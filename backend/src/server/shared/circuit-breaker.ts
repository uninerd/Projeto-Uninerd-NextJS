export type CircuitState = 'closed' | 'open' | 'half_open';
export class CircuitOpenError extends Error {}

/** One recovery probe; stale concurrent requests cannot close a newer circuit. */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private generation = 0;
  constructor(private readonly options: {
    threshold: number; cooldownMs: number; now?: () => number;
    onState?: (state: CircuitState) => void;
  }) {}
  private transition(state: CircuitState) {
    this.state = state; this.generation++; this.options.onState?.(state);
  }
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const now = this.options.now ?? Date.now;
    if (this.state === 'half_open') throw new CircuitOpenError('Recovery probe in progress');
    if (this.state === 'open') {
      if (now() - this.openedAt < this.options.cooldownMs) throw new CircuitOpenError('Circuit open');
      this.transition('half_open');
    }
    const generation = this.generation;
    const probe = (this.state as CircuitState) === 'half_open';
    try {
      const result = await operation();
      if (generation === this.generation) {
        this.failures = 0;
        if (probe) this.transition('closed');
      }
      return result;
    } catch (error) {
      if (generation === this.generation && (++this.failures >= this.options.threshold || probe)) {
        this.openedAt = now(); this.transition('open');
      }
      throw error;
    }
  }
}
