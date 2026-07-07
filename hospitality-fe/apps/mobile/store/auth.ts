import { create } from 'zustand';
import { User, AuthResponse } from '@hospitality-saas/shared-types';
import { ApiClient } from '@hospitality-saas/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  apiClient: ApiClient;
  isInitializing: boolean;
  login: (authData: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const logoutAction = async () => {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    } catch (e) {
      console.error('Error clearing session from AsyncStorage', e);
    }
    set({ user: null, accessToken: null, refreshToken: null });
  };

  const client = new ApiClient(
    () => get().accessToken,
    (token) => {
      set({ accessToken: token });
      AsyncStorage.setItem('accessToken', token || '').catch(e => console.error(e));
    },
    () => get().refreshToken,
    () => {
      logoutAction().catch(e => console.error(e));
    },
    Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://127.0.0.1:8000/api/v1'
  );

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    apiClient: client,
    isInitializing: true,
    login: async (authData) => {
      try {
        await AsyncStorage.multiSet([
          ['accessToken', authData.accessToken || ''],
          ['refreshToken', authData.refreshToken || ''],
          ['user', JSON.stringify(authData.user || null)]
        ]);
      } catch (e) {
        console.error('Error saving session to AsyncStorage', e);
      }
      set({
        user: authData.user,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      });
    },
    logout: logoutAction,
    loadSession: async () => {
      try {
        const keys = ['accessToken', 'refreshToken', 'user'];
        const stores = await AsyncStorage.multiGet(keys);
        const storeMap = Object.fromEntries(stores);
        
        const accessToken = storeMap.accessToken;
        const refreshToken = storeMap.refreshToken;
        const userStr = storeMap.user;
        const user = userStr ? JSON.parse(userStr) : null;

        if (accessToken && refreshToken) {
          set({ accessToken, refreshToken, user, isInitializing: false });
        } else {
          set({ isInitializing: false });
        }
      } catch (e) {
        console.error('Error loading session from AsyncStorage', e);
        set({ isInitializing: false });
      }
    }
  };
});

