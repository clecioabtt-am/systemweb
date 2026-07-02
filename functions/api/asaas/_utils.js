export function asaasBase(env) {
  return (env.ASAAS_ENV || 'production') === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
}

export async function asaasFetch(env, path, options = {}) {
  if (!env.ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada.');
  const res = await fetch(`${asaasBase(env)}${path}`, {
    ...options,
    headers: {
      'access_token': env.ASAAS_API_KEY,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || data?.message || `Erro Asaas ${res.status}`;
    const error = new Error(msg);
    error.payload = data;
    error.status = res.status;
    throw error;
  }
  return data;
}

export function onlyDigits(v = '') { return String(v || '').replace(/\D/g, ''); }
export function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } }); }

export async function log(env, user, action, target, metadata, request) {
  if (!env.CEEB_DB) return;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.CEEB_DB.prepare('INSERT INTO activity_logs (actor_id, actor_name, action, target, metadata, ip) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(user?.id || null, user?.name || '', action, target, JSON.stringify(metadata || {}), ip).run().catch(() => null);
}
