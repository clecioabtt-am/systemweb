export async function ensureStudentsColumns(env) {
  if (!env?.CEEB_DB) return;
  try {
    const info = await env.CEEB_DB.prepare('PRAGMA table_info(students)').all();
    const cols = new Set((info.results || []).map(c => c.name));
    const alters = [];
    if (!cols.has('asaas_id')) alters.push('ALTER TABLE students ADD COLUMN asaas_id TEXT');
    if (!cols.has('email')) alters.push('ALTER TABLE students ADD COLUMN email TEXT');
    if (!cols.has('phone')) alters.push('ALTER TABLE students ADD COLUMN phone TEXT');
    if (!cols.has('complement')) alters.push('ALTER TABLE students ADD COLUMN complement TEXT');
    if (!cols.has('updated_at')) alters.push('ALTER TABLE students ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
    for (const sql of alters) await env.CEEB_DB.prepare(sql).run();
    await env.CEEB_DB.prepare('CREATE INDEX IF NOT EXISTS idx_students_asaas_id ON students(asaas_id)').run();
    await env.CEEB_DB.prepare('CREATE INDEX IF NOT EXISTS idx_students_complement ON students(complement)').run();
  } catch (e) {
    console.warn('ensureStudentsColumns failed', e?.message || e);
  }
}

export async function upsertStudentFromAsaas(env, customer, fallback = {}) {
  if (!env?.CEEB_DB || !customer?.id) return;
  await ensureStudentsColumns(env);
  const name = customer.name || fallback.name || '';
  const cpf = customer.cpfCnpj || fallback.cpfCnpj || fallback.cpf || '';
  const email = customer.email || fallback.email || '';
  const phone = customer.phone || customer.mobilePhone || fallback.phone || '';
  const complement = customer.complement || fallback.complement || '';

  const existing = await env.CEEB_DB.prepare('SELECT id FROM students WHERE asaas_id = ? OR cpf = ? LIMIT 1')
    .bind(customer.id, cpf)
    .first()
    .catch(() => null);

  if (existing?.id) {
    await env.CEEB_DB.prepare(`UPDATE students
      SET asaas_id = ?, name = ?, cpf = ?, email = ?, phone = ?, complement = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`)
      .bind(customer.id, name, cpf, email, phone, complement, existing.id)
      .run();
  } else {
    await env.CEEB_DB.prepare(`INSERT INTO students (asaas_id, name, cpf, email, phone, complement, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(customer.id, name, cpf, email, phone, complement)
      .run();
  }
}
