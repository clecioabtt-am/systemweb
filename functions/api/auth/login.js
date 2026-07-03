
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
        await ensureUsers(env);
        await env.CEEB_DB.prepare("INSERT OR IGNORE INTO users (id, name, role, access_key, active) VALUES (1, 'Suporte', 'support', ?, 1)").bind(accessKey).run().catch(() => null);
      }
    } else {
      if (!env.CEEB_DB) return json({ ok: false, error: 'Binding CEEB_DB não encontrado.' }, 500);
      await ensureUsers(env);
      const row = await env.CEEB_DB.prepare('SELECT id, name, role, active, expires_at FROM users WHERE access_key = ? LIMIT 1').bind(accessKey).first();
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

async function log(env, user, action, target, request) {
  if (!env.CEEB_DB) return;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.CEEB_DB.prepare('INSERT INTO activity_logs (actor_id, actor_name, action, target, ip) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, user.name, action, target, ip).run().catch(() => null);
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });
}
