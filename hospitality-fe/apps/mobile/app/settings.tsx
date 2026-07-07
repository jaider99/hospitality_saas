import React from 'react';
import SettingsScreen from '../components/screens/SettingsScreen';
import MainScreenLayout from '../components/MainScreenLayout';

export default function SettingsPage() {
  return (
    <MainScreenLayout title="Settings">
      <SettingsScreen />
    </MainScreenLayout>
  );
}
