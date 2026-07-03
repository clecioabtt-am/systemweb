-- Execute este SQL no D1 se quiser corrigir manualmente a tabela users já existente.
ALTER TABLE users ADD COLUMN access_key TEXT;
ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN expires_at TEXT;
ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_access_key ON users(access_key);
