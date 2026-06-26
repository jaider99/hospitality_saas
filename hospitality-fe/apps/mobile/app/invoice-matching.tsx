import React from 'react';
import { ScrollView } from 'react-native';
import { useLayoutStore } from '../store/layout';
import OCRMatchingScreen from '../components/screens/OCRMatchingScreen';

export default function InvoiceMatchingPage() {
  const { invoiceLines, setInvoiceLines } = useLayoutStore();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fafaf8', padding: 16 }} showsVerticalScrollIndicator={false}>
      <OCRMatchingScreen
        invoiceLines={invoiceLines}
        setInvoiceLines={setInvoiceLines}
      />
    </ScrollView>
  );
}
