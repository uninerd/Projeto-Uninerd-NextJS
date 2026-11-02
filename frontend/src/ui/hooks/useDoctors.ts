import { useState, useEffect } from 'react';
import api from '../services/api';
import { Doctor, Specialty } from '../@types';

export const useDoctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(false);
  const limit = 100; // Itens por página

  const fetchDoctors = async (page: number = 1, specialty?: string) => {
    try {
      setLoading(true);
      let url = `/doctors?page=${page}&limit=${limit}`;
      if (specialty) {
        url += `&specialty=${encodeURIComponent(specialty)}`;
      }
      const response = await api.get(url);
      setDoctors(response.data.data);
      setTotalPages(response.data.last_page);
      setTotalItems(response.data.total);
      setCurrentPage(response.data.page);
    } catch (error) {
      console.error('Erro ao buscar médicos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const response = await api.get('/specialties');
      setSpecialties(response.data);
    } catch (error) {
      console.error('Erro ao buscar especialidades:', error);
    }
  };

  const searchDoctorsBySpecialty = async (specialty: string) => {
    setCurrentPage(1); // Resetar para a primeira página ao pesquisar
    return fetchDoctors(1, specialty);
  };

  useEffect(() => { 
    fetchDoctors(currentPage); 
    fetchSpecialties(); 
  }, [currentPage]);

  return { doctors, specialties, fetchDoctors, fetchSpecialties, searchDoctorsBySpecialty, loading, currentPage, totalPages, totalItems, setCurrentPage };
};
