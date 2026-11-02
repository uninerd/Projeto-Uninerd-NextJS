'use client';
import React from 'react';
import Input from '../components/Input';
import Button from '../components/Button';
import { useLogin } from '../hooks/useLogin';

const Login: React.FC = () => {
  const { email, setEmail, password, setPassword, handleLogin } = useLogin();

  return (
    <div className="min-h-screen flex items-center justify-center bg-med-bg">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-med shadow-sm w-full max-w-md flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-med-blue text-center">Entrar no Uninerd</h1>
        
        <Input 
          label="E-mail" 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        
        <Input 
          label="Senha" 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        
        <Button type="submit">Entrar</Button>
        
        <a href="/register" className="text-sm text-center text-gray-500 hover:text-med-blue">
          Criar conta
        </a>
      </form>
    </div>
  );
};

export default Login;
