import { DatabaseSync } from 'node:sqlite';
import { notificationMessage } from './events.mjs';
export function createStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS notifications (
      eventId TEXT NOT NULL, userId INTEGER NOT NULL, appointmentId INTEGER NOT NULL,
      message TEXT NOT NULL, timestamp TEXT NOT NULL, PRIMARY KEY(eventId,userId)
    );
    CREATE INDEX IF NOT EXISTS user_notifications ON notifications(userId,timestamp);`);
  const insert = db.prepare('INSERT OR IGNORE INTO notifications VALUES (?,?,?,?,?)');
  const list = db.prepare('SELECT eventId,appointmentId,message,timestamp FROM notifications WHERE userId=? ORDER BY timestamp DESC,eventId DESC LIMIT ? OFFSET ?');
  return {
    save(event) {
      db.exec('BEGIN');
      try {
        let inserted=0;
        for (const id of new Set([event.patientId, event.doctorId, event.previous?.doctorId, event.actorId].filter(Number.isSafeInteger))) {
          inserted+=Number(insert.run(event.eventId,id,event.appointmentId,notificationMessage(event),event.timestamp).changes);
        }
        db.exec('COMMIT');
        return inserted;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    list(userId, offset = 0, limit = 100) { return list.all(userId, limit, offset); },
    close() { db.close(); },
  };
}
