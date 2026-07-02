CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'support',
  access_key TEXT UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS polos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  complement TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asaas_id TEXT UNIQUE,
  name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  complement TEXT,
  polo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (polo_id) REFERENCES polos(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asaas_id TEXT UNIQUE,
  student_id INTEGER,
  polo_id INTEGER,
  value REAL,
  due_date TEXT,
  status TEXT,
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (polo_id) REFERENCES polos(id)
);

CREATE TABLE IF NOT EXISTS payment_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asaas_id TEXT UNIQUE,
  name TEXT,
  url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accountability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  polo_id INTEGER,
  title TEXT,
  total REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (polo_id) REFERENCES polos(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_name TEXT,
  action TEXT NOT NULL,
  target TEXT,
  metadata TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_polo ON students(polo_id);
CREATE INDEX IF NOT EXISTS idx_students_cpf ON students(cpf);
CREATE INDEX IF NOT EXISTS idx_students_complement ON students(complement);
CREATE INDEX IF NOT EXISTS idx_invoices_polo ON invoices(polo_id);
CREATE INDEX IF NOT EXISTS idx_logs_actor ON activity_logs(actor_id);

INSERT OR IGNORE INTO polos (name, complement) VALUES
('Polo BVR', 'POLO BVR'),
('Polo Manaus', 'POLO MANAUS'),
('Polo Barreirinha', 'POLO BARREIRINHA'),
('Polo Silves', 'POLO SILVES'),
('Polo Nhamundá', 'POLO NHAMUNDÁ'),
('Polo Urucará', 'POLO URUCARÁ');
