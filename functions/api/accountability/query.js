import { asaasFetch, json } from '../asaas/_utils.js';
import { fetchInvoiceRows, isPaidStatus, isoInRange, getAllCustomers, getComplement, mapInvoice } from '../invoices/query.js';

function normalize(v=''){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR')}
function brDate(v=''){if(!v)return ''; const [y,m,d]=String(v).slice(0,10).split('-'); return y&&m&&d?`${d}/${m}/${y}`:v;}
function cacheKey({polo,startDate,endDate}){return `accountability:v5:${String(polo||'').toLowerCase().trim()}:${startDate}:${endDate}`}

async function fetchPaymentsByPaymentPeriod(env, startDate, endDate) {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (let i = 0; i < 120; i++) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    // O Asaas aceita filtros de data no endpoint de pagamentos. O filtro reduz muito o volume retornado.
    params.set('paymentDate[ge]', startDate);
    params.set('paymentDate[le]', endDate);
    const page = await asaasFetch(env, `/payments?${params.toString()}`);
    const rows = page.data || [];
    out.push(...rows);
    if (!page.hasMore || rows.length === 0) break;
    offset += limit;
  }
  return out;
}

async function fastPaidRowsByPoloPeriod(env, { polo, startDate, endDate }) {
  const target = normalize(polo);
  const customers = await getAllCustomers(env);
  const customerById = new Map();
  for (const c of customers) {
    if (normalize(getComplement(c)) === target) customerById.set(c.id, c);
  }
  if (!customerById.size) return [];

  const payments = await fetchPaymentsByPaymentPeriod(env, startDate, endDate);
  const rows = [];
  for (const payment of payments) {
    const customer = customerById.get(payment.customer);
    if (!customer) continue;
    const row = mapInvoice(customer, payment);
    if (!isPaidStatus(row.status)) continue;
    if (!isoInRange(row.paymentDate, startDate, endDate)) continue;
    rows.push(row);
  }
  rows.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR',{sensitivity:'base'}) || String(a.paymentDate||'').localeCompare(String(b.paymentDate||'')));
  return rows;
}

export async function getAccountabilityRows(env,{polo,startDate,endDate,refresh=false}){
  const key=cacheKey({polo,startDate,endDate});
  if(env.CEEB_KV && !refresh){
    const cached=await env.CEEB_KV.get(key,'json').catch(()=>null);
    if(cached) return {...cached, cached:true};
  }

  let paid = [];
  let strategy = 'fast-global-payments';
  try {
    // Estratégia rápida: busca somente pagamentos do período e cruza com clientes do Polo em cache.
    paid = await fastPaidRowsByPoloPeriod(env, { polo, startDate, endDate });
  } catch (err) {
    // Fallback: caso a API recuse algum filtro, usa a busca por cliente, ainda com filtro de data no endpoint.
    strategy = 'fallback-by-customer';
    paid = await fetchInvoiceRows(env,{mode:'polo',polo,onlyPaid:true,paymentStart:startDate,paymentEnd:endDate,concurrency:14});
  }

  paid=paid.filter(r=>isPaidStatus(r.status)&&isoInRange(r.paymentDate,startDate,endDate));
  paid.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR',{sensitivity:'base'}) || String(a.paymentDate||'').localeCompare(String(b.paymentDate||'')));
  const totalPaid=paid.reduce((sum,r)=>sum+Number(r.netValue??r.value??0),0);
  const data={polo,startDate,endDate,startDateBr:brDate(startDate),endDateBr:brDate(endDate),summary:{paidCount:paid.length,totalPaid},rows:paid,cached:false,strategy};
  if(env.CEEB_KV) await env.CEEB_KV.put(key,JSON.stringify(data),{expirationTtl:600}).catch(()=>null);
  return data;
}

function generalCacheKey({polos,startDate,endDate}){
  const normalized=[...polos].map(normalize).sort().join('|');
  return `accountability-general:v1:${normalized}:${startDate}:${endDate}`;
}

export async function getGeneralAccountabilityRows(env,{polos,startDate,endDate,refresh=false}){
  const selected=[...new Set((polos||[]).map(v=>String(v||'').trim()).filter(Boolean))];
  const key=generalCacheKey({polos:selected,startDate,endDate});
  if(env.CEEB_KV && !refresh){
    const cached=await env.CEEB_KV.get(key,'json').catch(()=>null);
    if(cached) return {...cached,cached:true};
  }

  const targetByNormalized=new Map(selected.map(p=>[normalize(p),p]));
  const customers=await getAllCustomers(env);
  const customerInfo=new Map();
  for(const customer of customers){
    const normalized=normalize(getComplement(customer));
    const polo=targetByNormalized.get(normalized);
    if(polo) customerInfo.set(customer.id,{customer,polo});
  }

  const payments=await fetchPaymentsByPaymentPeriod(env,startDate,endDate);
  const rowsByPolo=new Map(selected.map(p=>[p,[]]));
  for(const payment of payments){
    const info=customerInfo.get(payment.customer);
    if(!info) continue;
    const row=mapInvoice(info.customer,payment);
    if(!isPaidStatus(row.status) || !isoInRange(row.paymentDate,startDate,endDate)) continue;
    rowsByPolo.get(info.polo).push(row);
  }

  const reports=selected.map(polo=>{
    const rows=rowsByPolo.get(polo)||[];
    rows.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR',{sensitivity:'base'}) || String(a.paymentDate||'').localeCompare(String(b.paymentDate||'')));
    const totalPaid=rows.reduce((sum,r)=>sum+Number(r.netValue??r.value??0),0);
    return {polo,summary:{paidCount:rows.length,totalPaid},rows};
  });
  const summary={
    paidCount:reports.reduce((sum,r)=>sum+r.summary.paidCount,0),
    totalPaid:reports.reduce((sum,r)=>sum+r.summary.totalPaid,0)
  };
  const data={polos:selected,startDate,endDate,startDateBr:brDate(startDate),endDateBr:brDate(endDate),summary,reports,cached:false,strategy:'single-period-query'};
  if(env.CEEB_KV) await env.CEEB_KV.put(key,JSON.stringify(data),{expirationTtl:600}).catch(()=>null);
  return data;
}

export async function onRequestGet({request,env}){
  try{const url=new URL(request.url);const polo=url.searchParams.get('polo')||'';const startDate=url.searchParams.get('startDate')||'';const endDate=url.searchParams.get('endDate')||'';const refresh=url.searchParams.get('refresh')==='1';if(!polo)return json({ok:false,error:'Informe o Polo.'},400);if(!startDate||!endDate)return json({ok:false,error:'Informe data inicial e data final.'},400);const data=await getAccountabilityRows(env,{polo,startDate,endDate,refresh});return json({ok:true,...data});}catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
