import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Receipt, Upload, Pencil } from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  screenHeight: number;
}

export default function UploadSheetModal({ visible, onClose, screenHeight }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{
        height: screenHeight,
        width: '100%',
        backgroundColor: 'rgba(21,21,21,0.4)',
        justifyContent: 'flex-end',
      }}>
        {/* Backdrop Touch Handler */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
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
        }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#e2e1dd', borderRadius: 2, alignSelf: 'center', marginBottom: 4 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Add Document</Text>
          
          <View style={{ gap: 10 }}>
            {[
              { label: 'Scan Invoice with Camera', sub: 'Capture a receipt or delivery note', icon: Receipt },
              { label: 'Choose PDF / Photo from Files', sub: 'Select an existing file from your device', icon: Upload },
              { label: 'Log Manual Expense', sub: 'Enter an expense or delivery note manually', icon: Pencil }
            ].map((o, idx) => (
              <TouchableOpacity key={idx} onPress={onClose}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#fafaf8', borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 12 }}>
                <View style={{ width: 38, height: 38, backgroundColor: '#151515', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                  <o.icon size={16} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#151515' }}>{o.label}</Text>
                  <Text style={{ fontSize: 10, color: '#8c8c89', marginTop: 2 }}>{o.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={onClose} style={{ width: '100%', paddingVertical: 14, borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 12, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: '#8c8c89', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
