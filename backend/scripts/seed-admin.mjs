import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
const { ADMIN_PASSWORD: password } = process.env;
if (!password || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) throw new Error('Configure ADMIN_PASSWORD com uma senha forte.');
const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
try {
  await db.execute(`INSERT INTO usuarios (nome,email,senha,nivel) VALUES (?,?,?,'admin') ON DUPLICATE KEY UPDATE nome=VALUES(nome)`,
    ['Administrador Uninerd', process.env.ADMIN_EMAIL ?? 'admin@uninerd.local', await bcrypt.hash(password,12)]);
  console.log('Administrador criado, ou preservado caso já existisse.');
} finally { await db.end(); }
