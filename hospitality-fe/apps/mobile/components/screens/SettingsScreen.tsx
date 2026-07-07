import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal
} from 'react-native';
import {
  Search,
  Plus,
  X,
  AlertCircle,
  Building,
  Users,
  Settings,
  Mail,
  Check
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmAlert from '../ui/ConfirmAlert';

export default function SettingsScreen() {
  const { apiClient, logout, user: currentUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'venue' | 'users' | 'system'>('venue');
  const [loading, setLoading] = useState(true);
  
  // Venue/Restaurant States
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [restName, setRestName] = useState('');
  const [restAddress, setRestAddress] = useState('');
  const [restPhone, setRestPhone] = useState('');
  const [restVat, setRestVat] = useState('');

  // Users States
  const [users, setUsers] = useState<any[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Administrator' | 'Chef & Kitchen' | 'Management View'>('Management View');

  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      // Fetch Restaurant info
      const restData = await apiClient.getRestaurant();
      setRestaurant(restData);
      if (restData) {
        setRestName(restData.name || '');
        setRestAddress(restData.address || '');
        setRestPhone(restData.phone || '');
        setRestVat(restData.vat_number || '');
      }

      // Fetch Users
      const usersData = await apiClient.getUsers();
      setUsers(usersData.items || []);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveVenue = async () => {
    try {
      await apiClient.updateRestaurant({
        name: restName,
        address: restAddress,
        phone: restPhone,
        vat_number: restVat
      });
      setAlertConfig({ title: 'Success', message: 'Venue settings updated', isSuccess: true });
      fetchSettings();
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to update venue settings' });
    }
  };

  const handleInviteUser = async () => {
    if (!newEmail.trim() || !newFirstName.trim() || !newLastName.trim()) return;

    try {
      await apiClient.createUser({
        first_name: newFirstName,
        last_name: newLastName,
        email: newEmail,
        role: newRole
      });
      setInviteModalOpen(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewRole('Management View');
      setAlertConfig({ title: 'Success', message: 'User invited successfully', isSuccess: true });
      fetchSettings();
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to invite user' });
    }
  };

  const handleToggleUserStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiClient.updateUserStatus(id, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u))
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <ActivityIndicator size="large" color="#1f8f5c" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingBottom: 100 }}
    >
      <Text style={styles.screenTitle}>Settings</Text>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {(['venue', 'users', 'system'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'venue' && (
        /* Venue Settings Card */
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Building size={18} color="#151515" />
            <Text style={styles.cardHeaderTitle}>Venue Details</Text>
          </View>
          
          <Input label="Venue / Restaurant Name" value={restName} onChangeText={setRestName} />
          <Input label="Address" value={restAddress} onChangeText={setRestAddress} />
          <Input label="Phone" value={restPhone} onChangeText={setRestPhone} keyboardType="phone-pad" />
          <Input label="VAT Number" value={restVat} onChangeText={setRestVat} />
          
          <Button title="Save Details" onPress={handleSaveVenue} style={{ marginTop: 12 }} />
        </View>
      )}

      {activeTab === 'users' && (
        /* User Management List */
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionHeader}>Staff Users ({users.length})</Text>
            <TouchableOpacity
              onPress={() => setInviteModalOpen(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#151515', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
            >
              <Plus size={12} color="#ffffff" />
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>Invite</Text>
            </TouchableOpacity>
          </View>

          {users.map((item) => (
            <View key={item.id} style={styles.userRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.userName}>{item.first_name} {item.last_name}</Text>
                <Text style={styles.userSub}>{item.email} · {item.role}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleToggleUserStatus(item.id, item.status)}
                style={[
                  styles.statusToggleBtn,
                  item.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive
                ]}
              >
                <Text style={[styles.statusText, item.status === 'ACTIVE' ? { color: '#1f8f5c' } : { color: '#8c8c89' }]}>
                  {item.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'system' && (
        /* System Status Metadata */
        <View style={{ gap: 12 }}>
          <View style={styles.card}>
            <Text style={[styles.cardHeaderTitle, { marginBottom: 12 }]}>System Metadata</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AI Assistant RAG Server</Text>
              <Text style={[styles.infoValue, { color: '#1f8f5c' }]}>Connected</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>OCR Parser Engine</Text>
              <Text style={styles.infoValue}>Claude 3.5 Sonnet</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Database Migration</Text>
              <Text style={styles.infoValue}>Alembic Rev head</Text>
            </View>
          </View>

          <Button title="Logout Session" onPress={logout} variant="danger" />
        </View>
      )}

      {/* Invite User Modal */}
      <Modal visible={inviteModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Invite New Staff Member</Text>
            <TouchableOpacity onPress={() => setInviteModalOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="First Name" value={newFirstName} onChangeText={setNewFirstName} />
            <Input label="Last Name" value={newLastName} onChangeText={setNewLastName} />
            <Input label="Email" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" />
            
            <Text style={styles.inputLabel}>System Role</Text>
            <View style={{ gap: 6, marginVertical: 6 }}>
              {(['Administrator', 'Chef & Kitchen', 'Management View'] as const).map((role) => (
                <TouchableOpacity
                  key={role}
                  onPress={() => setNewRole(role)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: newRole === role ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: newRole === role ? '#151515' : '#e2e1dd',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: newRole === role ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                    {role}
                  </Text>
                  {newRole === role && <Check size={16} color="#ffffff" />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button title="Cancel" onPress={() => setInviteModalOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Send Invitation" onPress={handleInviteUser} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Custom Alerts */}
      <ConfirmAlert
        visible={alertConfig !== null}
        title={alertConfig?.title || ''}
        message={alertConfig?.message || ''}
        confirmText="OK"
        onConfirm={() => setAlertConfig(null)}
        variant={alertConfig?.isSuccess ? 'success' : 'danger'}
      />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f0ec',
    borderRadius: 10,
    padding: 2,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  tabTextActive: {
    color: '#151515',
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 14,
    padding: 16,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
  },
  infoLabel: {
    fontSize: 12,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'Sora',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 12,
    padding: 12,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  userSub: {
    fontSize: 10,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  statusToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: '#e6f4ec',
    borderColor: '#1f8f5c',
  },
  statusInactive: {
    backgroundColor: '#f1f0ec',
    borderColor: '#e2e1dd',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Sora',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8c8c89',
    marginBottom: 4,
    fontFamily: 'Sora',
    textTransform: 'uppercase',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fafaf8',
    paddingTop: 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e1dd',
    backgroundColor: '#ffffff',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  modalBody: {
    padding: 20,
  },
});
