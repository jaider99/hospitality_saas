import React, { useState } from 'react';
import { Category } from '@hospitality-saas/shared-types';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';

interface CategoryListProps {
  categories: Category[];
  onCategoryClick: (category: Category) => void;
  onDeleteClick: (id: number) => void;
}

export default function CategoryList({ categories, onCategoryClick, onDeleteClick }: CategoryListProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-1">No categories found</h3>
        <p className="text-gray-500">Get started by creating a new category.</p>
      </div>
    );
  }

  // Helper to find parent
  const getParent = (parentId: string | null) => {
    if (!parentId) return null;
    return categories.find(c => c.category_id === parentId) || null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-xl">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Parent Category
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24 rounded-tr-xl">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {categories.map((category, index) => {
            const parent = getParent(category.parent_category_id);
            const isLast = index === categories.length - 1;
            return (
              <tr key={category.id} className="hover:bg-gray-50 transition-colors">
                <td className={`px-6 py-4 whitespace-nowrap ${isLast ? 'rounded-bl-xl' : ''}`}>
                  <div className="flex items-center">
                    <div
                      className="flex-shrink-0 h-4 w-4 rounded-full mr-3 border border-gray-200"
                      style={{ backgroundColor: category.color || '#cccccc' }}
                    ></div>
                    <div className="text-sm font-medium text-gray-900 hover:text-primary cursor-pointer" onClick={() => onCategoryClick(category)}>
                      {category.name}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {parent ? (
                    <div className="flex items-center">
                      <div
                        className="flex-shrink-0 h-3 w-3 rounded-full mr-2 border border-gray-200"
                        style={{ backgroundColor: parent.color || '#cccccc' }}
                      ></div>
                      <span className="text-sm text-gray-700">{parent.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 italic">None</span>
                  )}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative ${isLast ? 'rounded-br-xl' : ''}`}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === category.id ? null : category.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {openMenuId === category.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setOpenMenuId(null)} 
                      />
                      <div className="absolute right-6 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
