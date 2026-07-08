import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { AlertTriangle, X, Search, Check } from 'lucide-react-native';
import { InvoiceLine } from '../../constants/types';
import { sharedStyles as styles } from '../../styles/shared';

const catalogProducts = [
  'GIN XORIGUER 70cl',
  'Gin Bombay Sapphire 1L',
  'Gin Hendricks 70cl',
  'Limon (Lemon) 1kg',
  'Naranja (Orange) 1kg',
  'Limoncello Rossi',
  'Limoncello Pallini 70cl',
  'Olive Oil Arbequina 5L',
  'Olive Oil Virgen 1L',
  'Rucula Baby 100g',
  'Rucula Fresca 200g',
  'Campari 1L'
];

interface Props {
  invoiceLines: InvoiceLine[];
  setInvoiceLines: React.Dispatch<React.SetStateAction<InvoiceLine[]>>;
}

export default function OCRMatchingScreen({ invoiceLines, setInvoiceLines }: Props) {
  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenPicker = (lineId: number) => {
    setActiveLineId(lineId);
    setSearchQuery('');
  };

  const handleSelectProduct = (product: string) => {
    if (activeLineId !== null) {
      setInvoiceLines(prev =>
        prev.map(l =>
          l.id === activeLineId
            ? { ...l, matchedProduct: product, status: 'review' }
            : l
        )
      );
      setActiveLineId(null);
    }
  };

  const filteredCatalog = catalogProducts.filter(p =>
    p.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={styles.screenTitle}>OCR Catalog Match</Text>
        <Text style={{ fontSize: 12, color: '#8c8c89', fontFamily: 'Sora', marginTop: 2 }}>Invoice #5865 · Vendo lo que tengo S.L.</Text>
      </View>

      <View style={{ backgroundColor: '#fceaea', borderColor: '#ffb4ab', borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
        <AlertTriangle size={16} color="#b23a3a" style={{ marginRight: 8, marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#7a2828', fontSize: 13, fontWeight: '700', fontFamily: 'Sora' }}>Duplicate detected</Text>
          <Text style={{ color: '#7a2828', fontSize: 12, fontFamily: 'Sora', marginTop: 2 }}>This document matches Invoice #5865 previously uploaded.</Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        {invoiceLines.map((line) => (
          <View key={line.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>{line.rawText}</Text>
              <View style={{
                backgroundColor: line.confidence >= 85 ? '#e6f4ec' : '#fbf1dd',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10
              }}>
                <Text style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: line.confidence >= 85 ? '#1f8f5c' : '#b07a1a'
                }}>{line.confidence}% Match</Text>
              </View>
            </View>

            <Text style={{ fontSize: 11, color: '#8c8c89', fontFamily: 'DM Mono', marginBottom: 12 }}>
              Qty: {line.qty} · Price: {line.unitPrice} · Total: {line.total}
            </Text>

            {/* Catalog item matcher (Touchable to map) */}
            <TouchableOpacity 
              onPress={() => handleOpenPicker(line.id)}
              style={{ backgroundColor: '#f5f4f1', borderWidth: 1, borderColor: '#e2e1dd', padding: 10, borderRadius: 8, marginBottom: 8 }}
            >
              <Text style={{ fontSize: 10, color: '#8c8c89', textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 }}>Catalog Match</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: line.matchedProduct ? '#151515' : '#b23a3a' }}>
                {line.matchedProduct || 'Unassigned — Tap to map'}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setInvoiceLines(prev => prev.map(l => l.id === line.id ? { ...l, status: 'confirmed' } : l));
                  Alert.alert('Confirmed', 'Product match confirmed.');
                }}
                style={[
                  styles.primaryBtn, 
                  { 
                    flex: 1, 
                    paddingVertical: 8, 
                    backgroundColor: line.status === 'confirmed' ? '#e6f4ec' : '#151515',
                    borderColor: line.status === 'confirmed' ? '#9feacf' : '#151515'
                  }
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: line.status === 'confirmed' ? '#1f8f5c' : '#ffffff' }]}>
                  {line.status === 'confirmed' ? 'Confirmed' : 'Confirm Match'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setInvoiceLines(prev => prev.map(l => l.id === line.id ? { ...l, status: 'flagged' } : l));
                  Alert.alert('Flagged', 'Product match flagged for review.');
                }}
                style={[
                  styles.secondaryBtn, 
                  { 
                    paddingVertical: 8,
                    backgroundColor: line.status === 'flagged' ? '#fceaea' : '#ffffff',
                    borderColor: line.status === 'flagged' ? '#ffb4ab' : '#e2e1dd'
                  }
                ]}
              >
                <X size={12} color={line.status === 'flagged' ? '#b23a3a' : '#8c8c89'} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Catalog Search & Selection Modal */}
      <Modal visible={activeLineId !== null} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(21, 21, 21, 0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            height: '60%'
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Select Catalog Product</Text>
              <TouchableOpacity onPress={() => setActiveLineId(null)}>
                <X size={20} color="#151515" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fafaf8',
              borderWidth: 1,
              borderColor: '#e2e1dd',
              borderRadius: 10,
              paddingHorizontal: 12,
              height: 40,
              marginBottom: 14
            }}>
              <Search size={16} color="#8c8c89" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search catalog products..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#8c8c89"
                style={{ flex: 1, fontSize: 13, color: '#151515', fontFamily: 'Sora', height: '100%', padding: 0 }}
              />
            </View>

            {/* Catalog List */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {filteredCatalog.map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => handleSelectProduct(p)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f1f0ec'
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#151515', fontFamily: 'Sora' }}>{p}</Text>
                  <Check size={14} color="#1f8f5c" style={{ opacity: invoiceLines.find(l => l.id === activeLineId)?.matchedProduct === p ? 1 : 0 }} />
                </TouchableOpacity>
              ))}
              {filteredCatalog.length === 0 && (
                <Text style={{ fontSize: 12, color: '#8c8c89', fontFamily: 'Sora', textAlign: 'center', marginTop: 20 }}>No products found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
