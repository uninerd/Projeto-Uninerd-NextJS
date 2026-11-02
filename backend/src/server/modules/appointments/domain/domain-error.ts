export type DomainErrorCode = 'INVALID_VALUE' | 'FORBIDDEN' | 'CLOSED_APPOINTMENT';

// Domain rules have no dependency on HTTP, Next.js, MySQL or Redis.
export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export function ensure(condition: unknown, code: DomainErrorCode, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
