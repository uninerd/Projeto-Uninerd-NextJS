import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { AppError, requireCondition } from '@/server/shared/errors';
import { authenticate, checkOrigin, createSession, SESSION_COOKIE } from '@/server/shared/auth';
import { log } from '@/server/shared/logger';
import { metrics, routeLabel } from '@/server/shared/metrics';
import { readNotifications } from '@/server/shared/notifications-client';
import { database } from '@/server/shared/database';
import { redis } from '@/server/shared/redis';
import { registerDto, loginDto, updateUserDto, paginationDto } from '@/server/modules/users/user.dto';
import { userService } from '@/server/modules/users/user.service';
import { doctorDto, specialtyDto, doctorScheduleDto, doctorWeekDto, scheduleDate } from '@/server/modules/doctors/doctor.dto';
import { doctorService } from '@/server/modules/doctors/doctor.service';
import { appointmentDto, updateAppointmentDto } from '@/server/modules/appointments/appointment.dto';
import { appointmentService } from '@/server/modules/appointments/appointment.service';
import { DomainError, type DomainErrorCode } from '@/server/modules/appointments/domain/domain-error';

const idDto = z.coerce.number().int().positive();
async function body(request: NextRequest) {
  const text = await request.text();
  if (text.length > 16384) throw new AppError(413, 'Requisição muito grande.');
  try { return JSON.parse(text) as unknown; }
  catch { throw new AppError(400, 'JSON inválido.'); }
}
function json(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
function setSession(response: NextResponse, token: string, maxAge = 86400) {
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge });
  return response;
}

async function dispatch(request: NextRequest): Promise<NextResponse> {
  checkOrigin(request);
  const parts = request.nextUrl.pathname.slice('/api/'.length).split('/').filter(Boolean);
  const [resource, action] = parts;
  const method = request.method;
  if (parts.length > 2 && !(parts.length === 3 && resource === 'doctors' && ['availability', 'schedule', 'weekly-schedule'].includes(parts[2]))) throw new AppError(404, 'Endpoint não encontrado.');
  if (resource === 'health' && !action) {
    requireCondition(method === 'GET', 405, 'Método não permitido.');
    return json({ status: 'ok', service: 'uninerd-backend' });
  }
  if (resource === 'ready' && !action) {
    requireCondition(method === 'GET', 405, 'Método não permitido.');
    const results = await Promise.allSettled([database().query('SELECT 1'), redis().ping()]);
    const db = results[0].status === 'fulfilled'; const cache = results[1].status === 'fulfilled';
    return json({ status: db && cache ? 'ok' : 'degraded', database: db, redis: cache }, db ? 200 : 503);
  }
  if (resource === 'users' && action === 'register') {
    requireCondition(method === 'POST', 405, 'Método não permitido.');
    return json({ success: true, data: await userService.register(registerDto.parse(await body(request))) }, 201);
  }
  if (resource === 'users' && action === 'login') {
    requireCondition(method === 'POST', 405, 'Método não permitido.');
    const data = loginDto.parse(await body(request));
    const user = await userService.login(data.email, data.senha);
    const token = await createSession(user);
    return setSession(json({ success: true, user }), token);
  }
  if (resource === 'users' && action === 'logout') {
    requireCondition(method === 'POST', 405, 'Método não permitido.');
    return setSession(json({ success: true }), '', 0);
  }
  const actor = await authenticate(request);
  if (resource === 'users') {
    const id = action === 'me' ? actor.id : idDto.parse(action);
    requireCondition(id === actor.id, 403, 'Você pode acessar apenas seu próprio perfil.');
    if (method === 'GET') return json({ success: true, data: await userService.profile(id) });
    if (method === 'PUT' && action !== 'me') return json({ success: true, data: await userService.update(id, updateUserDto.parse(await body(request))) });
    if (method === 'DELETE' && action !== 'me') { await userService.delete(id); return setSession(json({ success: true }), '', 0); }
    throw new AppError(405, 'Método não permitido.');
  }
  if (resource === 'doctors') {
    if (parts[2] === 'weekly-schedule') {
      const id = idDto.parse(action);
      if (method === 'GET') return json(await doctorService.weekSchedule(actor, id));
      if (method === 'PUT') return json(await doctorService.saveWeekSchedule(actor, id, doctorWeekDto.parse(await body(request))));
      throw new AppError(405, 'Método não permitido.');
    }
    if (parts[2] === 'schedule') {
      const id = idDto.parse(action);
      if (method === 'GET') return json(await doctorService.schedule(actor, id, scheduleDate.parse(request.nextUrl.searchParams.get('date'))));
      if (method === 'PUT') return json(await doctorService.saveSchedule(actor, id, doctorScheduleDto.parse(await body(request))));
      throw new AppError(405, 'Método não permitido.');
    }
    if (parts[2] === 'availability') {
      requireCondition(method === 'GET', 405, 'Método não permitido.');
      const date = scheduleDate.parse(request.nextUrl.searchParams.get('date'));
      return json(await doctorService.availability(idDto.parse(action),date));
    }
    if (!action && method === 'GET') {
      const pagination = paginationDto.parse(Object.fromEntries(request.nextUrl.searchParams));
      const term = z.string().max(100).parse(request.nextUrl.searchParams.get('specialty') ?? '');
      return json(await doctorService.list(pagination.page, pagination.limit, term));
    }
    if (!action && method === 'POST') return json(await doctorService.create(actor, await body(request)), 201);
    if (action) {
      const id = idDto.parse(action);
      if (method === 'GET') return json(await doctorService.get(id));
      if (method === 'PUT') return json(await doctorService.update(actor, id, doctorDto.parse(await body(request))));
      if (method === 'DELETE') return json(await doctorService.delete(actor, id));
    }
    throw new AppError(405, 'Método não permitido.');
  }
  if (resource === 'specialties') {
    if (!action && method === 'GET') return json(await doctorService.specialties());
    if ((!action && method === 'POST') || (action && ['PUT', 'DELETE'].includes(method))) {
      const nome = method === 'DELETE' ? undefined : specialtyDto.parse(await body(request)).nome;
      return json(await doctorService.specialtyWrite(actor, method, action ? idDto.parse(action) : undefined, nome), method === 'POST' ? 201 : 200);
    }
    throw new AppError(405, 'Método não permitido.');
  }
  if (resource === 'appointments') {
    if (!action && method === 'GET') {
      const { page, limit } = paginationDto.parse(Object.fromEntries(request.nextUrl.searchParams));
      return json(await appointmentService.list(actor, page, limit));
    }
    if (!action && method === 'POST') return json(await appointmentService.create(actor, appointmentDto.parse(await body(request))), 201);
    if (action) {
      const id = idDto.parse(action);
      if (method === 'GET') return json(await appointmentService.get(actor, id));
      if (method === 'PUT') return json(await appointmentService.update(actor, id, updateAppointmentDto.parse(await body(request))));
      if (method === 'DELETE') return json(await appointmentService.cancel(actor, id));
    }
    throw new AppError(405, 'Método não permitido.');
  }
  if (resource === 'notifications' && !action) {
    requireCondition(method === 'GET', 405, 'Método não permitido.');
    const internalKey = process.env.NOTIFICATIONS_INTERNAL_KEY;
    requireCondition(internalKey, 503, 'Serviço de notificações não configurado.');
    try {
      return json(await readNotifications(actor.id, internalKey));
    } catch { throw new AppError(503, 'Notificações indisponíveis. Tente novamente em instantes.'); }
  }
  throw new AppError(404, 'Endpoint não encontrado.');
}

