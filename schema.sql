CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('support','coordinator')),
  name TEXT NOT NULL,
  email TEXT,
  access_key_hash TEXT NOT NULL,
  polo_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS polos (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, city TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, polo_id TEXT, name TEXT NOT NULL, cpf TEXT, phone TEXT, email TEXT, course TEXT, class_name TEXT, complement TEXT, status TEXT DEFAULT 'ativo', asaas_customer_id TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, student_id TEXT, polo_id TEXT, asaas_id TEXT, description TEXT, value REAL NOT NULL DEFAULT 0, due_date TEXT, status TEXT DEFAULT 'PENDING', invoice_url TEXT, bank_slip_url TEXT, pix_qr_code TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payment_links (id TEXT PRIMARY KEY, polo_id TEXT, student_id TEXT, title TEXT, url TEXT NOT NULL, value REAL DEFAULT 0, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS accountability (id TEXT PRIMARY KEY, polo_id TEXT, month_ref TEXT, total_charged REAL DEFAULT 0, total_paid REAL DEFAULT 0, total_pending REAL DEFAULT 0, notes TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY, actor_id TEXT, actor_name TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT, meta TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_polo ON students(polo_id);
CREATE INDEX IF NOT EXISTS idx_students_cpf ON students(cpf);
CREATE INDEX IF NOT EXISTS idx_invoices_polo ON invoices(polo_id);
CREATE INDEX IF NOT EXISTS idx_logs_actor ON activity_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_students_complement ON students(complement);
