'use client';
import React, { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '../contexts/AuthContext';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  if (loading) return <div>Carregando...</div>;
  return user ? children : <p className="p-8">Carregando sua sessão...</p>;
};

export default PrivateRoute;
