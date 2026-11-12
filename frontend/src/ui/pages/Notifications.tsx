'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
interface Notification { eventId: string; message: string; timestamp: string; appointmentId: number }
export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const pages = useRef(1);
  const refresh = useCallback(async (moreOffset?: number) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true);
    try {
      const collected: Notification[] = [];
      let next: number | null = moreOffset ?? 0;
      for (let page = 0; page < (moreOffset === undefined ? pages.current : 1) && next !== null; page++) {
        const { data }: { data: { data: Notification[]; nextOffset: number | null } } = await api.get(`/notifications?offset=${next}`, { signal: controller.signal });
        collected.push(...data.data); next = data.nextOffset;
      }
      if (controller.signal.aborted) return;
      setItems(previous => {
        const combined = moreOffset === undefined ? collected : [...previous, ...collected];
        return [...new Map(combined.map(item => [item.eventId, item])).values()];
      });
      if (moreOffset !== undefined) pages.current++;
      setNextOffset(next); setError('');
    } catch { if (!controller.signal.aborted) setError('Não foi possível buscar suas notificações. Tente novamente.'); }
    finally {
      if (!controller.signal.aborted) { setLoading(false); setBusy(false); }
      if (request.current === controller) request.current = null;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = setInterval(update, 5000);
    window.addEventListener('focus', update); document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); request.current?.abort(); request.current = null; };
  }, [refresh]);
  return <section className="p-8 max-w-4xl mx-auto"><header className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">Notificações</h1><button disabled={busy} onClick={() => void refresh()} className="bg-med-blue text-white rounded px-4 py-2">Atualizar</button></header>
    <p className="text-sm text-gray-600 mb-4">Acompanhe agendamentos, alterações, cancelamentos e conclusões. Esta aba atualiza automaticamente a cada 5 segundos.</p>
    {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
    {loading ? <p role="status">Carregando...</p> : items.length ? <ul className="space-y-3">{items.map(item => <li key={item.eventId} className="rounded-lg bg-white p-5 shadow-sm"><p>{item.message}</p><time className="text-sm text-gray-500">{new Date(item.timestamp).toLocaleString('pt-BR')}</time></li>)}</ul> : !error && <p>Você ainda não tem notificações.</p>}
    {nextOffset !== null && <button disabled={busy} onClick={() => void refresh(nextOffset)} className="mt-5 bg-med-blue text-white rounded px-4 py-2">Carregar anteriores</button>}
  </section>;
}
