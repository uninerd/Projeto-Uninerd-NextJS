'use client';
import React from 'react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  type?: 'danger' | 'info';
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirmar",
  type = 'danger' 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600">{message}</p>
        </div>
        
        <div className="bg-gray-50 p-4 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Cancelar
          </button>
          <Button
            onClick={onConfirm}
            className={`w-auto px-4 py-2 text-sm ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : ''}`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Modal;