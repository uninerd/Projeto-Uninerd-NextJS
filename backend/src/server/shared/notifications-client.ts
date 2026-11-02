import { CircuitBreaker } from './circuit-breaker';
import { metrics } from './metrics';
import { log } from './logger';
const globals = globalThis as unknown as { uninerdInboxCircuit?: CircuitBreaker };
const circuit = globals.uninerdInboxCircuit ??= new CircuitBreaker({ threshold: 3, cooldownMs: 15000,
  onState(state) {
    metrics.circuit.set(state === 'closed' ? 0 : state === 'open' ? 1 : .5);
    log('notifications.circuit', { state });
  },
});
class NonRetryableResponse extends Error {}
export async function readNotifications(userId: number, key: string) {
  return circuit.execute(async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(`${process.env.NOTIFICATIONS_URL ?? 'http://localhost:3002'}/notifications/${userId}`, {
          headers: { 'x-internal-key': key }, signal: AbortSignal.timeout(1000), cache: 'no-store',
        });
        if (!response.ok) {
          if (response.status < 500) throw new NonRetryableResponse();
          throw new Error('Unavailable');
        }
        return await response.json();
      } catch (error) {
        if (attempt === 2 || error instanceof NonRetryableResponse) throw error;
        log('notifications.retry', { attempt });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  });
}
