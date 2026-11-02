import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, write } from '../../backend/src/server/shared/database';
import { redis } from '../../backend/src/server/shared/redis';
import { assertResponseContract } from '../support/api-contract';

const origin = process.env.TEST_API_ORIGIN ?? 'http://localhost:8080';
const unique = randomUUID().replaceAll('-','');
const password = 'TesteForte@123';
function validCPF() {
  const digits = Array.from({ length:9 },() => Math.floor(Math.random()*10));
  for (const count of [10,11]) { const sum=digits.reduce((total,n,index)=>total+n*(count-index),0); const remainder=sum%11; digits.push(remainder<2?0:11-remainder); }
  return digits.join('');
}
async function api(path: string, method='GET', body?: unknown, cookie?: string) {
  const response = await fetch(`${origin}/api/${path}`, { method, headers:{ 'content-type':'application/json',origin,...(cookie ? { cookie } : {}) },
    body:body ? JSON.stringify(body):undefined, signal:AbortSignal.timeout(15000) });
  const contractPath = `/${path.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/{id}')}`;
  assertResponseContract(contractPath, method, response.status, await response.clone().json());
  return response;
}
async function login(email: string, senha: string) {
  const response=await api('users/login','POST',{ email,senha }); assert.equal(response.status,200,await response.clone().text());
  const cookie=response.headers.get('set-cookie'); assert.ok(cookie); assert.match(cookie,/HttpOnly/i); return cookie.split(';')[0];
}

