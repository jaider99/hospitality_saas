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
  Truck,
  X,
  AlertCircle,
  Trash2,
  Edit3
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmAlert from '../ui/ConfirmAlert';

export default function SuppliersScreen() {
  const { apiClient } = useAuthStore();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Alert / Deletion
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchSuppliers = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await apiClient.get<any[]>('/suppliers');
      setSuppliers(response.data || []);
      const cats = await apiClient.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSuppliers(false);
  };

  const openCreateModal = () => {
    setSelectedSupplier(null);
    setName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setCategoryId('');
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: any) => {
    setSelectedSupplier(supplier);
    setName(supplier.name || '');
    setContactName(supplier.contact_name || '');
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setCategoryId(supplier.category_id || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const payload = {
      name,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      category_id: categoryId || null
    };

    try {
      if (selectedSupplier) {
        // Edit
        await apiClient.put(`/suppliers/${selectedSupplier.id}`, payload);
        setAlertConfig({ title: 'Success', message: 'Supplier updated successfully', isSuccess: true });
      } else {
        // Create
        await apiClient.post('/suppliers', payload);
        setAlertConfig({ title: 'Success', message: 'Supplier created successfully', isSuccess: true });
      }
      setIsModalOpen(false);
      fetchSuppliers(false);
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to save supplier' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/suppliers/${id}`);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      setAlertConfig({ title: 'Success', message: 'Supplier deleted successfully', isSuccess: true });
    } catch (err: any) {
      console.error(err);
      // Detailed error if blocked by constraints
      setAlertConfig({
        title: 'Delete Blocked',
        message: 'This supplier cannot be deleted because it has linked products in the catalog.'
      });
    } finally {
      setSupplierToDelete(null);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (searchQuery.trim()) {
      return (
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(searchQuery.toLowerCase()))
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
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Suppliers</Text>
        <TouchableOpacity
          onPress={openCreateModal}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#151515', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        >
          <Plus size={14} color="#ffffff" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>Add Supplier</Text>
        </TouchableOpacity>
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
          placeholder="Search suppliers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8c8c89"
          style={{ flex: 1, fontSize: 12, color: '#151515', fontFamily: 'Sora', height: '100%', padding: 0 }}
        />
      </View>

      {/* Suppliers List */}
      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => {
          const matchedCategory = categories.find((c) => c.category_id === item.category_id);
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
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#e6f4ec', justifyContent: 'center', alignItems: 'center' }}>
                  <Truck size={20} color="#1f8f5c" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>
                    {item.name}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {matchedCategory?.name && (
                      <Badge label={matchedCategory.name} variant="info" />
                    )}
                    {item.contact_name && (
                      <Text style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'Sora' }}>
                        Contact: {item.contact_name}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={{ padding: 4 }}>
                  <Edit3 size={15} color="#8c8c89" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSupplierToDelete(item.id)} style={{ padding: 4 }}>
                  <Trash2 size={15} color="#b23a3a" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ padding: 32, alignItems: 'center', gap: 10, marginTop: 20 }}>
            <AlertCircle size={32} color="#8c8c89" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>No suppliers found</Text>
          </View>
        )}
      />

      {/* Create/Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>
              {selectedSupplier ? 'Edit Supplier' : 'Create Supplier'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Supplier Name" value={name} onChangeText={setName} placeholder="e.g. Makro" />
            <Input label="Contact Person" value={contactName} onChangeText={setContactName} placeholder="e.g. John Doe" />
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.category_id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: categoryId === cat.category_id ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: categoryId === cat.category_id ? '#151515' : '#e2e1dd'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: categoryId === cat.category_id ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button title="Cancel" onPress={() => setIsModalOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save Supplier" onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Supplier Confirm */}
      <ConfirmAlert
        visible={supplierToDelete !== null}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This will remove all delivery configurations."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => supplierToDelete !== null && handleDelete(supplierToDelete)}
        onCancel={() => setSupplierToDelete(null)}
        variant="danger"
      />

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
});
