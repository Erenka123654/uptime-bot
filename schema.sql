-- Drop the old Telegram-based tables (incompatible schema) before recreating.
DROP TABLE IF EXISTS monitors;
DROP TABLE IF EXISTS users;

-- Anonymous users identified by a random token generated client-side on first visit.
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',       -- 'free' | 'paid'
  created_at INTEGER NOT NULL
);

-- Monitored URLs
CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',  -- 'up' | 'down' | 'unknown'
  last_checked_at INTEGER,
  last_status_code INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
