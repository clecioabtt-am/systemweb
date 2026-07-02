export async function onRequestGet({ env }) {
  return json({ ok: true, d1: !!env.CEEB_DB, kv: !!env.CEEB_KV, asaas: !!env.ASAAS_API_KEY, env: env.ASAAS_ENV || 'production' });
}
function json(data) { return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json; charset=utf-8' } }); }
