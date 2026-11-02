import { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { isValidEmail, isValidCPF, isStrongPassword } from '../utils/validators';
import { useNavigate } from '@/ui/hooks/useNavigate';
import api from '../services/api';
import { Specialty } from '../@types';

interface RegisterFormData {
  nome: string;
  email: string;
  cpf: string;
  crm_numero: string;
  crm_uf: string;
  id_especialidade: string;
  senha: string;
  confirmPassword: string;
  nivel: 'paciente' | 'medico';
}

export const useRegister = () => {
  const [formData, setFormData] = useState<RegisterFormData>({ 
    nome: '', 
    email: '', 
    cpf: '', 
    crm_numero: '',
    crm_uf: '',
    id_especialidade: '',
    senha: '', 
    confirmPassword: '',
    nivel: 'paciente'
  });
  
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const response = await api.get('/specialties');
        setSpecialties(response.data || []);
      } catch (error) {
        console.error('Erro ao buscar especialidades:', error);
      }
    };
    fetchSpecialties();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.senha !== formData.confirmPassword) {
      alert('As senhas não conferem');
      return;
    }
    if (!isValidEmail(formData.email)) {
      alert('E-mail inválido.');
      return;
    }
    if (formData.nivel === 'paciente' && !isValidCPF(formData.cpf)) {
      alert('CPF inválido.');
      return;
    }
    if (!isStrongPassword(formData.senha)) {
      alert('A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas e minúsculas, números e caracteres especiais.');
      return;
    }

    try {
      const payload: Record<string, string | number> = {
        nome: formData.nome,
        email: formData.email,
        senha: formData.senha,
        nivel: formData.nivel,
      };

      if (formData.nivel === 'paciente') {
        payload.cpf = formData.cpf;
      } else if (formData.nivel === 'medico') {
        payload.crm_numero = formData.crm_numero;
        payload.crm_uf = formData.crm_uf;
        // IMPORTANTE: enviando com o nome que o backend espera e convertendo para numero
        payload.id_especialidade = Number(formData.id_especialidade);
      }

      await api.post('/users/register', payload);

      alert('Cadastro realizado com sucesso!');
      navigate('/login');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      const message = axiosError?.response?.data?.message || 'Erro ao cadastrar';
      alert(message);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return { formData, updateField, handleRegister, specialties };
};
