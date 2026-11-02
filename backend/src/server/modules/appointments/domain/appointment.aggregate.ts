import { ClinicSlot } from './clinic-slot';
import { AppointmentType, AppointmentStatus, type AppointmentStatusValue, type AppointmentTypeValue } from './appointment-values';
import { ensure } from './domain-error';

export interface AppointmentActor { id: number; nivel: 'paciente' | 'medico' | 'admin' }
export interface AppointmentReferences { patientId: number; doctorId: number }
export interface AppointmentSnapshot extends AppointmentReferences {
  id?: number; date: string; type: AppointmentTypeValue; status: AppointmentStatusValue;
}
export interface AppointmentChange { doctorId: number; date: string; type: string; status: string }

export function canAccessAppointment(actor: AppointmentActor, appointment: AppointmentReferences): boolean {
  return actor.nivel === 'admin' || (actor.nivel === 'paciente' && actor.id === appointment.patientId)
    || (actor.nivel === 'medico' && actor.id === appointment.doctorId);
}

function assertId(value: number): void {
  ensure(Number.isSafeInteger(value) && value > 0, 'INVALID_VALUE', 'Identificador inválido.');
}

/** Entity and aggregate root. Patient and doctor belong to other aggregates. */
export class AppointmentAggregate {
  private slot: ClinicSlot;
  private type: AppointmentType;
  private status: AppointmentStatus;
  private doctorId: number;

  private constructor(private readonly id: number | undefined, private readonly patientId: number,
    doctorId: number, slot: ClinicSlot, type: AppointmentType, status: AppointmentStatus) {
    if (id !== undefined) assertId(id);
    assertId(patientId); assertId(doctorId);
    this.doctorId = doctorId; this.slot = slot; this.type = type; this.status = status;
  }

  static schedule(actor: AppointmentActor, data: { doctorId: number; date: string; type: string }, now = new Date()): AppointmentAggregate {
    ensure(actor.nivel === 'paciente', 'FORBIDDEN', 'Entre como paciente para agendar.');
    const slot = ClinicSlot.from(data.date); slot.assertFuture(now);
    return new AppointmentAggregate(undefined, actor.id, data.doctorId, slot, AppointmentType.from(data.type), AppointmentStatus.from('AGENDADO'));
  }

  static restore(data: { id: number; patientId: number; doctorId: number; date: string; type: string; status: string }): AppointmentAggregate {
    // Historical appointments can be loaded without requiring a future slot.
    return new AppointmentAggregate(data.id, data.patientId, data.doctorId, ClinicSlot.from(data.date), AppointmentType.from(data.type), AppointmentStatus.from(data.status));
  }

  assertAccess(actor: AppointmentActor): void {
    ensure(canAccessAppointment(actor, { patientId: this.patientId, doctorId: this.doctorId }), 'FORBIDDEN', 'Você não pode acessar este agendamento.');
  }

  private assertOpen(actor: AppointmentActor): void {
    this.assertAccess(actor);
    ensure(!this.status.isTerminal, 'CLOSED_APPOINTMENT', 'Agendamentos encerrados não podem ser alterados.');
  }

  update(actor: AppointmentActor, data: AppointmentChange, now = new Date()): void {
    this.assertOpen(actor);
    const nextSlot = ClinicSlot.from(data.date);
    const nextType = AppointmentType.from(data.type);
    const nextStatus = AppointmentStatus.from(data.status);
    assertId(data.doctorId);
    ensure(actor.nivel !== 'paciente' || nextStatus.value !== 'CONCLUIDO', 'FORBIDDEN', 'Somente o médico pode concluir um atendimento.');
    ensure(actor.nivel !== 'medico' || data.doctorId === actor.id, 'FORBIDDEN', 'Você não pode transferir este agendamento.');
    if (nextStatus.value === 'CONCLUIDO') {
      ensure(data.doctorId === this.doctorId && nextSlot.equals(this.slot) && nextType.equals(this.type), 'INVALID_VALUE', 'Conclua o atendimento mantendo seus dados originais.');
    }
    if (nextStatus.value === 'AGENDADO') nextSlot.assertFuture(now);
    // Validate the entire transition before mutating the aggregate.
    this.doctorId = data.doctorId; this.slot = nextSlot; this.type = nextType; this.status = nextStatus;
  }

  cancel(actor: AppointmentActor): void {
    this.assertOpen(actor);
    this.status = AppointmentStatus.from('CANCELADO');
  }

  toSnapshot(): Readonly<AppointmentSnapshot> {
    return Object.freeze({ id: this.id, patientId: this.patientId, doctorId: this.doctorId,
      date: this.slot.value, type: this.type.value, status: this.status.value });
  }
}
