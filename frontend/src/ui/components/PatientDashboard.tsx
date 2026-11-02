'use client';
import React, { useState, useEffect } from 'react';
import { useNavigate } from '@/ui/hooks/useNavigate';
import Input from './Input';
import Button from './Button';
import { useDoctors } from '../hooks/useDoctors';

const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { doctors, specialties, searchDoctorsBySpecialty, loading } = useDoctors();
  const [searchSpecialty, setSearchSpecialty] = useState('');

  // 1. Corrigindo a lógica de busca/reset
  const handleSearch = async (value: string) => {
    setSearchSpecialty(value);
    
    // Se o valor for vazio (Todos), ele chama a API sem filtro e traz todos os médicos
    if (value === '') {
      await searchDoctorsBySpecialty('');
    } else {
      await searchDoctorsBySpecialty(value);
    }
  };

  return (
    <div className="p-8 bg-med-bg min-h-screen flex flex-col gap-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-600 p-8 rounded-lg shadow-lg text-white">
        <h1 className="text-4xl font-bold mb-2">Bem-vindo(a), Paciente!</h1>
        <p className="text-blue-100 text-lg">Gerencie seus agendamentos com facilidade</p>
      </header>

      {/* Botão de destaque */}
      <div className="flex justify-center -mt-12">
        <Button
          onClick={() => navigate('/appointments/new')}
          className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 text-xl font-bold shadow-xl border-4 border-white transform hover:scale-105 transition-all"
        >
          ✨ Novo Agendamento
        </Button>
      </div>

      {/* Seção de Filtro Organizada */}
      <section className="bg-white p-6 rounded-lg shadow-md max-w-4xl mx-auto w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          🔍 Filtrar Médicos
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Busca por Texto */}
          <Input
            label="Buscar por nome ou termo"
            placeholder="Digite o nome do médico..."
            value={searchSpecialty}
            onChange={(e) => handleSearch(e.target.value)}
          />

          {/* LISTA SUSPENSA (Dropdown) de Especialidades */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Selecione a Especialidade</label>
            <select
              className="border border-gray-300 rounded-lg p-[10px] bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchSpecialty}
              onChange={(e) => handleSearch(e.target.value)}
            >
              <option value="">-- Todos os Médicos --</option>
              {specialties.map((spec) => (
                <option key={spec.id} value={spec.name}>
                  {spec.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Exibição dos Médicos */}
      <section className="max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {searchSpecialty ? `Resultados para: ${searchSpecialty}` : 'Todos os Médicos Disponíveis'}
          </h2>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
            {doctors.length} encontrado(s)
          </span>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-4">Buscando especialistas...</p>
          </div>
        ) : doctors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <span className="text-2xl">🩺</span>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-2 py-1 rounded">
                    CRM {doctor.crm_numero}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 mb-1">{doctor.name}</h3>
                <p className="text-sm font-medium text-blue-600 mb-4">{doctor.specialty || 'Clínico Geral'}</p>
                
                <div className="mt-auto pt-4 border-t border-gray-50">
                  <Button
                    onClick={() => navigate(`/appointments/new?doctorId=${doctor.id}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
                  >
                    Agendar Horário
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-xl shadow-inner text-center border-2 border-dashed border-gray-200">
            <p className="text-gray-500 text-lg">Nenhum médico encontrado com esses critérios.</p>
            <button 
              onClick={() => handleSearch('')}
              className="mt-2 text-blue-600 font-bold hover:underline"
            >
              Limpar filtros e ver todos
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default PatientDashboard;