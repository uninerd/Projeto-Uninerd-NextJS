'use client';
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../services/api';

const labels = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const hours = Array.from({ length: 10 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);
interface Day { weekday: number; hours: string[]; occupiedHours: string[] }
interface Week { doctorId: number; days: Day[] }

export default function DoctorWeekSchedule({ doctorId, onSaved }: { doctorId: number; onSaved: () => void }) {
  const [days, setDays] = useState<Day[]>([]);
  const [weekday, setWeekday] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true;
    api.get<Week>(`/doctors/${doctorId}/weekly-schedule`)
      .then(({ data }) => { if (active) setDays(data.days); })
      .catch(() => { if (active) setError('Não foi possível carregar a agenda semanal. Atualize a página.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [doctorId]);
  const selected = days.find(day => day.weekday === weekday);
  function update(values: string[]) {
    setSuccess(''); setError('');
    setDays(previous => previous.map(day => day.weekday === weekday ? { ...day, hours: values } : day));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (loading || saving || !days.length) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const { data } = await api.put<Week>(`/doctors/${doctorId}/weekly-schedule`, { days: days.map(day => ({ weekday: day.weekday, hours: [...day.hours].sort() })) });
      setDays(data.days); setSuccess('Agenda semanal salva. Os horários se repetem nos dias da semana escolhidos.'); onSaved();
    } catch (caught) { setError((caught as AxiosError<{ message?: string }>).response?.data?.message ?? 'Não foi possível salvar a semana.'); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="max-w-3xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-8 space-y-5 mb-6">
    <header>
      <h1 className="text-2xl font-bold text-gray-800">Meus horários de atendimento</h1>
      <p className="mt-2 text-gray-600">Monte sua semana: escolha cada dia e marque os horários em que deseja atender. Salve depois de configurar os dias.</p>
    </header>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {success && <p role="status" className="text-green-700">{success}</p>}
    {loading ? <p>Carregando agenda semanal...</p> : <>
      <label className="block text-gray-700 font-semibold">Dia da semana
        <select value={weekday} onChange={event => setWeekday(Number(event.target.value))} disabled={saving}
          className="block w-full mt-2 border border-gray-300 rounded p-3 bg-white">
          {[1,2,3,4,5,6,0].map(value => <option key={value} value={value}>{labels[value]} · {days.find(day => day.weekday === value)?.hours.length ?? 0} horários</option>)}
        </select>
      </label>
      {selected && <fieldset disabled={saving} className="space-y-4">
        <legend className="font-semibold text-gray-700">Horários de {labels[weekday]}</legend>
        <div className="flex flex-wrap gap-3 mt-3">
          <button type="button" onClick={() => update(hours)} className="rounded border border-blue-300 px-3 py-2 text-blue-700">Liberar dia inteiro</button>
          <button type="button" onClick={() => update(selected.occupiedHours)} className="rounded border border-gray-300 px-3 py-2">Fechar horários sem reserva</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {hours.map(hour => <label key={hour} className={`rounded-lg border p-3 ${selected.hours.includes(hour) ? 'bg-green-50 border-green-400' : 'border-gray-200'}`}>
            <span className="flex items-center gap-2 font-semibold">
              <input type="checkbox" aria-label={`${labels[weekday]} ${hour}`} checked={selected.hours.includes(hour)} disabled={selected.occupiedHours.includes(hour)}
                onChange={event => update(event.target.checked ? [...selected.hours, hour] : selected.hours.filter(value => value !== hour))} />
              {hour}
            </span>
            <span className="text-xs text-gray-600">{selected.occupiedHours.includes(hour) ? 'Com reserva futura' : selected.hours.includes(hour) ? 'Liberado' : 'Fechado'}</span>
          </label>)}
        </div>
      </fieldset>}
    </>}
    <p className="text-sm text-gray-600">A semana se repete nas próximas datas. Ajustes por data, abaixo, têm prioridade. Reservas existentes são preservadas.</p>
    <button type="submit" disabled={loading || saving || !days.length} className="w-full sm:w-auto rounded bg-med-blue px-6 py-3 text-white font-semibold disabled:opacity-50">{saving ? 'Salvando semana...' : 'Salvar agenda semanal'}</button>
  </form>;
}
