import { ensure } from './domain-error';

export type AppointmentTypeValue = 'consulta' | 'exame';
export type AppointmentStatusValue = 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO';

export class AppointmentType {
  private constructor(public readonly value: AppointmentTypeValue) { Object.freeze(this); }
  static from(value: string): AppointmentType {
    ensure(value === 'consulta' || value === 'exame', 'INVALID_VALUE', 'Tipo de atendimento inválido.');
    return new AppointmentType(value);
  }
  equals(other: AppointmentType): boolean { return this.value === other.value; }
}

export class AppointmentStatus {
  private constructor(public readonly value: AppointmentStatusValue) { Object.freeze(this); }
  static from(value: string): AppointmentStatus {
    ensure(value === 'AGENDADO' || value === 'CONCLUIDO' || value === 'CANCELADO', 'INVALID_VALUE', 'Status de agendamento inválido.');
    return new AppointmentStatus(value);
  }
  get isTerminal(): boolean { return this.value !== 'AGENDADO'; }
  equals(other: AppointmentStatus): boolean { return this.value === other.value; }
}
