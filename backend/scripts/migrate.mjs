import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
try {
  // Idempotent, additive migration; never deletes existing accounts or appointments.
  for (const filename of ['03-doctor-availability.sql']) {
    const sql = readFileSync(resolve('database', filename), 'utf8');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await db.query(statement);
  }
  console.log('Availability schema applied; existing data preserved.');
} finally { await db.end(); }
