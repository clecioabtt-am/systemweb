import { asaasFetch, json } from './_utils.js';

export async function onRequestGet({ env }) {
  try {
    const result = await asaasFetch(env, '/customers?limit=1&offset=0');
    return json({ ok: true, message: 'Conexão com Asaas funcionando.', totalCount: result.totalCount ?? null });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
