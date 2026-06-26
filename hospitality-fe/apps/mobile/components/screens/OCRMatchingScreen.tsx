import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { InvoiceLine } from '../../constants/types';
import { sharedStyles as styles } from '../../styles/shared';

interface Props {
  invoiceLines: InvoiceLine[];
  setInvoiceLines: React.Dispatch<React.SetStateAction<InvoiceLine[]>>;
}

export default function OCRMatchingScreen({ invoiceLines, setInvoiceLines }: Props) {
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

            {/* Catalog item matcher */}
            <View style={{ backgroundColor: '#f5f4f1', borderWidth: 1, borderColor: '#e2e1dd', padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 10, color: '#8c8c89', textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 }}>Catalog Match</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: line.matchedProduct ? '#151515' : '#b23a3a' }}>
                {line.matchedProduct || 'Unassigned — Tap to map'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setInvoiceLines(prev => prev.map(l => l.id === line.id ? { ...l, status: 'confirmed' } : l));
                  Alert.alert('Confirmed', 'Product match confirmed.');
                }}
                style={[styles.primaryBtn, { flex: 1, paddingVertical: 8 }]}
              >
                <Text style={styles.primaryBtnText}>Confirm Match</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setInvoiceLines(prev => prev.map(l => l.id === line.id ? { ...l, status: 'flagged' } : l));
                  Alert.alert('Flagged', 'Product match flagged for review.');
                }}
                style={[styles.secondaryBtn, { paddingVertical: 8 }]}
              >
                <X size={12} color="#b23a3a" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
