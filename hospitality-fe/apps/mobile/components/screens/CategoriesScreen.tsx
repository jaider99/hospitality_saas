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
  Tag,
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

export default function CategoriesScreen() {
  const { apiClient } = useAuthStore();

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#151515');

  // Alert / Deletion
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchCategories = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await apiClient.getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCategories(false);
  };

  const openCreateModal = () => {
    setSelectedCategory(null);
    setName('');
    setDescription('');
    setColor('#151515');
    setIsModalOpen(true);
  };

  const openEditModal = (category: any) => {
    setSelectedCategory(category);
    setName(category.name || '');
    setDescription(category.description || '');
    setColor(category.color || '#151515');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const payload = {
      name,
      description: description || null,
      color: color || '#151515'
    };

    try {
      if (selectedCategory) {
        // Edit
        await apiClient.updateCategory(selectedCategory.id, payload);
        setAlertConfig({ title: 'Success', message: 'Category updated successfully', isSuccess: true });
      } else {
        // Create
        await apiClient.createCategory(payload);
        setAlertConfig({ title: 'Success', message: 'Category created successfully', isSuccess: true });
      }
      setIsModalOpen(false);
      fetchCategories(false);
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to save category' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setAlertConfig({ title: 'Success', message: 'Category deleted successfully', isSuccess: true });
    } catch (err: any) {
      console.error(err);
      // Detailed error if blocked by constraints
      setAlertConfig({
        title: 'Delete Blocked',
        message: 'This category cannot be deleted because it is assigned to active products or suppliers.'
      });
    } finally {
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (searchQuery.trim()) {
      return (
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
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
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Categories</Text>
        <TouchableOpacity
          onPress={openCreateModal}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#151515', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        >
          <Plus size={14} color="#ffffff" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>Add Category</Text>
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
          placeholder="Search categories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8c8c89"
          style={{ flex: 1, fontSize: 12, color: '#151515', fontFamily: 'Sora', height: '100%', padding: 0 }}
        />
      </View>

      {/* Categories List */}
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => {
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
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f0ec', justifyContent: 'center', alignItems: 'center' }}>
                  <Tag size={20} color={item.color || '#151515'} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>
                    {item.name}
                  </Text>
                  {item.description && (
                    <Text numberOfLines={1} style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'Sora' }}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={{ padding: 4 }}>
                  <Edit3 size={15} color="#8c8c89" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCategoryToDelete(item.id)} style={{ padding: 4 }}>
                  <Trash2 size={15} color="#b23a3a" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ padding: 32, alignItems: 'center', gap: 10, marginTop: 20 }}>
            <AlertCircle size={32} color="#8c8c89" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>No categories found</Text>
          </View>
        )}
      />

      {/* Create/Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>
              {selectedCategory ? 'Edit Category' : 'Create Category'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Category Name" value={name} onChangeText={setName} placeholder="e.g. spirits" />
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="Description of items in this category" />
            
            <Text style={styles.inputLabel}>Choose Color</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
              {['#151515', '#1f8f5c', '#b23a3a', '#b07a1a', '#2f6bb0', '#4f46e5', '#a855f7', '#ec4899'].map((col) => (
                <TouchableOpacity
                  key={col}
                  onPress={() => setColor(col)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: col,
                    borderWidth: color === col ? 3 : 0,
                    borderColor: '#ffffff',
                    shadowColor: '#151515',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button title="Cancel" onPress={() => setIsModalOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save Category" onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Category Confirm */}
      <ConfirmAlert
        visible={categoryToDelete !== null}
        title="Delete Category"
        message="Are you sure you want to delete this category? This will affect all linked supplier products."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => categoryToDelete !== null && handleDelete(categoryToDelete)}
        onCancel={() => setCategoryToDelete(null)}
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
