import { json } from '../asaas/_utils.js';
import { fetchInvoiceRows } from '../invoices/query.js';
function isPaid(s=''){return ['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(String(s||'').toUpperCase())}
function brDate(v=''){if(!v)return ''; const [y,m,d]=String(v).slice(0,10).split('-'); return y&&m&&d?`${d}/${m}/${y}`:v;}
function inRange(date,start,end){const d=String(date||'').slice(0,10); return d && d>=start && d<=end;}
export async function getAccountabilityRows(env,{polo,startDate,endDate}){
  const rows=await fetchInvoiceRows(env,{mode:'polo',polo});
  const paid=rows.filter(r=>isPaid(r.status)&&inRange(r.paymentDate||r.paymentDateBr,startDate,endDate));
  paid.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR',{sensitivity:'base'}) || String(a.paymentDate||'').localeCompare(String(b.paymentDate||'')));
  const totalPaid=paid.reduce((sum,r)=>sum+Number(r.netValue??r.value??0),0);
  return {polo,startDate,endDate,startDateBr:brDate(startDate),endDateBr:brDate(endDate),summary:{paidCount:paid.length,totalPaid},rows:paid};
}
export async function onRequestGet({request,env}){
  try{const url=new URL(request.url);const polo=url.searchParams.get('polo')||'';const startDate=url.searchParams.get('startDate')||'';const endDate=url.searchParams.get('endDate')||'';if(!polo)return json({ok:false,error:'Informe o Polo.'},400);if(!startDate||!endDate)return json({ok:false,error:'Informe data inicial e data final.'},400);const data=await getAccountabilityRows(env,{polo,startDate,endDate});return json({ok:true,...data});}catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}