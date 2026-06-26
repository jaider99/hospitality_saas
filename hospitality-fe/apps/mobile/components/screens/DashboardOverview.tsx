import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Incident } from '../../constants/types';
import { sharedStyles as styles } from '../../styles/shared';

interface Props {
  incidents: Incident[];
  handleResolveIncident: (id: string) => void;
  handleDisputeIncident: (id: string) => void;
}

export default function DashboardOverview({
  incidents,
  handleResolveIncident,
  handleDisputeIncident,
}: Props) {
  const activeIncidentsCount = incidents.filter(i => i.status === 'open').length;

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Spend</Text>
          <Text style={styles.statValue}>€14,823</Text>
          <Text style={[styles.statDiff, { color: '#1f8f5c' }]}>+4.2% MoM</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Gross Margin</Text>
          <Text style={styles.statValue}>68.2%</Text>
          <Text style={[styles.statDiff, { color: '#b23a3a' }]}>-3.8% vs Target</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Labor Ratio</Text>
          <Text style={styles.statValue}>31.4%</Text>
          <Text style={[styles.statDiff, { color: '#b07a1a' }]}>30.0% Threshold</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Incidents</Text>
          <Text style={styles.statValue}>{activeIncidentsCount}</Text>
          <Text style={[styles.statDiff, { color: '#b23a3a' }]}>Critical Active</Text>
        </View>
      </View>

      {/* Spend chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly Supplier Spend</Text>
        <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 12 }}>
          {[75, 90, 65, 110, 85, 125].map((val, i) => (
            <View key={i} style={{ alignItems: 'center', width: '13%' }}>
              <View style={{ backgroundColor: '#e6f4ec', width: '100%', height: val, borderRadius: 6, justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: '#1f8f5c', height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
              </View>
              <Text style={{ fontSize: 9, color: '#8c8c89', marginTop: 6, fontFamily: 'DM Mono' }}>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Spoilage / Incident Quick list */}
      <View style={{ gap: 8 }}>
        <Text style={styles.sectionHeader}>Active Exceptions</Text>
        {incidents.filter(i => i.status === 'open').slice(0, 2).map(inc => (
          <View key={inc.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>{inc.severity}</Text></View>
              <Text style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'DM Mono' }}>{inc.time}</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#151515', lineHeight: 18, marginBottom: 12 }}>{inc.message}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => handleResolveIncident(inc.id)} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Resolve</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDisputeIncident(inc.id)} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Dispute</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
