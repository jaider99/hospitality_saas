import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Incident } from '../../constants/types';
import { sharedStyles as styles } from '../../styles/shared';

interface Props {
  incidents: Incident[];
  handleResolveIncident: (id: string) => void;
  handleDisputeIncident: (id: string) => void;
}

export default function IncidentsBoardScreen({
  incidents,
  handleResolveIncident,
  handleDisputeIncident,
}: Props) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.screenTitle}>Incidents Board</Text>
      
      {/* Columns list */}
      {(['open', 'disputed', 'resolved'] as const).map((col) => {
        const colIncidents = incidents.filter(i => i.status === col);
        return (
          <View key={col} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#151515', textTransform: 'uppercase', letterSpacing: 0.5 }}>{col}</Text>
              <View style={{ backgroundColor: '#e2e1dd', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ fontSize: 10, color: '#151515', fontWeight: '700' }}>{colIncidents.length}</Text>
              </View>
            </View>

            {!colIncidents.length ? (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: 20 }]}>
                <Text style={{ fontSize: 12, color: '#8c8c89', fontStyle: 'italic' }}>No incidents in {col}</Text>
              </View>
            ) : (
              colIncidents.map(inc => (
                <View key={inc.id} style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'DM Mono' }}>{inc.time}</Text>
                    <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>{inc.severity}</Text></View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#151515', lineHeight: 16 }}>{inc.message}</Text>
                  
                  {col === 'open' && (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                      <TouchableOpacity onPress={() => handleResolveIncident(inc.id)} style={[styles.primaryBtn, { flex: 1, paddingVertical: 6 }]}><Text style={[styles.primaryBtnText, { fontSize: 10 }]}>Resolve</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDisputeIncident(inc.id)} style={[styles.secondaryBtn, { paddingVertical: 6 }]}><Text style={[styles.secondaryBtnText, { fontSize: 10 }]}>Dispute</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}
