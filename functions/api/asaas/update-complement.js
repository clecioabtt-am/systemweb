import { asaasFetch, json, log } from './_utils.js';

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const customers = Array.isArray(body.customers) ? body.customers : [];
    const complement = String(body.complement || '').trim();
    if (!customers.length) return json({ ok: false, error: 'Nenhum cliente informado.' }, 400);
    if (!complement) return json({ ok: false, error: 'Informe o novo complemento.' }, 400);

    const results = [];
    for (const item of customers) {
      try {
        const id = item.id || item.asaas_id;
        if (!id) throw new Error('Cliente sem ID Asaas.');
        const customer = await asaasFetch(env, `/customers/${id}`, { method: 'POST', body: JSON.stringify({ complement }) });
        results.push({ id, ok: true, customer });
        if (env.CEEB_DB) {
          await env.CEEB_DB.prepare('UPDATE students SET complement = ?, updated_at = CURRENT_TIMESTAMP WHERE asaas_id = ?').bind(complement, id).run().catch(()=>null);
        }
      } catch (e) {
        results.push({ id: item.id, ok: false, error: e.message });
      }
    }
    await log(env, data.user, 'asaas.customers.bulk_complement', 'customers', { complement, total: customers.length }, request);
    return json({ ok: true, total: customers.length, success: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
