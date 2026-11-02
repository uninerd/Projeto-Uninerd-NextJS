import Redis from 'ioredis';
import { log } from './logger';
import { metrics } from './metrics';
const globals = globalThis as unknown as { uninerdRedis?: Redis };
export function redis() {
  if (!globals.uninerdRedis) {
    globals.uninerdRedis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500, commandTimeout: 2000,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    globals.uninerdRedis.on('error', () => log('redis.unavailable'));
  }
  return globals.uninerdRedis;
}
export async function cached<T>(namespace: string, key: string, loader: () => Promise<T>): Promise<T> {
  let cacheKey: string | undefined;
  try {
    const version = await redis().get(`cache:${namespace}:version`) ?? '0';
    cacheKey = `cache:${namespace}:${version}:${key}`;
    const existing = await redis().get(cacheKey);
    if (existing) { metrics.cache.inc({ namespace, outcome: 'hit' }); log('cache.hit', { namespace }); return JSON.parse(existing) as T; }
    metrics.cache.inc({ namespace, outcome: 'miss' }); log('cache.miss', { namespace });
  } catch { metrics.cache.inc({ namespace, outcome: 'bypass' }); log('cache.bypass', { namespace }); }
  const data = await loader();
  if (cacheKey) {
    try { await redis().set(cacheKey, JSON.stringify(data), 'EX', Number(process.env.CACHE_TTL_SECONDS ?? 60)); }
    catch { metrics.cache.inc({ namespace, outcome: 'write_failed' }); log('cache.write_failed', { namespace }); }
  }
  return data;
}
export async function invalidate(namespace: string) {
  try { await redis().incr(`cache:${namespace}:version`); metrics.cache.inc({ namespace, outcome: 'invalidated' }); log('cache.invalidated', { namespace }); }
  catch { metrics.cache.inc({ namespace, outcome: 'invalidation_failed' }); log('cache.invalidation_failed', { namespace }); }
}
