import { asaasFetch, json } from './_utils.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const complement = url.searchParams.get('complement') || url.searchParams.get('polo') || '';
    if (!complement) return json({ ok: false, error: 'Informe o complemento/polo.' }, 400);
    const all = [];
    let offset = 0;
    const limit = 100;
    for (let i = 0; i < 20; i++) {
      const page = await asaasFetch(env, `/customers?complement=${encodeURIComponent(complement)}&limit=${limit}&offset=${offset}`);
      all.push(...(page.data || []));
      if (!page.hasMore) break;
      offset += limit;
    }
    return json({ ok: true, complement, total: all.length, data: all });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
