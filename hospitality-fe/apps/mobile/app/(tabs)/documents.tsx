import React from 'react';
import { View } from 'react-native';
import DocumentsScreen from '../../components/screens/DocumentsScreen';

export default function DocumentsTab() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, marginTop: 12, marginBottom: 84 }}>
      <DocumentsScreen />
    </View>
  );
}
