import { create } from 'zustand';
import { AppState, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { incidentStorage } from '../services/incidents/incidentStorage';
import { createIncidentRepository } from '../services/incidents/incidentRepository';
import { createIncidentSyncer } from '../services/incidents/incidentSync';
import {
  SYNC_STATUS,
  createIncidentRecord,
  isUnsent,
  locationFromCapture,
} from '../services/incidents/incidentModel';
import { apiClient } from '../services/apiClient';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { randomHex } from '../services/incidents/sessionSecrets';
import { useAuthStore } from './useAuthStore';
import { useContactsStore } from './useContactsStore';

/** A new SOS press within this window retries the unsent one instead of creating a second alert. */
const REUSE_UNSENT_WITHIN_MS = 30 * 60 * 1000;
const MIN_TIMER_MS = 1000;

function getAuth() {
  const { session, user } = useAuthStore.getState();
  return { required: isSupabaseConfigured(), signedIn: Boolean(session), userId: user?.id ?? null };
}

async function buildRequestExtras() {
  const extras = { standardPin: randomHex(32), duressPin: randomHex(32) };
  if (!isSupabaseConfigured()) {
    // Local development only: the server ignores client numbers when accounts are configured.
    const contacts = useContactsStore.getState().contacts;
    extras.contact1 = contacts[0]?.phone;
    extras.contact2 = contacts[1]?.phone;
  }
  return extras;
}

const repo = createIncidentRepository(incidentStorage);
const syncer = createIncidentSyncer({ repo, api: apiClient, getAuth, buildRequestExtras });

let initialized = false;
let timer = null;

export const useIncidentStore = create((set, get) => ({
  incidents: [],
  loaded: false,
  /** A live server session obtained by a background sync, waiting for the SOS screen to pick it up. Memory only. */
  pendingSession: null,

  init: () => {
    if (initialized) return;
    initialized = true;
    const kick = () => get().runDue();
    (async () => {
      await syncer.recoverInterrupted().catch(() => {});
      await get().refresh();
      await get().refreshServerStatuses();
      kick();
    })();
    AppState.addEventListener('change', (state) => {
      if (state === 'active') kick();
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', kick);
    }
    let signedIn = getAuth().signedIn;
    useAuthStore.subscribe((s) => {
      const now = Boolean(s.session);
      if (now && !signedIn) kick();
      signedIn = now;
    });
  },

  refresh: async () => {
    try {
      set({ incidents: await repo.list(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  /** Unsent incident by the current user that a new SOS press should retry rather than duplicate. */
  findReusableUnsent: async (nowMs = Date.now()) => {
    const { userId } = getAuth();
    const unsent = await repo.listUnsent();
    return (
      unsent.find(
        (r) =>
          r.userId === userId && r.statusReason !== 'ACCOUNT_MISMATCH' && nowMs - r.activatedAt <= REUSE_UNSENT_WITHIN_MS
      ) || null
    );
  },

  /** Persists the incident before any network call. Older unsent incidents are closed as superseded. */
  createIncident: async ({ contacts }) => {
    const { userId } = getAuth();
    for (const old of await repo.listUnsent()) {
      if (old.userId === userId) await syncer.closeIncident(old.id, { reason: 'SUPERSEDED' });
    }
    const record = createIncidentRecord({ id: Crypto.randomUUID(), userId, activatedAt: Date.now(), contacts });
    await repo.create(record);
    await get().refresh();
    return record;
  },

  setLocation: async (id, capture) => {
    await repo.update(id, (r) => (r.status === SYNC_STATUS.SERVER_RECEIVED ? null : { ...r, location: locationFromCapture(capture) }));
    await get().refresh();
  },

  /** Foreground sync for the SOS the user just pressed; the caller receives the live session directly. */
  sync: async (id) => {
    const result = await syncer.syncIncident(id);
    await get().refresh();
    get().schedule();
    return result;
  },

  runDue: async () => {
    let results = [];
    try {
      results = await syncer.syncDue();
    } catch {
      /* records are untouched on unexpected errors; the next trigger retries */
    }
    await get().refresh();
    const withSession = results.find((r) => r?.session);
    if (withSession) set({ pendingSession: { session: withSession.session, record: withSession.record } });
    get().schedule();
  },

  consumePendingSession: () => {
    const pending = get().pendingSession;
    set({ pendingSession: null });
    return pending;
  },

  /** One timer for the earliest retry; JS timers pause in the background, so this is foreground-only. */
  schedule: async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const due = await syncer.nextDueAt().catch(() => null);
    if (due == null) return;
    timer = setTimeout(() => get().runDue(), Math.max(MIN_TIMER_MS, due - Date.now()));
  },

  retry: async (id) => {
    const result = await syncer.syncIncident(id);
    await get().refresh();
    get().schedule();
    if (result?.session) set({ pendingSession: { session: result.session, record: result.record } });
    return result;
  },

  refreshDeliveries: async (id) => {
    const record = await syncer.refreshDeliveries(id);
    await get().refresh();
    return record;
  },

  refreshServerStatuses: async () => {
    const received = get().incidents.filter((r) => r.status === SYNC_STATUS.SERVER_RECEIVED).slice(0, 3);
    for (const r of received) await syncer.refreshDeliveries(r.id);
    await get().refresh();
  },

  close: async (id, reason) => {
    const result = await syncer.closeIncident(id, { reason });
    await get().refresh();
    return result;
  },

  recordDeviceSms: async (id, contacts, composerResult) => {
    await syncer.recordDeviceSms(id, contacts, composerResult);
    await get().refresh();
  },
}));

const FEATURE_RECEIVED_FOR_MS = 24 * 60 * 60 * 1000;

/** The incident to show on the home screen: newest unsent one, else a server-received one from the last day. */
export function selectFeaturedIncident(incidents, nowMs = Date.now()) {
  return (
    incidents.find(isUnsent) ||
    incidents.find((r) => r.status === SYNC_STATUS.SERVER_RECEIVED && nowMs - r.activatedAt < FEATURE_RECEIVED_FOR_MS) ||
    null
  );
}
