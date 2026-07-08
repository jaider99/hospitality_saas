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
  Utensils,
  Layers,
  ChevronRight,
  AlertCircle,
  X,
  Trash2,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmAlert from '../ui/ConfirmAlert';

export default function RecipesBoardScreen() {
  const router = useRouter();
  const { apiClient } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'dishes' | 'preparations'>('dishes');
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Creation Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeUom, setNewRecipeUom] = useState('ud');
  const [newRecipeTagName, setNewRecipeTagName] = useState('');

  // Manage Types Modal State
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [recipeTags, setRecipeTags] = useState<any[]>([]);
  const [newDishTypeInput, setNewDishTypeInput] = useState('');
  const [newPrepTypeInput, setNewPrepTypeInput] = useState('');

  // Deletion confirmations
  const [recipeToDelete, setRecipeToDelete] = useState<any | null>(null);
  const [tagToDelete, setTagToDelete] = useState<any | null>(null);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    isSuccess?: boolean;
  } | null>(null);

  // Active Type/Tag filters
  const [selectedTagFilter, setSelectedTagFilter] = useState('');

  const fetchRecipes = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await apiClient.getDishes({
        preparations: activeTab === 'preparations'
      });
      setRecipes(data);
    } catch (err) {
      console.error('Error fetching recipes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTags = async () => {
    try {
      const data = await apiClient.getRecipeTags();
      setRecipeTags(data);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  useEffect(() => {
    fetchRecipes();
    fetchTags();
  }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecipes(false);
    fetchTags();
  };

  const handleCreateRecipe = async () => {
    if (!newRecipeName.trim()) return;

    try {
      await apiClient.createRecipe({
        name: newRecipeName,
        isPreparation: activeTab === 'preparations',
        unitOfMeasure: newRecipeUom,
        tagName: newRecipeTagName || undefined
      });
      setIsCreateOpen(false);
      setNewRecipeName('');
      setNewRecipeUom('ud');
      setNewRecipeTagName('');
      setAlertConfig({ title: 'Success', message: 'Recipe created successfully', isSuccess: true });
      fetchRecipes(false);
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to create recipe' });
    }
  };

  const handleDeleteRecipe = async (id: number) => {
    try {
      await apiClient.deleteRecipe(id);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      setAlertConfig({ title: 'Success', message: 'Recipe deleted successfully', isSuccess: true });
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Could not delete recipe' });
    } finally {
      setRecipeToDelete(null);
    }
  };

  const handleAddTag = async (isPrep: boolean) => {
    const name = isPrep ? newPrepTypeInput : newDishTypeInput;
    if (!name.trim()) return;

    try {
      await apiClient.createRecipeTag(name, isPrep);
      if (isPrep) setNewPrepTypeInput('');
      else setNewDishTypeInput('');
      fetchTags();
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Could not create category' });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await apiClient.deleteRecipeTag(tagId);
      setRecipeTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err) {
      console.error(err);
      setAlertConfig({
        title: 'Delete Blocked',
        message:
          'This category cannot be deleted because it is currently assigned to one or more recipes.'
      });
    } finally {
      setTagToDelete(null);
    }
  };

  // Filtered recipes list
  const filteredRecipes = recipes.filter((r) => {
    if (selectedTagFilter && r.tag?.name !== selectedTagFilter) return false;

    if (searchQuery.trim()) {
      return r.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const getStatusVariant = (costPct: number) => {
    if (costPct >= 35) return 'danger';
    if (costPct >= 30) return 'warning';
    return 'success';
  };

  return (
    <View style={{ flex: 1, gap: 14 }}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>
          {activeTab === 'preparations' ? 'Preparations' : 'Recipes & Drinks'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setIsManageTypesOpen(true)}
            style={{
              borderWidth: 1,
              borderColor: '#e2e1dd',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: '#ffffff'
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>
              Manage Types
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsCreateOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#151515',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8
            }}
          >
            <Plus size={14} color="#ffffff" />
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>
              Create
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: '#e2e1dd',
          paddingBottom: 1
        }}
      >
        <TouchableOpacity
          onPress={() => {
            setActiveTab('dishes');
            setSelectedTagFilter('');
          }}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: activeTab === 'dishes' ? 2 : 0,
            borderBottomColor: '#151515'
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: activeTab === 'dishes' ? '700' : '500',
              color: activeTab === 'dishes' ? '#151515' : '#8c8c89',
              fontFamily: 'Sora'
            }}
          >
            Recipes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setActiveTab('preparations');
            setSelectedTagFilter('');
          }}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: activeTab === 'preparations' ? 2 : 0,
            borderBottomColor: '#151515'
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: activeTab === 'preparations' ? '700' : '500',
              color: activeTab === 'preparations' ? '#151515' : '#8c8c89',
              fontFamily: 'Sora'
            }}
          >
            Preparations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Tag Filter */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#e2e1dd',
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 38
          }}
        >
          <Search size={16} color="#8c8c89" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search recipe..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8c8c89"
            style={{
              flex: 1,
              fontSize: 12,
              color: '#151515',
              fontFamily: 'Sora',
              height: '100%',
              padding: 0
            }}
          />
        </View>

        {/* Horizontal tags filter inside header */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          <TouchableOpacity
            onPress={() => setSelectedTagFilter('')}
            style={{
              paddingHorizontal: 12,
              height: 38,
              justifyContent: 'center',
              borderRadius: 10,
              backgroundColor: !selectedTagFilter ? '#151515' : '#ffffff',
              borderWidth: 1,
              borderColor: !selectedTagFilter ? '#151515' : '#e2e1dd'
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: !selectedTagFilter ? '#ffffff' : '#8c8c89',
                fontFamily: 'Sora'
              }}
            >
              All Types
            </Text>
          </TouchableOpacity>
          {recipeTags
            .filter((t) => t.isPreparation === (activeTab === 'preparations'))
            .map((tag) => (
              <TouchableOpacity
                key={tag.id}
                onPress={() => setSelectedTagFilter(tag.name)}
                style={{
                  paddingHorizontal: 12,
                  height: 38,
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: selectedTagFilter === tag.name ? '#151515' : '#ffffff',
                  borderWidth: 1,
                  borderColor: selectedTagFilter === tag.name ? '#151515' : '#e2e1dd'
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: selectedTagFilter === tag.name ? '#ffffff' : '#8c8c89',
                    fontFamily: 'Sora'
                  }}
                >
                  {tag.name}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1f8f5c" />
        </View>
      ) : (
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => String(item.id)}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => {
            const salePrice = item.base || 0; // GRP (before tax)
            const cost = item.cost || 0; // portion cost from API
            const marginPct = item.margin ? item.margin * 100 : 0;
            const costPct = item.margin
              ? (1 - item.margin) * 100
              : salePrice > 0
                ? (cost / salePrice) * 100
                : 0;
            const labelVariant = getStatusVariant(costPct);

            return (
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/recipes/[id]', params: { id: item.dbId || item.id } })
                }
                style={{
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#e2e1dd',
                  padding: 14,
                  borderRadius: 14,
                  marginBottom: 10,
                  shadowColor: '#151515',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.02,
                  shadowRadius: 2,
                  elevation: 1
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#151515',
                        fontFamily: 'Sora'
                      }}
                    >
                      {item.name}
                    </Text>
                    {item.tag?.name && (
                      <Text
                        style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'Sora', marginTop: 2 }}
                      >
                        {activeTab === 'preparations' ? 'Preparation type' : 'Dish type'}:{' '}
                        {item.tag.name}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Badge
                      label={
                        labelVariant === 'danger'
                          ? 'Alert'
                          : labelVariant === 'warning'
                            ? 'Warning'
                            : 'Stable'
                      }
                      variant={labelVariant}
                    />
                    <TouchableOpacity
                      onPress={() => setRecipeToDelete(item)}
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={15} color="#b23a3a" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    borderTopWidth: 1,
                    borderTopColor: '#f1f0ec',
                    paddingTop: 8
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 9,
                        color: '#8c8c89',
                        fontFamily: 'Sora',
                        textTransform: 'uppercase'
                      }}
                    >
                      GRP
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: '#151515',
                        fontFamily: 'DM Mono'
                      }}
                    >
                      €{Number(salePrice).toFixed(2)}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 9,
                        color: '#8c8c89',
                        fontFamily: 'Sora',
                        textTransform: 'uppercase'
                      }}
                    >
                      Cost
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: '#151515',
                        fontFamily: 'DM Mono'
                      }}
                    >
                      €{Number(cost).toFixed(2)}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 9,
                        color: '#8c8c89',
                        fontFamily: 'Sora',
                        textTransform: 'uppercase'
                      }}
                    >
                      Margin
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: '#1f8f5c',
                        fontFamily: 'DM Mono'
                      }}
                    >
                      {Number(marginPct).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={() => (
            <View style={{ padding: 32, alignItems: 'center', gap: 10, marginTop: 20 }}>
              <AlertCircle size={32} color="#8c8c89" />
              <Text
                style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}
              >
                No recipes found
              </Text>
            </View>
          )}
        />
      )}

      {/* Create Modal */}
      <Modal visible={isCreateOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Create New Recipe</Text>
            <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input
              label="Recipe Name"
              value={newRecipeName}
              onChangeText={setNewRecipeName}
              placeholder="e.g. Negroni"
            />
            <Input
              label="Unit of Measure"
              value={newRecipeUom}
              onChangeText={setNewRecipeUom}
              placeholder="ud, L, kg"
            />

            <Text style={styles.inputLabel}>
              {activeTab === 'preparations' ? 'Preparation Type' : 'Dish Type'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginVertical: 6 }}
            >
              {recipeTags
                .filter((t) => t.isPreparation === (activeTab === 'preparations'))
                .map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => setNewRecipeTagName(tag.name)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: newRecipeTagName === tag.name ? '#151515' : '#ffffff',
                      borderWidth: 1,
                      borderColor: newRecipeTagName === tag.name ? '#151515' : '#e2e1dd'
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: newRecipeTagName === tag.name ? '#ffffff' : '#151515',
                        fontFamily: 'Sora'
                      }}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button
                title="Cancel"
                onPress={() => setIsCreateOpen(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button title="Create" onPress={handleCreateRecipe} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Manage Types Modal */}
      <Modal visible={isManageTypesOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Manage Categories</Text>
            <TouchableOpacity onPress={() => setIsManageTypesOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Dish Types column */}
            <Text style={styles.subHeading}>Dish Types</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                value={newDishTypeInput}
                onChangeText={setNewDishTypeInput}
                placeholder="New dish category"
                placeholderTextColor="#8c8c89"
                style={styles.inlineInput}
              />
              <Button title="Add" onPress={() => handleAddTag(false)} />
            </View>
            {recipeTags
              .filter((t) => !t.isPreparation)
              .map((tag) => (
                <View key={tag.id} style={styles.tagRow}>
                  <Text style={styles.tagName}>{tag.name}</Text>
                  <TouchableOpacity onPress={() => setTagToDelete(tag)} style={{ padding: 4 }}>
                    <Trash2 size={14} color="#b23a3a" />
                  </TouchableOpacity>
                </View>
              ))}

            {/* Preparation Types column */}
            <Text style={[styles.subHeading, { marginTop: 24 }]}>Preparation Types</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                value={newPrepTypeInput}
                onChangeText={setNewPrepTypeInput}
                placeholder="New preparation category"
                placeholderTextColor="#8c8c89"
                style={styles.inlineInput}
              />
              <Button title="Add" onPress={() => handleAddTag(true)} />
            </View>
            {recipeTags
              .filter((t) => t.isPreparation)
              .map((tag) => (
                <View key={tag.id} style={styles.tagRow}>
                  <Text style={styles.tagName}>{tag.name}</Text>
                  <TouchableOpacity onPress={() => setTagToDelete(tag)} style={{ padding: 4 }}>
                    <Trash2 size={14} color="#b23a3a" />
                  </TouchableOpacity>
                </View>
              ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Recipe Confirm */}
      <ConfirmAlert
        visible={recipeToDelete !== null}
        title="Delete Recipe"
        message={`Are you sure you want to delete "${recipeToDelete?.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => recipeToDelete !== null && handleDeleteRecipe(recipeToDelete.id)}
        onCancel={() => setRecipeToDelete(null)}
        variant="danger"
      />

      {/* Delete Tag Confirm */}
      <ConfirmAlert
        visible={tagToDelete !== null}
        title="Delete Category"
        message={`Are you sure you want to delete category "${tagToDelete?.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => tagToDelete !== null && handleDeleteTag(tagToDelete.id)}
        onCancel={() => setTagToDelete(null)}
        variant="danger"
      />

      {/* Custom alert overlays */}
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fafaf8',
    paddingTop: 48
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e1dd',
    backgroundColor: '#ffffff'
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora'
  },
  modalBody: {
    padding: 20
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8c8c89',
    marginBottom: 4,
    fontFamily: 'Sora',
    textTransform: 'uppercase'
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
    marginBottom: 10
  },
  inlineInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#151515',
    fontFamily: 'Sora',
    height: 38
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edece8'
  },
  tagName: {
    fontSize: 13,
    color: '#151515',
    fontFamily: 'Sora'
  }
});
