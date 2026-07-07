import React from 'react';
import SuppliersScreen from '../components/screens/SuppliersScreen';
import MainScreenLayout from '../components/MainScreenLayout';

export default function SuppliersPage() {
  return (
    <MainScreenLayout title="Suppliers">
      <SuppliersScreen />
    </MainScreenLayout>
  );
}
