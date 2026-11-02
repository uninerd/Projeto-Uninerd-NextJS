import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from '../backend/src/server/shared/http';
import { handleRequest } from '../backend/src/server/controllers/api.controller';
import { doctorService } from '../backend/src/server/modules/doctors/doctor.service';
import { DomainError } from '../backend/src/server/modules/appointments/domain/domain-error';
import { assertResponseContract } from './support/api-contract';

async function capture(request: NextRequest) {
  const previous=console.log; const logs:Record<string,unknown>[]=[];
  console.log=line=>{ logs.push(JSON.parse(String(line)) as Record<string,unknown>); };
  try { return { response:await handleRequest(request), logs }; }
  finally { console.log=previous; }
}
test('HTTP boundary rejects malformed, excessive, invalid and cross-site input before infrastructure', async()=>{
  const cases=[
    { body:'{',status:400 },
    { body:JSON.stringify({ nivel:'admin',senha:'private-marker' }),status:400 },
    { body:'x'.repeat(16385),status:413 },
    { body:'{}',status:403,headers:{ origin:'https://other.example','sec-fetch-site':'cross-site' } },
  ];
  for (const entry of cases) {
    const { response,logs }=await capture(new NextRequest('http://localhost:8080/api/users/register',{
      method:'POST',body:entry.body,headers:{ 'content-type':'application/json',...entry.headers },
    }));
    assert.equal(response.status,entry.status);
    assertResponseContract('/users/register','POST',entry.status,await response.json());
    assert.match(response.headers.get('x-request-id')!,/^[a-f0-9-]{36}$/);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.ok(!JSON.stringify(logs).includes('private-marker'));
  }
});
test('request logs keep correlation and finite routes without raw identifiers or query data',async()=>{
  for (const [path,expected] of [
    ['/api/users/private-marker@example.test?password=private-marker','unmatched'],
    ['/api/users/987654321?password=private-marker','/api/users/:id'],
  ]) {
    const { response,logs }=await capture(new NextRequest(`http://localhost:8080${path}`));
    assert.equal(response.status,401);
    const log=logs.find(item=>item.event==='http.request')!;
    assert.equal(log.path,expected); assert.equal(log.service,'uninerd-backend');
    assert.equal(log.requestId,response.headers.get('x-request-id'));
    assert.equal(log.method,'GET'); assert.equal(log.status,401);
    assert.ok(typeof log.durationMs==='number' && log.durationMs>=0);
    assert.ok(!JSON.stringify(logs).includes('private-marker'));
    assert.ok(!JSON.stringify(logs).includes('987654321'));
  }
});
test('central error handling maps domain and storage failures without exposing exception details',async()=>{
  const original=doctorService.specialties;
  const cases=[
    { error:new DomainError('INVALID_VALUE','Valor inválido.'),status:400 },
    { error:new DomainError('FORBIDDEN','Operação não permitida.'),status:403 },
    { error:new DomainError('CLOSED_APPOINTMENT','Agendamento encerrado.'),status:409 },
    ...['ER_DUP_ENTRY','ER_NO_REFERENCED_ROW_2','ER_ROW_IS_REFERENCED_2'].map(code=>({error:Object.assign(new Error('private-marker'),{code,sql:'private-marker'}),status:409})),
    { error:new Error('private-marker: password and SQL must stay private'),status:503 },
  ];
  try {
    for (const entry of cases) {
      doctorService.specialties=async()=>{ throw entry.error; };
      const { response,logs }=await capture(new NextRequest('http://localhost:8080/api/specialties'));
      assert.equal(response.status,entry.status);
      const body=await response.json();
      assertResponseContract('/specialties','GET',entry.status,body);
      assert.ok(!JSON.stringify({body,logs}).includes('private-marker'));
      if (entry.status===503) {
        assert.equal(body.requestId,response.headers.get('x-request-id'));
        assert.equal(logs.find(log=>log.event==='request.failed')?.requestId,body.requestId);
      }
    }
  } finally { doctorService.specialties=original; }
});
