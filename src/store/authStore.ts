import { create } from 'zustand';
import { injectAuthHooks } from '../lib/api';
import type { UserSummary } from '../types/api';

interface AuthState {
  user: UserSummary | null;
  accessToken: string | null;
  setAuth: (user: UserSummary, token: string) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
}

const SESSION_KEY = 'sq_auth';

function loadSession(): { user: UserSummary | null; accessToken: string | null } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { user: null, accessToken: null };
    return JSON.parse(raw);
  } catch {
    return { user: null, accessToken: null };
  }
}

function saveSession(user: UserSummary | null, accessToken: string | null) {
  if (user && accessToken) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, accessToken }));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const initial = loadSession();

  injectAuthHooks(
    () => get().accessToken,
    (t) => {
      saveSession(get().user, t);
      set({ accessToken: t });
    },
    () => {
      saveSession(null, null);
      set({ user: null, accessToken: null });
    },
    (u) => {
      saveSession(u as UserSummary, get().accessToken);
      set({ user: u as UserSummary });
    },
  );

  return {
    user: initial.user,
    accessToken: initial.accessToken,

    setAuth: (user: UserSummary, token: string) => {
      saveSession(user, token);
      set({ user, accessToken: token });
    },

    setToken: (token: string) => {
      saveSession(get().user, token);
      set({ accessToken: token });
    },

    clearAuth: () => {
      saveSession(null, null);
      set({ user: null, accessToken: null });
    },
  };
});
