import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Category } from '@hospitality-saas/shared-types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  category?: Category | null;
  categories: Category[];
}

export default function CategoryModal({ isOpen, onClose, onSubmit, category, categories }: CategoryModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#000000');
  const [parentCategoryId, setParentCategoryId] = useState<string | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setDescription(category.description || '');
        setColor(category.color || '#000000');
        setParentCategoryId(category.parent_category_id || '');
      } else {
        setName('');
        setDescription('');
        setColor('#000000');
        setParentCategoryId('');
      }
      setError(null);
    }
  }, [isOpen, category]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit({
        name,
        description: description || null,
        color,
        parent_category_id: parentCategoryId === '' ? null : parentCategoryId
      });
      onClose();
    } catch (err: any) {
      if (err.response?.data?.detail === 'category already exists') {
        setError('A category with this name already exists.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', 
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
    '#000000', '#ffffff', '#475569', '#334155', '#1e293b', '#0f172a'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{category ? 'Edit Category' : 'New Category'}</h2>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              placeholder="e.g. Beverages"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm resize-none"
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color Label
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0 p-0 overflow-hidden"
              />
              <span className="text-sm font-mono text-gray-500 uppercase">{color}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parent Category (Optional)
            </label>
            <select
              value={parentCategoryId}
              onChange={(e) => setParentCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white"
            >
              <option value="">None (Top-level Category)</option>
              {categories.filter(c => !category || c.category_id !== category.category_id).map(c => (
                <option key={c.category_id} value={c.category_id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Select a parent to make this a sub-category.</p>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
              ) : null}
              {category ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
