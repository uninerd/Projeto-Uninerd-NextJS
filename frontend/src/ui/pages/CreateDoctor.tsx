'use client';
import React, { useState } from 'react';
import { AxiosError } from 'axios';
import { useNavigate } from '@/ui/hooks/useNavigate';
import api from '../services/api';
import { useDoctors } from '../hooks/useDoctors';
import { Specialty } from '../@types';
import Button from '../components/Button';
import Input from '../components/Input';

const CreateDoctor: React.FC = () => {
  const navigate = useNavigate();
  // Puxa a lista de especialidades para o Select
  const { specialties } = useDoctors(); 

  // Estados dos campos do médico
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [crm, setCrm] = useState('');
  const [crmUf, setCrmUf] = useState('SP');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Faz o POST direto para a sua API (lembrando do /api para o proxy!)
      await api.post('/doctors', {
        name,
        address,
        specialty,
        crm, crmUf, email, senha
      });

      alert('Médico cadastrado com sucesso!');
      navigate('/doctors'); // Volta para a tabela de médicos
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error("Erro ao cadastrar médico:", axiosError);
      const errorMessage = axiosError.response?.data?.message || 'Erro ao cadastrar. Verifique os dados.';
      alert(errorMessage);
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-med-bg min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-8 rounded-lg shadow-sm w-full max-w-lg flex flex-col gap-6 border-t-4 border-blue-500">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Cadastrar Novo Médico</h1>
        <Input label="E-mail de acesso" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="Senha inicial" type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={8} />
        <Input label="UF do CRM" value={crmUf} onChange={e => setCrmUf(e.target.value.toUpperCase())} required maxLength={2} />

        <Input
          label="Nome Completo"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              label="CRM"
              type="text"
              value={crm}
              onChange={(e) => setCrm(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            {/* Select de Especialidades */}
            <div className="flex flex-col gap-1">
              <label htmlFor="createdoctor-select-1" className="text-sm font-medium text-gray-700">Especialidade</label>
              <select id="createdoctor-select-1"
                className="border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 bg-white"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                required
              >
                <option value="" disabled>Selecione...</option>
                {specialties.map((spec: Specialty) => (
                  <option key={spec.id} value={spec.name}>
                    {spec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Input
          label="Endereço da Clínica/Consultório"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />

        <div className="flex gap-4 mt-4">
          <button 
            type="button" 
            onClick={() => navigate('/doctors')} 
            className="w-full bg-gray-200 text-gray-700 py-2 rounded font-medium hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <Button type="submit" className="w-full">
            Salvar Médico
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateDoctor;
