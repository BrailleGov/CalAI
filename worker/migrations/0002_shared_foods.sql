-- AI-generated foods discovered from searches are shared across devices.
CREATE TABLE IF NOT EXISTS shared_foods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  serving_label TEXT NOT NULL,
  serving_grams REAL,
  kcal REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  category TEXT,
  source TEXT NOT NULL,
  query TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS shared_foods_created_idx ON shared_foods (created_at);
