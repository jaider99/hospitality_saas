import React from 'react';
import CategoriesScreen from '../components/screens/CategoriesScreen';
import MainScreenLayout from '../components/MainScreenLayout';

export default function CategoriesPage() {
  return (
    <MainScreenLayout title="Categories">
      <CategoriesScreen />
    </MainScreenLayout>
  );
}
