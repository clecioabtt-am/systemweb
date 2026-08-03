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
async function hashKey(value) {
  const enc = new TextEncoder().encode(String(value || ''));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function userColumns(env) {
  const r = await env.CEEB_DB.prepare('PRAGMA table_info(users)').all();
  return new Set((r.results || []).map(c => c.name));
}
async function ensureUsers(env) {
  if (!env.CEEB_DB) throw Object.assign(new Error('Binding CEEB_DB não encontrado.'), { status: 500 });
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
  // Compatibilidade com bancos já criados em versões anteriores
  if (!cols.has('access_key')) await env.CEEB_DB.prepare('ALTER TABLE users ADD COLUMN access_key TEXT').run().catch(() => null);
  if (!cols.has('access_key_hash')) await env.CEEB_DB.prepare('ALTER TABLE users ADD COLUMN access_key_hash TEXT').run().catch(() => null);
  if (!cols.has('active')) await env.CEEB_DB.prepare('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1').run().catch(() => null);
  if (!cols.has('expires_at')) await env.CEEB_DB.prepare('ALTER TABLE users ADD COLUMN expires_at TEXT').run().catch(() => null);
  if (!cols.has('updated_at')) await env.CEEB_DB.prepare('ALTER TABLE users ADD COLUMN updated_at TEXT').run().catch(() => null);
}
async function log(env, data, action, target, request, metadata = {}) {
  if (!env.CEEB_DB) return;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.CEEB_DB.prepare('INSERT INTO activity_logs (actor_id, actor_name, action, target, metadata, ip) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(data.user?.id || null, data.user?.name || 'Suporte', action, target, JSON.stringify(metadata), ip).run().catch(() => null);
}
function safePublicKey(k='') { return String(k || ''); }
export async function onRequestGet({ env, data }) {
  try {
    if (!isSupport(data)) return json({ ok: false, error: 'Acesso restrito ao suporte.' }, 403);
    await ensureUsers(env);
    const cols = await userColumns(env);
    const keySelect = cols.has('access_key') ? 'access_key' : "'' AS access_key";
    const r = await env.CEEB_DB.prepare(`SELECT id, name, ${keySelect}, active, expires_at, created_at, updated_at FROM users WHERE role = 'coordinator' ORDER BY name COLLATE NOCASE ASC`).all();
    const rows = (r.results || []).map(row => ({ ...row, access_key: safePublicKey(row.access_key), expires_at_br: brDate(row.expires_at), status: statusOf(row) }));
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
    const cols = await userColumns(env);
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const accessKey = String(body.accessKey || '').trim();
    const accessHash = await hashKey(accessKey);
    const expiresAt = String(body.expiresAt || '').trim() || null;
    const active = body.active === false ? 0 : 1;
    if (!name) return json({ ok: false, error: 'Informe o nome do coordenador.' }, 400);
    if (!accessKey) return json({ ok: false, error: 'Informe a senha/chave de acesso do coordenador.' }, 400);

    let existing = null;
    if (cols.has('access_key_hash')) existing = await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key_hash = ? LIMIT 1').bind(accessHash).first();
    if (!existing && cols.has('access_key')) existing = await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key = ? LIMIT 1').bind(accessKey).first();
    if (existing) return json({ ok: false, error: 'Essa senha/chave já está em uso por outro usuário.' }, 409);

    const insertCols = ['name', 'role', 'active', 'expires_at', 'updated_at'];
    const placeholders = ['?', "'coordinator'", '?', '?', 'CURRENT_TIMESTAMP'];
    const binds = [name, active, expiresAt];
    if (cols.has('access_key')) { insertCols.splice(2, 0, 'access_key'); placeholders.splice(2, 0, '?'); binds.splice(1, 0, accessKey); }
    if (cols.has('access_key_hash')) { insertCols.splice(3, 0, 'access_key_hash'); placeholders.splice(3, 0, '?'); binds.splice(2, 0, accessHash); }

    const r = await env.CEEB_DB.prepare(`INSERT INTO users (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`).bind(...binds).run();
    await log(env, data, 'coordinator_create', 'users', request, { name, expiresAt, active });
    return json({ ok: true, id: r.meta?.last_row_id || null });
  } catch (err) { return json({ ok: false, error: err.message }, err.status || 500); }
}


export async function onRequestPatch({ request, env, data }) {
  try {
    if (!isSupport(data)) return json({ ok: false, error: 'Acesso restrito ao suporte.' }, 403);
    await ensureUsers(env);
    const cols = await userColumns(env);
    const body = await request.json().catch(() => ({}));
    const id = String(body.id ?? '').trim();
    if (!id || id === '1') return json({ ok: false, error: 'Coordenador inválido.' }, 400);

    const current = await env.CEEB_DB.prepare("SELECT id, name FROM users WHERE CAST(id AS TEXT) = ? AND role = 'coordinator' LIMIT 1").bind(id).first();
    if (!current) return json({ ok: false, error: 'Coordenador não encontrado.' }, 404);

    const fields = [];
    const binds = [];

    if (body.name !== undefined) {
      const v = String(body.name || '').trim();
      if (!v) return json({ ok: false, error: 'Informe o nome do coordenador.' }, 400);
      fields.push('name = ?'); binds.push(v);
    }

    // A chave só é alterada quando uma NOVA chave é enviada explicitamente.
    // Assim, renovar apenas a validade nunca tenta cadastrar novamente a chave antiga.
    if (body.accessKey !== undefined && String(body.accessKey || '').trim() !== '') {
      const v = String(body.accessKey).trim();
      const h = await hashKey(v);
      let existing = null;
      if (cols.has('access_key_hash')) {
        existing = await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key_hash = ? AND CAST(id AS TEXT) <> ? LIMIT 1').bind(h, id).first();
      }
      if (!existing && cols.has('access_key')) {
        existing = await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key = ? AND CAST(id AS TEXT) <> ? LIMIT 1').bind(v, id).first();
      }
      if (existing) return json({ ok: false, error: 'Essa senha/chave já está em uso por outro usuário.' }, 409);
      if (cols.has('access_key')) { fields.push('access_key = ?'); binds.push(v); }
      if (cols.has('access_key_hash')) { fields.push('access_key_hash = ?'); binds.push(h); }
    }

    if (body.expires_at !== undefined || body.expiresAt !== undefined) {
      const v = body.expires_at ?? body.expiresAt;
      fields.push('expires_at = ?'); binds.push(String(v || '').trim() || null);
    }
    if (body.active !== undefined) {
      fields.push('active = ?'); binds.push(body.active ? 1 : 0);
    }

    if (!fields.length) return json({ ok: false, error: 'Nenhuma alteração enviada.' }, 400);
    if (cols.has('updated_at')) fields.push('updated_at = CURRENT_TIMESTAMP');
    binds.push(id);

    const result = await env.CEEB_DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE CAST(id AS TEXT) = ? AND role = 'coordinator'`).bind(...binds).run();
    if (!(result.meta?.changes || 0)) return json({ ok: false, error: 'Nenhuma alteração foi aplicada.' }, 404);

    await log(env, data, 'coordinator_update', `users:${id}`, request, {
      name: body.name,
      expires_at: body.expires_at ?? body.expiresAt,
      active: body.active,
      accessKey: body.accessKey ? '[alterada]' : undefined
    });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500);
  }
}

export async function onRequestDelete({ request, env, data }) {
  try {
    if (!isSupport(data)) return json({ ok: false, error: 'Acesso restrito ao suporte.' }, 403);
    await ensureUsers(env);
    const url = new URL(request.url);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!id || id === '1') return json({ ok: false, error: 'Coordenador inválido.' }, 400);

    const current = await env.CEEB_DB.prepare("SELECT id, name FROM users WHERE CAST(id AS TEXT) = ? AND role = 'coordinator' LIMIT 1").bind(id).first();
    if (!current) return json({ ok: false, error: 'Coordenador não encontrado.' }, 404);

    const result = await env.CEEB_DB.prepare("DELETE FROM users WHERE CAST(id AS TEXT) = ? AND role = 'coordinator'").bind(id).run();
    if (!(result.meta?.changes || 0)) return json({ ok: false, error: 'O coordenador não foi removido.' }, 500);

    await log(env, data, 'coordinator_delete', `users:${id}`, request, { name: current.name });
    return json({ ok: true, deleted: result.meta?.changes || 1 });
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500);
  }
}
