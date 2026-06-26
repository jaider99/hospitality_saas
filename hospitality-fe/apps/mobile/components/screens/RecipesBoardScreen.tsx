import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { recipesList } from '../../constants/mockData';
import { sharedStyles as styles } from '../../styles/shared';

export default function RecipesBoardScreen() {
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.screenTitle}>Recipes Costing</Text>
      {recipesList.map((r, i) => (
        <TouchableOpacity key={i} onPress={() => setSelectedRecipe(selectedRecipe === r.name ? null : r.name)}
          style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#151515' }}>{r.name}</Text>
            <View style={{
              backgroundColor: r.status === 'critical' ? '#fceaea' : r.status === 'warning' ? '#fbf1dd' : '#e6f4ec',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 10
            }}>
              <Text style={{
                fontSize: 9,
                fontWeight: '700',
                color: r.status === 'critical' ? '#b23a3a' : r.status === 'warning' ? '#b07a1a' : '#1f8f5c'
              }}>{r.status === 'critical' ? 'Alert' : r.status === 'warning' ? 'Warning' : 'Stable'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f0ec', paddingTop: 8 }}>
            <View><Text style={{ fontSize: 9, color: '#8c8c89' }}>Sale Price</Text><Text style={{ fontSize: 12, fontWeight: '600', color: '#151515', fontFamily: 'DM Mono' }}>€{r.sale.toFixed(2)}</Text></View>
            <View><Text style={{ fontSize: 9, color: '#8c8c89' }}>Portion Cost</Text><Text style={{ fontSize: 12, fontWeight: '600', color: '#151515', fontFamily: 'DM Mono' }}>€{r.portionCost.toFixed(2)}</Text></View>
            <View><Text style={{ fontSize: 9, color: '#8c8c89' }}>Margin</Text><Text style={{ fontSize: 12, fontWeight: '600', color: '#1f8f5c', fontFamily: 'DM Mono' }}>{(100 - r.costPct).toFixed(1)}%</Text></View>
          </View>
          {selectedRecipe === r.name && (
            <View style={{ marginTop: 12, backgroundColor: '#fafaf8', borderWidth: 1, borderColor: '#e2e1dd', padding: 12, borderRadius: 8, gap: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#8c8c89', textTransform: 'uppercase' }}>Ingredient Breakdown</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 12, color: '#151515' }}>Primary Spirits</Text><Text style={{ fontSize: 12, fontWeight: '600', color: '#151515', fontFamily: 'DM Mono' }}>€1.80</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 12, color: '#151515' }}>Mixer / Juices</Text><Text style={{ fontSize: 12, fontWeight: '600', color: '#151515', fontFamily: 'DM Mono' }}>€0.84</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 12, color: '#151515' }}>Garnish & Ice</Text><Text style={{ fontSize: 12, fontWeight: '600', color: '#151515', fontFamily: 'DM Mono' }}>€0.58</Text></View>
              <View style={{ borderTopWidth: 1, borderTopColor: '#e2e1dd', paddingTop: 6, marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: '#8c8c89' }}>Supplier</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#151515' }}>{r.supplier}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
