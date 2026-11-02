'use client';
import React from 'react';
import Sidebar from './Sidebar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="uninerd-layout flex min-h-screen bg-med-bg">
      {/* O Menu Lateral Fixo */}
      <Sidebar />
      
      {/* A área principal onde as telas (Home, Médicos, etc) vão renderizar */}
      <main className="flex-1 min-w-0 overflow-x-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;
