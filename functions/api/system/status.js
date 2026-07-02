export async function onRequestGet({ env, data }) {
  let tables = [];
  if (env.CEEB_DB) {
    const r = await env.CEEB_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    tables = r.results.map(x => x.name);
  }
  return json({ ok: true, user: data.user, d1: !!env.CEEB_DB, kv: !!env.CEEB_KV, asaas: !!env.ASAAS_API_KEY, tables });
}
function json(data) { return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json; charset=utf-8' } }); }
