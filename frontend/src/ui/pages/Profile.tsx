'use client';
import React, { useState, useContext } from 'react';
import { AxiosError } from 'axios';
import { isStrongPassword } from '../utils/validators';
import { useNavigate } from '@/ui/hooks/useNavigate';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';
import Button from '../components/Button';
import Input from '../components/Input';

const Profile: React.FC = () => {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  // Inicia os estados com os dados do usuário logado
  const [nome, setNome] = useState(user?.nome || '');
  const [email] = useState(user?.email || ''); // E-mail não tem 'setEmail' pois não vai mudar
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Monta os dados enviados ao backend
      const dadosAtualizados: { nome: string; senha?: string } = { nome };
      
      // Só envia a senha se o usuário digitou uma nova
      if (senha.trim() !== "") {
        if (senha !== confirmSenha) {
          alert("As senhas não conferem.");
          return;
        }
        if (!isStrongPassword(senha)) {
          alert("A nova senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas e minúsculas, números e caracteres especiais.");
          return;
        }
        dadosAtualizados.senha = senha;
      }

      // Faz a requisição PUT para atualizar o próprio usuário
      const response = await api.put(`/users/${user?.id}`, dadosAtualizados);
      const updatedUser = response.data?.data;

      if (updatedUser) {
        updateUser(updatedUser);
      }

      alert('Perfil atualizado com sucesso!');

    } catch (error: unknown) {
      console.error("Erro ao atualizar perfil:", error);
      const axiosError = error as AxiosError<{ message?: string }>;
      const errorMessage = axiosError?.response?.data?.message || 'Erro ao atualizar. Verifique os dados.';
      alert(errorMessage);
    }
  };

  return (
    <div className="p-8 bg-med-bg min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm w-full max-w-md flex flex-col gap-6 border-t-4 border-purple-500">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Meu Perfil</h1>

        <Input
          label="Nome Completo"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />

        {/* Campo de E-mail bloqueado (readOnly/disabled) */}
        <div className="flex flex-col gap-1 opacity-70 cursor-not-allowed">
          <label className="text-sm font-medium text-gray-700">E-mail (Não alterável)</label>
          <input
            type="email"
            value={email}
            disabled
            className="border border-gray-300 rounded p-2 bg-gray-100 text-gray-500 cursor-not-allowed"
          />
        </div>

        <Input
          label="Nova Senha (deixe em branco para não alterar)"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <Input
          label="Confirmar Nova Senha"
          type="password"
          value={confirmSenha}
          onChange={(e) => setConfirmSenha(e.target.value)}
        />

        <div className="flex gap-4 mt-4">
          <button 
            type="button" 
            onClick={() => navigate('/')} 
            className="w-full bg-gray-200 text-gray-700 py-2 rounded font-medium hover:bg-gray-300 transition-colors"
          >
            Voltar
          </button>
          <Button type="submit" className="w-full">
            Salvar Perfil
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
