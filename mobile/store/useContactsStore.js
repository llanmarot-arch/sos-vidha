import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sosvidha/web_contacts';

const SEED_CONTACTS = [
  { id: 'seed-1', name: 'Priya Sharma', phone: '+919876543210', relationship: 'Sister' },
  { id: 'seed-2', name: 'Rahul Mehta', phone: '+919123456789', relationship: 'Friend' },
];

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export function validatePhone(phone) {
  return PHONE_REGEX.test(String(phone).trim());
}

export const useContactsStore = create((set, get) => ({
  contacts: [],
  loading: true,
  error: null,
  saveStatus: 'idle',

  loadContacts: async () => {
    set({ loading: true, error: null });
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ contacts: JSON.parse(raw), loading: false });
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CONTACTS));
        set({ contacts: SEED_CONTACTS, loading: false });
      }
    } catch (err) {
      set({ contacts: SEED_CONTACTS, loading: false, error: err.message });
    }
  },

  persist: async (contacts) => {
    set({ saveStatus: 'saving' });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
      set({ contacts, saveStatus: 'success' });
      setTimeout(() => set({ saveStatus: 'idle' }), 1500);
    } catch (err) {
      set({ saveStatus: 'error', error: err.message });
    }
  },

  addContact: async (contact) => {
    if (!validatePhone(contact.phone)) {
      set({ error: 'Invalid phone number (E.164 format required)' });
      return false;
    }
    const next = [...get().contacts, { ...contact, id: `c-${Date.now()}` }];
    await get().persist(next);
    return true;
  },

  updateContact: async (id, patch) => {
    if (patch.phone && !validatePhone(patch.phone)) {
      set({ error: 'Invalid phone number (E.164 format required)' });
      return false;
    }
    const next = get().contacts.map((c) => (c.id === id ? { ...c, ...patch } : c));
    await get().persist(next);
    return true;
  },

  deleteContact: async (id) => {
    const next = get().contacts.filter((c) => c.id !== id);
    await get().persist(next);
    return true;
  },

  clearError: () => set({ error: null }),
}));
