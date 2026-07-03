function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function isSupport(data) { return data?.user?.role === 'support'; }
async function log(env, data, action, target, request, metadata = {}) {
  if (!env.CEEB_DB) return;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.CEEB_DB.prepare('INSERT INTO activity_logs (actor_id, actor_name, action, target, metadata, ip) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(data.user?.id || null, data.user?.name || 'Suporte', action, target, JSON.stringify(metadata), ip).run().catch(() => null);
}
async function getId(context) {
  return Number(context.params?.id || 0);
}
export async function onRequestPatch(context) {
  const { request, env, data } = context;
  try {
    if (!isSupport(data)) return json({ ok: false, error: 'Acesso restrito ao suporte.' }, 403);
    const id = await getId(context);
    if (!id || id === 1) return json({ ok: false, error: 'Coordenador inválido.' }, 400);
    const body = await request.json().catch(() => ({}));
    const current = await env.CEEB_DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'coordinator' LIMIT 1").bind(id).first();
    if (!current) return json({ ok: false, error: 'Coordenador não encontrado.' }, 404);

    const fields = [];
    const binds = [];
    if (body.name !== undefined) { const v = String(body.name || '').trim(); if (!v) return json({ ok:false,error:'Informe o nome.'},400); fields.push('name = ?'); binds.push(v); }
    if (body.accessKey !== undefined) {
      const v = String(body.accessKey || '').trim();
      if (!v) return json({ ok:false,error:'Informe a senha/chave.'},400);
      const ex = await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key = ? AND id <> ? LIMIT 1').bind(v, id).first();
      if (ex) return json({ ok:false,error:'Essa senha/chave já está em uso.'},409);
      fields.push('access_key = ?'); binds.push(v);
    }
    if (body.expiresAt !== undefined) { fields.push('expires_at = ?'); binds.push(String(body.expiresAt || '').trim() || null); }
    if (body.active !== undefined) { fields.push('active = ?'); binds.push(body.active ? 1 : 0); }
    if (!fields.length) return json({ ok:false,error:'Nenhuma alteração enviada.'},400);
    fields.push('updated_at = CURRENT_TIMESTAMP');
    binds.push(id);
    await env.CEEB_DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND role = 'coordinator'`).bind(...binds).run();
    await log(env, data, 'coordinator_update', `users:${id}`, request, body);
    return json({ ok: true });
  } catch (err) { return json({ ok: false, error: err.message }, err.status || 500); }
}
export async function onRequestDelete(context) {
  const { request, env, data } = context;
  try {
    if (!isSupport(data)) return json({ ok: false, error: 'Acesso restrito ao suporte.' }, 403);
    const id = await getId(context);
    if (!id || id === 1) return json({ ok: false, error: 'Coordenador inválido.' }, 400);
    const r = await env.CEEB_DB.prepare("DELETE FROM users WHERE id = ? AND role = 'coordinator'").bind(id).run();
    await log(env, data, 'coordinator_delete', `users:${id}`, request);
    return json({ ok: true, deleted: r.meta?.changes || 0 });
  } catch (err) { return json({ ok: false, error: err.message }, err.status || 500); }
}
