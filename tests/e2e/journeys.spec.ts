import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { database, write } from '../../backend/src/server/shared/database';
import { login as loginWithBudget } from './auth';

const password = 'JornadaForte@123';
function cpf() {
  const digits = Array.from({ length:9 },()=>Math.floor(Math.random()*10));
  for (const count of [10,11]) { const remainder=digits.reduce((sum,n,i)=>sum+n*(count-i),0)%11; digits.push(remainder<2?0:11-remainder); }
  return digits.join('');
}
async function login(page:Page,email:string,senha=password) {
  await loginWithBudget(page,email,senha);
}
async function logout(page:Page) {
  const response=page.waitForResponse(r=>r.url().endsWith('/api/users/logout') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Sair do Sistema'}).click();
  expect((await response).ok()).toBe(true); await expect(page).toHaveURL('/login');
}
async function fitsViewport(page:Page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document must not scroll horizontally').toBe(true);
  const main=page.locator('main');
  if (await main.count()) expect(await main.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Content must fit; wide tables should scroll inside their own container').toBe(true);
}
async function submit(page:Page,button:string,path:string,method:string) {
  const response=page.waitForResponse(r=>new URL(r.url()).pathname===path && r.request().method()===method);
  const alert=page.waitForEvent('dialog',{predicate:dialog=>dialog.type()==='alert'});
  const confirmation=method==='DELETE' && path.startsWith('/api/appointments/')
    ? page.waitForEvent('dialog',{predicate:dialog=>dialog.type()==='confirm'}) : null;
  const click=page.getByRole('button',{ name:button,exact:true }).click();
  if (confirmation) await (await confirmation).accept();
  const result=await response;
  await (await alert).accept(); await click;
  expect(result.ok(),`${method} ${path}`).toBe(true); return result;
}
test.afterAll(async()=>{ await database().end(); });

test('real UI: catalog CRUD, patient registration/profile, booking/edit/cancel, doctor completion and inbox recovery',async({ page },testInfo)=>{
  const key=randomUUID().slice(0,8); const doctorName=`Médico UI ${key}`;
  const doctorEmail=`ui-doctor-${key}@example.com`; const patientEmail=`ui-patient-${key}@example.com`;
  const date=new Date(Date.now()+45*86400000).toISOString().slice(0,10);
  const accounts:number[]=[]; const appointments:number[]=[]; const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await login(page,process.env.ADMIN_EMAIL ?? 'admin@uninerd.local',process.env.ADMIN_PASSWORD!);
    await page.goto('/doctors/new');
    await page.getByLabel('E-mail de acesso').fill(doctorEmail);
    await page.getByLabel('Senha inicial').fill(password);
    await page.getByLabel('Nome Completo').fill(doctorName);
    await page.getByLabel('CRM',{exact:true}).fill(String(Date.now()).slice(-9));
    await page.getByLabel('Especialidade',{exact:true}).selectOption({index:1});
    await page.getByLabel('Endereço da Clínica/Consultório').fill('Clínica de testes UI');
    await fitsViewport(page);
    const doctor=await (await submit(page,'Salvar Médico','/api/doctors','POST')).json(); accounts.push(doctor.id);
    await expect(page).toHaveURL('/doctors');
    const row=page.getByRole('row').filter({hasText:doctorName}); await expect(row).toBeVisible();
    await row.getByRole('button',{name:'Editar',exact:true}).click();
    await expect(page.getByLabel('Nome Completo')).toHaveValue(doctorName);
    await page.getByLabel('Endereço da Clínica/Consultório').fill('Clínica UI atualizada');
    await submit(page,'Salvar Alterações',`/api/doctors/${doctor.id}`,'PUT');
    await expect(page.getByRole('row').filter({hasText:doctorName})).toContainText('Clínica UI atualizada');
    await fitsViewport(page);
    await logout(page);

    await login(page,doctorEmail);
    await page.getByRole('link',{name:'Meus horários',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Meus horários de atendimento'})).toBeVisible();
    const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
    const dayName=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][weekday];
    await page.getByLabel('Dia da semana').selectOption(String(weekday));
    await page.getByRole('checkbox',{name:`${dayName} 10:00`,exact:true}).check();
    await page.getByRole('checkbox',{name:`${dayName} 11:00`,exact:true}).check();
    const savedWeek=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/doctors/${doctor.id}/weekly-schedule` && r.request().method()==='PUT');
    await page.getByRole('button',{name:'Salvar agenda semanal',exact:true}).click();
    expect((await savedWeek).ok()).toBe(true);
    await expect(page.getByText('Agenda semanal salva.',{exact:false})).toBeVisible();
    await page.reload();
    await page.getByLabel('Dia da semana').selectOption(String(weekday));
    await expect(page.getByRole('checkbox',{name:`${dayName} 10:00`,exact:true})).toBeChecked();
    await page.getByLabel('Data de atendimento').fill(date);
    await expect(page.getByRole('checkbox',{name:'10:00',exact:true})).toBeChecked();
    await fitsViewport(page);
    await logout(page);

    await page.goto('/register');
    await page.getByLabel('Nome Completo').fill(`Paciente UI ${key}`);
    await page.getByLabel('E-mail',{exact:true}).fill(patientEmail);
    await page.getByLabel('CPF',{exact:true}).fill(cpf());
    await page.getByLabel('Senha',{exact:true}).fill(password);
    await page.getByLabel('Confirmar Senha',{exact:true}).fill(password);
    await fitsViewport(page);
    const registered=await (await submit(page,'Finalizar Cadastro','/api/users/register','POST')).json(); accounts.push(registered.data.id);
    await expect(page).toHaveURL('/login'); await login(page,patientEmail);
    await expect(page.getByRole('heading',{name:'Bem-vindo(a), Paciente!'})).toBeVisible();
    await fitsViewport(page);
    await page.goto('/profile');
    await page.getByLabel('Nome Completo').fill(`Paciente atualizado ${key}`);
    await submit(page,'Salvar Perfil',`/api/users/${registered.data.id}`,'PUT');
    await page.reload(); await expect(page.getByLabel('Nome Completo')).toHaveValue(`Paciente atualizado ${key}`);
    await fitsViewport(page);

    async function book() {
      await page.goto(`/appointments/new?doctorId=${doctor.id}`);
      await page.getByLabel('Data',{exact:true}).fill(date);
      await expect(page.getByLabel('Hora',{exact:true}).locator('option[value="10:00"]')).toHaveCount(1);
      await page.getByLabel('Hora',{exact:true}).selectOption('10:00');
      await fitsViewport(page);
      const appointment=await (await submit(page,'Confirmar Agendamento','/api/appointments','POST')).json(); appointments.push(appointment.id);
      await expect(page).toHaveURL('/appointments'); return appointment;
    }
    const first=await book();
    await expect(page.getByRole('row').filter({hasText:doctorName})).toContainText('AGENDADO');
    await fitsViewport(page);
    await page.getByRole('row').filter({hasText:doctorName}).getByRole('button',{name:'Editar',exact:true}).click();
    await page.getByLabel('Tipo de Atendimento').selectOption('exame');
    await expect(page.getByLabel('Estado').locator('option[value="CONCLUIDO"]')).toHaveCount(0);
    await fitsViewport(page);
    await submit(page,'Guardar Alterações',`/api/appointments/${first.id}`,'PUT');
    await expect(page.getByRole('row').filter({hasText:doctorName})).toContainText('exame');
    await submit(page,'Cancelar',`/api/appointments/${first.id}`,'DELETE');
    await expect(page.getByRole('row').filter({hasText:doctorName})).toContainText('CANCELADO');
    const second=await book();
    await page.goto('/notifications');
    await expect(page.getByText(`Agendamento #${second.id} criado`,{exact:false})).toBeVisible();
    await expect(page.getByText(`Agendamento #${first.id} atualizado`,{exact:false})).toBeVisible();
    await expect(page.getByText(`Agendamento #${first.id} cancelado`,{exact:false})).toBeVisible();
    await page.route('**/api/notifications*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Falha simulada de teste'})}));
    await page.getByRole('button',{name:'Atualizar',exact:true}).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Não foi possível');
    await page.unroute('**/api/notifications*'); await page.getByRole('button',{name:'Atualizar',exact:true}).click();
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(`Agendamento #${second.id} criado`,{exact:false})).toBeVisible();
    await fitsViewport(page);
    await page.screenshot({path:testInfo.outputPath('patient-inbox.png'),fullPage:true});
    await logout(page);

    await login(page,doctorEmail);
    await page.goto('/my-schedule');
    await page.getByLabel('Data de atendimento').fill(date);
    await expect(page.getByRole('checkbox',{name:'10:00',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Fechar horários livres',exact:true}).click();
    const savedDate=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/doctors/${doctor.id}/schedule` && r.request().method()==='PUT');
    await page.getByRole('button',{name:'Salvar disponibilidade',exact:true}).click();
    expect((await savedDate).ok()).toBe(true);
    await expect(page.getByRole('checkbox',{name:'10:00',exact:true})).toBeChecked();
    await expect(page.getByRole('checkbox',{name:'11:00',exact:true})).not.toBeChecked();
    await fitsViewport(page);
    await page.goto('/appointments');
    const active=page.getByRole('row').filter({hasText:'AGENDADO'});
    await expect(active).toHaveCount(1); await active.getByRole('button',{name:'Editar',exact:true}).click();
    await page.getByLabel('Estado').selectOption('CONCLUIDO');
    await submit(page,'Guardar Alterações',`/api/appointments/${second.id}`,'PUT');
    const completed=page.getByRole('row').filter({hasText:'CONCLUIDO'});
    await expect(completed).toHaveCount(1); await expect(completed.getByRole('button')).toHaveCount(0);
    await page.goto('/notifications');
    await expect(page.getByText(`Agendamento #${second.id} concluído pelo médico`,{exact:false})).toBeVisible();
    const inbox=await (await page.request.get('/api/notifications')).json();
    let newArrival=false;
    const simulated={eventId:randomUUID(),appointmentId:second.id,message:'Notificação de teste recebida automaticamente.',timestamp:new Date().toISOString()};
    await page.route('**/api/notifications*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...inbox,data:newArrival?[simulated,...inbox.data]:inbox.data})}));
    await page.reload();
    await expect(page.getByText(`Agendamento #${second.id} concluído pelo médico`,{exact:false})).toBeVisible();
    newArrival=true;
    await expect(page.getByText(simulated.message,{exact:true})).toBeVisible({timeout:8000});
    await page.unroute('**/api/notifications*');
    await fitsViewport(page);
    await logout(page);
    // Remove only this test's clinical records before exercising catalog deletion.
    for (const id of appointments) await write('DELETE FROM agendamentos WHERE id=?',[id]);
    await login(page,process.env.ADMIN_EMAIL ?? 'admin@uninerd.local',process.env.ADMIN_PASSWORD!);
    await page.goto('/doctors');
    await page.getByRole('row').filter({hasText:doctorName}).getByRole('button',{name:'Excluir',exact:true}).click();
    await submit(page,'Sim, Excluir',`/api/doctors/${doctor.id}`,'DELETE');
    await expect(page.getByRole('row').filter({hasText:doctorName})).toHaveCount(0);
    await fitsViewport(page);
    expect(errors).toEqual([]);
  } finally {
    // Only IDs created by this test; completed appointments cannot be purged through the business API.
    for (const id of appointments) await write('DELETE FROM agendamentos WHERE id=?',[id]);
    for (const id of accounts.reverse()) await write('DELETE FROM usuarios WHERE id=?',[id]);
  }
});
