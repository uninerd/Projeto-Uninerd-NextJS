'use client';
import { useEffect, useState } from 'react';
import api from '../services/api';
interface Notification { eventId: string; message: string; timestamp: string; appointmentId: number }
export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function refresh() {
    setLoading(true); setError('');
    try { const { data } = await api.get('/notifications'); setItems(data.data); }
    catch { setError('Não foi possível buscar suas notificações. Tente novamente.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <section className="p-8 max-w-4xl mx-auto"><header className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">Notificações</h1><button disabled={loading} onClick={refresh} className="bg-med-blue text-white rounded px-4 py-2">Atualizar</button></header>
    {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
    {loading ? <p role="status">Carregando...</p> : items.length ? <ul className="space-y-3">{items.map(item => <li key={item.eventId} className="rounded-lg bg-white p-5 shadow-sm"><p>{item.message}</p><time className="text-sm text-gray-500">{new Date(item.timestamp).toLocaleString('pt-BR')}</time></li>)}</ul> : !error && <p>Você ainda não tem notificações.</p>}
  </section>;
}
