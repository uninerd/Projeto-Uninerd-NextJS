import { eventDto } from './events.mjs';
export function createRecovery({ backendUrl, key, save, log, intervalMs = 3000 }) {
  let stopped = false;
  let timer;
  async function recover() {
    try {
      const url = `${backendUrl}/api/internal/appointment-events`;
      const headers = { 'x-internal-key': key, 'content-type': 'application/json' };
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw new Error('Outbox unavailable');
      const { data } = await response.json();
      const eventIds = [];
      for (const payload of data) {
        if (stopped) return;
        const event = eventDto.parse(payload);
        save(event); // Synchronous SQLite commit precedes the acknowledgement.
        eventIds.push(event.eventId);
      }
      if (eventIds.length && !stopped) {
        const ack = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ eventIds }), signal: AbortSignal.timeout(2000) });
        if (!ack.ok) throw new Error('Acknowledgement failed');
        log('outbox.recovered', { count: eventIds.length });
      }
    } catch { if (!stopped) log('outbox.retry'); }
    finally { if (!stopped) timer = setTimeout(recover, intervalMs); }
  }
  void recover();
  return () => { stopped = true; clearTimeout(timer); };
}
