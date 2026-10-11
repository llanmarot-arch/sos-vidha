import { create } from 'zustand';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { setAccessTokenProvider } from '../services/apiClient';
import { clearContactsCache } from './useContactsStore';

function mapAuthError(error) {
  if (!error?.message) {
    return 'Authentication failed. Please try again.';
  }
  const msg = error.message;
  if (msg.includes('Invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Please verify your email before signing in.';
  }
  if (msg.includes('User already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  return msg;
}

export const useAuthStore = create((set, get) => ({
  initialized: false,
  loading: false,
  session: null,
  user: null,
  authError: null,
  authSuccess: null,
  authView: 'welcome',

  initialize: async () => {
    if (!isSupabaseConfigured()) {
      set({ initialized: true, session: null, user: null });
      return;
    }

    const supabase = getSupabase();
    setAccessTokenProvider(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    });

    const { data } = await supabase.auth.getSession();
    set({
      initialized: true,
      session: data.session,
      user: data.session?.user ?? null,
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        authError: null,
      });
      if (!session) {
        set({ authView: 'welcome' });
      }
    });
  },

  setAuthView: (authView) => set({ authView, authError: null, authSuccess: null }),

  clearAuthMessages: () => set({ authError: null, authSuccess: null }),

  signIn: async ({ email, password }) => {
    set({ loading: true, authError: null, authSuccess: null });
    const supabase = getSupabase();
    if (!supabase) {
      set({ loading: false, authError: 'Account system is not configured.' });
      return false;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    set({ loading: false });

    if (error) {
      set({ authError: mapAuthError(error) });
      return false;
    }

    set({ session: data.session, user: data.user, authSuccess: 'Signed in successfully.' });
    return true;
  },

  signUp: async ({ email, password, fullName }) => {
    set({ loading: true, authError: null, authSuccess: null });
    const supabase = getSupabase();
    if (!supabase) {
      set({ loading: false, authError: 'Account system is not configured.' });
      return false;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    set({ loading: false });

    if (error) {
      set({ authError: mapAuthError(error) });
      return false;
    }

    if (data.user && !data.session) {
      set({
        authSuccess: 'Account created. Check your email to verify your address, then sign in.',
        authView: 'signin',
      });
      return true;
    }

    set({ session: data.session, user: data.user, authSuccess: 'Account created.' });
    return true;
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    await clearContactsCache();
    set({ session: null, user: null, authView: 'welcome', authSuccess: null, authError: null });
  },

  resetPassword: async (email) => {
    set({ loading: true, authError: null, authSuccess: null });
    const supabase = getSupabase();
    if (!supabase) {
      set({ loading: false, authError: 'Account system is not configured.' });
      return false;
    }

    const redirectTo =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : {});
    set({ loading: false });

    if (error) {
      set({ authError: mapAuthError(error) });
      return false;
    }

    set({
      authSuccess: 'If an account exists for this email, a reset link has been sent.',
      authView: 'signin',
    });
    return true;
  },

  isSessionExpiredError: (message) =>
    Boolean(message && (message.includes('AUTH_EXPIRED') || message.includes('Authentication required'))),
}));
