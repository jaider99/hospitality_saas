import React from 'react';
import { ScrollView } from 'react-native';
import { useLayoutStore } from '../../store/layout';
import DashboardOverview from '../../components/screens/DashboardOverview';

export default function DashboardTab() {
  const { incidents, handleResolveIncident, handleDisputeIncident } = useLayoutStore();
  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, marginTop: 12, marginBottom: 84 }} showsVerticalScrollIndicator={false}>
      <DashboardOverview
        incidents={incidents}
        handleResolveIncident={handleResolveIncident}
        handleDisputeIncident={handleDisputeIncident}
      />
    </ScrollView>
  );
}
