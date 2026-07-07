import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Edit3,
  Check,
  X,
  Layers,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  Info,
  BookOpen
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmAlert from '../../components/ui/ConfirmAlert';
import Badge from '../../components/ui/Badge';

export default function RecipeDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { apiClient } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [dish, setDish] = useState<any | null>(null);
  const [bom, setBom] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTagName, setEditTagName] = useState('');
  const [editUOM, setEditUOM] = useState('ud');
  const [editPortions, setEditPortions] = useState(1);
  const [editBasePrice, setEditBasePrice] = useState('0.00'); // GRP (before tax)
  const [editTaxAmount, setEditTaxAmount] = useState('0.00'); // VAT
  const [editSalePrice, setEditSalePrice] = useState('0.00'); // NRP (after tax)
  const [editIvaRate, setEditIvaRate] = useState(10); // 10% default
  const [editExpectedMargin, setEditExpectedMargin] = useState('20');
  const [recipeNotes, setRecipeNotes] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'ingredients' | 'notes'>('ingredients');

  // Add Ingredient inline panel state
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [ingType, setIngType] = useState<'product' | 'preparation'>('product');
  const [ingSearch, setIngSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [ingNetQuantity, setIngNetQuantity] = useState('1.00');
  const [ingShrinkage, setIngShrinkage] = useState('0.00');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Alert & Confirms
  const [lineToRemove, setLineToRemove] = useState<number | null>(null);
  const [recipeTags, setRecipeTags] = useState<any[]>([]);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchDishDetails = async () => {
    try {
      setLoading(true);
      const numericId = Number(id);
      // Fetch recipe details directly — avoids missing preparations that getDishes() omits
      const matched = await apiClient.getRecipeById(numericId) as any;

      if (matched) {
        const bomData = await apiClient.getBOM(String(numericId));
        setBom(bomData.bom);

        setDish({ ...matched, linkedArticles: bomData.bom.items });
        setEditName(matched.name);
        setEditTagName(matched.tag?.name || '');
        setEditUOM(matched.unitOfMeasure || 'ud');
        setEditPortions(matched.portions || 1);
        setEditBasePrice(Number(matched.base || 0).toFixed(2));
        setEditTaxAmount(Number(matched.tax || 0).toFixed(2));
        setEditSalePrice(Number(matched.price || 0).toFixed(2));
        setRecipeNotes(matched.notes || '');

        if (matched.base > 0) {
          setEditIvaRate(Math.round(((matched.tax || 0) / matched.base) * 100));
        } else {
          setEditIvaRate(10);
        }

        const initialMargin = matched.margin > 0 ? (matched.margin * 100).toFixed(0) : '20';
        setEditExpectedMargin(initialMargin);
      } else {
        setError('Recipe not found');
      }
    } catch (err) {
      console.error(err);
      setError('Could not fetch recipe details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const data = await apiClient.getRecipeTags();
      setRecipeTags(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDishDetails();
      fetchTags();
    }
  }, [id]);

  // Live searches for products/preparations
  useEffect(() => {
    if (!ingSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const performSearch = async () => {
      try {
        if (ingType === 'product') {
          const res = await apiClient.searchSuppliedProducts(ingSearch);
          setSearchResults(res);
        } else {
          const res = await apiClient.getDishes({ preparations: true });
          const filtered = res.filter((d: any) =>
            d.name.toLowerCase().includes(ingSearch.toLowerCase())
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const delayDebounce = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [ingSearch, ingType]);

  // Calculations for Pricing
  const handleRecalculatePrices = (type: 'base' | 'sale' | 'iva', val: string) => {
    const numeric = parseFloat(val) || 0;
    const vatFactor = editIvaRate / 100;

    if (type === 'base') {
      setEditBasePrice(val);
      const tax = numeric * vatFactor;
      const sale = numeric + tax;
      setEditTaxAmount(tax.toFixed(2));
      setEditSalePrice(sale.toFixed(2));
    } else if (type === 'sale') {
      setEditSalePrice(val);
      const base = numeric / (1 + vatFactor);
      const tax = numeric - base;
      setEditBasePrice(base.toFixed(2));
      setEditTaxAmount(tax.toFixed(2));
    } else if (type === 'iva') {
      const activeRate = parseInt(val) || 0;
      setEditIvaRate(activeRate);
      const baseNum = parseFloat(editBasePrice) || 0;
      const tax = baseNum * (activeRate / 100);
      const sale = baseNum + tax;
      setEditTaxAmount(tax.toFixed(2));
      setEditSalePrice(sale.toFixed(2));
    }
  };

  // Recommended GRP calculation
  const portionCost = bom?.cost || 0;
  const targetMarginPercent = parseFloat(editExpectedMargin) || 0;
  const recommendedGRP = targetMarginPercent < 100
    ? portionCost / (1 - targetMarginPercent / 100)
    : portionCost;

  const handleApplyRecommendedGRP = () => {
    handleRecalculatePrices('base', recommendedGRP.toFixed(2));
  };

  // Save changes
  const handleSaveRecipe = async () => {
    if (!dish) return;

    try {
      const dbId = dish.dbId || Number(id);
      await apiClient.updateRecipe(dbId, {
        name: editName,
        unitOfMeasure: editUOM,
        base: parseFloat(editBasePrice) || 0,
        tax: parseFloat(editTaxAmount) || 0,
        salePrice: parseFloat(editSalePrice) || 0,
        tagName: editTagName || undefined,
        notes: recipeNotes
      });

      setAlertConfig({ title: 'Success', message: 'Recipe updated successfully', isSuccess: true });
      setIsEditing(false);
      fetchDishDetails();
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to update recipe details' });
    }
  };

  // Save Notes ONLY
  const handleSaveNotes = async () => {
    if (!dish) return;
    try {
      const dbId = dish.dbId || Number(id);
      await apiClient.updateRecipe(dbId, { notes: recipeNotes });
      setAlertConfig({ title: 'Success', message: 'Recipe notes saved', isSuccess: true });
      fetchDishDetails();
    } catch (e) {
      console.error(e);
      setAlertConfig({ title: 'Error', message: 'Failed to save recipe notes' });
    }
  };

  // Add ingredient
  const shrinkagePercent = parseFloat(ingShrinkage) || 0;
  const netQtyNum = parseFloat(ingNetQuantity) || 0;
  const calculatedGrossQty = shrinkagePercent > 0 
    ? netQtyNum / (1 - (shrinkagePercent / 100))
    : netQtyNum;

  const unitCost = selectedItem ? (selectedItem.price || selectedItem.currentCost || 0) : 0;
  const calculatedProductCost = calculatedGrossQty * unitCost;

  const handleAddIngredientCall = async () => {
    if (!selectedItem || !dish) return;

    try {
      const dbId = dish.dbId || Number(id);
      const isPrep = ingType === 'preparation';
      const payload = {
        productId: isPrep ? null : selectedItem.id,
        childRecipeId: isPrep ? (selectedItem.dbId || selectedItem.id) : null,
        quantity: calculatedGrossQty
      };

      await apiClient.addIngredient(dbId, payload);
      setSelectedItem(null);
      setIngSearch('');
      setIngNetQuantity('1.00');
      setIngShrinkage('0.00');
      setIsAddingIngredient(false);
      fetchDishDetails();
    } catch (e) {
      console.error(e);
      setAlertConfig({ title: 'Error', message: 'Failed to add ingredient' });
    }
  };

  const handleRemoveIngredientCall = async (lineId: number) => {
    try {
      await apiClient.removeIngredient(lineId);
      fetchDishDetails();
    } catch (e) {
      console.error(e);
      setAlertConfig({ title: 'Error', message: 'Failed to remove ingredient' });
    } finally {
      setLineToRemove(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1f8f5c" />
      </View>
    );
  }

  if (error || !dish) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color="#b23a3a" />
        <Text style={styles.errorText}>{error || 'Recipe details not found'}</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#151515" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {dish.name}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (isEditing) handleSaveRecipe();
            else setIsEditing(true);
          }}
          style={styles.editToggleBtn}
        >
          <Text style={styles.editToggleBtnText}>{isEditing ? 'Save' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {isEditing ? (
          /* Editing Panel (Mockup 1) */
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Basic Information</Text>
            <Input label="Name" value={editName} onChangeText={setEditName} />
            <Input label="Unit of Measure" value={editUOM} onChangeText={setEditUOM} />
            
            <Text style={styles.inputLabel}>{dish.isPreparation ? 'Preparation Type' : 'Dish Type'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
              {recipeTags
                .filter((t) => t.isPreparation === dish.isPreparation)
                .map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => setEditTagName(tag.name)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: editTagName === tag.name ? '#151515' : '#ffffff',
                      borderWidth: 1,
                      borderColor: editTagName === tag.name ? '#151515' : '#e2e1dd',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: editTagName === tag.name ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Sale Details</Text>
            
            {/* VAT selector buttons */}
            <Text style={styles.inputLabel}>VAT Rate (%)</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
              {[0, 4, 10, 21].map((rate) => (
                <TouchableOpacity
                  key={rate}
                  onPress={() => handleRecalculatePrices('iva', String(rate))}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: editIvaRate === rate ? '#151515' : '#ffffff',
                    borderWidth: 1,
                    borderColor: editIvaRate === rate ? '#151515' : '#e2e1dd'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: editIvaRate === rate ? '#ffffff' : '#151515', fontFamily: 'Sora' }}>
                    {rate}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Expected Margin (%)" value={editExpectedMargin} onChangeText={setEditExpectedMargin} keyboardType="numeric" />
            
            {/* Recommended GRP box */}
            <View style={styles.recommendedBox}>
              <View>
                <Text style={{ fontSize: 11, color: '#8c8c89', fontFamily: 'Sora' }}>Recommended GRP</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>
                  €{recommendedGRP.toFixed(2)}
                </Text>
              </View>
              <Button title="Apply GRP" onPress={handleApplyRecommendedGRP} variant="secondary" />
            </View>

            <Input label="GRP (Selling Price Before Tax)" value={editBasePrice} onChangeText={(val: string) => handleRecalculatePrices('base', val)} keyboardType="decimal-pad" />
            <Input label="VAT Amount" value={editTaxAmount} editable={false} style={{ opacity: 0.7 }} />
            <Input label="NRP (Selling Price After Tax)" value={editSalePrice} onChangeText={(val: string) => handleRecalculatePrices('sale', val)} keyboardType="decimal-pad" />
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setIsEditing(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save Changes" onPress={handleSaveRecipe} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          /* View Mode */
          <View style={{ gap: 16 }}>

            {/* Info Card */}
            <View style={styles.card}>
              {/* Tag badge + type label */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: '#e6f4ec', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(31,143,92,0.1)' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#1f8f5c', fontFamily: 'Sora', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {dish.tag?.name || 'UNGROUPED'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: dish.isPreparation ? '#f0f0ff' : '#f5f4f1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#e2e1dd' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: dish.isPreparation ? '#5555cc' : '#555', fontFamily: 'Sora' }}>
                      {dish.isPreparation ? 'PREPARATION' : 'DISH'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  style={{ backgroundColor: '#f1f0ec', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e1dd' }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>Edit</Text>
                </TouchableOpacity>
              </View>

              {/* Info rows */}
              <View style={{ gap: 0, borderTopWidth: 1, borderTopColor: '#f1f0ec', paddingTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f0ec' }}>
                  <Text style={{ fontSize: 12, color: '#8c8c89', fontFamily: 'Sora' }}>{dish.isPreparation ? 'Preparation type' : 'Dish type'}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>{dish.tag?.name || '—'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f0ec' }}>
                  <Text style={{ fontSize: 12, color: '#8c8c89', fontFamily: 'Sora' }}>Quantity produced</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>{dish.portions || 1} {dish.unitOfMeasure || 'ud'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f0ec' }}>
                  <Text style={{ fontSize: 12, color: '#8c8c89', fontFamily: 'Sora' }}>NRP (incl. IVA)</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#151515', fontFamily: 'DM Mono' }}>€{Number(dish.price || 0).toFixed(2)}</Text>
                </View>
                {dish.notes ? (
                  <View style={{ paddingVertical: 8 }}>
                    <Text style={{ fontSize: 12, color: '#8c8c89', fontFamily: 'Sora', marginBottom: 4 }}>Notes</Text>
                    <Text style={{ fontSize: 12, color: '#151515', fontFamily: 'Sora', lineHeight: 18 }} numberOfLines={3}>{dish.notes}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Cost Summary Card */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>Cost Summary per Portion</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <View style={[styles.statBox, { backgroundColor: '#fafaf8' }]}>
                  <Text style={styles.statLabel}>GRP</Text>
                  <Text style={styles.statValue}>€{Number(dish.base || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#fafaf8' }]}>
                  <Text style={styles.statLabel}>Cost</Text>
                  <Text style={[styles.statValue, { color: '#b23a3a' }]}>€{Number(portionCost).toFixed(2)}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#fafaf8' }]}>
                  <Text style={styles.statLabel}>Profit</Text>
                  <Text style={styles.statValue}>€{Number(dish.profit || (dish.base - portionCost) || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#fafaf8' }]}>
                  <Text style={styles.statLabel}>Margin</Text>
                  <Text style={[styles.statValue, { color: '#1f8f5c' }]}>
                    {Number(dish.margin ? dish.margin * 100 : 0).toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>


            {/* Tabs for details */}
            <View style={styles.subTabs}>
              <TouchableOpacity
                onPress={() => setActiveSubTab('ingredients')}
                style={[styles.subTabButton, activeSubTab === 'ingredients' && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, activeSubTab === 'ingredients' && styles.subTextActive]}>Ingredients</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveSubTab('notes')}
                style={[styles.subTabButton, activeSubTab === 'notes' && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, activeSubTab === 'notes' && styles.subTextActive]}>Notes</Text>
              </TouchableOpacity>
            </View>

            {activeSubTab === 'ingredients' ? (
              /* Ingredients Section */
              <View style={{ gap: 10 }}>
                {/* Ingredients Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionHeader}>Ingredients List ({bom?.items?.length || 0})</Text>
                  <TouchableOpacity
                    onPress={() => setIsAddingIngredient(!isAddingIngredient)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#151515', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                  >
                    <Plus size={12} color="#ffffff" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Inline Add Ingredient Panel (Mockup 3) */}
                {isAddingIngredient && (
                  <View style={[styles.card, { borderColor: '#1f8f5c', borderStyle: 'solid' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Select Product / Batch</Text>
                      <TouchableOpacity onPress={() => setIsAddingIngredient(false)}>
                        <X size={16} color="#8c8c89" />
                      </TouchableOpacity>
                    </View>

                    {/* Step 1 Selector */}
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                      <TouchableOpacity
                        onPress={() => setIngType(ingType === 'product' ? 'preparation' : 'product')}
                        style={{
                          borderWidth: 1,
                          borderColor: '#e2e1dd',
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          justifyContent: 'center',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>
                          {ingType === 'product' ? 'Product' : 'Prep'}
                        </Text>
                      </TouchableOpacity>
                      <TextInput
                        value={ingSearch}
                        onChangeText={(val) => { setIngSearch(val); setDropdownOpen(true); }}
                        placeholder="Search catalog..."
                        placeholderTextColor="#8c8c89"
                        style={styles.searchBarInput}
                      />
                    </View>

                    {/* Search results dropdown */}
                    {dropdownOpen && searchResults.length > 0 && (
                      <View style={styles.resultsDropdown}>
                        <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                          {searchResults.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              onPress={() => { setSelectedItem(item); setIngSearch(item.name); setDropdownOpen(false); }}
                              style={styles.dropdownOption}
                            >
                              <Text style={{ fontSize: 12, color: '#151515', fontFamily: 'Sora' }}>{item.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {selectedItem && (
                      <View style={{ gap: 8, marginTop: 8 }}>
                        <View style={styles.selectedBox}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#1f8f5c', fontFamily: 'Sora' }}>
                            Selected: {selectedItem.name}
                          </Text>
                        </View>

                        <Input label="Net Quantity" value={ingNetQuantity} onChangeText={setIngNetQuantity} keyboardType="decimal-pad" />
                        <Input label="Shrinkage / Waste (%)" value={ingShrinkage} onChangeText={setIngShrinkage} keyboardType="numeric" />

                        {/* computed gross and cost line */}
                        <View style={styles.liveCalculationBox}>
                          <View>
                            <Text style={styles.calcLabel}>Gross Qty</Text>
                            <Text style={styles.calcValue}>{calculatedGrossQty.toFixed(3)}</Text>
                          </View>
                          <View>
                            <Text style={styles.calcLabel}>Unit Cost</Text>
                            <Text style={styles.calcValue}>€{unitCost.toFixed(2)}</Text>
                          </View>
                          <View>
                            <Text style={styles.calcLabel}>Estimated Cost</Text>
                            <Text style={[styles.calcValue, { color: '#1f8f5c' }]}>€{calculatedProductCost.toFixed(2)}</Text>
                          </View>
                        </View>

                        <Button title="Add to Ingredients" onPress={handleAddIngredientCall} />
                      </View>
                    )}
                  </View>
                )}

                {/* List items */}
                {bom?.items && bom.items.length > 0 ? (
                  bom.items.map((item: any, idx: number) => (
                    <View key={item.ingredientLineID || idx} style={styles.ingredientRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>
                          {item.name}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'Sora' }}>
                          Qty: {item.quantity} {item.displayUnit} · Shrinkage: {item.shrinkage}%
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>
                          €{Number(item.costPerDish).toFixed(2)}
                        </Text>
                        <TouchableOpacity onPress={() => setLineToRemove(Number(item.ingredientLineID))} style={{ padding: 4 }}>
                          <Trash2 size={14} color="#b23a3a" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>No ingredients added to this recipe.</Text>
                  </View>
                )}
              </View>
            ) : (
              /* Notes Section */
              <View style={styles.card}>
                <Text style={[styles.sectionHeader, { marginBottom: 12 }]}>Preparation Notes</Text>
                <TextInput
                  value={recipeNotes}
                  onChangeText={setRecipeNotes}
                  multiline
                  numberOfLines={6}
                  placeholder="Enter recipe prep instructions, comments, plating steps..."
                  placeholderTextColor="#8c8c89"
                  style={styles.notesArea}
                />
                <Button title="Save Notes" onPress={handleSaveNotes} style={{ marginTop: 14 }} />
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Remove Ingredient Confirm */}
      <ConfirmAlert
        visible={lineToRemove !== null}
        title="Remove Ingredient"
        message="Are you sure you want to remove this ingredient from the recipe?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => lineToRemove !== null && handleRemoveIngredientCall(lineToRemove)}
        onCancel={() => setLineToRemove(null)}
        variant="danger"
      />

      {/* Success/Error notifications */}
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
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8c8c89',
    marginBottom: 4,
    fontFamily: 'Sora',
    textTransform: 'uppercase',
  },
  recommendedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f4f1',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#f5f4f1',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
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
  subTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f0ec',
    borderRadius: 10,
    padding: 2,
  },
  subTabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  subTabActive: {
    backgroundColor: '#ffffff',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  subTextActive: {
    color: '#151515',
  },
  notesArea: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#151515',
    fontFamily: 'Sora',
    textAlignVertical: 'top',
    minHeight: 120,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 12,
    padding: 12,
  },
  emptyCard: {
    padding: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e1dd',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 12,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  searchBarInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#151515',
    fontFamily: 'Sora',
    height: 38,
  },
  resultsDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 8,
    marginTop: 4,
    paddingHorizontal: 4,
    shadowColor: '#151515',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
  },
  selectedBox: {
    backgroundColor: '#e6f4ec',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  liveCalculationBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fafaf8',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e1dd',
    marginVertical: 8,
  },
  calcLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#8c8c89',
    textTransform: 'uppercase',
    fontFamily: 'Sora',
  },
  calcValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'DM Mono',
    marginTop: 2,
  },
});
