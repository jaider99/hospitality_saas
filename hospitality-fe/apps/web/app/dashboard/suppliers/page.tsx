'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Supplier, SupplierCreate, SupplierUpdate } from './types';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from './api';
import SupplierList from './_components/SupplierList';
import ConfirmModal from './_components/ConfirmModal';
import NewSupplierModal from './_components/NewSupplierModal';
import SupplierDetailDrawer from './_components/SupplierDetailDrawer';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (data: SupplierCreate) => {
    try {
      await createSupplier(data);
      await fetchSuppliers();
    } catch (error) {
      console.error("Error creating supplier:", error);
      throw error;
    }
  };

  const handleUpdateSupplier = async (id: number, data: SupplierUpdate) => {
    try {
      const updated = await updateSupplier(id, data);
      // Update local state for drawer
      if (selectedSupplier && selectedSupplier.id === id) {
        setSelectedSupplier(updated);
      }
      await fetchSuppliers();
    } catch (error) {
      console.error("Error updating supplier:", error);
      throw error;
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    setSupplierToDelete(id);
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteSupplier(supplierToDelete);
      if (selectedSupplier && selectedSupplier.id === supplierToDelete) {
        setSelectedSupplier(null);
      }
      await fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
    } finally {
      setSupplierToDelete(null);
    }
  };

  const filteredSuppliers = React.useMemo(() => suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.vat_id && s.vat_id.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [suppliers, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your vendors and purchasing contacts.</p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          
          <button className="flex items-center justify-center p-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter size={18} />
          </button>
          
          <button 
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap shadow-sm"
          >
            <Plus size={18} className="mr-2" />
            New supplier
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <SupplierList 
              suppliers={filteredSuppliers} 
              onSupplierClick={setSelectedSupplier} 
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}
        </div>
      </div>

      {/* Modals & Drawers */}
      <NewSupplierModal 
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateSupplier}
      />

      <SupplierDetailDrawer 
        isOpen={!!selectedSupplier}
        supplier={selectedSupplier}
        onClose={() => setSelectedSupplier(null)}
        onUpdateSupplier={handleUpdateSupplier}
        onDeleteSupplier={handleDeleteSupplier}
      />

      <ConfirmModal
        isOpen={supplierToDelete !== null}
        title="Delete Supplier"
        message="Are you sure you want to permanently delete this supplier? All associated data will be removed. This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeleteSupplier}
        onCancel={() => setSupplierToDelete(null)}
      />

    </div>
  );
}
