'use client';
import React, { InputHTMLAttributes, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, ...rest }) => {
  const generatedId = useId();
  const id = rest.id ?? generatedId;
  return (
  <div className="flex flex-col gap-1 w-full">
    <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
    <input
      className={`p-3 border rounded-med bg-med-bg focus:outline-none focus:ring-2 focus:ring-med-blue ${error ? 'border-red-500' : 'border-gray-200'}`}
      {...rest}
      id={id}
      aria-invalid={Boolean(error)}
    />
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
);
};

export default Input;
