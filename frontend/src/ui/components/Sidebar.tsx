'use client';
import React, { useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthContext } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { user, signOut } = useContext(AuthContext);
  const pathname = usePathname();

  // Lista base de links
  const menuItems = [
    { path: '/', label: 'Início / Agenda', icon: '🏠' },
    { path: '/appointments', label: 'Lista de Consultas', icon: '📅' },
    { path: '/my-schedule', label: 'Meus horários', icon: '🕘' },
    { path: '/doctors', label: 'Buscar Médicos', icon: '🩺' },
    { path: '/profile', label: 'Meu Perfil', icon: '👤' },
    { path: '/notifications', label: 'Notificações', icon: '🔔' },
  ];

  // FILTRAGEM DE ACESSO
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.path === '/my-schedule') return user?.nivel === 'medico';
    if (user?.nivel === 'paciente') {
      // Paciente não vê a aba "Médicos" (pois ele já tem a busca no Dashboard)
      return true;
    }
    
    if (user?.nivel === 'medico') {
      // Médico vê a Agenda (Dashboard), Lista e Perfil. 
      // NÃO vê "Buscar Médicos", pois médico não marca consulta.
      return true;
    }

    return true;
  });

  return (
    <aside className="uninerd-sidebar w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col shadow-sm shrink-0">
      {/* Cabeçalho */}
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-blue-600">Uninerd</h2>
        <p className="text-sm text-gray-500 mt-1">
          {user?.nivel === 'medico' ? 'Dr(a). ' : 'Olá, '}
          {user?.nome?.split(' ')[0]}
        </p>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-4 flex flex-col gap-2">
        {filteredMenuItems.map((item) => {
          const isActive = pathname === item.path || 
                           (item.path !== '/' && pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
              }`}
            >
              <span aria-hidden="true" className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé / Sair */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <span className="text-lg">🚪</span>
          Sair do Sistema
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
