import { test, expect } from '@playwright/test';
import { login } from './auth';
test('protected routes redirect to login and registration loads specialties', async ({ page }) => {
  await page.goto('/appointments'); await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading',{ name:'Entrar no Uninerd' })).toBeVisible();
  await page.getByRole('link',{ name:'Criar conta' }).click();
  await expect(page.getByRole('heading',{ name:'Novo Cadastro' })).toBeVisible();
  await page.getByLabel('Tipo de Cadastro').selectOption('medico');
  await expect(page.locator('select').last().locator('option')).not.toHaveCount(1);
});
test('administrator session, catalog, notifications and logout work in browser', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await login(page,process.env.ADMIN_EMAIL ?? 'admin@uninerd.local',process.env.ADMIN_PASSWORD!);
  await expect(page.getByRole('heading',{ name:'Administração Uninerd' })).toBeVisible();
  await page.getByRole('link',{ name:'Gerenciar médicos' }).click();
  await expect(page.getByRole('button',{ name:'Cadastrar Médico' })).toBeVisible();
  await page.getByRole('button',{ name:'Cadastrar Médico' }).click();
  await expect(page.getByLabel('E-mail de acesso')).toBeVisible();
  await page.getByRole('link',{ name:'Notificações' }).click();
  await expect(page.getByRole('heading',{ name:'Notificações',exact:true })).toBeVisible();
  await expect(page.getByText('Você ainda não tem notificações.')).toBeVisible();
  await page.getByRole('button',{ name:'Sair do Sistema' }).click(); await expect(page).toHaveURL(/\/login$/);
  const session = (await page.context().cookies()).find(cookie=>cookie.name==='uninerd_session'); expect(session).toBeUndefined();
  expect(errors).toEqual([]);
});
