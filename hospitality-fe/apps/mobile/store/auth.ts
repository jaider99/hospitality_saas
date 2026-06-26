import { create } from 'zustand';
import { User, AuthResponse } from '@hospitality-saas/shared-types';
import { ApiClient } from '@hospitality-saas/api-client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  apiClient: ApiClient;
  login: (authData: AuthResponse) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const logoutAction = () => {
    set({ user: null, accessToken: null, refreshToken: null });
  };

  const client = new ApiClient(
    () => get().accessToken,
    (token) => set({ accessToken: token }),
    () => get().refreshToken,
    logoutAction
  );

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    apiClient: client,
    login: (authData) => {
      set({
        user: authData.user,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });
    },
    logout: logoutAction,
  };
});
