import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { sharedStyles as styles } from '../../styles/shared';

interface Props {
  user: { name: string; role: string; email: string } | null;
  logout: () => void;
}

export default function SettingsScreen({ user, logout }: Props) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.screenTitle}>Settings</Text>
      
      <View style={styles.card}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#151515', marginBottom: 12 }}>Profile & Venue</Text>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f0ec', paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#8c8c89' }}>Username</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515' }}>{user?.name || 'General Manager'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f0ec', paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#8c8c89' }}>Role</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', textTransform: 'capitalize' }}>{user?.role || 'Admin'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, color: '#8c8c89' }}>Venue Name</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515' }}>Hospitality Elite Barcelona</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#151515', marginBottom: 12 }}>System & Integrations</Text>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f0ec', paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#8c8c89' }}>AI RAG Server</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f8f5c' }}>Connected</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, color: '#8c8c89' }}>OCR Model</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515' }}>Claude 3.5 Sonnet</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={logout} style={[styles.secondaryBtn, { marginTop: 8, borderColor: '#ffb4ab', backgroundColor: '#fceaea' }]}>
        <Text style={[styles.secondaryBtnText, { color: '#b23a3a' }]}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}
