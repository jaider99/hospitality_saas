import React, { useState } from 'react';
import { Category } from '@hospitality-saas/shared-types';
import { MoreHorizontal, Edit, Trash2, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';

interface CategoryListProps {
  categories: Category[];
  onCategoryClick: (category: Category) => void;
  onDeleteClick: (id: number) => void;
}

export default function CategoryList({ categories, onCategoryClick, onDeleteClick }: CategoryListProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Record<string, boolean>>({});

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-1">No categories found</h3>
        <p className="text-gray-500">Get started by creating a new category.</p>
      </div>
    );
  }

  // Toggles the collapse/expand state of a parent category
  const toggleParentCollapse = (parentCategoryId: string) => {
    setCollapsedParentIds((prev) => ({
      ...prev,
      [parentCategoryId]: !prev[parentCategoryId]
    }));
  };

  // Helper to find parent
  const getParent = (parentId: string | null) => {
    if (!parentId) return null;
    return categories.find(c => c.category_id === parentId) || null;
  };

  // 1. Identify root categories (no parent, or parent not present in current list)
  const rootCategories = categories.filter(
    (c) => !c.parent_category_id || !categories.some((parent) => parent.category_id === c.parent_category_id)
  );

  // 2. Find children of a given root category
  const getChildren = (parentCategoryId: string) => {
    return categories.filter((c) => c.parent_category_id === parentCategoryId);
  };

  const renderActionsCell = (category: Category) => {
    const isOpen = openMenuId === category.id;
    return (
      <td className={`px-6 py-3 whitespace-nowrap text-right text-sm font-medium relative ${isOpen ? 'z-40' : ''}`}>
        <button
          onClick={() => setOpenMenuId(isOpen ? null : category.id)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <MoreHorizontal size={18} />
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setOpenMenuId(null)} 
            />
            <div className="absolute right-6 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setOpenMenuId(null);
                  onCategoryClick(category);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <Edit size={14} className="mr-2 text-gray-400" />
                Edit
              </button>
              <button
                onClick={() => {
                  setOpenMenuId(null);
                  onDeleteClick(category.id);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <Trash2 size={14} className="mr-2 text-red-400" />
                Delete
              </button>
            </div>
          </>
        )}
      </td>
    );
  };

  // Renders vertical guides for nested tree view
  const renderTreeLines = (depth: number) => {
    const lines = [];
    for (let i = 0; i < depth - 1; i++) {
      lines.push(
        <div key={i} className="w-4 h-6 border-r border-gray-200 mr-2.5 shrink-0" />
      );
    }
    if (depth > 0) {
      lines.push(
        <CornerDownRight key="branch" size={14} className="text-gray-400 mr-2.5 shrink-0" />
      );
    }
    return lines;
  };

  // Recursive renderer for category node
  const renderCategoryNode = (
    category: Category,
    depth: number,
    visited: Set<string> = new Set()
  ): React.ReactNode => {
    // Prevent infinite recursion in case of data cycles
    if (visited.has(category.category_id)) {
      return null;
    }
    const newVisited = new Set(visited);
    newVisited.add(category.category_id);

    const children = getChildren(category.category_id);
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedParentIds[category.category_id] || false;
    const parent = getParent(category.parent_category_id);

    return (
      <React.Fragment key={category.id}>
        <tr className={`${depth > 0 ? 'bg-gray-50/10' : 'hover:bg-gray-50/80'} hover:bg-gray-50 transition-colors`}>
          <td className="px-6 py-3.5 whitespace-nowrap">
            <div className="flex items-center">
              {renderTreeLines(depth)}
              {hasChildren ? (
                <button
                  onClick={() => toggleParentCollapse(category.category_id)}
                  className="mr-1.5 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors focus:outline-none shrink-0"
                  title={isCollapsed ? "Expand sub-categories" : "Collapse sub-categories"}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
              ) : (
                <div className="w-7 h-7 mr-1.5 shrink-0" /> /* Spacer */
              )}
              <div
                className="flex-shrink-0 h-4 w-4 rounded-full mr-3 border border-gray-200"
                style={{ backgroundColor: category.color || '#cccccc' }}
              ></div>
              <div 
                className={`text-sm ${depth === 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'} hover:text-primary cursor-pointer`}
                onClick={() => onCategoryClick(category)}
              >
                {category.name}
              </div>
            </div>
          </td>
          <td className="px-6 py-3.5 whitespace-nowrap">
            {parent ? (
              <div className="flex items-center">
                <div
                  className="flex-shrink-0 h-3 w-3 rounded-full mr-2 border border-gray-200"
                  style={{ backgroundColor: parent.color || '#cccccc' }}
                ></div>
                <span className="text-sm text-gray-600">{parent.name}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">None</span>
            )}
          </td>
          {renderActionsCell(category)}
        </tr>

        {/* Recursive call for children */}
        {hasChildren && !isCollapsed && children.map((child) => 
          renderCategoryNode(child, depth + 1, newVisited)
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Parent Category
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rootCategories.map((rootCategory) => renderCategoryNode(rootCategory, 0))}
        </tbody>
      </table>
    </div>
  );
}
