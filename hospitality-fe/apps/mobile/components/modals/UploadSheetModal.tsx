import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Receipt, Upload, Pencil, ArrowLeft } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLayoutStore } from '../../store/layout';
import { useAuthStore } from '../../store/auth';

interface Props {
  visible: boolean;
  onClose: () => void;
  screenHeight: number;
}

export default function UploadSheetModal({ visible, onClose, screenHeight }: Props) {
  const { uploadInvoiceFile, fetchInvoices } = useLayoutStore();
  const { apiClient } = useAuthStore();
  const [mode, setMode] = useState<'options' | 'manual'>('options');
  const [loading, setLoading] = useState(false);

  // Manual form states
  const [supplierName, setSupplierName] = useState('');
  const [docNum, setDocNum] = useState('');
  const [amount, setAmount] = useState('');

  const resetForm = () => {
    setSupplierName('');
    setDocNum('');
    setAmount('');
    setMode('options');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 1. Scan Invoice with Camera
  const handleScanCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to scan invoices.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        handleClose();
        await uploadInvoiceFile(
          asset.uri,
          asset.fileName || `camera_${Date.now()}.jpg`,
          asset.mimeType || 'image/jpeg'
        );
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to scan invoice.');
    }
  };

  // 2. Choose PDF / Photo from Files
  const handleChooseFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        handleClose();
        await uploadInvoiceFile(
          asset.uri,
          asset.name || 'document.pdf',
          asset.mimeType || 'application/pdf'
        );
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to select file.');
    }
  };

  // 3. Save Manual Expense
  const handleSaveManual = async () => {
    if (!supplierName.trim()) {
      Alert.alert('Validation Error', 'Supplier Name is required.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      // Create a pending invoice with mock text file
      const formData = new FormData();
      formData.append('file', {
        uri: 'data:text/plain;base64,TWFudWFsIGV4cGVuc2U=',
        name: 'manual_expense.txt',
        type: 'text/plain'
      } as any);

      const uploadRes = await apiClient.uploadInvoice(formData);
      const invoiceId = uploadRes.invoiceId;

      // Immediately update invoice with the manual details and mark completed
      await apiClient.updateInvoice(invoiceId, {
        supplierName,
        documentNumber: docNum || `MANUAL-${Date.now()}`,
        invoiceNumber: docNum || `MANUAL-${Date.now()}`,
        totalAmount: numAmount,
        baseAmount: numAmount,
        status: 'PROCESSED',
        needs_review: false
      });

      handleClose();
      await fetchInvoices(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save manual expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={handleClose}>
      <View style={{
        height: screenHeight,
        width: '100%',
        backgroundColor: 'rgba(21,21,21,0.4)',
        justifyContent: 'flex-end',
      }}>
        {/* Backdrop Touch Handler */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <View style={{
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20,
          paddingBottom: 40,
          gap: 16,
          maxHeight: '90%'
        }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#e2e1dd', borderRadius: 2, alignSelf: 'center', marginBottom: 4 }} />
          
          {mode === 'options' ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Add Document</Text>
              
              <View style={{ gap: 10 }}>
                <TouchableOpacity onPress={handleScanCamera}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#fafaf8', borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 12 }}>
                  <View style={{ width: 38, height: 38, backgroundColor: '#151515', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <Receipt size={16} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#151515' }}>Scan Invoice with Camera</Text>
                    <Text style={{ fontSize: 10, color: '#8c8c89', marginTop: 2 }}>Capture a receipt or delivery note</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleChooseFile}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#fafaf8', borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 12 }}>
                  <View style={{ width: 38, height: 38, backgroundColor: '#151515', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <Upload size={16} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#151515' }}>Choose PDF / Photo from Files</Text>
                    <Text style={{ fontSize: 10, color: '#8c8c89', marginTop: 2 }}>Select an existing file from your device</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('manual')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#fafaf8', borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 12 }}>
                  <View style={{ width: 38, height: 38, backgroundColor: '#151515', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <Pencil size={16} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#151515' }}>Log Manual Expense</Text>
                    <Text style={{ fontSize: 10, color: '#8c8c89', marginTop: 2 }}>Enter an expense or delivery note manually</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleClose} style={{ width: '100%', paddingVertical: 14, borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 12, alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: '#8c8c89', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setMode('options')} style={{ padding: 4 }}>
                  <ArrowLeft size={18} color="#151515" />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Log Manual Expense</Text>
              </View>

              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#8c8c89', marginBottom: 6 }}>Supplier Name *</Text>
                  <TextInput
                    value={supplierName}
                    onChangeText={setSupplierName}
                    placeholder="Enter supplier name"
                    placeholderTextColor="#8c8c89"
                    style={{ borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 8, padding: 10, fontSize: 13, color: '#151515' }}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#8c8c89', marginBottom: 6 }}>Document Number</Text>
                  <TextInput
                    value={docNum}
                    onChangeText={setDocNum}
                    placeholder="Enter document number (optional)"
                    placeholderTextColor="#8c8c89"
                    style={{ borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 8, padding: 10, fontSize: 13, color: '#151515' }}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#8c8c89', marginBottom: 6 }}>Total Amount (€) *</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor="#8c8c89"
                    keyboardType="decimal-pad"
                    style={{ borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 8, padding: 10, fontSize: 13, color: '#151515' }}
                  />
                </View>

                {loading ? (
                  <ActivityIndicator size="small" color="#1f8f5c" style={{ marginVertical: 12 }} />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <TouchableOpacity onPress={() => setMode('options')}
                      style={{ flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#8c8c89', fontSize: 13, fontWeight: '600' }}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSaveManual}
                      style={{ flex: 1, paddingVertical: 12, backgroundColor: '#151515', borderRadius: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
