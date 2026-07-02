import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Supplier } from '../types';
import categoriesData from '../../../../data/categories.json';

interface SupplierListProps {
  suppliers: Supplier[];
  onSupplierClick: (supplier: Supplier) => void;
}

interface CategoryGroup {
  id: string;
  name: string;
  color: string;
  suppliers: Supplier[];
}

export default function SupplierList({ suppliers, onSupplierClick }: SupplierListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Group suppliers by category
  const groupedSuppliers = useMemo(() => {
    const groups: Record<string, CategoryGroup> = {};
    const noCategoryGroup: CategoryGroup = {
      id: 'none',
      name: 'No category',
      color: '#ccc',
      suppliers: []
    };

    // Helper to find main category and subcategory
    const getCategoryHierarchy = (categoryId: string) => {
      let mainCategory = { id: 'none', name: 'No category', color: '#ccc' };
      let subCategoryName = '';
      let subCategoryColor = '';
      let subCategoryFontColor = '';
      
      const search = (nodes: any[], parentNode: any | null = null) => {
        for (const node of nodes) {
          if (node.id === categoryId) {
            if (parentNode) {
               mainCategory = { id: parentNode.id, name: parentNode.name, color: parentNode.color };
               subCategoryName = node.name;
               subCategoryColor = node.color;
               subCategoryFontColor = node.fontColor || '#FFFFFF';
            } else {
               mainCategory = { id: node.id, name: node.name, color: node.color };
            }
            return true;
          }
          if (node.subcategories && search(node.subcategories, parentNode || node)) {
             return true;
          }
        }
        return false;
      };
      
      if (categoriesData && categoriesData.categories) {
        search(categoriesData.categories);
      }
      return { mainCategory, subCategoryName, subCategoryColor, subCategoryFontColor };
    };

    suppliers.forEach(supplier => {
      if (!supplier.category_id) {
        noCategoryGroup.suppliers.push(supplier);
      } else {
        const { mainCategory, subCategoryName, subCategoryColor, subCategoryFontColor } = getCategoryHierarchy(supplier.category_id);
        
        if (!groups[mainCategory.id]) {
          groups[mainCategory.id] = {
            id: mainCategory.id,
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
      }
    });

    const resultList = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    if (noCategoryGroup.suppliers.length > 0) {
      resultList.push(noCategoryGroup);
    }
    
    return resultList;
  }, [suppliers]);

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
          <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Category Header */}
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
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
                      idx !== group.suppliers.length - 1 ? 'border-b border-gray-50' : ''
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
                      <button className="text-gray-400 hover:text-gray-600 p-1" onClick={(e) => { e.stopPropagation(); }}>
                        <MoreHorizontal size={18} />
                      </button>
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
