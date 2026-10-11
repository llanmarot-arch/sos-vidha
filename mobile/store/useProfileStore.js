import { create } from 'zustand';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const useProfileStore = create((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  saveStatus: 'idle',

  loadProfile: async (userId) => {
    if (!isSupabaseConfigured() || !userId) {
      set({ profile: null, loading: false });
      return;
    }

    set({ loading: true, error: null });
    const supabase = getSupabase();
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

    if (error) {
      set({ loading: false, error: error.message, profile: null });
      return;
    }

    set({ loading: false, profile: data });
  },

  saveProfile: async (userId, patch) => {
    if (!userId) return false;
    set({ saveStatus: 'saving', error: null });
    const supabase = getSupabase();
    const payload = {
      id: userId,
      full_name: patch.full_name?.trim() || null,
      phone_e164: patch.phone_e164?.trim() || null,
      email: patch.email?.trim() || null,
    };

    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) {
      set({ saveStatus: 'error', error: error.message });
      return false;
    }

    set({ profile: data, saveStatus: 'success' });
    setTimeout(() => set({ saveStatus: 'idle' }), 1500);
    return true;
  },

  clear: () => set({ profile: null, loading: false, error: null, saveStatus: 'idle' }),
}));
