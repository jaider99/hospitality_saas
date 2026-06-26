import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { staff } from '../../constants/mockData';
import { sharedStyles as styles } from '../../styles/shared';

export default function StaffLaborScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.screenTitle}>Staff & Labor</Text>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Active Staff</Text>
          <Text style={styles.statValue}>3 Clocked-in</Text>
        </View>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Labor Cost Today</Text>
          <Text style={styles.statValue}>€224.25</Text>
        </View>
      </View>

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item: s, index: idx }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: idx < staff.length - 1 ? 1 : 0, borderBottomColor: '#f1f0ec' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: s.status === 'clocked-in' ? '#1f8f5c' : '#8c8c89'
              }} />
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>{s.name}</Text>
                <Text style={{ fontSize: 10, color: '#8c8c89', marginTop: 2, fontFamily: 'Sora' }}>{s.role} · €{s.rate.toFixed(2)}/hr</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>
                {s.status === 'clocked-in' ? `${s.hours} hrs` : 'Clocked Out'}
              </Text>
            </View>
          </View>
        )}
        style={styles.card}
      />
    </View>
  );
}
