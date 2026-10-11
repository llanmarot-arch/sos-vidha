import { isValidIncidentId, isUnsent, SYNC_STATUS } from './incidentModel.js';

/**
 * Durable incident storage over an injected async key-value adapter ({ getItem, setItem, removeItem }).
 * Each record lives under its own key so one corrupt entry cannot take down the others; the index lists IDs.
 * Writes are serialized so a sync result and a user action cannot overwrite each other.
 */

export const INDEX_KEY = 'sosvidha.incidents.index';
const recordKey = (id) => `sosvidha.incident.${id}`;
const MAX_KEPT = 20;

export function createIncidentRepository(storage, { maxKept = MAX_KEPT } = {}) {
  let chain = Promise.resolve();
  const serialize = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  async function readIndex() {
    const raw = await storage.getItem(INDEX_KEY);
    if (!raw) return [];
    try {
      const ids = JSON.parse(raw);
      return Array.isArray(ids) ? ids.filter(isValidIncidentId) : [];
    } catch {
      return [];
    }
  }

  async function readRecord(id) {
    const raw = await storage.getItem(recordKey(id));
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      return record && record.id === id ? record : null;
    } catch {
      return null;
    }
  }

  async function writeRecord(record) {
    await storage.setItem(recordKey(record.id), JSON.stringify(record));
    const ids = await readIndex();
    if (!ids.includes(record.id)) {
      await storage.setItem(INDEX_KEY, JSON.stringify([...ids, record.id]));
    }
  }

  /** Drops the oldest closed or server-confirmed records beyond the cap. Unsent incidents are never removed. */
  async function prune() {
    const ids = await readIndex();
    if (ids.length <= maxKept) return;
    const records = (await Promise.all(ids.map(readRecord))).filter(Boolean);
    const removable = records
      .filter((r) => r.status === SYNC_STATUS.CLOSED || r.status === SYNC_STATUS.SERVER_RECEIVED)
      .sort((a, b) => a.activatedAt - b.activatedAt);
    const excess = ids.length - maxKept;
    const drop = new Set(removable.slice(0, excess).map((r) => r.id));
    if (!drop.size) return;
    await storage.setItem(INDEX_KEY, JSON.stringify(ids.filter((id) => !drop.has(id))));
    await Promise.all([...drop].map((id) => storage.removeItem(recordKey(id)).catch(() => {})));
  }

  return {
    create(record) {
      return serialize(async () => {
        if (!isValidIncidentId(record?.id)) throw new Error('Invalid incident ID');
        if (await readRecord(record.id)) throw new Error('Incident already exists');
        await writeRecord(record);
        await prune().catch(() => {});
        return record;
      });
    },

    get(id) {
      return isValidIncidentId(id) ? readRecord(id) : Promise.resolve(null);
    },

    /** Newest first. Unreadable entries are skipped rather than failing the whole list. */
    async list() {
      const ids = await readIndex();
      const records = (await Promise.all(ids.map((id) => readRecord(id).catch(() => null)))).filter(Boolean);
      return records.sort((a, b) => b.activatedAt - a.activatedAt);
    },

    async listUnsent() {
      return (await this.list()).filter(isUnsent);
    },

    /** Applies `mutate(record)` to the latest stored copy. Returns the saved record, or null if it is gone. */
    update(id, mutate, { now = Date.now } = {}) {
      return serialize(async () => {
        const current = await readRecord(id);
        if (!current) return null;
        const next = mutate({ ...current, sync: { ...current.sync } });
        if (!next) return current;
        const saved = { ...next, id: current.id, updatedAt: now() };
        await writeRecord(saved);
        return saved;
      });
    },
  };
}

/** In-memory adapter for tests; `createMemoryStorage(old.snapshot())` simulates an app restart. */
export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async setItem(key, value) {
      data.set(key, String(value));
    },
    async removeItem(key) {
      data.delete(key);
    },
    snapshot() {
      return Object.fromEntries(data);
    },
  };
}
