'use client';
import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { useNavigate } from '@/ui/hooks/useNavigate';
import { useParams } from 'next/navigation';
import api from '../services/api';
import { Specialty } from '../@types';
import { useDoctors } from '../hooks/useDoctors';
import Button from '../components/Button';
import Input from '../components/Input';

const EditDoctor: React.FC = () => {
  const { id } = useParams(); // Puxa o ID do médico lá da URL
  const navigate = useNavigate();
  const { specialties } = useDoctors(); 

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [crm, setCrm] = useState('');
  const [crmUf, setCrmUf] = useState('SP');

  // Dispara assim que a tela abre para buscar os dados do médico e preencher os inputs
  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await api.get(`/doctors/${id}`);
        const doctor = response.data;
        setName(doctor.name || '');
        setAddress(doctor.address || '');
        setSpecialty(doctor.specialty || '');
        setCrm(doctor.crm || '');
        setCrmUf(doctor.crmUf || 'SP');
      } catch (error) {
        console.error("Erro ao buscar dados do médico:", error);
        alert("Erro ao carregar os dados. O médico pode não existir.");
        navigate('/doctors');
      }
    };
    fetchDoctor();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Faz o PUT para atualizar os dados no banco
      await api.put(`/doctors/${id}`, {
        name,
        address,
        specialty,
        crm, crmUf
      });

      alert('Médico atualizado com sucesso!');
      navigate('/doctors');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error("Erro ao atualizar médico:", axiosError);
      const errorMessage = axiosError.response?.data?.message || 'Erro ao atualizar. Verifique os dados.';
      alert(errorMessage);
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-med-bg min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-8 rounded-lg shadow-sm w-full max-w-lg flex flex-col gap-6 border-t-4 border-yellow-500">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Editar Médico</h1>
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
            <div className="flex flex-col gap-1">
              <label htmlFor="editdoctor-select-1" className="text-sm font-medium text-gray-700">Especialidade</label>
              <select id="editdoctor-select-1"
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
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditDoctor;
