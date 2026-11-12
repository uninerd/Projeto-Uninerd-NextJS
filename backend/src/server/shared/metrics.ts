import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from '@prometheus-io/client';

export function routeLabel(path: string) {
  if (path === '/api/internal/appointment-events') return path;
  if (/^\/api\/(health|ready|notifications|specialties|doctors|appointments)$/.test(path)) return path;
  if (/^\/api\/users\/(login|register|logout|me)$/.test(path)) return path;
  if (/^\/api\/(users|doctors|appointments|specialties)\/\d+$/.test(path)) return path.replace(/\d+$/, ':id');
  if (/^\/api\/doctors\/\d+\/availability$/.test(path)) return '/api/doctors/:id/availability';
  if (/^\/api\/doctors\/\d+\/schedule$/.test(path)) return '/api/doctors/:id/schedule';
  if (/^\/api\/doctors\/\d+\/weekly-schedule$/.test(path)) return '/api/doctors/:id/weekly-schedule';
  return 'unmatched';
}
function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'uninerd_' });
  const registers = [registry];
  return {
    registry,
    requests: new Counter({ name: 'uninerd_http_requests_total', help: 'Completed API requests', labelNames: ['route', 'method', 'status'], registers }),
    duration: new Histogram({ name: 'uninerd_http_request_duration_seconds', help: 'API request duration', labelNames: ['route', 'method'], buckets: [.01,.025,.05,.1,.25,.5,1,2,5,10], registers }),
    cache: new Counter({ name: 'uninerd_cache_operations_total', help: 'Cache outcomes', labelNames: ['namespace', 'outcome'], registers }),
    circuit: new Gauge({ name: 'uninerd_notifications_circuit_state', help: '0 closed, 1 open, 0.5 recovery probe', registers }),
    events: new Counter({ name: 'uninerd_events_published_total', help: 'Event publication outcomes, not delivery acknowledgements', labelNames: ['event', 'result'], registers }),
  };
}
const globals = globalThis as unknown as { uninerdMetrics?: ReturnType<typeof createMetrics> };
export const metrics = globals.uninerdMetrics ??= createMetrics();