export async function handleRequest(request: NextRequest) {
  const requestId = randomUUID(); const start = Date.now(); let response: NextResponse;
  try {
    // Registration needs specialties before a session exists.
    if (request.nextUrl.pathname === '/api/specialties' && request.method === 'GET') response = json(await doctorService.specialties());
    else response = await dispatch(request);
  } catch (error) {
    if (error instanceof DomainError) {
      const statuses: Record<DomainErrorCode, number> = { INVALID_VALUE: 400, FORBIDDEN: 403, CLOSED_APPOINTMENT: 409 };
      response = json({ success: false, message: error.message }, statuses[error.code]);
    }
    else if (error instanceof AppError) response = json({ success: false, message: error.message }, error.status);
    else if (error instanceof ZodError) response = json({ success: false, message: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') }, 400);
    else {
      const code = (error as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY') response = json({ success: false, message: 'Dados já cadastrados ou horário ocupado.' }, 409);
      else if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_ROW_IS_REFERENCED_2') response = json({ success: false, message: 'Registro inválido ou com vínculos que impedem a operação.' }, 409);
      else {
        log('request.failed', { requestId, code: code ?? 'UNKNOWN' });
        response = json({ success: false, message: 'Serviço temporariamente indisponível.', requestId }, 503);
      }
    }
  }
  response.headers.set('x-request-id', requestId);
  response.headers.set('cache-control', 'no-store');
  const route = routeLabel(request.nextUrl.pathname);
  const method = ['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'].includes(request.method) ? request.method : 'OTHER';
  metrics.requests.inc({ route, method, status: response.status });
  metrics.duration.observe({ route, method }, (Date.now()-start)/1000);
  log('http.request', { requestId, method, path: route, status: response.status, durationMs: Date.now()-start });
  return response;
}
