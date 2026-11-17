import { asaasFetch, json, log } from './_utils.js';

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const customers = Array.isArray(body.customers) ? body.customers : [];
    if (!customers.length) return json({ ok: false, error: 'Nenhum cliente informado.' }, 400);
    // Lotes menores evitam timeout e facilitam a recuperação de erros do Asaas.
    if (customers.length > 10) return json({ ok: false, error: 'Envie no máximo 10 clientes por solicitação.' }, 400);

    const results = [];
    const seen = new Set();
    for (const item of customers) {
      const id = String(item?.id || item?.asaas_id || '').trim();
      try {
        const complement = String(item?.complement ?? body.complement ?? '').trim();
        if (!/^cus_[a-zA-Z0-9]+$/.test(id)) throw new Error('ID Asaas inválido.');
        if (seen.has(id)) throw new Error('Cliente duplicado na solicitação.');
        seen.add(id);
        if (!complement) throw new Error('O complemento não pode ficar vazio.');
        if (complement.length > 255) throw new Error('O complemento deve ter até 255 caracteres.');

        // Atualização cadastral no Asaas é PUT; POST é destinado à criação.
        await asaasFetch(env, `/customers/${encodeURIComponent(id)}`, {
          method: 'PUT', body: JSON.stringify({ complement })
        });
        // Só contar como sucesso após reler o cadastro efetivamente persistido.
        const customer = await asaasFetch(env, `/customers/${encodeURIComponent(id)}`);
        if (String(customer.complement || '').trim() !== complement) {
          throw new Error('O Asaas não confirmou o novo complemento na consulta do cliente.');
        }
        let warning = null;
        if (env.CEEB_DB) {
          try {
            await env.CEEB_DB.prepare('UPDATE students SET complement = ?, updated_at = CURRENT_TIMESTAMP WHERE asaas_id = ?').bind(complement, id).run();
          } catch (err) {
            warning = 'Atualizado no Asaas, mas não foi possível sincronizar o banco local.';
          }
        }
        results.push({ id, ok: true, complement, warning });
      } catch (e) {
        const status = Number(e.status) || null;
        results.push({
          id, ok: false, error: e.message || 'Falha na atualização do cliente.',
          status, code: e.code || null,
          retryable: status === 429 || (status === 403 && e.retryAfterSeconds > 0) ||
            (status >= 500 && status <= 504) ||
            (status === null && !/inválido|duplicado|vazio|255 caracteres/i.test(e.message || '')),
          retryAfterSeconds: e.retryAfterSeconds ?? null
        });
      }
    }
    await log(env, data?.user, 'asaas.customers.bulk_complement', 'customers', { total: customers.length, success: results.filter(r => r.ok).length }, request);
    return json({ ok: true, total: customers.length, success: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
