import { expect, type Page } from '@playwright/test';

export async function login(page: Page, email: string, senha: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  for (let attempt = 0; attempt < 3; attempt++) {
    const pending = page.waitForResponse(response => response.url().endsWith('/api/users/login') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const response = await pending;
    // Browser projects share the test proxy's real 5/minute authentication budget.
    // Wait for a token instead of weakening the production rate limit.
    if (response.status() === 429 && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 13000));
      continue;
    }
    expect(response.status(), 'Browser login must succeed').toBe(200);
    await expect(page).toHaveURL('/');
    return;
  }
}
