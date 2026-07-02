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
        await env.CEEB_DB.prepare("INSERT OR IGNORE INTO users (id, name, role, access_key, active) VALUES (1, 'Suporte', 'support', ?, 1)").bind(accessKey).run().catch(() => null);
      }
    } else {
      if (!env.CEEB_DB) return json({ ok: false, error: 'Binding CEEB_DB não encontrado.' }, 500);
      const row = await env.CEEB_DB.prepare('SELECT id, name, role, active, expires_at FROM users WHERE access_key = ? LIMIT 1').bind(accessKey).first();
      if (!row) return json({ ok: false, error: 'Chave de coordenador inválida.' }, 401);
      if (!row.active) return json({ ok: false, error: 'Acesso bloqueado pelo suporte.' }, 403);
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: 'Chave expirada.' }, 403);
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
