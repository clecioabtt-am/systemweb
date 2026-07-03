import { asaasFetch, onlyDigits, json, log } from './_utils.js';
import { upsertStudentFromAsaas } from './db-utils.js';

const RECENT_KEY = 'recent:invoices:v1';

function parseMoney(value) {
  if (typeof value === 'number') return value;
  const s = String(value || '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function normalizeBilling(v = '') {
  const b = String(v || '').trim().toUpperCase();
  if (b === 'BOLETO' || b === 'PIX' || b === 'CREDIT_CARD' || b === 'UNDEFINED') return b;
  if (b.includes('PIX') && b.includes('BOLETO')) return 'UNDEFINED';
  return 'UNDEFINED';
}
function dueDateOk(v='') { return /^\d{4}-\d{2}-\d{2}$/.test(String(v)); }
function invoiceUrl(payment={}) {
  return payment.invoiceUrl || payment.bankSlipUrl || payment.transactionReceiptUrl || payment.paymentLink || '';
}
async function findOrCreateCustomer(env, item) {
  const cpfCnpj = onlyDigits(item.cpfCnpj || item.cpf || '');
  const name = String(item.name || '').trim();
  if (!name || !cpfCnpj) throw new Error('Nome e CPF/CNPJ são obrigatórios.');
  const found = await asaasFetch(env, `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`);
  if (found?.data?.length) {
    const existing = found.data[0];
    const payload = { name, cpfCnpj, complement: item.complement || existing.complement || undefined, email: item.email || existing.email || undefined, phone: onlyDigits(item.phone || '') || existing.phone || undefined, mobilePhone: onlyDigits(item.phone || '') || existing.mobilePhone || undefined };
    const customer = await asaasFetch(env, `/customers/${existing.id}`, { method: 'POST', body: JSON.stringify(payload) });
    await upsertStudentFromAsaas(env, customer, item);
    return customer;
  }
  const payload = { name, cpfCnpj, complement: item.complement || undefined, email: item.email || undefined, phone: onlyDigits(item.phone || '') || undefined, mobilePhone: onlyDigits(item.phone || '') || undefined };
  const customer = await asaasFetch(env, '/customers', { method: 'POST', body: JSON.stringify(payload) });
  await upsertStudentFromAsaas(env, customer, item);
  return customer;
}
async function createPayment(env, item) {
  const value = parseMoney(item.value);
  if (!value || value <= 0) throw new Error(`Valor inválido para ${item.name || 'cliente'}.`);
  if (!dueDateOk(item.dueDate)) throw new Error(`Vencimento inválido para ${item.name || 'cliente'}. Use AAAA-MM-DD.`);
  const customer = item.id && String(item.id).startsWith('cus_') ? item : await findOrCreateCustomer(env, item);
  const customerId = customer.id || item.id || item.asaas_id;
  if (!customerId) throw new Error('Cliente sem ID do Asaas.');
  const payload = {
    customer: customerId,
    billingType: normalizeBilling(item.billingType),
    value,
    dueDate: item.dueDate,
    description: item.description || `Mensalidade ${item.complement || ''}`.trim(),
    externalReference: item.externalReference || undefined
  };
  const payment = await asaasFetch(env, '/payments', { method: 'POST', body: JSON.stringify(payload) });
  const url = invoiceUrl(payment);
  const row = { name: item.name || customer.name || 'Cliente', cpfCnpj: item.cpfCnpj || item.cpf || customer.cpfCnpj || '', complement: item.complement || customer.complement || '', asaasPaymentId: payment.id, customerId, url, value, dueDate: item.dueDate, billingType: payload.billingType, description: payload.description, createdAt: new Date().toISOString() };
  if (env.CEEB_DB) {
    await env.CEEB_DB.prepare(`INSERT OR IGNORE INTO invoices (asaas_id, value, due_date, status, invoice_url, bank_slip_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .bind(payment.id, value, item.dueDate, payment.status || 'PENDING', payment.invoiceUrl || url, payment.bankSlipUrl || '').run().catch(()=>null);
  }
  return row;
}
async function appendRecent(env, rows) {
  if (!env.CEEB_KV) return;
  const current = await env.CEEB_KV.get(RECENT_KEY, 'json').catch(()=>null);
  const list = [...(Array.isArray(rows) ? rows : [rows]), ...(Array.isArray(current) ? current : [])].slice(0, 300);
  await env.CEEB_KV.put(RECENT_KEY, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 7 }).catch(()=>null);
}
export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const mode = body.mode || 'manual';
    if (mode === 'bulk') {
      const customers = Array.isArray(body.customers) ? body.customers : [];
      if (!customers.length) return json({ ok: false, error: 'Nenhum aluno selecionado.' }, 400);
      const results = [];
      for (const item of customers) {
        try { results.push({ ok: true, invoice: await createPayment(env, item) }); }
        catch (e) { results.push({ ok: false, name: item.name, error: e.message }); }
      }
      const created = results.filter(r => r.ok).map(r => r.invoice);
      await appendRecent(env, created);
      await log(env, data.user, 'asaas.invoices.bulk_create', 'payments', { total: customers.length, success: created.length }, request);
      return json({ ok: true, total: customers.length, success: created.length, failed: results.length - created.length, invoices: created, results });
    }
    const invoice = await createPayment(env, body);
    await appendRecent(env, invoice);
    await log(env, data.user, 'asaas.invoice.create', invoice.asaasPaymentId, { name: invoice.name, value: invoice.value }, request);
    return json({ ok: true, invoice });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
