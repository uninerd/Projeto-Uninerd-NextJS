CREATE TABLE IF NOT EXISTS appointment_outbox (
  sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id CHAR(36) NOT NULL UNIQUE,
  payload JSON NOT NULL,
  acknowledged_at DATETIME(3) NULL,
  INDEX pending_events (acknowledged_at, sequence_id)
);
