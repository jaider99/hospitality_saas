import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Supplier } from '../types';
import { Category } from '@hospitality-saas/shared-types';
import { useAuthStore } from '../../../../store/auth';

interface SupplierListProps {
  suppliers: Supplier[];
  onSupplierClick: (supplier: Supplier) => void;
  onDeleteSupplier?: (id: number) => void;
}

interface CategoryGroup {
  id: string;
  name: string;
  color: string;
  suppliers: Supplier[];
}

export default function SupplierList({ suppliers, onSupplierClick, onDeleteSupplier }: SupplierListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const apiClient = useAuthStore(state => state.apiClient);

  React.useEffect(() => {
    apiClient.getCategories().then(setCategories).catch(console.error);
  }, [apiClient]);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-supplier-menu]')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Group suppliers by category
  const groupedSuppliers = useMemo(() => {
    const groups: Record<string, CategoryGroup> = {};

    // Helper to find main category and subcategory
    const getCategoryHierarchy = (categoryId: number | string) => {
      let mainCategory: { id: string | number; name: string; color: string } = { id: 'unassigned', name: 'No category', color: '#ccc' };
      let subCategoryName = '';
      let subCategoryColor = '';
      let subCategoryFontColor = '';
      
      const node: any = categories.find(c => c.category_id === categoryId);
      if (node) {
        if (node.parent_category_id) {
          const parent: any = categories.find(c => c.category_id === node.parent_category_id);
          if (parent) {
            mainCategory = { id: parent.id, name: parent.name, color: parent.color };
            subCategoryName = node.name;
            subCategoryColor = node.color;
            subCategoryFontColor = node.fontColor || '#FFFFFF';
          } else {
            mainCategory = { id: node.id, name: node.name, color: node.color };
          }
        } else {
          mainCategory = { id: node.id, name: node.name, color: node.color };
        }
      }
      
      return { mainCategory, subCategoryName, subCategoryColor, subCategoryFontColor };
    };

    suppliers.forEach(supplier => {
      const { mainCategory, subCategoryName, subCategoryColor, subCategoryFontColor } = 
        supplier.category_id 
          ? getCategoryHierarchy(supplier.category_id)
          : { 
              mainCategory: { id: 'unassigned', name: 'No category', color: '#ccc' },
              subCategoryName: '', subCategoryColor: '', subCategoryFontColor: ''
            };
      
      if (!groups[mainCategory.id]) {
        groups[mainCategory.id] = {
          id: String(mainCategory.id),
          name: mainCategory.name,
          color: mainCategory.color,
          suppliers: []
        };
      }
      groups[mainCategory.id].suppliers.push({
        ...supplier,
        _subCategoryName: subCategoryName,
        _subCategoryColor: subCategoryColor,
        _subCategoryFontColor: subCategoryFontColor
      } as Supplier & { _subCategoryName?: string, _subCategoryColor?: string, _subCategoryFontColor?: string });
    });

    const resultList = Object.values(groups).sort((a, b) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      return a.name.localeCompare(b.name);
    });
    
    return resultList;
  }, [suppliers, categories]);

  // Auto-expand categories when the grouped list changes (e.g., on search or load)
  React.useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    groupedSuppliers.forEach(g => { initialExpanded[g.id] = true; });
    setExpandedCategories(initialExpanded);
  }, [groupedSuppliers]);

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-gray-300 rounded-xl">
        <p className="text-gray-500 font-medium">No suppliers found.</p>
        <p className="text-sm text-gray-400 mt-1">Click "New supplier" to add one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedSuppliers.map((group) => {
        const isExpanded = expandedCategories[group.id];
        
        return (
          <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Category Header */}
            <div 
              className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                isExpanded ? 'rounded-t-xl' : 'rounded-xl'
              }`}
              onClick={() => toggleCategory(group.id)}
            >
              <div className="flex items-center">
                {isExpanded ? (
                  <ChevronDown size={20} className="text-gray-400 mr-2" />
                ) : (
                  <ChevronRight size={20} className="text-gray-400 mr-2" />
                )}
                <div 
                  className="w-3 h-3 rounded-full mr-3" 
                  style={{ backgroundColor: group.color }}
                />
                <h3 className="text-base font-semibold text-gray-900 capitalize">{group.name}</h3>
                <span className="ml-3 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {group.suppliers.length}
                </span>
              </div>
            </div>

            {/* Suppliers List */}
            {isExpanded && (
              <div className="border-t border-gray-100">
                {group.suppliers.map((supplier, idx) => (
                  <div 
                    key={supplier.id}
                    className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      idx !== group.suppliers.length - 1 ? 'border-b border-gray-50' : 'rounded-b-xl'
                    }`}
                    onClick={() => onSupplierClick(supplier)}
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{supplier.name}</h4>
                      {supplier.vat_id && (
                        <p className="text-xs text-gray-500 mt-0.5">VAT: {supplier.vat_id}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 space-x-4">
                      {/* Sub-category display */}
                      {(supplier as any)._subCategoryName && (
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium border border-black/5"
                          style={{ 
                            backgroundColor: (supplier as any)._subCategoryColor || '#f3f4f6',
                            color: (supplier as any)._subCategoryFontColor || '#4b5563'
                          }}
                        >
                          {(supplier as any)._subCategoryName}
                        </span>
                      )}
                      <span>{supplier.contact_list?.length || 0} contacts</span>

                      {/* 3-dot menu */}
                      <div
                        className="relative"
                        data-supplier-menu="true"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                          onClick={() => setActiveDropdown(activeDropdown === supplier.id ? null : supplier.id)}
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {activeDropdown === supplier.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-xl z-50 border border-gray-200 py-1">
                            <button
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                              onClick={() => {
                                setActiveDropdown(null);
                                if (onDeleteSupplier && supplier.id) {
                                  onDeleteSupplier(supplier.id);
                                }
                              }}
                            >
                              🗑 Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
