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

export const useAuthStore = create<AuthState>((set, get) => {
  const store = {
    user: null,
    accessToken: null,

    setAuth: (user: UserSummary, token: string) => set({ user, accessToken: token }),

    setToken: (token: string) => set({ accessToken: token }),

    clearAuth: () => set({ user: null, accessToken: null }),
  };

  // Wire up the axios interceptors once the store exists
  injectAuthHooks(
    () => get().accessToken,
    (t) => set({ accessToken: t }),
    () => set({ user: null, accessToken: null }),
    (u) => set({ user: u as UserSummary }),
  );

  return store;
});
