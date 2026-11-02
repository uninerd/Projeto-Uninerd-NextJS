'use client';
import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ children, loading, ...rest }) => (
  <button
    className="w-full bg-med-blue text-white p-3 rounded-med font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
    disabled={loading}
    {...rest}
  >
    {loading ? 'Carregando...' : children}
  </button>
);

export default Button;
