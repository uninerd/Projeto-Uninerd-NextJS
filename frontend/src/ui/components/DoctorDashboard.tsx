'use client';
import React, { useState, useContext, useEffect, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';

interface Appointment {
  id: number;
  date: string;
  doctorName: string;
  patientName: string;
  status: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  patientName?: string;
}

const DoctorDashboard: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekSchedule, setWeekSchedule] = useState<{ day: string; dateStr: string; slots: TimeSlot[] }[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/appointments?limit=100');
      // A API retorna { data, total, page, last_page }
      setAppointments(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateWeekSchedule = useCallback(() => {
    const today = new Date();
    const schedule = [];

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });

      const slots: TimeSlot[] = [];
      for (let hour = 8; hour < 18; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;

        const appointmentOnSlot = appointments.find(app => {
          if (!app.date || app.status === 'CANCELADO') return false;
          const appDate = new Date(app.date);
          
          const appDateStr = appDate.getFullYear() + '-' + 
                             String(appDate.getMonth() + 1).padStart(2, '0') + '-' + 
                             String(appDate.getDate()).padStart(2, '0');
          
          const appTimeStr = String(appDate.getHours()).padStart(2, '0') + ":00";
          return appDateStr === dateStr && appTimeStr === timeStr;
        });

        slots.push({
          time: timeStr,
          available: !appointmentOnSlot,
          patientName: appointmentOnSlot?.patientName,
        });
      }

      schedule.push({
        day: dayName,
        dateStr: dateStr,
        slots,
      });
    }

    setWeekSchedule(schedule);
  }, [appointments]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    generateWeekSchedule();
  }, [appointments, generateWeekSchedule]);

  // Estatísticas com verificação de existência
  const scheduledCount = appointments.filter((app) => app.status?.toUpperCase() === 'AGENDADO').length;
  const completedCount = appointments.filter((app) => app.status === 'CONCLUIDO').length;

  const currentDaySchedule = weekSchedule.find(s => s.dateStr === selectedDate);
  
  // Filtra os agendamentos do dia selecionado com SEGURANÇA
  const dailyAppointments = appointments.filter(a => a.date && a.date.includes(selectedDate));

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Carregando painel do médico...</div>;
  }

  return (
    <div className="p-8 bg-med-bg min-h-screen flex flex-col gap-8">
      <header className="bg-gradient-to-r from-green-500 to-green-600 p-8 rounded-lg shadow-lg text-white">
        <h1 className="text-4xl font-bold mb-2">Bem-vindo(a), Dr(a). {user?.nome}!</h1>
        <p className="text-green-100 text-lg">Gerencie sua agenda baseada no banco de dados</p>
      </header>

      {/* Cards de Estatísticas */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-semibold">Agendamentos nesta visão (até 100)</p>
          <p className="text-4xl font-bold text-blue-600 mt-2">{appointments.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm font-semibold">Pendentes</p>
          <p className="text-4xl font-bold text-yellow-600 mt-2">{scheduledCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-semibold">Concluídos</p>
          <p className="text-4xl font-bold text-green-600 mt-2">{completedCount}</p>
        </div>
      </section>

      {/* Agenda Semanal */}
      <section className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">📅 Sua Agenda da Semana</h2>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {weekSchedule.map((daySchedule, idx) => (
            <div
              key={idx}
              className={`flex-shrink-0 p-4 rounded-lg border-2 transition-all cursor-pointer min-w-[140px] ${
                selectedDate === daySchedule.dateStr
                  ? 'bg-blue-100 border-blue-500'
                  : 'bg-gray-50 border-gray-300 hover:border-blue-300'
              }`}
              onClick={() => setSelectedDate(daySchedule.dateStr)}
            >
              <p className="font-semibold text-gray-800 uppercase">{daySchedule.day}</p>
              <p className="text-xs text-gray-500">{daySchedule.dateStr}</p>
              <p className="text-sm text-gray-600 mt-2">
                ✅ {daySchedule.slots.filter((s) => s.available).length} livres
              </p>
            </div>
          ))}
        </div>

        {currentDaySchedule && (
          <div className="mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Horários para {selectedDate}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {currentDaySchedule.slots.map((slot, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg text-center font-semibold border ${
                    slot.available
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-700 border-red-200 shadow-sm'
                  }`}
                  title={slot.patientName ? `Paciente: ${slot.patientName}` : 'Livre'}
                >
                  <p className="text-sm">{slot.time}</p>
                  <p className="text-xs mt-1 truncate">
                    {slot.available ? '✓ Livre' : `✗ ${slot.patientName || 'Ocupado'}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Lista de Pacientes do Dia */}
      <section className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">👥 Lista de Pacientes do Dia</h2>
        {dailyAppointments.length > 0 ? (
           <div className="divide-y divide-gray-200">
              {dailyAppointments.map(app => (
                <div key={app.id} className="py-4 flex justify-between items-center">
                   <div>
                      <p className="font-bold text-gray-800">{app.patientName}</p>
                      <p className="text-sm text-gray-500">
                        {app.date ? new Date(app.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                      </p>
                   </div>
                   <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {app.status}
                   </span>
                </div>
              ))}
           </div>
        ) : (
          <p className="text-gray-500 text-center py-4">Nenhum paciente agendado para esta data.</p>
        )}
      </section>
    </div>
  );
};

export default DoctorDashboard;
