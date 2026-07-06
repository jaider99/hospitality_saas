import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'success' | 'warning' | 'info';
}

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText, 
  onConfirm, 
  onCancel,
  variant
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isSuccess = variant === 'success' || title.toLowerCase().includes('success') || title.toLowerCase().includes('saved') || title.toLowerCase().includes('uploaded');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onCancel} />
      
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm transform transition-all p-6 border border-gray-100">
        <div className="absolute top-4 right-4">
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex flex-col items-center text-center mt-2">
          {isSuccess ? (
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4 text-[#1f8f5c] ring-4 ring-green-50/50">
              <Check size={24} />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-600 ring-4 ring-red-50/50">
              <AlertTriangle size={24} />
            </div>
          )}
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed px-2">{message}</p>
          
          <div className="flex space-x-3 w-full">
            {cancelText && (
              <button 
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button 
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                isSuccess 
                  ? 'bg-primary hover:opacity-90 text-white'
                  : cancelText 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-primary hover:opacity-90 text-white'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
