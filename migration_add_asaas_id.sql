-- Execute este arquivo no Cloudflare D1 apenas se seu banco já foi criado com schema antigo.
-- Ele adiciona as colunas usadas pela integração Asaas sem apagar seus dados.
ALTER TABLE students ADD COLUMN asaas_id TEXT;
ALTER TABLE students ADD COLUMN email TEXT;
ALTER TABLE students ADD COLUMN phone TEXT;
ALTER TABLE students ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_students_asaas_id ON students(asaas_id);
CREATE INDEX IF NOT EXISTS idx_students_complement ON students(complement);
