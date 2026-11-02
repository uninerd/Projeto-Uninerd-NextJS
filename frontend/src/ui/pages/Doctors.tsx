'use client';
import React, { useState, useContext } from 'react';
import { useNavigate } from '@/ui/hooks/useNavigate';
import api from '../services/api';
import Table from '../components/Table';
import Button from '../components/Button';
import Modal from '../components/Modal'; // <-- Importamos o seu novo Modal
import { useDoctors } from '../hooks/useDoctors';
import Pagination from '../components/Pagination';
import { AuthContext } from '../contexts/AuthContext';

const Doctors: React.FC = () => {
  const { doctors, fetchDoctors, currentPage, totalPages, setCurrentPage } = useDoctors();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Estados para o Modal de Exclusão
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  const headers = ['Nome', 'Endereço', 'Especialidade', 'Ações'];

  // Função que abre o modal e guarda qual médico queremos deletar
  const handleOpenDeleteModal = (id: number) => {
    setSelectedDoctorId(id);
    setIsModalOpen(true);
  };

  // Função que realmente deleta o médico via API
  const handleConfirmDelete = async () => {
    if (!selectedDoctorId) return;

    try {
      await api.delete(`/doctors/${selectedDoctorId}`);
      alert('Médico removido com sucesso!');
      fetchDoctors(); // Atualiza a tabela na hora
    } catch (error) {
      console.error("Erro ao deletar médico:", error);
      alert('Não foi possível excluir o médico. Verifique se ele possui agendamentos vinculados.');
    } finally {
      setIsModalOpen(false);
      setSelectedDoctorId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-med-bg min-h-screen flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <h1 className="text-2xl font-bold text-gray-800">Médicos</h1>
        {user?.nivel === 'admin' && <Button className="w-auto px-6" onClick={() => navigate('/doctors/new')}>
          Cadastrar Médico
        </Button>}
      </div>

      <Table headers={headers} currentPage={currentPage}>
        {doctors.map((doc) => (
          <tr key={doc.id} className="hover:bg-gray-50 border-b">
            <td className="p-4">{doc.name}</td>
            <td className="p-4">{doc.address}</td>
            <td className="p-4">{doc.specialty}</td>
            <td className="p-4 flex gap-4">
              {(user?.nivel === 'admin' || (user?.nivel === 'medico' && user.id === doc.id)) && (
                <>
                  <button 
                    className="text-med-blue hover:underline font-medium"
                    onClick={() => navigate(`/doctors/edit/${doc.id}`)}
                  >
                    Editar
                  </button>
                  {user?.nivel === 'admin' && <button 
                    className="text-red-500 hover:text-red-700 font-medium"
                    onClick={() => handleOpenDeleteModal(doc.id)}
                  >
                    Excluir
                  </button>}
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Nosso Modal Reutilizável em ação! */}
      <Modal 
        isOpen={isModalOpen}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja remover este médico? Esta ação não pode ser desfeita."
        confirmText="Sim, Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Doctors;
