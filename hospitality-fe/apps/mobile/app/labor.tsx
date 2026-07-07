import React from 'react';
import StaffLaborScreen from '../components/screens/StaffLaborScreen';
import MainScreenLayout from '../components/MainScreenLayout';

export default function LaborPage() {
  return (
    <MainScreenLayout title="Staff & Labor">
      <StaffLaborScreen />
    </MainScreenLayout>
  );
}
