import { asaasFetch, json } from './_utils.js';

function normalizeComplement(value = '') {
  return String(value || '').trim();
}

async function fetchAllCustomers(env, refresh=false) {
  const customersCacheKey = 'asaas:customers:all:v2';
  if (!refresh && env.CEEB_KV) {
    const cached = await env.CEEB_KV.get(customersCacheKey, 'json').catch(() => null);
    if (Array.isArray(cached?.data)) return cached.data;
  }
  const out = [];
  let offset = 0;
  const limit = 100;
  for (let pageIndex = 0; pageIndex < 180; pageIndex++) {
    const page = await asaasFetch(env, `/customers?limit=${limit}&offset=${offset}`);
    const rows = page.data || [];
    out.push(...rows);
    if (!page.hasMore || rows.length === 0) break;
    offset += limit;
  }
  if (env.CEEB_KV) await env.CEEB_KV.put(customersCacheKey, JSON.stringify({ data: out, updatedAt: new Date().toISOString() }), { expirationTtl: 900 }).catch(() => null);
  return out;
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === '1';
    const cacheKey = 'asaas:polos:complements:v2';

    if (!refresh && env.CEEB_KV) {
      const cached = await env.CEEB_KV.get(cacheKey, 'json').catch(() => null);
      if (cached?.data) return json({ ok: true, cached: true, ...cached });
    }

    const customers = await fetchAllCustomers(env, refresh);
    const map = new Map();
    for (const customer of customers) {
      const complement = normalizeComplement(customer.complement);
      if (!complement) continue;
      const current = map.get(complement) || { complement, total: 0 };
      current.total += 1;
      map.set(complement, current);
    }

    const data = Array.from(map.values()).sort((a, b) =>
      a.complement.localeCompare(b.complement, 'pt-BR', { sensitivity: 'base' })
    );

    const payload = { total: data.length, data, updatedAt: new Date().toISOString() };
    if (env.CEEB_KV) {
      await env.CEEB_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 900 }).catch(() => null);
    }

    return json({ ok: true, cached: false, ...payload });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
