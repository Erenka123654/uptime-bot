ALTER TABLE monitors ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE monitors ADD COLUMN method TEXT NOT NULL DEFAULT 'GET';
ALTER TABLE monitors ADD COLUMN expected_status INTEGER NOT NULL DEFAULT 200;
ALTER TABLE monitors ADD COLUMN interval_minutes INTEGER NOT NULL DEFAULT 5;
ALTER TABLE monitors ADD COLUMN timeout_ms INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE monitors ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE monitors ADD COLUMN response_time_ms INTEGER;

UPDATE monitors SET name = replace(replace(url, 'https://', ''), 'http://', '') WHERE name = '';

CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at INTEGER NOT NULL,
  FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checks_monitor_time ON checks(monitor_id, checked_at DESC);
