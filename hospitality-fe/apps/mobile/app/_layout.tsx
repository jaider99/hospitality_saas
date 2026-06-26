import React, { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/auth';

export default function RootLayout() {
  const { accessToken } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const inLogin = segments[0] === 'login';

    if (!accessToken && !inLogin) {
      router.replace('/login');
    } else if (accessToken && (inLogin || !segments[0])) {
      router.replace('/(tabs)/dashboard');
    }
  }, [accessToken, segments, mounted]);

  return <Slot />;
}
