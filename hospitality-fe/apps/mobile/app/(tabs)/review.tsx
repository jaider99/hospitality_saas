import React from 'react';
import { ScrollView } from 'react-native';
import { useLayoutStore } from '../../store/layout';
import ReviewCenterScreen from '../../components/screens/ReviewCenterScreen';

export default function ReviewTab() {
  const { incidents, handleResolveIncident, handleDisputeIncident } = useLayoutStore();
  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, marginTop: 12, marginBottom: 84 }} showsVerticalScrollIndicator={false}>
      <ReviewCenterScreen
        incidents={incidents}
        handleResolveIncident={handleResolveIncident}
        handleDisputeIncident={handleDisputeIncident}
      />
    </ScrollView>
  );
}
