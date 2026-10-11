import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { isDevMockEnabled } from '../services/apiClient';
import { incidentStorage } from '../services/incidents/incidentStorage';

const LEGACY_STORAGE_KEY = '@sosvidha/web_contacts';
export const CONTACTS_CACHE_KEY = 'sosvidha.contacts.cache';

/** Last contacts confirmed by Supabase, for offline SOS and the device SMS fallback. Bound to one user. */
async function writeContactsCache(userId, contacts) {
  if (!userId) return;
  try {
    await incidentStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify({ userId, savedAt: Date.now(), contacts }));
  } catch {
    /* the live list still works; only the offline copy is missing */
  }
}

async function readContactsCache(userId) {
  try {
    const raw = await incidentStorage.getItem(CONTACTS_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : null;
    return cache && cache.userId === userId && Array.isArray(cache.contacts) ? cache : null;
  } catch {
    return null;
  }
}

export async function clearContactsCache() {
  await incidentStorage.removeItem(CONTACTS_CACHE_KEY).catch(() => {});
}

const DEV_SEED_CONTACTS = [
  { id: 'seed-1', name: 'Priya Sharma', phone: '+919876543210', relationship: 'Sister' },
  { id: 'seed-2', name: 'Rahul Mehta', phone: '+919123456789', relationship: 'Friend' },
];

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export function validatePhone(phone) {
  return PHONE_REGEX.test(String(phone).trim());
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone_e164,
    relationship: row.relationship || 'GUARDIAN',
  };
}

export const useContactsStore = create((set, get) => ({
  contacts: [],
  loading: true,
  error: null,
  saveStatus: 'idle',
  requiresAuth: false,
  /** Set when the list shown is the offline copy because Supabase could not be reached. */
  cachedAt: null,

  loadContacts: async (userId) => {
    set({ loading: true, error: null, requiresAuth: false, cachedAt: null });

    if (isSupabaseConfigured()) {
      if (!userId) {
        set({ contacts: [], loading: false, requiresAuth: true });
        return;
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('id, name, phone_e164, relationship')
        .order('created_at', { ascending: true });

      if (error) {
        const cache = await readContactsCache(userId);
        if (cache) {
          set({ contacts: cache.contacts, cachedAt: cache.savedAt, loading: false, error: null });
          return;
        }
        set({ contacts: [], loading: false, error: error.message });
        return;
      }

      const contacts = (data || []).map(mapRow);
      set({ contacts, loading: false });
      writeContactsCache(userId, contacts);
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        set({ contacts: JSON.parse(raw), loading: false });
        return;
      }
      if (isDevMockEnabled()) {
        await AsyncStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(DEV_SEED_CONTACTS));
        set({ contacts: DEV_SEED_CONTACTS, loading: false });
        return;
      }
      set({ contacts: [], loading: false });
    } catch (err) {
      set({ contacts: [], loading: false, error: err.message });
    }
  },

  persistLegacy: async (contacts) => {
    set({ saveStatus: 'saving' });
    try {
      await AsyncStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(contacts));
      set({ contacts, saveStatus: 'success' });
      setTimeout(() => set({ saveStatus: 'idle' }), 1500);
    } catch (err) {
      set({ saveStatus: 'error', error: err.message });
    }
  },

  addContact: async (contact, userId) => {
    if (!validatePhone(contact.phone)) {
      set({ error: 'Invalid phone number (E.164 format required)' });
      return false;
    }

    if (isSupabaseConfigured()) {
      if (!userId) {
        set({ error: 'Sign in to manage guardians.' });
        return false;
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({
          user_id: userId,
          name: contact.name.trim(),
          phone_e164: contact.phone.trim(),
          relationship: contact.relationship?.trim() || 'GUARDIAN',
        })
        .select()
        .single();

      if (error) {
        set({ error: error.message });
        return false;
      }
      set({ contacts: [...get().contacts, mapRow(data)], saveStatus: 'success' });
      writeContactsCache(userId, get().contacts);
      setTimeout(() => set({ saveStatus: 'idle' }), 1500);
      return true;
    }

    const next = [...get().contacts, { ...contact, id: `c-${Date.now()}` }];
    await get().persistLegacy(next);
    return true;
  },

  updateContact: async (id, patch, userId) => {
    if (patch.phone && !validatePhone(patch.phone)) {
      set({ error: 'Invalid phone number (E.164 format required)' });
      return false;
    }

    if (isSupabaseConfigured()) {
      if (!userId) {
        set({ error: 'Sign in to manage guardians.' });
        return false;
      }
      const supabase = getSupabase();
      const payload = {};
      if (patch.name) payload.name = patch.name.trim();
      if (patch.phone) payload.phone_e164 = patch.phone.trim();
      if (patch.relationship) payload.relationship = patch.relationship.trim();

      const { data, error } = await supabase
        .from('emergency_contacts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        set({ error: error.message });
        return false;
      }

      const next = get().contacts.map((c) => (c.id === id ? mapRow(data) : c));
      set({ contacts: next, saveStatus: 'success' });
      writeContactsCache(userId, next);
      setTimeout(() => set({ saveStatus: 'idle' }), 1500);
      return true;
    }

    const next = get().contacts.map((c) => (c.id === id ? { ...c, ...patch } : c));
    await get().persistLegacy(next);
    return true;
  },

  deleteContact: async (id, userId) => {
    if (isSupabaseConfigured()) {
      if (!userId) {
        set({ error: 'Sign in to manage guardians.' });
        return false;
      }
      const supabase = getSupabase();
      const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);
      if (error) {
        set({ error: error.message });
        return false;
      }
      const next = get().contacts.filter((c) => c.id !== id);
      set({ contacts: next, saveStatus: 'success' });
      writeContactsCache(userId, next);
      setTimeout(() => set({ saveStatus: 'idle' }), 1500);
      return true;
    }

    const next = get().contacts.filter((c) => c.id !== id);
    await get().persistLegacy(next);
    return true;
  },

  clearError: () => set({ error: null }),
  reset: () => set({ contacts: [], loading: false, error: null, saveStatus: 'idle', requiresAuth: false, cachedAt: null }),
}));
