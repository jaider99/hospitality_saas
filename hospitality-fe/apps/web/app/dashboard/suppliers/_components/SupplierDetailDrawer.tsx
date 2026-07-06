import React, { useState, useEffect } from 'react';
import { X, Phone, MoreVertical, Plus, Edit2, Trash2 } from 'lucide-react';
import { Supplier, SupplierContact, SupplierContactCreate, SupplierUpdate } from '../types';
import ContactForm from './ContactForm';
import CategorySelector from './CategorySelector';
import ConfirmModal from './ConfirmModal';
import { updateSupplier } from '../api';

interface SupplierDetailDrawerProps {
  supplier: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSupplier: (id: number, data: SupplierUpdate) => Promise<void>;
  onDeleteSupplier: (id: number) => void;
}

export default function SupplierDetailDrawer({ supplier, isOpen, onClose, onUpdateSupplier, onDeleteSupplier }: SupplierDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'contacts' | 'purchases' | 'configuration' | 'payments'>('contacts');
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<SupplierUpdate>({});
  const [contactToDelete, setContactToDelete] = useState<number | null>(null);

  // Notes state
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  // Reset state when supplier changes
  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        legal_name: supplier.legal_name || '',
        vat_id: supplier.vat_id || '',
        address: supplier.address || '',
        category_id: supplier.category_id,
        accounting_account: supplier.accounting_account || '',
        sanitary_registration: supplier.sanitary_registration || '',
        supplier_code: supplier.supplier_code || '',
      });
      setIsEditing(false);
      setIsCreatingContact(false);
      setEditingContactIndex(null);
    }
  }, [supplier]);

  const handleInfoChange = (field: keyof SupplierUpdate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async () => {
    if (!supplier) return;
    setIsSaving(true);
    try {
      await onUpdateSupplier(supplier.id!, formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update supplier", error);
    } finally {
      setIsSaving(false);
    }
  };

  // In a real app, you would fetch fresh supplier data or manage state via a global store
  const handleSaveContact = async (newContact: SupplierContactCreate) => {
    if (!supplier) return;
    try {
      const currentContacts = supplier.contact_list ? supplier.contact_list.map(c => ({
        id: c.id,
        name: c.name,
        position: c.position || '',
        email: c.email || '',
        phone: c.phone || '',
        contact_preference: c.contact_preference || 'phone',
        is_main_contact: c.is_main_contact
      })) : [];

      await onUpdateSupplier(supplier.id!, {
        contacts: [...currentContacts, newContact]
      });
      setIsCreatingContact(false);
    } catch (error) {
      console.error("Failed to add contact", error);
    }
  };

  const handleUpdateContact = async (index: number, updatedContact: SupplierContactCreate) => {
    if (!supplier || !supplier.contact_list) return;
    try {
      const currentContacts = supplier.contact_list.map(c => ({
        id: c.id,
        name: c.name,
        position: c.position || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        contact_preference: c.contact_preference || undefined,
        is_main_contact: c.is_main_contact
      })) as any[];
      
      currentContacts[index] = {
        name: updatedContact.name,
        position: updatedContact.position || '',
        email: updatedContact.email || '',
        phone: updatedContact.phone || '',
        contact_preference: updatedContact.contact_preference || 'phone',
        is_main_contact:  updatedContact.is_main_contact || false
      };

      await onUpdateSupplier(supplier.id!, {
        contacts: currentContacts
      });
      setEditingContactIndex(null);
    } catch (error) {
      console.error("Failed to update contact", error);
    }
  };

  const handleDeleteContactClick = (index: number) => {
    setContactToDelete(index);
  };

  const confirmDeleteContact = async () => {
    if (!supplier || !supplier.contact_list || contactToDelete === null) return;
    
    try {
      const remainingContacts = supplier.contact_list
        .filter((_, idx) => idx !== contactToDelete)
        .map(c => ({
          id: c.id,
          name: c.name,
          position: c.position || '',
          email: c.email || '',
          phone: c.phone || '',
          contact_preference: c.contact_preference || 'phone',
          is_main_contact: c.is_main_contact
        }));

      await onUpdateSupplier(supplier.id!, { contacts: remainingContacts });
    } catch (error) {
      console.error("Failed to delete contact", error);
    } finally {
      setContactToDelete(null);
    }
  };

  if (!isOpen || !supplier) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex max-w-full">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-screen max-w-3xl transform bg-gray-50 shadow-2xl transition-transform ease-in-out duration-300 translate-x-0 h-full flex flex-col">
        
        {isEditing ? (
          <div className="bg-white px-6 py-6 border-b border-gray-200 shadow-sm z-10 relative">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800">Edit supplier</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Commercial name *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name || ''}
                    onChange={(e) => handleInfoChange('name', e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Supplier code</label>
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                  <CategorySelector 
                    value={formData.category_id ?? null} 
                    onChange={(val) => handleInfoChange('category_id', val)} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fiscal name</label>
                  <input 
                    type="text" 
                    value={formData.legal_name || ''}
                    onChange={(e) => handleInfoChange('legal_name', e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">VAT number (recommended)</label>
                  <input 
                    type="text" 
                    value={formData.vat_id || ''}
                    onChange={(e) => handleInfoChange('vat_id', e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Accounting account</label>
                  <input 
                    type="text" 
                    value={formData.accounting_account || ''}
                    onChange={(e) => handleInfoChange('accounting_account', e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sanitary authorization or registry no.</label>
                  <input 
                    type="text" 
                    value={formData.sanitary_registration || ''}
                    onChange={(e) => handleInfoChange('sanitary_registration', e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address</label>
                  <input 
                    type="text" 
                    value={formData.address || ''}
                    onChange={(e) => handleInfoChange('address', e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving || !formData.name}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white px-6 py-6 border-b border-gray-200">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 font-bold text-xl uppercase">
                  {supplier.name.substring(0, 2)}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">{supplier.name}</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 shadow-sm transition-colors"
                >
                  <Edit2 size={14} className="mr-2" /> Edit
                </button>
                <button 
                  onClick={() => onDeleteSupplier(supplier.id!)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete Supplier"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-y-6 gap-x-4 text-sm">
              <div>
                <h4 className="text-gray-500 mb-1">Fiscal name</h4>
                <p className="font-medium text-gray-900 uppercase">{supplier.legal_name || '—'}</p>
              </div>
              <div>
                <h4 className="text-gray-500 mb-1">NIF / CIF</h4>
                <p className="font-medium text-gray-900 uppercase">{supplier.vat_id || '—'}</p>
              </div>
              <div>
                <h4 className="text-gray-500 mb-1">Sanitary authorization or registry no.</h4>
                <p className="font-medium text-gray-900">{supplier.sanitary_registration || '—'}</p>
              </div>
              <div>
                <h4 className="text-gray-500 mb-1">Supplier code</h4>
                <p className="font-medium text-gray-900">{supplier.supplier_code || '—'}</p>
              </div>
              
              <div className="col-span-2">
                <h4 className="text-gray-500 mb-1">Accounting account</h4>
                <p className="font-medium text-gray-900">{supplier.accounting_account || '—'}</p>
              </div>
              <div className="col-span-2">
                <h4 className="text-gray-500 mb-1">Address</h4>
                <p className="font-medium text-gray-900">{supplier.address || '—'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white px-6 border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              className={`py-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'contacts' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('contacts')}
            >
              Contacts
            </button>
            <button
              className={`py-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'purchases' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('purchases')}
            >
              Purchases
            </button>
            <button
              className={`py-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'configuration' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('configuration')}
            >
              Configuration
            </button>
            <button
              className={`py-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'payments' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('payments')}
            >
              Payments
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'contacts' && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Contacts</h3>
                <button 
                  onClick={() => { setIsCreatingContact(true); setEditingContactIndex(null); }}
                  className="flex items-center text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 shadow-sm"
                >
                  <Plus size={16} className="mr-1" /> New contact
                </button>
              </div>

              {isCreatingContact && (
                <ContactForm 
                  onSave={handleSaveContact} 
                  onCancel={() => setIsCreatingContact(false)} 
                />
              )}

              <div className="space-y-4">
                {supplier.contact_list && supplier.contact_list.length > 0 ? (
                  supplier.contact_list.map((contact, index) => (
                    editingContactIndex === index ? (
                      <ContactForm 
                        key={`edit-${index}`}
                        initialData={contact}
                        onSave={(data) => handleUpdateContact(index, data)} 
                        onCancel={() => setEditingContactIndex(null)} 
                      />
                    ) : (
                      <div key={index} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between shadow-sm">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{contact.name}</h4>
                          {contact.position && <p className="text-sm text-gray-500 mt-0.5">{contact.position}</p>}
                          {contact.email && <p className="text-sm text-gray-500 mt-1">{contact.email}</p>}
                          {contact.phone && <p className="text-sm text-gray-500 mt-0.5">{contact.phone}</p>}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {contact.contact_preference && (
                            <div className="flex items-center px-2 py-1 bg-accent/10 text-accent rounded text-xs font-medium border border-accent/20">
                              <Phone size={12} className="mr-1" /> {contact.contact_preference.charAt(0).toUpperCase() + contact.contact_preference.slice(1)}
                            </div>
                          )}
                          <button 
                            onClick={() => { setEditingContactIndex(index); setIsCreatingContact(false); }}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded transition-colors"
                            title="Edit contact"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteContactClick(index)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete contact"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  ))
                ) : (
                  <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <p className="text-sm text-gray-500">No contacts available for this supplier.</p>
                  </div>
                )}
              </div>

              {/* Notes section */}
              <div className="mt-8">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Notes</h3>
                
                {/* Existing notes */}
                <div className="space-y-4 mb-4">
                  {(supplier.notes || []).map((note, idx) => (
                    <div key={idx} className="bg-secondary/50 border border-gray-200 rounded-xl p-4 relative group shadow-sm">
                      <button 
                        onClick={() => {
                          const newNotes = (supplier.notes || []).filter((_, i) => i !== idx);
                          onUpdateSupplier(supplier.id!, { notes: newNotes });
                        }}
                        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete note"
                      >
                        <Trash2 size={16} />
                      </button>
                      <h4 className="font-semibold text-gray-800 mb-2">{note.title}</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>

                {/* Add new note */}
                <div className="bg-secondary/50 border border-gray-200 rounded-xl p-4 shadow-sm focus-within:ring-2 focus-within:ring-primary transition-shadow">
                  <input 
                    type="text" 
                    value={newNoteTitle}
                    onChange={e => setNewNoteTitle(e.target.value)}
                    placeholder="Insert a title" 
                    className="w-full bg-transparent font-medium text-gray-800 outline-none placeholder-gray-500 mb-2" 
                  />
                  <textarea 
                    value={newNoteContent}
                    onChange={e => setNewNoteContent(e.target.value)}
                    placeholder="Write here" 
                    className="w-full bg-transparent text-sm text-gray-600 outline-none resize-none placeholder-gray-400" 
                    rows={3}
                  ></textarea>
                  <div className="flex justify-end mt-2">
                    <button 
                      type="button"
                      disabled={!newNoteTitle.trim() || !newNoteContent.trim()}
                      onClick={() => {
                        const newNotes = [...(supplier.notes || []), { title: newNoteTitle.trim(), content: newNoteContent.trim() }];
                        onUpdateSupplier(supplier.id!, { notes: newNotes });
                        setNewNoteTitle('');
                        setNewNoteContent('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      Save note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'contacts' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>The {activeTab} view is not yet implemented.</p>
            </div>
          )}
        </div>

      </div>

      <ConfirmModal
        isOpen={contactToDelete !== null}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeleteContact}
        onCancel={() => setContactToDelete(null)}
      />
    </div>
  );
}
