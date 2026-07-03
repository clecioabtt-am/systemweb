import { asaasFetch, onlyDigits, json, log } from './_utils.js';
import { upsertStudentFromAsaas } from './db-utils.js';

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return json({ ok: false, error: 'Nenhuma linha CSV recebida.' }, 400);
    const results = [];
    for (const row of rows) {
      const name = String(row.nome || row.name || '').trim();
      const cpfCnpj = onlyDigits(row.cpf || row.cpfCnpj || '');
      const complement = String(row.complemento || row.complement || '').trim();
      if (!name || !cpfCnpj) { results.push({ name, cpfCnpj, ok: false, error: 'Nome ou CPF vazio.' }); continue; }
      try {
        const found = await asaasFetch(env, `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`);
        const existing = found?.data?.[0];
        const payload = { name, cpfCnpj, complement };
        const customer = existing
          ? await asaasFetch(env, `/customers/${existing.id}`, { method: 'POST', body: JSON.stringify(payload) })
          : await asaasFetch(env, '/customers', { method: 'POST', body: JSON.stringify(payload) });
        await upsertStudentFromAsaas(env, customer, { name, cpfCnpj, complement });
        results.push({ name, cpfCnpj, complement, ok: true, mode: existing ? 'updated' : 'created', id: customer.id });
      } catch (e) {
        results.push({ name, cpfCnpj, complement, ok: false, error: e.message });
      }
    }
    await log(env, data.user, 'asaas.customers.bulk_import', 'customers', { total: rows.length }, request);
    return json({ ok: true, total: rows.length, success: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
  } catch (err) { return json({ ok: false, error: err.message }, 500); }
}
