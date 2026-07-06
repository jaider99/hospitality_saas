'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Category } from '@hospitality-saas/shared-types';
import { ApiClient } from '@hospitality-saas/api-client';
import { useAuthStore } from '../../../store/auth';
import CategoryList from './_components/CategoryList';
import CategoryModal from './_components/CategoryModal';
import ConfirmModal from '../suppliers/_components/ConfirmModal'; // Reuse existing confirm modal

export default function CategoriesPage() {
  const apiClient = useAuthStore(state => state.apiClient);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [apiClient]);

  const handleSubmit = async (data: any) => {
    try {
      if (selectedCategory) {
        await apiClient.updateCategory(selectedCategory.id, data);
      } else {
        await apiClient.createCategory(data);
      }
      await fetchCategories();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('[CategoriesPage] handleSubmit error:', error?.response?.status, error?.response?.data, error?.message);
      throw error;
    }
  };

  const handleEditClick = (category: Category) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const handleNewClick = () => {
    setSelectedCategory(null);
    setIsModalOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await apiClient.deleteCategory(categoryToDelete);
      setAlertMessage(null);
      await fetchCategories();
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Failed to delete category.';
      setAlertMessage(msg);
    } finally {
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = React.useMemo(() => categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [categories, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage product and supplier categories.</p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          
          <button 
            onClick={handleNewClick}
            className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap shadow-sm"
          >
            <Plus size={18} className="mr-2" />
            New category
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <CategoryList 
              categories={filteredCategories} 
              onCategoryClick={handleEditClick} 
              onDeleteClick={setCategoryToDelete}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <CategoryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        category={selectedCategory}
        categories={categories}
      />

      <ConfirmModal
        isOpen={categoryToDelete !== null}
        title="Delete Category"
        message="Are you sure you want to permanently delete this category? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteCategory}
        onCancel={() => setCategoryToDelete(null)}
      />

      <ConfirmModal
        isOpen={alertMessage !== null}
        title="Delete Category Blocked"
        message={alertMessage || ''}
        confirmText="OK"
        onConfirm={() => setAlertMessage(null)}
        onCancel={() => setAlertMessage(null)}
      />

    </div>
  );
}
