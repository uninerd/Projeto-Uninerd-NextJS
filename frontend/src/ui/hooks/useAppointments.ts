import { useState, useEffect } from 'react';
import api from '../services/api';
import { Appointment } from '../@types';

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 10; // Itens por página

  const fetchAppointments = async (page: number = 1) => {
    try {
      // Adicionado o /api
      const response = await api.get(`/appointments?page=${page}&limit=${limit}`);
      setAppointments(response.data.data);
      setTotalPages(response.data.last_page);
      setTotalItems(response.data.total);
      setCurrentPage(response.data.page);
    } catch (error) {
      console.error("Erro ao buscar agendamentos:", error);
    } finally {
      // O finally garante que o loading fique falso, dando erro ou não!
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(currentPage); }, [currentPage]);

  const createAppointment = async (data: {
    date: string;
    doctorId: number;
    patientId?: number;
    type: string;
  }) => {
    await api.post('/appointments', data);
    fetchAppointments();
  };

  return { appointments, loading, fetchAppointments, createAppointment, currentPage, totalPages, totalItems, setCurrentPage };
};
