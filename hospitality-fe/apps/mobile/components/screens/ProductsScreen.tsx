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
import { useRouter } from 'expo-router';
import {
  Search,
  Plus,
  Package,
  Star,
  ChevronRight,
  SlidersHorizontal,
  X,
  AlertCircle,
  Archive,
  StarOff
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmAlert from '../ui/ConfirmAlert';

export default function ProductsScreen() {
  const router = useRouter();
  const { apiClient } = useAuthStore();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategoryId, setNewProdCategoryId] = useState('');
  const [newProdSupplierId, setNewProdSupplierId] = useState('');
  
  // Alert configs
  const [productToArchive, setProductToArchive] = useState<any | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      // 1. Fetch products
      const prodsRes = await apiClient.getProducts();
      setProducts(prodsRes.items || []);

      // 2. Fetch categories
      const catsRes = await apiClient.getCategories();
      setCategories(catsRes);

      // 3. Fetch suppliers
      const supsRes = await apiClient.get<any[]>('/suppliers');
      setSuppliers(supsRes.data || []);
    } catch (err) {
      console.error(err);
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

  const handleCreateProduct = async () => {
    if (!newProdName.trim()) return;

    try {
      await apiClient.createProduct({
        name: newProdName,
        category_id: newProdCategoryId || undefined,
        supplier_id: newProdSupplierId ? Number(newProdSupplierId) : undefined
      });
      setIsCreateOpen(false);
      setNewProdName('');
      setNewProdCategoryId('');
      setNewProdSupplierId('');
      setAlertConfig({ title: 'Success', message: 'Product created successfully', isSuccess: true });
      fetchData(false);
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to create product' });
    }
  };

  const handleToggleBookmark = async (id: string) => {
    try {
      await apiClient.toggleProductBookmark(id);
      setProducts((prev) =>
        prev.map((p) => (String(p.id) === String(id) ? { ...p, bookmarked: !p.bookmarked } : p))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveProduct = async (id: string) => {
    try {
      await apiClient.archiveProduct(id, true);
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
      setAlertConfig({ title: 'Success', message: 'Product archived successfully', isSuccess: true });
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Could not archive product' });
    } finally {
      setProductToArchive(null);
    }
  };

  // Filter products list
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'All' && p.category_id !== selectedCategory) return false;
    if (selectedSupplier !== 'All' && String(p.supplier_id) !== String(selectedSupplier)) return false;

    if (searchQuery.trim()) {
      return p.name.toLowerCase().includes(searchQuery.toLowerCase());
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
      
      {/* Header bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Products</Text>
        <TouchableOpacity
          onPress={() => setIsCreateOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#151515', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        >
          <Plus size={14} color="#ffffff" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Search and Filters Bar */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{
          flex: 1,
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
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8c8c89"
            style={{ flex: 1, fontSize: 12, color: '#151515', fontFamily: 'Sora', height: '100%', padding: 0 }}
          />
        </View>

        <TouchableOpacity 
          onPress={() => setFilterModalOpen(true)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: (selectedCategory !== 'All' || selectedSupplier !== 'All') ? '#151515' : '#e2e1dd',
            backgroundColor: (selectedCategory !== 'All' || selectedSupplier !== 'All') ? '#151515' : '#ffffff',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <SlidersHorizontal size={16} color={(selectedCategory !== 'All' || selectedSupplier !== 'All') ? '#ffffff' : '#151515'} />
        </TouchableOpacity>
      </View>

      {/* Active filters badges */}
      {(selectedCategory !== 'All' || selectedSupplier !== 'All') && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {selectedCategory !== 'All' && (
            <TouchableOpacity onPress={() => setSelectedCategory('All')} style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                Cat: {categories.find((c) => c.category_id === selectedCategory)?.name || selectedCategory} ✕
              </Text>
            </TouchableOpacity>
          )}
          {selectedSupplier !== 'All' && (
            <TouchableOpacity onPress={() => setSelectedSupplier('All')} style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                Sup: {suppliers.find((s) => String(s.id) === String(selectedSupplier))?.name || selectedSupplier} ✕
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => {
          const matchedCategory = categories.find((c) => c.category_id === item.category_id);
          return (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })}
              style={{
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
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#f5f4f1', justifyContent: 'center', alignItems: 'center' }}>
                  <Package size={20} color="#151515" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>
                    {item.name}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {matchedCategory?.name && (
                      <Badge label={matchedCategory.name} variant="info" />
                    )}
                    {item.unit && (
                      <Text style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'Sora' }}>{item.unit}</Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {item.price != null && (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>
                    €{Number(item.price).toFixed(2)}
                  </Text>
                )}
                <TouchableOpacity onPress={() => handleToggleBookmark(item.id)} style={{ padding: 4 }}>
                  <Star size={16} color={item.bookmarked ? '#b07a1a' : '#8c8c89'} fill={item.bookmarked ? '#b07a1a' : 'transparent'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setProductToArchive(item)} style={{ padding: 4 }}>
                  <Archive size={16} color="#8c8c89" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ padding: 32, alignItems: 'center', gap: 10, marginTop: 20 }}>
            <AlertCircle size={32} color="#8c8c89" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>No products found</Text>
          </View>
        )}
      />

      {/* Filter Bottom Sheet */}
      <Modal visible={filterModalOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(21, 21, 21, 0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            maxHeight: '70%'
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Product Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                <X size={20} color="#151515" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16 }}>
                
                {/* Category Picker */}
                <Text style={styles.inputLabel}>Filter by Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedCategory('All')}
                    style={[styles.modalOptionBtn, selectedCategory === 'All' && styles.modalOptionActive]}
                  >
                    <Text style={[styles.modalOptionText, selectedCategory === 'All' && styles.modalOptionTextActive]}>All</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.category_id)}
                      style={[styles.modalOptionBtn, selectedCategory === cat.category_id && styles.modalOptionActive]}
                    >
                      <Text style={[styles.modalOptionText, selectedCategory === cat.category_id && styles.modalOptionTextActive]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Supplier Picker */}
                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Filter by Supplier</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedSupplier('All')}
                    style={[styles.modalOptionBtn, selectedSupplier === 'All' && styles.modalOptionActive]}
                  >
                    <Text style={[styles.modalOptionText, selectedSupplier === 'All' && styles.modalOptionTextActive]}>All</Text>
                  </TouchableOpacity>
                  {suppliers.map((sup) => (
                    <TouchableOpacity
                      key={sup.id}
                      onPress={() => setSelectedSupplier(String(sup.id))}
                      style={[styles.modalOptionBtn, String(selectedSupplier) === String(sup.id) && styles.modalOptionActive]}
                    >
                      <Text style={[styles.modalOptionText, String(selectedSupplier) === String(sup.id) && styles.modalOptionTextActive]}>{sup.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

              </View>
            </ScrollView>

            <Button title="Apply Filters" onPress={() => setFilterModalOpen(false)} style={{ marginTop: 24 }} />
          </View>
        </View>
      </Modal>

      {/* Create Product Modal */}
      <Modal visible={isCreateOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Create New Product</Text>
            <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Product Name" value={newProdName} onChangeText={setNewProdName} placeholder="e.g. Lime 1kg" />
            
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setNewProdCategoryId(cat.category_id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: newProdCategoryId === cat.category_id ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: newProdCategoryId === cat.category_id ? '#151515' : '#e2e1dd'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: newProdCategoryId === cat.category_id ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Supplier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
              {suppliers.map((sup) => (
                <TouchableOpacity
                  key={sup.id}
                  onPress={() => setNewProdSupplierId(String(sup.id))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: newProdSupplierId === String(sup.id) ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: newProdSupplierId === String(sup.id) ? '#151515' : '#e2e1dd'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: newProdSupplierId === String(sup.id) ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                    {sup.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button title="Cancel" onPress={() => setIsCreateOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Create Product" onPress={handleCreateProduct} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Confirm Archiving */}
      <ConfirmAlert
        visible={productToArchive !== null}
        title="Archive Product"
        message={`Are you sure you want to archive "${productToArchive?.name}"?`}
        confirmText="Archive"
        cancelText="Cancel"
        onConfirm={() => productToArchive !== null && handleArchiveProduct(productToArchive.id)}
        onCancel={() => setProductToArchive(null)}
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
  filterBadge: {
    backgroundColor: '#f1f0ec',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#151515',
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
  modalOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
  },
  modalOptionActive: {
    backgroundColor: '#151515',
    borderColor: '#151515',
  },
  modalOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'Sora',
  },
  modalOptionTextActive: {
    color: '#ffffff',
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
