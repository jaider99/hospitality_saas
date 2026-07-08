// Polyfill for Hermes Reflect.construct.apply missing method
if (typeof Reflect !== 'undefined' && !(Reflect.construct as any).apply) {
  (Reflect.construct as any).apply = function (self: any, args: any) {
    return (Reflect.construct as any)(...args);
  };
}

import React, { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../store/auth';

export default function RootLayout() {
  const { accessToken, isInitializing, loadSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadSession();
  }, []);

  useEffect(() => {
    if (!mounted || isInitializing) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const inLogin = segments[0] === 'login';

    if (!accessToken && !inLogin) {
      router.replace('/login');
    } else if (accessToken && (inLogin || !segments[0])) {
      router.replace('/(tabs)/dashboard');
    }
  }, [accessToken, segments, mounted, isInitializing]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafaf8' }}>
        <ActivityIndicator size="large" color="#1f8f5c" />
      </View>
    );
  }

  return <Slot />;
}
