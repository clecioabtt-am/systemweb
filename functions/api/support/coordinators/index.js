function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function isSupport(data) { return data?.user?.role === 'support'; }
function brDate(v='') { if (!v) return ''; const [y,m,d] = String(v).slice(0,10).split('-'); return y&&m&&d ? `${d}/${m}/${y}` : v; }
function todayISO() { return new Date().toISOString().slice(0,10); }
function statusOf(row) {
  if (!Number(row.active)) return 'bloqueado';
  if (row.expires_at && String(row.expires_at).slice(0,10) < todayISO()) return 'expirado';
  const soon = new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10);
  if (row.expires_at && String(row.expires_at).slice(0,10) <= soon) return 'vence_em_breve';
  return 'ativo';
}

async function ensureUsers(env) {
  if (!env.CEEB_DB) throw Object.assign(new Error('Binding CEEB_DB não encontrado.'), { status: 500 });
  await env.CEEB_DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'support',
    access_key TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const info = await env.CEEB_DB.prepare('PRAGMA table_info(users)').all();
  const cols = new Set((info.results || []).map(c => c.name));
  const alters = [];
  if (!cols.has('role')) alters.push("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'coordinator'");
  if (!cols.has('access_key')) alters.push('ALTER TABLE users ADD COLUMN access_key TEXT');
  if (!cols.has('active')) alters.push('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  if (!cols.has('expires_at')) alters.push('ALTER TABLE users ADD COLUMN expires_at TEXT');
  if (!cols.has('created_at')) alters.push('ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  if (!cols.has('updated_at')) alters.push('ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  for (const sql of alters) await env.CEEB_DB.prepare(sql).run().catch(() => null);
  await env.CEEB_DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)').run().catch(() => null);
  await env.CEEB_DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_access_key ON users(access_key)').run().catch(() => null);
}

async function log(env, data, action, target, request, metadata = {}) {
  if (!env.CEEB_DB) return;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.CEEB_DB.prepare('INSERT INTO activity_logs (actor_id, actor_name, action, target, metadata, ip) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(data.user?.id || null, data.user?.name || 'Suporte', action, target, JSON.stringify(metadata), ip).run().catch(() => null);
}
export async function onRequestGet({ env, data }) {
  try {
    if (!isSupport(data)) return json({ ok: false, error: 'Acesso restrito ao suporte.' }, 403);
    await ensureUsers(env);
    const r = await env.CEEB_DB.prepare("SELECT id, name, access_key, active, expires_at, created_at, updated_at FROM users WHERE role = 'coordinator' ORDER BY name COLLATE NOCASE ASC").all();
    const rows = (r.results || []).map(row => ({ ...row, expires_at_br: brDate(row.expires_at), status: statusOf(row) }));
    const summary = {
      total: rows.length,
      ativos: rows.filter(r => r.status === 'ativo' || r.status === 'vence_em_breve').length,
      bloqueados: rows.filter(r => r.status === 'bloqueado').length,
      expirados: rows.filter(r => r.status === 'expirado').length,
      vencendo: rows.filter(r => r.status === 'vence_em_breve').length
    };
    return json({ ok: true, data: rows, summary });
  } catch (err) { return json({ ok: false, error: err.message }, err.status || 500); }
}
export async function onRequestPost({ request, env, data }) {
  try {
    if (!isSupport(data)) return json({ ok: false, error: 'Acesso restrito ao suporte.' }, 403);
    await ensureUsers(env);
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const accessKey = String(body.accessKey || '').trim();
    const expiresAt = String(body.expiresAt || '').trim() || null;
    const active = body.active === false ? 0 : 1;
    if (!name) return json({ ok: false, error: 'Informe o nome do coordenador.' }, 400);
    if (!accessKey) return json({ ok: false, error: 'Informe a senha/chave de acesso do coordenador.' }, 400);
    const existing = await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key = ? LIMIT 1').bind(accessKey).first();
    if (existing) return json({ ok: false, error: 'Essa senha/chave já está em uso por outro usuário.' }, 409);
    const r = await env.CEEB_DB.prepare("INSERT INTO users (name, role, access_key, active, expires_at, updated_at) VALUES (?, 'coordinator', ?, ?, ?, CURRENT_TIMESTAMP)")
      .bind(name, accessKey, active, expiresAt).run();
    await log(env, data, 'coordinator_create', 'users', request, { name, expiresAt, active });
    return json({ ok: true, id: r.meta?.last_row_id || null });
  } catch (err) { return json({ ok: false, error: err.message }, err.status || 500); }
}
