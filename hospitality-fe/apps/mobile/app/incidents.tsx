import React from 'react';
import { ScrollView } from 'react-native';
import { useLayoutStore } from '../store/layout';
import IncidentsBoardScreen from '../components/screens/IncidentsBoardScreen';

export default function IncidentsPage() {
  const { incidents, handleResolveIncident, handleDisputeIncident } = useLayoutStore();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fafaf8', padding: 16 }} showsVerticalScrollIndicator={false}>
      <IncidentsBoardScreen
        incidents={incidents}
        handleResolveIncident={handleResolveIncident}
        handleDisputeIncident={handleDisputeIncident}
      />
    </ScrollView>
  );
}
