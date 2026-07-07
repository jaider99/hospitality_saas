import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Edit3,
  Check,
  X,
  Package,
  TrendingDown,
  Info
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmAlert from '../../components/ui/ConfirmAlert';

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { apiClient } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTaxRate, setEditTaxRate] = useState('');
  const [editFixedPrice, setEditFixedPrice] = useState('');
  const [editPriceOption, setEditPriceOption] = useState('average');
  const [editCustomPrice, setEditCustomPrice] = useState('');
  
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const detail = await apiClient.getProductDetail(String(id));
      setProduct(detail);
      if (detail) {
        setEditName(detail.name || '');
        setEditCategoryId(detail.app_category_id || detail.category_id || '');
        setEditTaxRate(detail.tax_rate !== null && detail.tax_rate !== undefined ? String(detail.tax_rate) : '0.1');
        setEditFixedPrice(detail.config?.fixed_price !== null && detail.config?.fixed_price !== undefined ? String(detail.config?.fixed_price) : '');
        setEditPriceOption(detail.config?.reference_price_mode || 'average');
        setEditCustomPrice(detail.config?.custom_reference_price !== null && detail.config?.custom_reference_price !== undefined ? String(detail.config?.custom_reference_price) : '');
      }

      const cats = await apiClient.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error(err);
      setError('Could not load product details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  const handleSaveProduct = async () => {
    if (!product) return;

    try {
      await apiClient.updateProduct(String(id), {
        name: editName,
        app_category_id: editCategoryId || undefined,
        tax_rate: editTaxRate ? parseFloat(editTaxRate) : undefined,
        config: {
          ...product.config,
          reference_price_mode: editPriceOption,
          custom_reference_price: editCustomPrice ? parseFloat(editCustomPrice) : null,
          fixed_price: editFixedPrice ? parseFloat(editFixedPrice) : null
        }
      });
      setIsEditing(false);
      setAlertConfig({ title: 'Success', message: 'Product details saved', isSuccess: true });
      fetchDetails();
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to save product details' });
    }
  };

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    return `€${Number(val).toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1f8f5c" />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.centerContainer}>
        <Info size={48} color="#b23a3a" />
        <Text style={styles.errorText}>{error || 'Product not found'}</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const matchedCategory = categories.find((c) => c.category_id === product.app_category_id || c.category_id === product.category_id);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#151515" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product.name}
        </Text>
        <TouchableOpacity
          onPress={() => setIsEditing(true)}
          style={styles.editToggleBtn}
        >
          <Text style={styles.editToggleBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Basic Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Package size={18} color="#151515" />
              <Text style={styles.cardTitle}>Product Information</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{product.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>{matchedCategory?.name || '—'}</Text>
          </View>
          {product.unit_of_measure && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Base Unit</Text>
              <Text style={styles.infoValue}>{product.unit_of_measure}</Text>
            </View>
          )}
          {product.tax_rate !== null && product.tax_rate !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tax Rate (VAT)</Text>
              <Text style={styles.infoValue}>{(product.tax_rate * 100).toFixed(0)}%</Text>
            </View>
          )}
        </View>

        {/* Pricing Statistics Card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Historical Pricing & Cost</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <View style={{ flex: 1, minWidth: 100 }}>
              <Text style={styles.infoLabel}>Last Price</Text>
              <Text style={[styles.infoValue, { fontSize: 16, color: '#1f8f5c', fontWeight: '700' }]}>
                {formatCurrency(product.price_stats?.last || product.last_price)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 100 }}>
              <Text style={styles.infoLabel}>Ref. Price Mode</Text>
              <Text style={[styles.infoValue, { fontSize: 13, textTransform: 'capitalize', fontWeight: '700' }]}>
                {(product.config?.reference_price_mode || 'average').replace('_', ' ')}
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: '#edece8', marginVertical: 12 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.infoLabel}>Min Price</Text>
              <Text style={styles.infoValue}>{formatCurrency(product.price_stats?.min)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>Max Price</Text>
              <Text style={styles.infoValue}>{formatCurrency(product.price_stats?.max)}</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: '#edece8', marginVertical: 12 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.infoLabel}>Total Purchased</Text>
              <Text style={styles.infoValue}>{(product.total_units_purchased || 0).toFixed(1)} units</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>Total Spend</Text>
              <Text style={[styles.infoValue, { color: '#151515' }]}>{formatCurrency(product.total_cost || product.total)}</Text>
            </View>
          </View>
        </View>

        {/* Packaging Formats Card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Packaging / Formats</Text>
          {product.formats && product.formats.length > 0 ? (
            product.formats.map((format: any, idx: number) => (
              <View key={format.id || idx} style={styles.formatRow}>
                <Text style={styles.formatName}>{format.purchase_unit || format.name}</Text>
                <Text style={styles.formatPrice}>
                  Conv. Factor: {format.conversion_factor} {format.base_unit || 'ud'}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noFormatsText}>No additional formats configured.</Text>
          )}
        </View>

        {/* Purchase History Card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>
            Purchase History ({product.purchase_history?.length || 0})
          </Text>
          {product.purchase_history && product.purchase_history.length > 0 ? (
            product.purchase_history.map((hist: any, idx: number) => (
              <View key={hist.line_id || idx} style={styles.historyRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.historySupplier}>{hist.supplier_name}</Text>
                  <Text style={styles.historyMeta}>
                    {hist.document_date} · Inv: {hist.document_number || '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={styles.historyPrice}>{formatCurrency(hist.unit_price)}</Text>
                  <Text style={styles.historySub}>
                    Qty: {hist.quantity} {hist.unit || 'ud'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noFormatsText}>No purchase history recorded.</Text>
          )}
        </View>

      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={isEditing} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Edit Product Details</Text>
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Product Name" value={editName} onChangeText={setEditName} />
            
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setEditCategoryId(cat.category_id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: editCategoryId === cat.category_id ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: editCategoryId === cat.category_id ? '#151515' : '#e2e1dd'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: editCategoryId === cat.category_id ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Reference Price Mode</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
              {['average', 'last_received', 'fixed'].map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setEditPriceOption(option)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: editPriceOption === option ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: editPriceOption === option ? '#151515' : '#e2e1dd'
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: editPriceOption === option ? '#ffffff' : '#151515', textTransform: 'capitalize', fontFamily: 'Sora' }}>
                    {option.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {editPriceOption === 'fixed' && (
              <Input
                label="Fixed Reference Price (€)"
                value={editFixedPrice}
                onChangeText={setEditFixedPrice}
                keyboardType="decimal-pad"
              />
            )}

            <Input
              label="Custom Reference Price (€)"
              value={editCustomPrice}
              onChangeText={setEditCustomPrice}
              keyboardType="decimal-pad"
            />

            <Input
              label="Tax Rate (e.g. 0.1 for 10%)"
              value={editTaxRate}
              onChangeText={setEditTaxRate}
              keyboardType="decimal-pad"
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button title="Cancel" onPress={() => setIsEditing(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save" onPress={handleSaveProduct} style={{ flex: 1 }} />
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
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
    paddingTop: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fafaf8',
  },
  errorText: {
    fontSize: 14,
    color: '#8c8c89',
    textAlign: 'center',
    marginVertical: 16,
    fontFamily: 'Sora',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e1dd',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
    flex: 1,
  },
  editToggleBtn: {
    backgroundColor: '#f1f0ec',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'Sora',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  formatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
  },
  formatName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'Sora',
  },
  formatPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
    alignItems: 'center',
  },
  historySupplier: {
    fontSize: 12,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'Sora',
  },
  historyMeta: {
    fontSize: 10,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  historyPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'DM Mono',
  },
  historySub: {
    fontSize: 10,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  noFormatsText: {
    fontSize: 11,
    color: '#8c8c89',
    fontFamily: 'Sora',
    textAlign: 'center',
    paddingVertical: 16,
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
    gap: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8c8c89',
    marginBottom: 4,
    fontFamily: 'Sora',
    textTransform: 'uppercase',
  },
});
