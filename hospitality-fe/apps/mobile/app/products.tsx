import React from 'react';
import ProductsScreen from '../components/screens/ProductsScreen';
import MainScreenLayout from '../components/MainScreenLayout';

export default function ProductsPage() {
  return (
    <MainScreenLayout title="Products Catalog">
      <ProductsScreen />
    </MainScreenLayout>
  );
}
