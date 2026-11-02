'use client';
import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import PatientDashboard from '../components/PatientDashboard';
import DoctorDashboard from '../components/DoctorDashboard';
import Link from 'next/link';

const Home: React.FC = () => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-med-bg">
        <div className="text-center">
          <p className="text-xl text-gray-700">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {user.nivel === 'paciente' ? (
        <PatientDashboard />
      ) : user.nivel === 'medico' ? (
        <DoctorDashboard />
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-med-bg">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Administração Uninerd</h1>
            <p className="mb-6">Gerencie o catálogo de médicos e acompanhe os agendamentos.</p>
            <Link href="/doctors" className="bg-med-blue text-white px-6 py-3 rounded">Gerenciar médicos</Link>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
