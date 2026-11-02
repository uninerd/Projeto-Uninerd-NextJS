import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { AppError } from './errors';
import { rows } from './database';
export type Role = 'paciente' | 'medico' | 'admin';
export interface Actor { id: number; nivel: Role }
export const SESSION_COOKIE = 'uninerd_session';
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new AppError(503, 'Autenticação não configurada.');
  return new TextEncoder().encode(value);
}
export async function createSession(actor: Actor) {
  return new SignJWT({ nivel: actor.nivel }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(actor.id)).setIssuedAt().setExpirationTime('1d')
    .setIssuer('uninerd').setAudience('uninerd-web').sign(secret());
}
export async function verifySession(token: string): Promise<Actor> {
  const key = secret();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], issuer: 'uninerd', audience: 'uninerd-web' });
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id < 1 || !['paciente', 'medico', 'admin'].includes(String(payload.nivel))) throw new Error();
    return { id, nivel: payload.nivel as Role };
  } catch { throw new AppError(401, 'Sessão inválida ou expirada.'); }
}
export async function authenticate(request: NextRequest): Promise<Actor> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw new AppError(401, 'Faça login para continuar.');
  const claim = await verifySession(token);
  const [current] = await rows<Actor>('SELECT id, nivel FROM usuarios WHERE id = ?', [claim.id]);
  if (!current) throw new AppError(401, 'Sessão inválida.');
  return current;
}
export function checkOrigin(request: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN ?? request.nextUrl.origin;
  if ((origin && origin !== expected) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AppError(403, 'Origem da requisição não permitida.');
  }
}
