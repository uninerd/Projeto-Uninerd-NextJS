import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertResponseContract } from './support/api-contract';

test('published response contracts accept actual success and reject incompatible types', () => {
  assert.doesNotThrow(() => assertResponseContract('/appointments', 'POST', 201, { id: 1, message: 'Agendamento criado com sucesso' }));
  assert.throws(() => assertResponseContract('/appointments', 'POST', 201, { id: '1', message: 'Criado' }), /diverge/);
  assert.throws(() => assertResponseContract('/users/login', 'POST', 200, { success: true, token: 'legacy-token' }), /diverge/);
  assert.throws(() => assertResponseContract('/users/login', 'POST', 200, {
    success: true, user: { id: 1, nome: 'Exemplo', email: 'exemplo@example.com', nivel: 'paciente', senha: 'unexpected-field' },
  }), /diverge/);
});

test('readiness failure uses dependency flags rather than the generic error envelope', () => {
  assert.doesNotThrow(() => assertResponseContract('/ready', 'GET', 503, { status: 'degraded', database: false, redis: true }));
  assert.throws(() => assertResponseContract('/ready', 'GET', 503, { success: false, message: 'Indisponível' }), /diverge/);
});

test('error responses require a message and cannot silently change shape', () => {
  assert.doesNotThrow(() => assertResponseContract('/appointments/{id}', 'PUT', 409, { success: false, message: 'Agendamento encerrado.' }));
  assert.throws(() => assertResponseContract('/appointments/{id}', 'PUT', 409, { error: 'Agendamento encerrado.' }), /diverge/);
});
