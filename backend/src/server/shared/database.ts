import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
const globalDb = globalThis as unknown as { uninerdDb?: Pool };
export function database(): Pool {
  if (!globalDb.uninerdDb) globalDb.uninerdDb = mysql.createPool({
    host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 3317),
    user: process.env.DB_USER ?? 'uninerd', password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'uninerd_db', connectionLimit: 10,
    waitForConnections: true, queueLimit: 50, connectTimeout: 5000, dateStrings: true,
  });
  return globalDb.uninerdDb;
}
export async function rows<T>(sql: string, values: (string | number | null)[] = []): Promise<T[]> {
  const [result] = await database().execute<RowDataPacket[]>(sql, values);
  return result as T[];
}
export async function write(sql: string, values: (string | number | null)[] = []) {
  const [result] = await database().execute<ResultSetHeader>(sql, values);
  return result;
}
