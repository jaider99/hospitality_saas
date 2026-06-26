import React from 'react';
import { ScrollView } from 'react-native';
import { useAuthStore } from '../store/auth';
import SettingsScreen from '../components/screens/SettingsScreen';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fafaf8', padding: 16 }} showsVerticalScrollIndicator={false}>
      <SettingsScreen
        user={user}
        logout={logout}
      />
    </ScrollView>
  );
}
