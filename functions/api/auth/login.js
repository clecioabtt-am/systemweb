export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const profile = body.profile || 'support';
    const accessKey = String(body.accessKey || '').trim();
    if (!accessKey) return json({ ok: false, error: 'Informe a chave de acesso.' }, 400);
    if (!env.CEEB_KV) return json({ ok: false, error: 'Binding CEEB_KV não encontrado.' }, 500);

    let user = null;
    if (profile === 'support') {
      if (!env.SUPPORT_MASTER_KEY) return json({ ok: false, error: 'SUPPORT_MASTER_KEY não configurada.' }, 500);
      if (accessKey !== env.SUPPORT_MASTER_KEY) return json({ ok: false, error: 'Chave de suporte inválida.' }, 401);
      user = { id: 1, name: 'Suporte', role: 'support' };
      if (env.CEEB_DB) {
        await ensureUserCompatibility(env);
        const cols = await userColumns(env);
        const h = await hashKey(accessKey);
        const insertCols = ['id', 'name', 'role', 'active'];
        const placeholders = ['1', "'Suporte'", "'support'", '1'];
        const binds = [];
        if (cols.has('access_key')) { insertCols.push('access_key'); placeholders.push('?'); binds.push(accessKey); }
        if (cols.has('access_key_hash')) { insertCols.push('access_key_hash'); placeholders.push('?'); binds.push(h); }
        await env.CEEB_DB.prepare(`INSERT OR IGNORE INTO users (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`).bind(...binds).run().catch(() => null);
      }
    } else {
      if (!env.CEEB_DB) return json({ ok: false, error: 'Binding CEEB_DB não encontrado.' }, 500);
      await ensureUserCompatibility(env);
      const cols = await userColumns(env);
      const h = await hashKey(accessKey);
      let row = null;
      if (cols.has('access_key_hash')) row = await env.CEEB_DB.prepare('SELECT id, name, role, active, expires_at FROM users WHERE access_key_hash = ? AND role = ? LIMIT 1').bind(h, 'coordinator').first();
      if (!row && cols.has('access_key')) row = await env.CEEB_DB.prepare('SELECT id, name, role, active, expires_at FROM users WHERE access_key = ? AND role = ? LIMIT 1').bind(accessKey, 'coordinator').first();
      if (!row) return json({ ok: false, error: 'Chave de coordenador inválida.' }, 401);
      if (!row.active) return json({ ok: false, error: 'Acesso bloqueado pelo suporte.' }, 403);
      if (row.expires_at && String(row.expires_at).slice(0,10) < new Date().toISOString().slice(0,10)) return json({ ok: false, error: 'Chave expirada. Solicite ao suporte uma nova data de expiração.' }, 403);
      user = { id: row.id, name: row.name, role: row.role };
    }

    const token = crypto.randomUUID();
    const expires = Date.now() + 1000 * 60 * 60 * 8;
    await env.CEEB_KV.put(`session:${token}`, JSON.stringify({ ...user, expires }), { expirationTtl: 60 * 60 * 8 });
    await log(env, user, 'login', 'auth', request);
    return json({ ok: true, user }, 200, {
      'Set-Cookie': `ceeb_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 8}`
    });
  } catch (err) {
    return json({ ok: false, error: err.message || 'Falha no login.' }, 500);
  }
}

async function hashKey(value) {
  const enc = new TextEncoder().encode(String(value || ''));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function userColumns(env) {
  const r = await env.CEEB_DB.prepare('PRAGMA table_info(users)').all();
  return new Set((r.results || []).map(c => c.name));
}
async function ensureUserCompatibility(env) {
  await env.CEEB_DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'support',
    access_key TEXT UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const cols = await userColumns(env);
  if (!cols.has('access_key')) await env.CEEB_DB.prepare('ALTER TABLE users ADD COLUMN access_key TEXT').run().catch(() => null);
  if (!cols.has('access_key_hash')) await env.CEEB_DB.prepare('ALTER TABLE users ADD COLUMN access_key_hash TEXT').run().catch(() => null);
}
async function log(env, user, action, target, request) {
  if (!env.CEEB_DB) return;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.CEEB_DB.prepare('INSERT INTO activity_logs (actor_id, actor_name, action, target, ip) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, user.name, action, target, ip).run().catch(() => null);
}
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });
}
