import { asaasFetch, onlyDigits, json } from '../asaas/_utils.js';

function normalize(v=''){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR')}
export function getComplement(c={}){return String(c.complement||c.addressComplement||c.complemento||'').trim()}
function brDate(v=''){ if(!v) return ''; const [y,m,d]=String(v).slice(0,10).split('-'); return y&&m&&d?`${d}/${m}/${y}`:v; }
function billingLabel(v=''){const m={BOLETO:'Boleto Bancário / Pix',PIX:'PIX',UNDEFINED:'Boleto Bancário / Pix',CREDIT_CARD:'Cartão'}; return m[String(v).toUpperCase()]||v||''}
function paymentUrl(p={}){return p.invoiceUrl||p.bankSlipUrl||p.transactionReceiptUrl||p.paymentLink||''}
export function isPaidStatus(s=''){return ['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(String(s||'').toUpperCase())}
export function isoInRange(date,start,end){const d=String(date||'').slice(0,10); return !!(d && (!start || d>=start) && (!end || d<=end));}
export function mapInvoice(customer,p){
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

export async function getAllCustomers(env,{refresh=false}={}){
  const cacheKey='asaas:customers:all:v2';
  if(env.CEEB_KV && !refresh){
    const cached=await env.CEEB_KV.get(cacheKey,'json').catch(()=>null);
    if(Array.isArray(cached?.data)) return cached.data;
  }
  const out=[]; let offset=0; const limit=100;
  for(let i=0;i<180;i++){
    const page=await asaasFetch(env,`/customers?limit=${limit}&offset=${offset}`);
    const rows=page.data||[]; out.push(...rows);
    if(!page.hasMore||!rows.length)break; offset+=limit;
  }
  if(env.CEEB_KV) await env.CEEB_KV.put(cacheKey,JSON.stringify({data:out,updatedAt:new Date().toISOString()}),{expirationTtl:900}).catch(()=>null);
  return out;
}
async function customersByPolo(env,polo){
  const target=normalize(polo);
  const rows=(await getAllCustomers(env)).filter(c=>normalize(getComplement(c))===target);
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
  let arr=[...byId.values()];
  if(cpfClean) arr=arr.filter(c=>onlyDigits(c.cpfCnpj||'')===cpfClean);
  if(name){const wanted=normalize(name);const exact=arr.filter(c=>normalize(c.name)===wanted);if(exact.length)arr=exact;}
  arr.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{sensitivity:'base'}));
  return arr;
}
async function invoicesForCustomer(env,customer,opts={}){
  const out=[]; let offset=0; const limit=100;
  for(let i=0;i<20;i++){
    const params=new URLSearchParams({customer:customer.id,limit:String(limit),offset:String(offset)});
    // Para prestação de contas, restringe a busca no próprio Asaas pela data de pagamento.
    // Isso evita carregar histórico inteiro de mensalidades de cada aluno.
    if(opts.paymentStart) params.set('paymentDate[ge]',opts.paymentStart);
    if(opts.paymentEnd) params.set('paymentDate[le]',opts.paymentEnd);
    const page=await asaasFetch(env,`/payments?${params.toString()}`);
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
export async function fetchInvoiceRows(env,{mode,polo,name,cpf,onlyPaid=false,paymentStart='',paymentEnd='',concurrency=12}){
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
    const onlyPaid=url.searchParams.get('onlyPaid')==='1';
    const data=await fetchInvoiceRows(env,{mode,polo,name,cpf,onlyPaid});
    const paid=data.filter(r=>isPaidStatus(r.status));
    return json({ok:true,total:data.length,summary:{paidCount:paid.length,totalPaid:paid.reduce((s,r)=>s+Number(r.value||0),0),totalNet:paid.reduce((s,r)=>s+Number(r.netValue??r.value??0),0)},data});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}

export async function onRequestPost({request,env}){
  try{
    const body=await request.json(); const people=Array.isArray(body.people)?body.people:[];
    if(!people.length)return json({ok:false,error:'Informe pelo menos um aluno.'},400);
    if(people.length>100)return json({ok:false,error:'Consulte no máximo 100 alunos por vez.'},400);
    const reports=[];
    for(const person of people){
      const name=String(person.name||person.nome||'').trim(),cpf=onlyDigits(person.cpf||'');
      if(!name&&!cpf)continue;
      const rows=await fetchInvoiceRows(env,{mode:'cliente',name,cpf,onlyPaid:true,concurrency:4});
      const groups=new Map();
      rows.forEach(row=>{const key=row.customerId||`${row.name}|${row.cpfCnpj}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)});
      if(!groups.size){reports.push({query:{name,cpf},name:name||'Aluno não localizado',cpfCnpj:cpf,found:false,paidCount:0,totalPaid:0,totalNet:0,rows:[]});continue;}
      for(const studentRows of groups.values()){
        studentRows.sort((a,b)=>String(a.paymentDate||a.dueDate||'').localeCompare(String(b.paymentDate||b.dueDate||'')));
        studentRows.forEach((r,i)=>r.paymentOrder=i+1);
        const first=studentRows[0];
        reports.push({query:{name,cpf},name:first.name,cpfCnpj:first.cpfCnpj,complement:first.complement,found:true,paidCount:studentRows.length,totalPaid:studentRows.reduce((s,r)=>s+Number(r.value||0),0),totalNet:studentRows.reduce((s,r)=>s+Number(r.netValue??r.value??0),0),rows:studentRows});
      }
    }
    reports.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    return json({ok:true,studentCount:reports.length,paidCount:reports.reduce((s,r)=>s+r.paidCount,0),totalPaid:reports.reduce((s,r)=>s+r.totalPaid,0),totalNet:reports.reduce((s,r)=>s+r.totalNet,0),reports});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
