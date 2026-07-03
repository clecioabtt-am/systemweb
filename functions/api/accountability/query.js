import { json } from '../asaas/_utils.js';
import { fetchInvoiceRows, isPaidStatus, isoInRange } from '../invoices/query.js';
function brDate(v=''){if(!v)return ''; const [y,m,d]=String(v).slice(0,10).split('-'); return y&&m&&d?`${d}/${m}/${y}`:v;}
function cacheKey({polo,startDate,endDate}){return `accountability:v3:${String(polo||'').toLowerCase().trim()}:${startDate}:${endDate}`}
export async function getAccountabilityRows(env,{polo,startDate,endDate,refresh=false}){
  const key=cacheKey({polo,startDate,endDate});
  if(env.CEEB_KV && !refresh){
    const cached=await env.CEEB_KV.get(key,'json').catch(()=>null);
    if(cached) return {...cached, cached:true};
  }
  // Prestação de contas: somente faturas PAGAS dos clientes cujo complemento é exatamente o Polo selecionado,
  // considerando a DATA DE PAGAMENTO dentro do período informado.
  let paid=await fetchInvoiceRows(env,{mode:'polo',polo,onlyPaid:true,paymentStart:startDate,paymentEnd:endDate,concurrency:10});
  paid=paid.filter(r=>isPaidStatus(r.status)&&isoInRange(r.paymentDate,startDate,endDate));
  paid.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR',{sensitivity:'base'}) || String(a.paymentDate||'').localeCompare(String(b.paymentDate||'')));
  const totalPaid=paid.reduce((sum,r)=>sum+Number(r.netValue??r.value??0),0);
  const data={polo,startDate,endDate,startDateBr:brDate(startDate),endDateBr:brDate(endDate),summary:{paidCount:paid.length,totalPaid},rows:paid,cached:false};
  if(env.CEEB_KV) await env.CEEB_KV.put(key,JSON.stringify(data),{expirationTtl:600}).catch(()=>null);
  return data;
}
export async function onRequestGet({request,env}){
  try{const url=new URL(request.url);const polo=url.searchParams.get('polo')||'';const startDate=url.searchParams.get('startDate')||'';const endDate=url.searchParams.get('endDate')||'';const refresh=url.searchParams.get('refresh')==='1';if(!polo)return json({ok:false,error:'Informe o Polo.'},400);if(!startDate||!endDate)return json({ok:false,error:'Informe data inicial e data final.'},400);const data=await getAccountabilityRows(env,{polo,startDate,endDate,refresh});return json({ok:true,...data});}catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
