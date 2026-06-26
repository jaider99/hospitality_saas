import React from 'react';
import { View, Text } from 'react-native';
import { extractedProducts } from '../../constants/mockData';
import { sharedStyles as styles } from '../../styles/shared';

export default function ExtractedItemsScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.screenTitle}>Extracted Items</Text>
      <View style={styles.card}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#f1f0ec', paddingBottom: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#8c8c89' }}>Product Item</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#8c8c89' }}>Total Cost</Text>
        </View>
        {extractedProducts.map((p, idx) => (
          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < extractedProducts.length - 1 ? 1 : 0, borderBottomColor: '#fafaf8' }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515' }}>{p.item}</Text>
              <Text style={{ fontSize: 10, color: '#8c8c89', marginTop: 2, fontFamily: 'DM Mono' }}>Qty: {p.qty} · Price: {p.price}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono', alignSelf: 'center' }}>{p.total}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
