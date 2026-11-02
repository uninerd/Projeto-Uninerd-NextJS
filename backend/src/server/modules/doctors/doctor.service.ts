import type { Actor } from '@/server/shared/auth';
import { requireCondition } from '@/server/shared/errors';
import { cached, invalidate } from '@/server/shared/redis';
import { userService } from '../users/user.service';
import { doctorRepository } from './doctor.repository';
import { doctorDto, createDoctorDto, validateDoctorAccount, type DoctorDto } from './doctor.dto';
export const doctorService = {
  list(page: number, limit: number, term: string) {
    return cached('doctors', JSON.stringify([page, limit, term]), () => doctorRepository.list(page, limit, term));
  },
  specialties() { return cached('specialties', 'all', () => doctorRepository.specialties()); },
  async get(id: number) {
    const doctor = await doctorRepository.byId(id); requireCondition(doctor, 404, 'Médico não encontrado.'); return doctor;
  },
  async availability(id: number, date: string) {
    await this.get(id);
    const occupied = await doctorRepository.occupiedHours(id,date);
    const hours = Array.from({ length: 10 }, (_,i) => `${String(i+8).padStart(2,'0')}:00`);
    return { date, doctorId: id, hours: hours.filter(hour => !occupied.some(slot => slot.time === hour)) };
  },
  async create(actor: Actor, input: unknown) {
    requireCondition(actor.nivel === 'admin', 403, 'Somente administradores podem cadastrar outros médicos.');
    const data = createDoctorDto.parse(input);
    const specialty = await doctorRepository.specialty(data.specialty); requireCondition(specialty, 400, 'Especialidade inválida.');
    const user = await userService.register(validateDoctorAccount.parse({ nome: data.name, email: data.email, senha: data.senha,
      nivel: 'medico', crm_numero: data.crm, crm_uf: data.crmUf, id_especialidade: specialty.id }));
    await doctorRepository.update(user.id, doctorDto.parse({ name: data.name, address: data.address, specialty: data.specialty, crm: data.crm, crmUf: data.crmUf }), specialty.id);
    await invalidate('doctors'); return this.get(user.id);
  },
  async update(actor: Actor, id: number, data: DoctorDto) {
    requireCondition(actor.nivel === 'admin' || (actor.nivel === 'medico' && actor.id === id), 403, 'Você não pode editar este médico.');
    await this.get(id);
    const specialty = await doctorRepository.specialty(data.specialty); requireCondition(specialty, 400, 'Especialidade inválida.');
    await doctorRepository.update(id, data, specialty.id); await invalidate('doctors');
    return { message: 'Médico atualizado com sucesso!' };
  },
  async delete(actor: Actor, id: number) {
    requireCondition(actor.nivel === 'admin', 403, 'Somente administradores podem excluir médicos.');
    await this.get(id); await doctorRepository.delete(id); await invalidate('doctors'); return { message: 'Médico removido com sucesso!' };
  },
  async specialtyWrite(actor: Actor, method: string, id: number | undefined, nome?: string) {
    requireCondition(actor.nivel === 'admin', 403, 'Somente administradores podem gerenciar especialidades.');
    if (method === 'POST') {
      const result = await doctorRepository.createSpecialty(nome!); await invalidate('specialties'); return { id: result.insertId, nome };
    }
    const result = method === 'PUT' ? await doctorRepository.updateSpecialty(id!, nome!) : await doctorRepository.deleteSpecialty(id!);
    requireCondition(result.affectedRows, 404, 'Especialidade não encontrada.');
    await Promise.all([invalidate('specialties'), invalidate('doctors')]); return { message: 'Especialidade atualizada.' };
  },
};
