import { DomainError, ensure } from './domain-error';

/** A clinic-local hour in São Paulo (UTC-03:00), without identity. */
export class ClinicSlot {
  private constructor(public readonly value: string) { Object.freeze(this); }

  static from(value: string): ClinicSlot {
    const message = 'Informe uma data válida e um horário inteiro entre 08:00 e 17:00.';
    ensure(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/.test(value), 'INVALID_VALUE', message);
    const instant = new Date(`${value}-03:00`);
    ensure(Number(value.slice(0, 4)) >= 1000 && Number.isFinite(instant.getTime())
      && instant.toISOString().slice(0, 10) === value.slice(0, 10)
      && Number(value.slice(11, 13)) >= 8 && Number(value.slice(11, 13)) <= 17, 'INVALID_VALUE', message);
    return new ClinicSlot(value);
  }

  static isValid(value: string): boolean {
    try { ClinicSlot.from(value); return true; }
    catch (error) { if (error instanceof DomainError) return false; throw error; }
  }

  equals(other: ClinicSlot): boolean { return this.value === other.value; }

  assertFuture(now: Date): void {
    ensure(new Date(`${this.value}-03:00`).getTime() > now.getTime(), 'INVALID_VALUE', 'Escolha um horário futuro.');
  }
}
