'use client';
import React, { useState, useContext, useEffect } from 'react';
import { AxiosError } from 'axios';
import { useNavigate } from '@/ui/hooks/useNavigate';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '../contexts/AuthContext';
import { useAppointments } from '../hooks/useAppointments';
import { useDoctors } from '../hooks/useDoctors';
import api from '../services/api';
import Button from '../components/Button';
import Input from '../components/Input';
import { Doctor } from '../@types';

const CreateAppointment: React.FC = () => {
  const { user } = useContext(AuthContext);
  const { createAppointment } = useAppointments();
  const { doctors } = useDoctors(); 
  const navigate = useNavigate();
  
  const searchParams = useSearchParams();
  const doctorIdFromUrl = searchParams.get('doctorId');

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [doctorId, setDoctorId] = useState(doctorIdFromUrl || '');
  const [type, setType] = useState('consulta');
  const [availableHours, setAvailableHours] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState('');

  const today = new Date().toISOString().split('T')[0];


  useEffect(() => {
    if (doctorIdFromUrl) {
      setDoctorId(doctorIdFromUrl);
    }
  }, [doctorIdFromUrl]);

  useEffect(() => {
    let active = true;
    setAvailableHours([]);
    setAvailabilityError('');
    if (!doctorId || !date) return;
    api.get(`/doctors/${doctorId}/availability?date=${date}`)
      .then(({ data }) => { if (active) setAvailableHours(data.hours); })
      .catch(() => { if (active) setAvailabilityError('Não foi possível consultar os horários. Selecione a data novamente.'); });
    return () => { active = false; };
  }, [doctorId, date]);

  const getAvailableHours = () => availableHours;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return alert("Selecione um horário.");

    const dateTime = `${date}T${time}:00`;

    try {
      await createAppointment({
        date: dateTime,
        doctorId: Number(doctorId),
        type: type
      });
      alert('Agendamento criado com sucesso!');
      navigate('/appointments'); 
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      alert(axiosError.response?.data?.message || 'Erro ao criar agendamento.');
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-med-bg min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-8 rounded-lg shadow-sm w-full max-w-lg flex flex-col gap-6 border-t-4 border-blue-500">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Novo Agendamento</h1>
        {availabilityError && <p role="alert" className="text-red-600">{availabilityError}</p>}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              label="Data"
              type="date"
              value={date}
              min={today}
              onChange={(e) => {
                setDate(e.target.value);
                setTime(''); 
              }}
              required
            />
          </div>
          
          <div className="flex-1 flex flex-col gap-1">
            <label htmlFor="createappointment-select-1" className="text-sm font-medium text-gray-700">Hora</label>
            <select id="createappointment-select-1"
              className="border border-gray-300 rounded p-[9px] focus:outline-none focus:border-blue-500 bg-white"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            >
              <option value="" disabled>--:--</option>
              {getAvailableHours().map(hour => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="createappointment-select-2" className="text-sm font-medium text-gray-700">Médico</label>
          <select id="createappointment-select-2"
            className={`border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 ${doctorIdFromUrl ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            value={doctorId}
            onChange={(e) => {
              setDoctorId(e.target.value);
              setTime(''); 
            }}
            disabled={!!doctorIdFromUrl}
            required
          >
            <option value="" disabled>Selecione um médico...</option>
            {/* SEGURANÇA: Adicionado ?. para evitar erro se doctors for null */}
            {doctors?.map((doc: Doctor) => (
              <option key={doc.id} value={doc.id}>
                {doc.name} - {doc.specialty}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="createappointment-select-3" className="text-sm font-medium text-gray-700">Tipo de Atendimento</label>
          <select id="createappointment-select-3"
            className="border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 bg-white"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
          >
            <option value="consulta">Consulta</option>
            <option value="exame">Exame</option>
          </select>
        </div>

        <div className="flex gap-4 mt-4">
          <button type="button" onClick={() => navigate('/appointments')} className="w-full bg-gray-200 text-gray-700 py-2 rounded font-medium hover:bg-gray-300 transition-colors">
            Cancelar
          </button>
          <Button type="submit" className="w-full">Confirmar Agendamento</Button>
        </div>
      </form>
    </div>
  );
};

export default CreateAppointment;
