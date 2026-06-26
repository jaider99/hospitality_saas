import React from 'react';
import { View } from 'react-native';
import StaffLaborScreen from '../components/screens/StaffLaborScreen';

export default function LaborPage() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fafaf8', padding: 16 }}>
      <StaffLaborScreen />
    </View>
  );
}
