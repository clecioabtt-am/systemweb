import { asaasFetch, onlyDigits, json } from '../asaas/_utils.js';

function normalize(v=''){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR')}
function getComplement(c={}){return String(c.complement||c.addressComplement||c.complemento||'').trim()}
function brDate(v=''){ if(!v) return ''; const [y,m,d]=String(v).slice(0,10).split('-'); return y&&m&&d?`${d}/${m}/${y}`:v; }
function billingLabel(v=''){const m={BOLETO:'Boleto Bancário / Pix',PIX:'PIX',UNDEFINED:'Boleto Bancário / Pix',CREDIT_CARD:'Cartão'}; return m[String(v).toUpperCase()]||v||''}
function paymentUrl(p={}){return p.invoiceUrl||p.bankSlipUrl||p.transactionReceiptUrl||p.paymentLink||''}
export function isPaidStatus(s=''){return ['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(String(s||'').toUpperCase())}
export function isoInRange(date,start,end){const d=String(date||'').slice(0,10); return !!(d && (!start || d>=start) && (!end || d<=end));}
function mapInvoice(customer,p){
  const status=String(p.status||'').toUpperCase();
  const payDate=p.paymentDate||p.clientPaymentDate||p.confirmedDate||'';
  return {
    id:p.id,
    customerId:customer.id,
    name:customer.name||'',
    cpfCnpj:customer.cpfCnpj||'',
    complement:getComplement(customer),
    billingType:p.billingType||'',
    billingTypeLabel:billingLabel(p.billingType),
    dueDate:p.dueDate||'',
    dueDateBr:brDate(p.dueDate),
    paymentDate:payDate,
    paymentDateBr:brDate(payDate),
    value:p.value||0,
    netValue:p.netValue ?? p.value ?? 0,
    status,
    description:p.description||'',
    invoiceUrl:paymentUrl(p),
    canDelete:['PENDING','AWAITING_RISK_ANALYSIS'].includes(status)
  }
}
async function allCustomers(env){
  const out=[]; let offset=0; const limit=100;
  for(let i=0;i<180;i++){
    const page=await asaasFetch(env,`/customers?limit=${limit}&offset=${offset}`);
    const rows=page.data||[]; out.push(...rows);
    if(!page.hasMore||!rows.length)break; offset+=limit;
  }
  return out;
}
async function customersByPolo(env,polo){
  const target=normalize(polo);
  const rows=(await allCustomers(env)).filter(c=>normalize(getComplement(c))===target);
  rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'}));
  return rows;
}
async function customersByClient(env,name,cpf){
  const cpfClean=onlyDigits(cpf||'');
  let found=[];
  if(cpfClean){const r=await asaasFetch(env,`/customers?cpfCnpj=${encodeURIComponent(cpfClean)}&limit=100`); found.push(...(r.data||[]));}
  if(name){
    const r=await asaasFetch(env,`/customers?name=${encodeURIComponent(name)}&limit=100`);
    found.push(...(r.data||[]));
  }
  const byId=new Map(); found.forEach(c=>byId.set(c.id,c));
  const arr=[...byId.values()];
  arr.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'}));
  return arr;
}
async function invoicesForCustomer(env,customer,opts={}){
  const out=[]; let offset=0; const limit=100;
  for(let i=0;i<20;i++){
    const page=await asaasFetch(env,`/payments?customer=${encodeURIComponent(customer.id)}&limit=${limit}&offset=${offset}`);
    const rows=(page.data||[]).map(p=>mapInvoice(customer,p));
    for(const row of rows){
      if(opts.onlyPaid && !isPaidStatus(row.status)) continue;
      if(opts.paymentStart || opts.paymentEnd){
        if(!isoInRange(row.paymentDate,opts.paymentStart,opts.paymentEnd)) continue;
      }
      out.push(row);
    }
    if(!page.hasMore||!rows.length)break; offset+=limit;
  }
  return out;
}
async function mapConcurrent(items,limit,fn){
  const results=new Array(items.length);
  let idx=0;
  async function worker(){
    while(idx<items.length){
      const current=idx++;
      results[current]=await fn(items[current],current);
    }
  }
  const workers=Array.from({length:Math.min(limit,items.length)},()=>worker());
  await Promise.all(workers);
  return results;
}
export async function fetchInvoiceRows(env,{mode,polo,name,cpf,onlyPaid=false,paymentStart='',paymentEnd='',concurrency=8}){
  const customers = mode==='polo' ? await customersByPolo(env,polo) : await customersByClient(env,name,cpf);
  const chunks=await mapConcurrent(customers,concurrency,(c)=>invoicesForCustomer(env,c,{onlyPaid,paymentStart,paymentEnd}));
  const all=chunks.flat();
  all.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR',{sensitivity:'base'}) || String(a.paymentDate||a.dueDate||'').localeCompare(String(b.paymentDate||b.dueDate||'')));
  return all;
}
export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url); const mode=url.searchParams.get('mode')||'polo';
    const polo=url.searchParams.get('polo')||url.searchParams.get('complement')||'';
    const name=url.searchParams.get('name')||url.searchParams.get('nome')||'';
    const cpf=url.searchParams.get('cpf')||'';
    if(mode==='polo' && !polo) return json({ok:false,error:'Informe o Polo.'},400);
    if(mode!=='polo' && !name && !cpf) return json({ok:false,error:'Informe nome ou CPF.'},400);
    const data=await fetchInvoiceRows(env,{mode,polo,name,cpf});
    return json({ok:true,total:data.length,data});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
