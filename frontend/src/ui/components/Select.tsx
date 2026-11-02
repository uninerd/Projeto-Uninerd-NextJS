'use client';
import React, { useId } from 'react';

interface SelectProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}

const Select: React.FC<SelectProps> = ({ label, value, onChange, options, required = false }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium text-gray-700">{label}</label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">Selecione uma opção</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
