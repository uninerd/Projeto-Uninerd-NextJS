import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { database, rows, write } from '../../backend/src/server/shared/database';
import { redis } from '../../backend/src/server/shared/redis';
import { assertResponseContract } from '../support/api-contract';

const origin = process.env.TEST_API_ORIGIN ?? 'http://localhost:8080';
const unique = randomUUID().replaceAll('-','');
const password = 'TesteForte@123';
function notificationService(action: 'stop' | 'start') {
  // Outage injection is opt-in and restricted to the isolated validation stack.
  assert.equal(process.env.TEST_NOTIFICATIONS_COMPOSE_PROJECT,'uninerd-agenda-validation');
  execFileSync('docker',['--context','default','compose','-p','uninerd-agenda-validation','-f','docker-compose.yml','-f','.deploy/agenda-validation.compose.yml',action,'notifications'],
    {env:{...process.env,APP_PORT:'18081',APP_BIND_ADDRESS:'127.0.0.1',APP_ORIGIN:origin},stdio:'pipe',timeout:30000});
}
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
  let workerStopped=false;
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
    const day = date.slice(0,10);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const week = { days: [{ weekday, hours: ['10:00','11:00'] }] };
    const empty = await (await api(`doctors/${doctor.id}/availability?date=${day}`,'GET',undefined,patientCookie)).json();
    assert.deepEqual(empty.hours, [], 'An unconfigured doctor must not accept bookings');
    assert.equal((await api(`doctors/${doctor.id}/schedule?date=${day}`,'GET',undefined,patientCookie)).status,403);
    assert.equal((await api(`doctors/${doctor.id}/weekly-schedule`,'PUT',week,adminCookie)).status,403);
    assert.equal((await api(`doctors/${doctor.id}/schedule`,'PUT',{ date:day,hours:['10:00'] },patientCookie)).status,403);
    assert.equal((await api(`doctors/${doctor.id}/schedule`,'PUT',{ date:day,hours:['10:30'] },doctorCookie)).status,400);
    const savedWeek=await api(`doctors/${doctor.id}/weekly-schedule`,'PUT',week,doctorCookie);
    assert.equal(savedWeek.status,200,await savedWeek.clone().text());
    const selectedWeek=(await savedWeek.json()).days.find((entry:{ weekday:number })=>entry.weekday===weekday);
    assert.deepEqual(selectedWeek.hours,['10:00','11:00']);
    const nextWeek=new Date(`${day}T12:00:00Z`); nextWeek.setUTCDate(nextWeek.getUTCDate()+7);
    const nextDay=nextWeek.toISOString().slice(0,10);
    const recurring=await (await api(`doctors/${doctor.id}/availability?date=${nextDay}`,'GET',undefined,patientCookie)).json();
    assert.deepEqual(recurring.hours,['10:00','11:00']);
    assert.equal((await api(`doctors/${doctor.id}/schedule`,'PUT',{ date:nextDay,hours:[] },doctorCookie)).status,200);
    const closedDate=await (await api(`doctors/${doctor.id}/availability?date=${nextDay}`,'GET',undefined,patientCookie)).json();
    assert.deepEqual(closedDate.hours,[], 'A closed date overrides the recurring week');
    const payload={ doctorId:doctor.id,date,type:'consulta' };
    assert.equal((await api('appointments','POST',{...payload,date:day+'T09:00:00'},patientCookie)).status,409);
    const responses=await Promise.all([api('appointments','POST',payload,patientCookie),api('appointments','POST',payload,patientCookie)]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    const created=await responses.find(r=>r.status===201)!.json(); appointments.push(created.id);
    assert.equal((await api(`doctors/${doctor.id}/schedule`,'PUT',{date:day,hours:[]},doctorCookie)).status,409);
    assert.equal((await api(`doctors/${doctor.id}/weekly-schedule`,'PUT',{days:[]},doctorCookie)).status,409);
    assert.equal((await api(`appointments/${created.id}`,'PUT',{...payload,date:day+'T12:00:00',status:'AGENDADO'},patientCookie)).status,409);

    const raceDay=new Date(`${day}T12:00:00Z`); raceDay.setUTCDate(raceDay.getUTCDate()+2);
    const raceDate=raceDay.toISOString().slice(0,10);
    assert.equal((await api(`doctors/${doctor.id}/schedule`,'PUT',{date:raceDate,hours:['14:00']},doctorCookie)).status,200);
    const [racingBooking,racingClose]=await Promise.all([
      api('appointments','POST',{...payload,date:raceDate+'T14:00:00'},patientCookie),
      api(`doctors/${doctor.id}/schedule`,'PUT',{date:raceDate,hours:[]},doctorCookie),
    ]);
    if (racingBooking.status===201) {
      appointments.push((await racingBooking.json()).id);
      assert.equal(racingClose.status,409,'Closing must not remove a newly booked slot');
    } else {
      assert.equal(racingBooking.status,409,'Booking must reject a concurrently closed slot');
      assert.equal(racingClose.status,200);
    }
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
    assert.equal((await fetch(`${origin}/api/internal/appointment-events`)).status,404,'The outbox must not be exposed by Nginx');
    assert.equal((await api('notifications?offset=-1','GET',undefined,patientCookie)).status,400);
    const secondEmail=`doctor-transfer-${unique}@example.com`;
    const secondDoctorResponse=await api('doctors','POST',{name:'Médico Transferência',address:'Clínica de teste',specialty:specialties[0].name,crm:String(Date.now()).slice(-9),crmUf:'SP',email:secondEmail,senha:password},adminCookie);
    assert.equal(secondDoctorResponse.status,201); const secondDoctor=await secondDoctorResponse.json(); accounts.push(secondDoctor.id);
    const secondDoctorCookie=await login(secondEmail,password);
    assert.equal((await api(`doctors/${secondDoctor.id}/schedule`,'PUT',{date:day,hours:['11:00']},secondDoctorCookie)).status,200);
    if(process.env.TEST_NOTIFICATIONS_COMPOSE_PROJECT) { notificationService('stop'); workerStopped=true; }
    assert.equal((await api(`appointments/${created.id}`,'PUT',{...payload,doctorId:secondDoctor.id,date:day+'T11:00:00',type:'exame',status:'AGENDADO'},patientCookie)).status,200);
    assert.equal((await api(`appointments/${created.id}`,'PUT',{...payload,date:day+'T11:00:00',type:'exame',status:'AGENDADO'},patientCookie)).status,200);
    assert.equal((await api(`appointments/${created.id}`,'DELETE',undefined,patientCookie)).status,200);
    const free=await (await api(`doctors/${doctor.id}/availability?date=${date.slice(0,10)}`,'GET',undefined,patientCookie)).json(); assert.ok(free.hours.includes('10:00'));
    const replacement=await api('appointments','POST',payload,patientCookie); assert.equal(replacement.status,201);
    const replacementId=(await replacement.json()).id; appointments.push(replacementId);
    const completed=await api(`appointments/${replacementId}`,'PUT',{ ...payload,status:'CONCLUIDO' },doctorCookie);
    assert.equal(completed.status,200,await completed.clone().text());
    assert.equal((await api(`appointments/${replacementId}`,'DELETE',undefined,patientCookie)).status,409);
    assert.equal((await api(`appointments/${replacementId}`,'PUT',{ ...payload,status:'AGENDADO' },doctorCookie)).status,409);
    const closed=await (await api(`appointments/${replacementId}`,'GET',undefined,doctorCookie)).json(); assert.equal(closed.status,'CONCLUIDO');
    const another=await api('appointments','POST',{...payload,date:day+'T11:00:00'},patientCookie);
    assert.equal(another.status,201); const anotherId=(await another.json()).id; appointments.push(anotherId);
    assert.equal((await api(`appointments/${anotherId}`,'PUT',{...payload,date:day+'T11:00:00',status:'CANCELADO'},adminCookie)).status,200);
    if(workerStopped) { notificationService('start'); workerStopped=false; }
    for(const cookie of [patientCookie,doctorCookie,secondDoctorCookie,adminCookie]) {
      let complete=false;
      const deadline=Date.now()+20000;
      while(Date.now()<deadline) {
        const response=await api('notifications','GET',undefined,cookie);
        if(response.ok) {
          const {data}=await response.json();
          const relevant=data.filter((n:{appointmentId:number})=>[created.id,replacementId,anotherId].includes(n.appointmentId));
          assert.equal(new Set(relevant.map((n:{eventId:string})=>n.eventId)).size,relevant.length,'No duplicated deliveries');
          const messages=relevant.map((n:{message:string})=>n.message).join(' ');
          complete=cookie===secondDoctorCookie ? relevant.filter((n:{appointmentId:number})=>n.appointmentId===created.id).length===2
            : cookie===adminCookie ? messages.includes(`Agendamento #${anotherId} cancelado pelo administrador`)
            : ['criado pelo paciente','atualizado pelo paciente','reagendado pelo paciente','cancelado pelo paciente','concluído pelo médico','cancelado pelo administrador'].every(text=>messages.includes(text));
          if(complete) break;
        }
        await new Promise(resolve=>setTimeout(resolve,300));
      }
      assert.equal(complete,true,'Every confirmed action must reach its recipients, including after service downtime');
    }
    const pending=await rows<{total:number}>('SELECT COUNT(*) AS total FROM appointment_outbox WHERE acknowledged_at IS NULL AND JSON_EXTRACT(payload,\'$.patientId\')=?',[patient.id]);
    // Recovery acknowledges only after both inboxes commit; allow the in-flight ACK to finish.
    if(pending[0].total>0) await new Promise(resolve=>setTimeout(resolve,3500));
    const remaining=await rows<{total:number}>('SELECT COUNT(*) AS total FROM appointment_outbox WHERE acknowledged_at IS NULL AND JSON_EXTRACT(payload,\'$.patientId\')=?',[patient.id]);
    assert.equal(remaining[0].total,0);
    const events=await rows<{payload:string|{event:string}}>('SELECT payload FROM appointment_outbox WHERE JSON_EXTRACT(payload,\'$.appointmentId\')=?',[created.id]);
    assert.deepEqual(events.map(row=>typeof row.payload==='string'?JSON.parse(row.payload).event:row.payload.event).sort(),
      ['appointment.created','appointment.updated','appointment.rescheduled','appointment.rescheduled','appointment.cancelled'].sort(),
      'Failed and unauthorized operations must not append successful lifecycle events');
    const logout=await api('users/logout','POST',{},patientCookie); assert.equal(logout.status,200); assert.match(logout.headers.get('set-cookie')!,/Max-Age=0/i);
  } finally {
    if(workerStopped) notificationService('start');
    for(const id of accounts) await write('DELETE FROM appointment_outbox WHERE JSON_EXTRACT(payload,\'$.patientId\')=?',[id]);
    for(const id of appointments) await write('DELETE FROM agendamentos WHERE id=?',[id]);
    for(const id of accounts.reverse()) await write('DELETE FROM usuarios WHERE id=?',[id]);
    await database().end(); redis().disconnect();
  }
});
