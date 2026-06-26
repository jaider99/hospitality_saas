import React from 'react';
import { ScrollView } from 'react-native';
import ExtractedItemsScreen from '../components/screens/ExtractedItemsScreen';

export default function ProductsPage() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fafaf8', padding: 16 }} showsVerticalScrollIndicator={false}>
      <ExtractedItemsScreen />
    </ScrollView>
  );
}
