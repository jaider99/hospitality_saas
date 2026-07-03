import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Category } from '@hospitality-saas/shared-types';
import { ApiClient } from '@hospitality-saas/api-client';
import { useAuthStore } from '../../../../store/auth';

interface CategorySelectorProps {
  value: string | null;
  onChange: (categoryId: string) => void;
  error?: string;
}

export default function CategorySelector({ value, onChange, error }: CategorySelectorProps) {
  const apiClient = useAuthStore(state => state.apiClient);
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  useEffect(() => {
    apiClient.getCategories().then(setCategories).catch(console.error);
  }, [apiClient]);

  // Build tree from flat list
  const categoryTree = useMemo(() => {
    const rootNodes: any[] = [];
    const map = new Map();
    const mapByStrId = new Map();
    
    categories.forEach(c => {
      const node = { ...c, subcategories: [] };
      map.set(c.id, node);
      mapByStrId.set(c.category_id, node);
    });
    
    categories.forEach(c => {
      const node = map.get(c.id);
      if (c.parent_category_id) {
        const parent = mapByStrId.get(c.parent_category_id);
        if (parent) {
          parent.subcategories.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });
    
    return rootNodes;
  }, [categories]);

  // Flatten for the selected value display only
  const flatOptionsMap = useMemo(() => {
    const map = new Map<string, { name: string, color: string, path: string }>();
    const traverse = (nodes: any[], currentPath: string) => {
      nodes.forEach((node) => {
        const path = currentPath ? `${currentPath} > ${node.name}` : node.name;
        map.set(node.category_id, { name: node.name, color: node.color, path });
        if (node.subcategories?.length) traverse(node.subcategories, path);
      });
    };
    if (categoryTree.length) traverse(categoryTree, '');
    return map;
  }, [categoryTree]);

  const selectedOption = value ? flatOptionsMap.get(value) : null;

  // Recursive component for rendering the tree nodes
  const CategoryNode = ({ node, depth }: { node: any, depth: number }) => {
    const hasChildren = node.subcategories && node.subcategories.length > 0;
    // Default to closed for all levels
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="w-full">
        <div
          className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer ${
            value === node.category_id ? 'bg-primary/5' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={(e) => {
            e.stopPropagation();
            onChange(node.category_id);
            setIsOpen(false);
          }}
        >
          <div className="flex items-center min-w-0">
            {/* Chevron for expanding/collapsing */}
            <div 
              className={`w-6 h-6 flex items-center justify-center mr-1 rounded hover:bg-gray-200 transition-colors ${!hasChildren ? 'invisible' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
            </div>
            <span
              className="w-2.5 h-2.5 rounded-full mr-2.5 flex-shrink-0"
              style={{ backgroundColor: node.color || '#ccc' }}
            />
            <span className="font-medium text-gray-700">{node.name}</span>
          </div>
          {value === node.category_id && <Check size={14} className="text-primary ml-auto flex-shrink-0" />}
        </div>

        {isExpanded && hasChildren && (
          <div className="w-full">
            {node.subcategories.map((child: any) => (
              <CategoryNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full">
      {/* Selector Button */}
      <div
        className={`flex items-center justify-between w-full p-2.5 border rounded-lg cursor-pointer bg-white ${
          error ? 'border-red-500' : isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'
      } focus:outline-none focus:ring-2 focus:ring-primary`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption ? (
          <div className="flex items-center space-x-2 truncate">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selectedOption.color || '#ccc' }}
            />
            <span className="text-sm font-medium text-gray-900 truncate">{selectedOption.path}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">No category</span>
        )}
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Tree */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto py-1">
          {categoryTree.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No categories found</div>
          ) : (
            categoryTree.map((node: any) => (
              <CategoryNode key={node.id} node={node} depth={0} />
            ))
          )}
        </div>
      )}
      
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
