import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (existsSync('.env')) {
  console.log('.env já existe; configuração preservada.');
} else {
  const password = randomBytes(24).toString('hex');
  const values = {
    JWT_SECRET: randomBytes(32).toString('hex'), MYSQL_ROOT_PASSWORD: randomBytes(24).toString('hex'),
    MYSQL_PASSWORD: password, DB_PASSWORD: password,
    NOTIFICATIONS_INTERNAL_KEY: randomBytes(32).toString('hex'), ADMIN_PASSWORD: `Aa1!${randomBytes(20).toString('hex')}`,
  };
  let content = readFileSync('.env.example', 'utf8');
  for (const [key, value] of Object.entries(values)) content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
  writeFileSync('.env', content, { flag: 'wx' });
  console.log('.env criado com segredos aleatórios. Consulte ADMIN_EMAIL e ADMIN_PASSWORD localmente para acessar como administrador.');
}
