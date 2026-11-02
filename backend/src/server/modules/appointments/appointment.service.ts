import type { Actor } from '@/server/shared/auth';
import { requireCondition } from '@/server/shared/errors';
import { publishAppointment } from '@/server/shared/events';
import { doctorService } from '../doctors/doctor.service';
import { appointmentRepository } from './appointment.repository';
import type { AppointmentDto, UpdateAppointmentDto } from './appointment.dto';
import { AppointmentAggregate } from './domain/appointment.aggregate';
export const appointmentService = {
  list: appointmentRepository.list,
  async get(actor: Actor, id: number) {
    const appointment = await appointmentRepository.byId(id); requireCondition(appointment, 404, 'Agendamento não encontrado.');
    AppointmentAggregate.restore(appointment).assertAccess(actor); return appointment;
  },
  async create(actor: Actor, data: AppointmentDto) {
    const aggregate = AppointmentAggregate.schedule(actor, data);
    await doctorService.get(data.doctorId);
    const appointment = (await appointmentRepository.create(aggregate))!;
    await publishAppointment('appointment.created', appointment); return { id: appointment.id, message: 'Agendamento criado com sucesso' };
  },
  async update(actor: Actor, id: number, data: UpdateAppointmentDto) {
    const existing = await this.get(actor, id);
    AppointmentAggregate.restore(existing).update(actor, data);
    await doctorService.get(data.doctorId);
    const appointment = (await appointmentRepository.change(id, aggregate => aggregate.update(actor, data)))!;
    await publishAppointment(data.status === 'CANCELADO' ? 'appointment.cancelled' : 'appointment.updated', appointment);
    return { message: 'Agendamento atualizado com sucesso!' };
  },
  async cancel(actor: Actor, id: number) {
    const appointment = (await appointmentRepository.change(id, aggregate => aggregate.cancel(actor)))!;
    await publishAppointment('appointment.cancelled', appointment); return { message: 'Agendamento cancelado com sucesso.' };
  },
};
