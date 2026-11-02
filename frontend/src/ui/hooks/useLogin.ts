import { useState, useContext } from 'react';
import { AxiosError } from 'axios';
import { isValidEmail } from '../utils/validators';
import { useNavigate } from '@/ui/hooks/useNavigate';
import { AuthContext } from '../contexts/AuthContext';

export const useLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Impede o recarregamento da página

    if (!isValidEmail(email)) {
      alert('Por favor, insira um e-mail válido.');
      return;
    }
    
    try {
      await signIn({ email, password });
      navigate('/');
    } catch (error: unknown) {
      console.error("Erro no login:", error);
      const axiosError = error as AxiosError<{ message?: string }>;
      const message = axiosError?.response?.data?.message || 'E-mail ou senha inválidos';
      alert(message);
    }
  };

  return { email, setEmail, password, setPassword, handleLogin };
};