import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import {
  Search,
  Plus,
  Users,
  X,
  AlertCircle,
  Check
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmAlert from '../ui/ConfirmAlert';

export default function StaffLaborScreen() {
  const { apiClient } = useAuthStore();
  const propertyId = 1; // Default property ID

  const [employees, setEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [positionId, setPositionId] = useState<number | null>(null);
  const [governmentId, setGovernmentId] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [phone, setPhone] = useState('');

  // Alert config
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const emps = await apiClient.getStaffEmployees(propertyId);
      setEmployees(emps || []);
      const pos = await apiClient.getStaffPositions(propertyId);
      setPositions(pos || []);
    } catch (err) {
      console.error('Error fetching staff costs data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const openCreateModal = () => {
    setName('');
    setEmail('');
    setPositionId(null);
    setGovernmentId('');
    setWeeklyHours('');
    setPhone('');
    setIsModalOpen(true);
  };

  const handleCreateEmployee = async () => {
    if (!name.trim()) return;

    const payload = {
      name,
      email: email || null,
      position_id: positionId,
      government_id: governmentId || null,
      weekly_hours: weeklyHours ? parseFloat(weeklyHours) : null,
      phone: phone || null,
      active: true
    };

    try {
      await apiClient.createStaffEmployee(propertyId, payload);
      setIsModalOpen(false);
      setAlertConfig({ title: 'Success', message: 'Employee added successfully', isSuccess: true });
      fetchData(false);
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to add employee' });
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await apiClient.updateStaffEmployee(propertyId, id, { active: !currentStatus });
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === id ? { ...emp, active: !currentStatus } : emp))
      );
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (searchQuery.trim()) {
      return (
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return true;
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafaf8' }}>
        <ActivityIndicator size="large" color="#1f8f5c" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: 14 }}>
      
      {/* Header Bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Staff Costs</Text>
        <TouchableOpacity
          onPress={openCreateModal}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#151515', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        >
          <Plus size={14} color="#ffffff" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>Add Employee</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary Ribbon */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Total Staff</Text>
          <Text style={styles.statValue}>{employees.length} Members</Text>
        </View>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Active Staff</Text>
          <Text style={styles.statValue}>{employees.filter((e) => e.active).length} Active</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e1dd',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 38
      }}>
        <Search size={16} color="#8c8c89" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Search by name, email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8c8c89"
          style={{ flex: 1, fontSize: 12, color: '#151515', fontFamily: 'Sora', height: '100%', padding: 0 }}
        />
      </View>

      {/* Employee List */}
      <FlatList
        data={filteredEmployees}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => {
          const matchedPosition = positions.find((p) => p.id === item.position_id);
          return (
            <View style={{
              backgroundColor: '#ffffff',
              borderWidth: 1,
              borderColor: '#e2e1dd',
              padding: 14,
              borderRadius: 14,
              marginBottom: 10,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              shadowColor: '#151515',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.02,
              shadowRadius: 2,
              elevation: 1,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: item.active ? '#e6f4ec' : '#f1f0ec',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Users size={20} color={item.active ? '#1f8f5c' : '#8c8c89'} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'Sora' }}>
                    {matchedPosition?.name || 'Waiter/Waitress'} · {item.email || 'No email'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleToggleActive(item.id, item.active)}
                style={{
                  backgroundColor: item.active ? '#e6f4ec' : '#f1f0ec',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: item.active ? '#1f8f5c' : '#e2e1dd'
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: item.active ? '#1f8f5c' : '#8c8c89', fontFamily: 'Sora' }}>
                  {item.active ? 'Active' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ padding: 32, alignItems: 'center', gap: 10, marginTop: 20 }}>
            <AlertCircle size={32} color="#8c8c89" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>No employees found</Text>
          </View>
        )}
      />

      {/* Add Employee Modal */}
      <Modal visible={isModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Add Employee</Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Captain Haddock" />
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="Government ID" value={governmentId} onChangeText={setGovernmentId} placeholder="DNI/NIE" />
            <Input label="Weekly Hours" value={weeklyHours} onChangeText={setWeeklyHours} keyboardType="numeric" />

            <Text style={styles.inputLabel}>Position / Role</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
              {positions.map((pos) => (
                <TouchableOpacity
                  key={pos.id}
                  onPress={() => setPositionId(pos.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: positionId === pos.id ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: positionId === pos.id ? '#151515' : '#e2e1dd'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: positionId === pos.id ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                    {pos.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button title="Cancel" onPress={() => setIsModalOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save Employee" onPress={handleCreateEmployee} style={{ flex: 1 }} />
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

    </View>
  );
}

const styles = StyleSheet.create({
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
  statCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    padding: 12,
    borderRadius: 10,
    shadowColor: '#151515',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8c8c89',
    textTransform: 'uppercase',
    fontFamily: 'Sora',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'DM Mono',
  },
});
