import { asaasFetch, json } from './_utils.js';

function normalizeComplement(value = '') {
  return String(value || '').trim();
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === '1';
    const cacheKey = 'asaas:polos:complements:v1';

    if (!refresh && env.CEEB_KV) {
      const cached = await env.CEEB_KV.get(cacheKey, 'json').catch(() => null);
      if (cached?.data) return json({ ok: true, cached: true, ...cached });
    }

    const map = new Map();
    let offset = 0;
    const limit = 100;

    // Busca clientes no Asaas e monta a lista única de Polos a partir do campo complement.
    // O limite de páginas evita chamada excessiva caso a conta tenha muitos clientes.
    for (let pageIndex = 0; pageIndex < 80; pageIndex++) {
      const page = await asaasFetch(env, `/customers?limit=${limit}&offset=${offset}`);
      const rows = page.data || [];

      for (const customer of rows) {
        const complement = normalizeComplement(customer.complement);
        if (!complement) continue;
        const current = map.get(complement) || { complement, total: 0 };
        current.total += 1;
        map.set(complement, current);
      }

      if (!page.hasMore || rows.length === 0) break;
      offset += limit;
    }

    const data = Array.from(map.values()).sort((a, b) =>
      a.complement.localeCompare(b.complement, 'pt-BR', { sensitivity: 'base' })
    );

    const payload = { total: data.length, data, updatedAt: new Date().toISOString() };
    if (env.CEEB_KV) {
      await env.CEEB_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 600 }).catch(() => null);
    }

    return json({ ok: true, cached: false, ...payload });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
