import { json } from '../asaas/_utils.js';
const KEY = 'recent:invoices:v1';
export async function onRequestGet({ env }) {
  const data = env.CEEB_KV ? (await env.CEEB_KV.get(KEY, 'json').catch(()=>null)) : null;
  return json({ ok: true, data: Array.isArray(data) ? data : [] });
}
export async function onRequestDelete({ env }) {
  if (env.CEEB_KV) await env.CEEB_KV.delete(KEY).catch(()=>null);
  return json({ ok: true, data: [] });
}
