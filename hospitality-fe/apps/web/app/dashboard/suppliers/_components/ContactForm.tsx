import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { SupplierContactCreate } from '../types';

interface ContactFormProps {
  initialData?: Partial<SupplierContactCreate>;
  onSave: (data: SupplierContactCreate) => void;
  onCancel?: () => void;
}

export default function ContactForm({ initialData, onSave, onCancel }: ContactFormProps) {
  const [formData, setFormData] = useState<SupplierContactCreate>({
    name: initialData?.name || '',
    position: initialData?.position || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    contact_preference: initialData?.contact_preference || 'phone',
    is_main_contact: initialData?.is_main_contact || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof SupplierContactCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for field when typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = "Name is required.";
    
    if (!formData.email) {
      newErrors.email = "Email is required.";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    
    if (!formData.phone) {
      newErrors.phone = "Phone is required.";
    } else {
      const hasLetters = /[a-zA-Z]/.test(formData.phone);
      if (hasLetters) {
        newErrors.phone = "It should only contain digits.";
      } else {
        const digitsOnly = formData.phone.replace(/\D/g, '');
        if (digitsOnly.length !== 10) {
          newErrors.phone = "It should be of exactly 10 digits.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative mb-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name *</label>
          <input 
            type="text" 
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none text-sm ${
              errors.name ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-200 focus:ring-primary'
            }`}
            placeholder="e.g. John Doe"
          />
          {errors.name && (
            <div className="flex items-center text-red-500 text-xs mt-1.5 font-medium">
              <AlertCircle size={12} className="mr-1" /> {errors.name}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Position</label>
          <input 
            type="text" 
            value={formData.position || ''}
            onChange={(e) => handleChange('position', e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
            placeholder="e.g. Sales Manager"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address *</label>
          <input 
            type="email" 
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none text-sm ${
              errors.email ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-200 focus:ring-primary'
            }`}
            placeholder="e.g. john@example.com"
          />
          {errors.email && (
            <div className="flex items-center text-red-500 text-xs mt-1.5 font-medium">
              <AlertCircle size={12} className="mr-1" /> {errors.email}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
          <input 
            type="tel" 
            value={formData.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none text-sm ${
              errors.phone ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-200 focus:ring-primary'
            }`}
            placeholder="600 000 000"
          />
          {errors.phone && (
            <div className="flex items-center text-red-500 text-xs mt-1.5 font-medium">
              <AlertCircle size={12} className="mr-1" /> {errors.phone}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col space-y-3 pb-12">
        <label className="block text-xs font-semibold text-gray-600">Contact preference</label>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
            {(['phone', 'email', 'whatsapp'] as const).map(pref => (
              <button
                key={pref}
                type="button"
                onClick={() => handleChange('contact_preference', pref)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors flex items-center ${
                  formData.contact_preference === pref 
                    ? 'bg-white shadow-sm border border-gray-200 text-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {pref === 'phone' && <span className="mr-1.5">📞</span>}
                {pref === 'email' && <span className="mr-1.5">✉️</span>}
                {pref === 'whatsapp' && <span className="mr-1.5 text-green-500">💬</span>}
                {pref}
              </button>
            ))}
          </div>

          <label className="flex items-center cursor-pointer ml-4">
            <input 
              type="checkbox"
              checked={formData.is_main_contact}
              onChange={(e) => handleChange('is_main_contact', e.target.checked)}
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <span className="text-sm text-gray-700 font-medium">Main purchasing contact</span>
          </label>
        </div>
      </div>

      <div className="absolute bottom-5 right-5 flex space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!formData.name}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
        >
          Save changes
        </button>
      </div>
    </form>
  );
}
