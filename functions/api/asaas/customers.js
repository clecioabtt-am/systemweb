import { asaasFetch, onlyDigits, json, log } from './_utils.js';

export async function onRequestGet({ request, env, data }) {
  try {
    const url = new URL(request.url);
    const cpf = onlyDigits(url.searchParams.get('cpf') || '');
    const complement = url.searchParams.get('complement') || url.searchParams.get('polo') || '';
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 100);
    const offset = Number(url.searchParams.get('offset') || 0);
    let path = `/customers?limit=${limit}&offset=${offset}`;
    if (cpf) path += `&cpfCnpj=${encodeURIComponent(cpf)}`;
    if (complement) path += `&complement=${encodeURIComponent(complement)}`;
    const result = await asaasFetch(env, path);
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const cpfCnpj = onlyDigits(body.cpfCnpj || body.cpf || '');
    const complement = String(body.complement || '').trim();
    if (!name || !cpfCnpj) return json({ ok: false, error: 'Nome e CPF/CNPJ são obrigatórios.' }, 400);

    let existing = null;
    const found = await asaasFetch(env, `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`);
    if (found?.data?.length) existing = found.data[0];

    const payload = {
      name,
      cpfCnpj,
      email: body.email || undefined,
      phone: onlyDigits(body.phone || '' ) || undefined,
      mobilePhone: onlyDigits(body.mobilePhone || body.phone || '') || undefined,
      complement: complement || undefined,
      address: body.address || undefined,
      addressNumber: body.addressNumber || undefined,
      province: body.province || undefined,
      postalCode: onlyDigits(body.postalCode || '') || undefined,
      externalReference: body.externalReference || undefined
    };

    const customer = existing
      ? await asaasFetch(env, `/customers/${existing.id}`, { method: 'POST', body: JSON.stringify(payload) })
      : await asaasFetch(env, '/customers', { method: 'POST', body: JSON.stringify(payload) });

    if (env.CEEB_DB) {
      await env.CEEB_DB.prepare(`INSERT INTO students (asaas_id, name, cpf, email, phone, complement, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(asaas_id) DO UPDATE SET name=excluded.name, cpf=excluded.cpf, email=excluded.email, phone=excluded.phone, complement=excluded.complement, updated_at=CURRENT_TIMESTAMP`)
        .bind(customer.id, customer.name || name, cpfCnpj, customer.email || body.email || '', customer.phone || body.phone || '', customer.complement || complement || '').run();
    }
    await log(env, data.user, existing ? 'asaas.customer.update' : 'asaas.customer.create', customer.id, { cpfCnpj, complement }, request);
    return json({ ok: true, mode: existing ? 'updated' : 'created', customer });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
