'use client';
import React, { ReactNode } from 'react';

interface TableProps {
  headers: string[];
  children: ReactNode;
  onPageChange?: (page: number) => void;
  currentPage?: number;
}

const Table: React.FC<TableProps> = ({ headers, children, onPageChange, currentPage }) => (
  <div className="w-full overflow-x-auto bg-white rounded-med shadow-sm border border-gray-100">
    <table className="w-full text-left border-collapse">
      <thead className="bg-med-bg text-gray-600 uppercase text-xs font-bold">
        <tr>{headers.map((h) => <th key={h} className="p-4">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-gray-50">{children}</tbody>
    </table>
    <div className="p-4 flex justify-end gap-2">
      <button onClick={() => onPageChange?.((currentPage || 1) - 1)} className="px-3 py-1 border rounded">Anterior</button>
      <button onClick={() => onPageChange?.((currentPage || 1) + 1)} className="px-3 py-1 border rounded">Próximo</button>
    </div>
  </div>
);

export default Table;
