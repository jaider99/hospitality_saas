import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import CategorySelector from './CategorySelector';
import { SupplierCreate, SupplierContactCreate } from '../types';

interface NewSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierCreate) => Promise<void>;
}

export default function NewSupplierModal({ isOpen, onClose, onSubmit }: NewSupplierModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'contacts'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  
  const [formData, setFormData] = useState<SupplierCreate>({
    name: '',
    legal_name: '',
    vat_id: '',
    address: '',
    category_id: null,
    accounting_account: '',
    sanitary_registration: '',
    tags: [],
    contacts: []
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        legal_name: '',
        vat_id: '',
        address: '',
        category_id: null,
        accounting_account: '',
        sanitary_registration: '',
        supplier_code: '',
        tags: [],
        contacts: []
      });
      setActiveTab('info');
      setErrors({});
    }
  }, [isOpen]);

  const handleInfoChange = (field: keyof SupplierCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addContact = () => {
    const newContact: SupplierContactCreate = {
      name: '',
      position: '',
      email: '',
      phone: '',
      contact_preference: 'phone',
      is_main_contact: formData.contacts?.length === 0
    };
    setFormData(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), newContact]
    }));
  };

  const updateContact = (index: number, field: keyof SupplierContactCreate, value: any) => {
    setFormData(prev => {
      const updatedContacts = [...(prev.contacts || [])];
      
      // If setting a contact as main, unset others
      if (field === 'is_main_contact' && value === true) {
        updatedContacts.forEach(c => c.is_main_contact = false);
      }
      
      updatedContacts[index] = { ...updatedContacts[index], [field]: value };
      // Clear error for this specific field
      const fieldStr = field as string;
      if (errors[index]?.[fieldStr]) {
        setErrors(prevErrors => {
          const newErrors = { ...prevErrors };
          if (newErrors[index]) {
            newErrors[index] = { ...newErrors[index] };
            delete newErrors[index][fieldStr];
          }
          return newErrors;
        });
      }
      
      return { ...prev, contacts: updatedContacts };
    });
  };

  const removeContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      contacts: (prev.contacts || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate contacts
    let hasErrors = false;
    const newErrors: Record<string, Record<string, string>> = {};
    
    (formData.contacts || []).forEach((c, idx) => {
      // Only validate if they typed something or it's not totally blank
      if (c.name || c.email || c.phone) {
        newErrors[idx] = {};
        if (!c.name) {
          newErrors[idx].name = "Name is required.";
          hasErrors = true;
        }
        if (!c.email) {
          newErrors[idx].email = "Email is required.";
          hasErrors = true;
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(c.email)) {
          newErrors[idx].email = "Invalid email address.";
          hasErrors = true;
        }
        
        if (!c.phone) {
          newErrors[idx].phone = "Phone is required.";
          hasErrors = true;
        } else {
          const hasLetters = /[a-zA-Z]/.test(c.phone);
          if (hasLetters) {
            newErrors[idx].phone = "It should only contain digits.";
            hasErrors = true;
          } else {
            const digitsOnly = c.phone.replace(/\D/g, '');
            if (digitsOnly.length !== 10) {
              newErrors[idx].phone = "It should be of exactly 10 digits.";
              hasErrors = true;
            }
          }
        }
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      setActiveTab('contacts');
      return;
    }

    setIsSubmitting(true);
    try {
      // Filter out any contacts that don't have a name before submitting
      const cleanData = {
        ...formData,
        contacts: (formData.contacts || []).filter(c => c.name.trim() !== '')
      };
      await onSubmit(cleanData);
      onClose();
    } catch (error) {
      console.error("Failed to create supplier:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">New supplier</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-gray-100 space-x-6">
          <button
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('info')}
          >
            Information
          </button>
          <button
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'contacts' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('contacts')}
          >
            Contacts
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <form id="new-supplier-form" onSubmit={handleSubmit} noValidate>
            
            {activeTab === 'info' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <CategorySelector 
                    value={formData.category_id ?? null} 
                    onChange={(val) => handleInfoChange('category_id', val)} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commercial name *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={(e) => handleInfoChange('name', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier code</label>
                    <input 
                      type="text" 
                      value={formData.supplier_code || ''}
                      onChange={(e) => handleInfoChange('supplier_code', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      placeholder="e.g. SUP-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal name</label>
                    <input 
                      type="text" 
                      value={formData.legal_name || ''}
                      onChange={(e) => handleInfoChange('legal_name', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      placeholder="Legal entity name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VAT number / CIF</label>
                    <input 
                      type="text" 
                      value={formData.vat_id || ''}
                      onChange={(e) => handleInfoChange('vat_id', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      placeholder="e.g. B12345678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input 
                    type="text" 
                    value={formData.address || ''}
                    onChange={(e) => handleInfoChange('address', e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                    placeholder="Full address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sanitary authorization / registry no.</label>
                    <input 
                      type="text" 
                      value={formData.sanitary_registration || ''}
                      onChange={(e) => handleInfoChange('sanitary_registration', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Accounting account</label>
                    <input 
                      type="text" 
                      value={formData.accounting_account || ''}
                      onChange={(e) => handleInfoChange('accounting_account', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      placeholder="e.g. 4000001"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">Supplier Contacts</h3>
                  <button 
                    type="button"
                    onClick={addContact}
                    className="flex items-center text-sm text-primary hover:bg-primary/5 font-medium px-3 py-1.5 rounded-lg transition-colors border border-primary/20"
                  >
                    <Plus size={16} className="mr-1" /> Add Contact
                  </button>
                </div>

                {(formData.contacts || []).length === 0 ? (
                  <div className="text-center py-10 bg-white border border-dashed border-gray-300 rounded-lg">
                    <p className="text-sm text-gray-500">No contacts added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(formData.contacts || []).map((contact, index) => (
                      <div key={index} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm relative group">
                        <button 
                          type="button"
                          onClick={() => removeContact(index)}
                          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={18} />
                        </button>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                            <input 
                              type="text" 
                              value={contact.name}
                              onChange={(e) => updateContact(index, 'name', e.target.value)}
                              className={`w-full p-2 border rounded-lg text-sm outline-none focus:ring-1 ${
                                errors[index]?.name ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-200 focus:ring-primary'
                              }`}
                            />
                            {errors[index]?.name && (
                              <div className="flex items-center text-red-500 text-xs mt-1 font-medium">
                                <AlertCircle size={12} className="mr-1" /> {errors[index].name}
                              </div>
                            )}
                          </div>
                          <div className="pr-6">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Position / Role</label>
                            <input 
                              type="text" 
                              value={contact.position || ''}
                              onChange={(e) => updateContact(index, 'position', e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                            <input 
                              type="email" 
                              value={contact.email || ''}
                              onChange={(e) => updateContact(index, 'email', e.target.value)}
                              className={`w-full p-2 border rounded-lg text-sm outline-none focus:ring-1 ${
                                errors[index]?.email ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-200 focus:ring-primary'
                              }`}
                            />
                            {errors[index]?.email && (
                              <div className="flex items-center text-red-500 text-xs mt-1 font-medium">
                                <AlertCircle size={12} className="mr-1" /> {errors[index].email}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Phone *</label>
                            <input 
                              type="tel" 
                              value={contact.phone || ''}
                              onChange={(e) => updateContact(index, 'phone', e.target.value)}
                              className={`w-full p-2 border rounded-lg text-sm outline-none focus:ring-1 ${
                                errors[index]?.phone ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-200 focus:ring-primary'
                              }`}
                            />
                            {errors[index]?.phone && (
                              <div className="flex items-center text-red-500 text-xs mt-1 font-medium">
                                <AlertCircle size={12} className="mr-1" /> {errors[index].phone}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-50">
                          <div className="flex items-center">
                            <label className="text-xs font-medium text-gray-500 mr-2">Contact Preference:</label>
                            <select
                              value={contact.contact_preference || 'phone'}
                              onChange={(e) => updateContact(index, 'contact_preference', e.target.value)}
                              className="text-sm p-1 border border-gray-200 rounded bg-gray-50 outline-none"
                            >
                              <option value="phone">Phone</option>
                              <option value="email">Email</option>
                              <option value="whatsapp">WhatsApp</option>
                            </select>
                          </div>
                          <label className="flex items-center cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={contact.is_main_contact}
                              onChange={(e) => updateContact(index, 'is_main_contact', e.target.checked)}
                              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                            />
                            <span className="ml-2 text-sm text-gray-700 font-medium">Main purchasing contact</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-supplier-form"
            disabled={isSubmitting || !formData.name}
            className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
          >
            {isSubmitting ? 'Creating...' : 'Create supplier'}
          </button>
        </div>

      </div>
    </div>
  );
}
