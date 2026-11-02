'use client';
import React from 'react';
import Input from '../components/Input';
import Select from '../components/Select';
import Button from '../components/Button';
import { useRegister } from '../hooks/useRegister';
import { BRAZILIAN_STATES } from '../constants/ufs';

const Register: React.FC = () => {
  const { formData, updateField, handleRegister, specialties } = useRegister();

  // --- FUNÇÃO DE MÁSCARA DE CPF ---
  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // 1. Remove tudo o que não for número
    value = value.replace(/\D/g, '');

    // 2. Limita a 11 caracteres numéricos
    if (value.length > 11) value = value.slice(0, 11);

    // 3. Aplica a formatação (000.000.000-00)
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');

    // 4. Atualiza o campo no formulário
    updateField('cpf', value);
  };

  const userTypeOptions = [
    { value: 'paciente', label: 'Paciente' },
    { value: 'medico', label: 'Médico' },
  ];

  const specialtyOptions = specialties.map((spec) => ({
    value: spec.id?.toString() || spec.name,
    label: spec.name,
  }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-med-bg p-4">
      <form onSubmit={handleRegister} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md flex flex-col gap-5 border-t-4 border-med-blue">
        <div className="text-center mb-2">
          <h1 className="text-3xl font-bold text-med-blue">Novo Cadastro</h1>
          <p className="text-gray-600 text-sm mt-2">Crie sua conta no Uninerd</p>
        </div>

        <Select
          label="Tipo de Cadastro"
          value={formData.nivel}
          onChange={(e) => updateField('nivel', e.target.value)}
          options={userTypeOptions}
          required
        />

        <Input 
          label="Nome Completo" 
          placeholder="Ex: João Silva"
          value={formData.nome} 
          onChange={(e) => updateField('nome', e.target.value)} 
          required
        />
        
        <Input 
          label="E-mail" 
          type="email" 
          placeholder="seu.email@exemplo.com"
          value={formData.email} 
          onChange={(e) => updateField('email', e.target.value)}
          required
        />

        {/* Campos do Paciente */}
        {formData.nivel === 'paciente' && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700 font-semibold mb-3">📋 Dados do Paciente</p>
            <Input 
              label="CPF" 
              placeholder="000.000.000-00"
              value={formData.cpf} 
              // AQUI: Usamos a nossa função de máscara
              onChange={handleCPFChange}
              required
            />
          </div>
        )}

        {/* Campos do Médico */}
        {formData.nivel === 'medico' && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex flex-col gap-4">
            <p className="text-sm text-green-700 font-semibold">🩺 Dados do Médico</p>
            
            <Input 
              label="Número do CRM" 
              placeholder="Ex: 123456"
              value={formData.crm_numero} 
              onChange={(e) => updateField('crm_numero', e.target.value)}
              required
            />

            <Select
              label="UF do CRM"
              value={formData.crm_uf}
              onChange={(e) => updateField('crm_uf', e.target.value)}
              options={BRAZILIAN_STATES}
              required
            />

            <Select 
              label="Especialidade" 
              value={formData.id_especialidade}
              onChange={(e) => updateField('id_especialidade', e.target.value)}
              options={specialtyOptions}
              required
            />
          </div>
        )}

        <Input 
          label="Senha" 
          type="password" 
          placeholder="••••••••"
          value={formData.senha} 
          onChange={(e) => updateField('senha', e.target.value)}
          required
        />
        
        <Input 
          label="Confirmar Senha" 
          type="password" 
          placeholder="••••••••"
          value={formData.confirmPassword} 
          onChange={(e) => updateField('confirmPassword', e.target.value)}
          required
        />
        
        <Button type="submit" className="mt-2">Finalizar Cadastro</Button>

        <p className="text-center text-sm text-gray-600 mt-2">
          Já tem conta? <a href="/login" className="text-med-blue font-semibold hover:underline">Faça login</a>
        </p>
      </form>
    </div>
  );
};

export default Register;