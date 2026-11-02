import http from 'node:http';
import { Registry, Counter, Histogram, collectDefaultMetrics } from '@prometheus-io/client';
const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'uninerd_notifications_' });
const consumed = new Counter({ name: 'uninerd_events_consumed_total', help: 'Validated events persisted (includes duplicates)', labelNames: ['event'], registers: [registry] });
const lag = new Histogram({ name: 'uninerd_event_lag_seconds', help: 'Publish to persist time with connected subscriber', labelNames: ['event'], buckets: [.01,.05,.1,.25,.5,1,2,5,10], registers: [registry] });
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { eventDto } from './events.mjs';
import { createStore } from './store.mjs';
const internalKey = process.env.INTERNAL_KEY;
if (!internalKey || internalKey.length < 32) throw new Error('INTERNAL_KEY must contain at least 32 characters');
const directory = process.env.DATA_DIRECTORY ?? './data';
mkdirSync(directory, { recursive: true });
const store = createStore(join(directory, 'notifications.sqlite'));
const log = (event, fields = {}) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, service: 'notifications', ...fields }));
const subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { retryStrategy: attempt => Math.min(attempt*500,5000), connectTimeout: 3000 });
subscriber.on('error', () => log('redis.unavailable'));
subscriber.on('message', (_channel, message) => {
  try {
    const event = eventDto.parse(JSON.parse(message)); store.save(event);
    const lagMs = Math.max(0, Date.now()-Date.parse(event.timestamp));
    consumed.inc({ event: event.event }); lag.observe({ event: event.event }, lagMs/1000);
    log('event.consumed', { lagMs, eventId: event.eventId, type: event.event, appointmentId: event.appointmentId });
  } catch { log('event.rejected'); }
});
await subscriber.subscribe('uninerd:appointments');
const server = http.createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  const reply = (status, payload) => { response.writeHead(status); response.end(JSON.stringify(payload)); };
  if (request.method !== 'GET') return reply(405, { message: 'Method not allowed' });
  if (request.url === '/internal/metrics') {
    response.setHeader('content-type', registry.contentType);
    response.end(await registry.metrics()); return;
  }
  if (request.url === '/health') return reply(subscriber.status === 'ready' ? 200 : 503, { status: subscriber.status === 'ready' ? 'ok' : 'degraded' });
  const key = request.headers['x-internal-key'];
  if (typeof key !== 'string' || Buffer.byteLength(key) !== Buffer.byteLength(internalKey) || !timingSafeEqual(Buffer.from(key),Buffer.from(internalKey))) return reply(401, { message: 'Unauthorized' });
  const match = /^\/notifications\/(\d+)$/.exec(request.url ?? '');
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) return reply(404, { message: 'Not found' });
  try { reply(200, { data: store.list(Number(match[1])) }); }
  catch { log('store.read_failed'); reply(503, { message: 'Service unavailable' }); }
});
server.listen(Number(process.env.PORT ?? 3002), '0.0.0.0', () => log('service.started'));
async function shutdown() {
  server.close(); await subscriber.quit(); store.close(); process.exit(0);
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
