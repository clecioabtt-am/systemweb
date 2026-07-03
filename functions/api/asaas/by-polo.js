import { asaasFetch, json } from './_utils.js';

function normalize(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function getComplement(customer = {}) {
  // No Asaas o campo esperado é `complement`. Mantemos fallbacks para evitar
  // retornar vazio caso a API entregue variações em algum ambiente.
  return String(customer.complement || customer.addressComplement || customer.complemento || '').trim();
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const complement = String(url.searchParams.get('complement') || url.searchParams.get('polo') || '').trim();
    if (!complement) return json({ ok: false, error: 'Informe o complemento/polo.' }, 400);

    const target = normalize(complement);
    const matched = [];
    let scanned = 0;
    let offset = 0;
    const limit = 100;

    // A API do Asaas pode não filtrar exatamente por `complement` em todas as contas.
    // Por isso buscamos páginas de clientes e filtramos do lado do backend, garantindo
    // que a tela exiba somente clientes cujo campo complemento seja igual ao Polo selecionado.
    for (let pageIndex = 0; pageIndex < 120; pageIndex++) {
      const page = await asaasFetch(env, `/customers?limit=${limit}&offset=${offset}`);
      const rows = page.data || [];
      scanned += rows.length;

      for (const customer of rows) {
        const currentComplement = getComplement(customer);
        if (normalize(currentComplement) === target) {
          matched.push({
            ...customer,
            complement: currentComplement
          });
        }
      }

      if (!page.hasMore || rows.length === 0) break;
      offset += limit;
    }

    return json({
      ok: true,
      complement,
      total: matched.length,
      scanned,
      data: matched
    });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
