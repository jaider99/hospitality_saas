import { create } from 'zustand';
import { User, AuthResponse } from '@hospitality-saas/shared-types';
import { ApiClient } from '@hospitality-saas/api-client';
import { STORAGE_KEYS } from '@hospitality-saas/constants';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  apiClient: ApiClient;
  login: (authData: AuthResponse) => void;
  logout: () => void;
}

const getStoredToken = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
};

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(STORAGE_KEYS.USER_DATA);
  return user ? JSON.parse(user) : null;
};

export const useAuthStore = create<AuthState>((set, get) => {
  const setToken = (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    }
    set({ accessToken: token });
  };

  const logoutAction = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
    set({ user: null, accessToken: null, refreshToken: null });
  };

  const client = new ApiClient(
    () => get().accessToken,
    setToken,
    () => get().refreshToken,
    logoutAction
  );

  return {
    user: getStoredUser(),
    accessToken: getStoredToken(STORAGE_KEYS.ACCESS_TOKEN),
    refreshToken: getStoredToken(STORAGE_KEYS.REFRESH_TOKEN),
    apiClient: client,
    login: (authData) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authData.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authData.refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(authData.user));
      }
      set({
        user: authData.user,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });
    },
    logout: logoutAction,
  };
});
export const getApiClient = () => useAuthStore.getState().apiClient;
