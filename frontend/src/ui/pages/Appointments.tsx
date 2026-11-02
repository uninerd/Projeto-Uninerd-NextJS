'use client';
import React, { useContext } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import Pagination from '../components/Pagination';
import { useNavigate } from '@/ui/hooks/useNavigate';
import api from '../services/api';
import { AuthContext } from '../contexts/AuthContext';
import Button from '../components/Button';

const Appointments: React.FC = () => {
  const { user } = useContext(AuthContext);
  const { appointments, loading, fetchAppointments, currentPage, totalPages, setCurrentPage } = useAppointments();
  const navigate = useNavigate();

  const handleDelete = async (id: number) => {
    if (window.confirm('Deseja realmente cancelar este agendamento?')) {
      try {
        await api.delete(`/appointments/${id}`);
        fetchAppointments(currentPage);
        alert('Agendamento cancelado!');
      } catch (error) {
        alert('Erro ao cancelar agendamento.');
      }
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Agendamentos</h1>
        {/* Só mostra o botão se for paciente */}
        {user?.nivel === 'paciente' && (
          <Button onClick={() => navigate('/appointments/new')}>
            Novo Agendamento
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-x-auto border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Data</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                {user?.nivel === 'medico' ? 'Paciente' : 'Médico'}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {appointments.length > 0 ? (
              appointments.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {app.date.slice(0,10).split('-').reverse().join('/')} às {app.date.slice(11,16)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {user?.nivel === 'medico' ? app.patientName : app.doctorName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 capitalize">
                    {app.type || 'consulta'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-3">
                    {app.status === 'AGENDADO' && <>
                    <button 
                      onClick={() => navigate(`/appointments/edit/${app.id}`)}
                      className="text-blue-500 hover:text-blue-700 text-sm font-bold"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(app.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-bold"
                    >
                      Cancelar
                    </button>
                    </>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  Nenhum agendamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default Appointments;