test('full flow: accounts, permissions, concurrent booking, Redis cache and notifications', async () => {
  const accounts:number[]=[]; const appointments:number[]=[];
  try {
    const health=await api('ready'); assert.equal(health.status,200); assert.equal((await health.json()).redis,true);
    const specialties=await (await api('specialties')).json(); assert.ok(specialties.length>0);
    const adminCookie=await login(process.env.ADMIN_EMAIL ?? 'admin@uninerd.local',process.env.ADMIN_PASSWORD!);
    const email=`doctor-${unique}@example.com`;
    const createDoctor=await api('doctors','POST',{ name:'Médico Integração',address:'Clínica de teste',specialty:specialties[0].name,crm:String(Date.now()).slice(-9),crmUf:'SP',email,senha:password },adminCookie);
    assert.equal(createDoctor.status,201,await createDoctor.clone().text()); const doctor=await createDoctor.json(); accounts.push(doctor.id);
    const doctorCookie=await login(email,password);
    const patientEmail=`patient-${unique}@example.com`;
    const register=await api('users/register','POST',{ nome:'Paciente Integração',email:patientEmail,senha:password,nivel:'paciente',cpf:validCPF() });
    assert.equal(register.status,201,await register.clone().text()); const patient=(await register.json()).data; accounts.push(patient.id);
    const patientCookie=await login(patientEmail,password);
    const denied=await api(`users/${patient.id}`,'PUT',{ nivel:'admin' },patientCookie); assert.equal(denied.status,400);
    const foreignProfile=await api(`users/${doctor.id}`,'GET',undefined,patientCookie); assert.equal(foreignProfile.status,403);
    const invalidDoctorWrite=await api(`doctors/${doctor.id}`,'PUT',{ name:'Outro',address:'Rua teste',specialty:specialties[0].name,crm:'12345' },patientCookie); assert.equal(invalidDoctorWrite.status,403);

    // Cache hit, TTL and version invalidation are verified against Redis itself.
    const filter=`Integração`;
    await api(`doctors?specialty=${encodeURIComponent(filter)}`,'GET',undefined,patientCookie);
    const version=await redis().get('cache:doctors:version') ?? '0';
    const key=`cache:doctors:${version}:${JSON.stringify([1,10,filter])}`;
    assert.ok(await redis().get(key)); const ttl=await redis().ttl(key); assert.ok(ttl>0 && ttl<=Number(process.env.CACHE_TTL_SECONDS ?? 60));
    const updated=await api(`doctors/${doctor.id}`,'PUT',{ name:'Médico Integração Atualizado',address:'Clínica de teste',specialty:specialties[0].name,crm:doctor.crm,crmUf:'SP' },doctorCookie); assert.equal(updated.status,200);
    const nextVersion=await redis().get('cache:doctors:version'); assert.notEqual(nextVersion,version);
    const refreshed=await (await api(`doctors?specialty=${encodeURIComponent(filter)}`,'GET',undefined,patientCookie)).json();
    assert.ok(refreshed.data.some((row:{ name:string })=>row.name==='Médico Integração Atualizado'));

    const date=new Date(Date.now()+30*86400000).toISOString().slice(0,10)+'T10:00:00';
    const payload={ doctorId:doctor.id,date,type:'consulta' };
    const responses=await Promise.all([api('appointments','POST',payload,patientCookie),api('appointments','POST',payload,patientCookie)]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    const created=await responses.find(r=>r.status===201)!.json(); appointments.push(created.id);
    const edited=await api(`appointments/${created.id}`,'PUT',{ ...payload,type:'exame',status:'AGENDADO' },patientCookie);
    assert.equal(edited.status,200,await edited.clone().text());
    const persisted=await (await api(`appointments/${created.id}`,'GET',undefined,doctorCookie)).json();
    assert.equal(persisted.type,'exame'); assert.equal(persisted.id,created.id);
    const otherAccess=await api(`appointments/${created.id}`,'GET',undefined,adminCookie); assert.equal(otherAccess.status,200);
    const completing=await api(`appointments/${created.id}`,'PUT',{ ...payload,status:'CONCLUIDO' },patientCookie); assert.equal(completing.status,403);
    const availability=await (await api(`doctors/${doctor.id}/availability?date=${date.slice(0,10)}`,'GET',undefined,patientCookie)).json(); assert.ok(!availability.hours.includes('10:00'));
    let delivered=false;
    for(let attempt=0;attempt<20;attempt++) {
      const response=await api('notifications','GET',undefined,patientCookie); assert.equal(response.status,200);
      const notifications=await response.json();
      if(notifications.data.some((n:{ appointmentId:number })=>n.appointmentId===created.id)) { delivered=true; break; }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(delivered,true,'Pub/Sub notification must reach the patient inbox');
    assert.equal((await api(`appointments/${created.id}`,'DELETE',undefined,patientCookie)).status,200);
    const free=await (await api(`doctors/${doctor.id}/availability?date=${date.slice(0,10)}`,'GET',undefined,patientCookie)).json(); assert.ok(free.hours.includes('10:00'));
    const replacement=await api('appointments','POST',payload,patientCookie); assert.equal(replacement.status,201);
    const replacementId=(await replacement.json()).id; appointments.push(replacementId);
    const completed=await api(`appointments/${replacementId}`,'PUT',{ ...payload,status:'CONCLUIDO' },doctorCookie);
    assert.equal(completed.status,200,await completed.clone().text());
    assert.equal((await api(`appointments/${replacementId}`,'DELETE',undefined,patientCookie)).status,409);
    assert.equal((await api(`appointments/${replacementId}`,'PUT',{ ...payload,status:'AGENDADO' },doctorCookie)).status,409);
    const closed=await (await api(`appointments/${replacementId}`,'GET',undefined,doctorCookie)).json(); assert.equal(closed.status,'CONCLUIDO');
    const logout=await api('users/logout','POST',{},patientCookie); assert.equal(logout.status,200); assert.match(logout.headers.get('set-cookie')!,/Max-Age=0/i);
  } finally {
    for(const id of appointments) await write('DELETE FROM agendamentos WHERE id=?',[id]);
    for(const id of accounts.reverse()) await write('DELETE FROM usuarios WHERE id=?',[id]);
    await database().end(); redis().disconnect();
  }
});
