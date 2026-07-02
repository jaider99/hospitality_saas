import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import categoriesData from '../../../../data/categories.json';

interface CategorySelectorProps {
  value: string | null;
  onChange: (categoryId: string) => void;
  error?: string;
}

export default function CategorySelector({ value, onChange, error }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Flatten for the selected value display only
  const flatOptionsMap = useMemo(() => {
    const map = new Map<string, { name: string, color: string, path: string }>();
    const traverse = (nodes: any[], currentPath: string) => {
      nodes.forEach((node) => {
        const path = currentPath ? `${currentPath} > ${node.name}` : node.name;
        map.set(node.id, { name: node.name, color: node.color, path });
        if (node.subcategories?.length) traverse(node.subcategories, path);
      });
    };
    if (categoriesData?.categories) traverse(categoriesData.categories, '');
    return map;
  }, []);

  const selectedOption = value ? flatOptionsMap.get(value) : null;

  // Recursive component for rendering the tree nodes
  const CategoryNode = ({ node, depth }: { node: any, depth: number }) => {
    const hasChildren = node.subcategories && node.subcategories.length > 0;
    // Default to closed for all levels
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="w-full">
        <div
          className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
            value === node.id ? 'bg-primary/5' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
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

          {/* Selection Area */}
          <button 
            className="flex items-center flex-1 min-w-0"
            onClick={(e) => {
              e.stopPropagation();
              onChange(node.id);
              setIsOpen(false);
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full mr-2.5 flex-shrink-0"
              style={{ backgroundColor: node.color || '#ccc' }}
            />
            <span className="font-medium text-gray-700">{node.name}</span>
            {value === node.id && <Check size={14} className="text-primary ml-auto flex-shrink-0" />}
          </button>
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
          {(!categoriesData || !categoriesData.categories || categoriesData.categories.length === 0) ? (
            <div className="p-3 text-sm text-gray-500">No categories found</div>
          ) : (
            categoriesData.categories.map((node: any) => (
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
