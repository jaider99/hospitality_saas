import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Incident } from '../../constants/types';
import { sharedStyles as styles } from '../../styles/shared';

interface Props {
  incidents: Incident[];
  handleResolveIncident: (id: string) => void;
  handleDisputeIncident: (id: string) => void;
}

export default function ReviewCenterScreen({
  incidents,
  handleResolveIncident,
  handleDisputeIncident,
}: Props) {
  const activeAlerts = incidents.filter(i => i.status === 'open' || i.status === 'disputed');

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.screenTitle}>Review Center</Text>
      
      {!activeAlerts.length ? (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
          <Text style={{ fontSize: 13, color: '#8c8c89', fontStyle: 'italic' }}>All alerts cleared!</Text>
        </View>
      ) : (
        activeAlerts.map(inc => (
          <View key={inc.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>{inc.severity}</Text></View>
              <Text style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'DM Mono' }}>{inc.time}</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#151515', lineHeight: 18, marginBottom: 12 }}>{inc.message}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => handleResolveIncident(inc.id)} style={[styles.primaryBtn, { flex: 1 }]}><Text style={styles.primaryBtnText}>Verify</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDisputeIncident(inc.id)} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Dispute</Text></TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
