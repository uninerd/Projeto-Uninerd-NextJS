'use client';
import { useContext, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';
import Input from '../components/Input';
import DoctorWeekSchedule from '../components/DoctorWeekSchedule';

const hours = Array.from({ length: 10 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
interface Schedule { doctorId: number; date: string; hours: string[]; occupiedHours: string[]; source: 'date' | 'weekly' }
const todayInClinic = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

export default function DoctorSchedule() {
  const { user } = useContext(AuthContext);
  const [date, setDate] = useState(todayInClinic);
  const [selected, setSelected] = useState<string[]>([]);
  const [occupied, setOccupied] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);
  const [source, setSource] = useState<'date' | 'weekly'>('weekly');

  useEffect(() => {
    if (user?.nivel !== 'medico' || !date) return;
    let active = true;
    setLoading(true); setLoaded(false); setError(''); setSuccess(''); setSelected([]); setOccupied([]);
    api.get<Schedule>(`/doctors/${user.id}/schedule?date=${date}`)
      .then(({ data }) => { if (active) { setSelected(data.hours); setOccupied(data.occupiedHours); setSource(data.source); setLoaded(true); } })
      .catch(() => { if (active) setError('Não foi possível carregar sua agenda. Selecione a data novamente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.nivel, date, reload]);

  if (!user || user.id === undefined) return <p className="p-8">Carregando...</p>;
  if (user.nivel !== 'medico') return <p role="alert" className="p-8">Esta área é exclusiva dos médicos.</p>;
  const isPast = (hour: string) => new Date(`${date}T${hour}:00-03:00`).getTime() <= Date.now();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user || loading || saving || !date || !loaded) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const { data } = await api.put<Schedule>(`/doctors/${user.id}/schedule`, { date, hours: [...selected].sort() });
      setSelected(data.hours); setOccupied(data.occupiedHours); setSource(data.source);
      setSuccess('Disponibilidade salva. Os pacientes já podem consultar os horários liberados.');
    } catch (caught) {
      setError((caught as AxiosError<{ message?: string }>).response?.data?.message ?? 'Não foi possível salvar sua agenda.');
    } finally { setSaving(false); }
  }

  return <div className="p-4 sm:p-8 bg-med-bg min-h-screen">
    <DoctorWeekSchedule doctorId={user.id} onSaved={() => setReload(value => value + 1)} />
    <form onSubmit={save} className="max-w-3xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-8 space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-800">Ajustar uma data específica</h2>
        <p className="mt-2 text-gray-600">Use para abrir ou fechar horários de um dia, por exemplo um feriado. Ao salvar, essa data passa a ter sua própria configuração.</p>
      </header>
      <Input label="Data de atendimento" type="date" min={todayInClinic()} value={date} disabled={saving}
        required onChange={event => setDate(event.target.value)} />
      {!loading && loaded && <p className="text-sm text-gray-600">{source === 'weekly' ? 'Usando a agenda semanal. Salvar criará uma exceção para esta data.' : 'Esta data possui uma configuração específica.'}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {success && <p role="status" className="text-green-700">{success}</p>}
      {loading ? <p>Carregando horários...</p> : <>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={saving || !date || !loaded} className="rounded border border-blue-300 px-4 py-2 text-blue-700 disabled:opacity-50"
            onClick={() => { setSuccess(''); setSelected([...new Set([...hours.filter(hour => !isPast(hour)), ...occupied])]); }}>Liberar todos</button>
          <button type="button" disabled={saving || !date || !loaded} className="rounded border border-gray-300 px-4 py-2 text-gray-700 disabled:opacity-50"
            onClick={() => { setSuccess(''); setSelected(occupied); }}>Fechar horários livres</button>
        </div>
        <fieldset disabled={saving || !date || !loaded}>
          <legend className="font-semibold text-gray-700 mb-3">Horários da clínica · São Paulo</legend>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {hours.map(hour => {
              const reserved = occupied.includes(hour);
              const past = isPast(hour);
              return <label key={hour} className={`flex flex-col items-start rounded-lg border p-3 gap-1 ${reserved ? 'bg-amber-50 border-amber-300' : selected.includes(hour) ? 'bg-green-50 border-green-400' : 'border-gray-200'} ${past ? 'opacity-60' : ''}`}>
                <span className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" aria-label={hour} checked={selected.includes(hour)} disabled={reserved || past}
                    onChange={event => { setSuccess(''); setSelected(previous => event.target.checked ? [...previous, hour] : previous.filter(value => value !== hour)); }} />
                  {hour}
                </span>
                <span className="text-xs text-gray-600">{reserved ? 'Já reservado' : past ? 'Horário passado' : selected.includes(hour) ? 'Liberado' : 'Fechado'}</span>
              </label>;
            })}
          </div>
        </fieldset>
      </>}
      <p className="text-sm text-gray-600">Atendimentos já reservados são preservados e não podem ser fechados por esta tela. Cada atendimento ocupa uma hora.</p>
      <button type="submit" disabled={loading || saving || !date || !loaded} className="w-full sm:w-auto rounded bg-med-blue px-6 py-3 text-white font-semibold disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar disponibilidade'}
      </button>
    </form>
  </div>;
}
