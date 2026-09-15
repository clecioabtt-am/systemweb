import { json, onlyDigits } from '../asaas/_utils.js';
import { customersByClient, invoicesForCustomer, isPaidStatus } from './query.js';

export function statusGroup(status='') {
  const value=String(status||'').toUpperCase();
  if(isPaidStatus(value)) return 'paid';
  if(value==='OVERDUE') return 'overdue';
  if(['PENDING','AWAITING_RISK_ANALYSIS','DUNNING_REQUESTED','DUNNING_RECEIVED'].includes(value)) return 'pending';
  return 'other';
}

export function summarizeManual(rows=[]) {
  const summary={paidCount:0,overdueCount:0,pendingCount:0,totalCount:rows.length,paidValue:0,overdueValue:0,pendingValue:0};
  for(const row of rows){
    const group=statusGroup(row.status),value=Number(row.value||0);
    if(group==='paid'){summary.paidCount++;summary.paidValue+=value}
    else if(group==='overdue'){summary.overdueCount++;summary.overdueValue+=value}
    else if(group==='pending'){summary.pendingCount++;summary.pendingValue+=value}
  }
  return summary;
}

export async function queryManualStudent(env,cpfValue) {
  const cpf=onlyDigits(cpfValue||'');
  if(cpf.length!==11) { const error=new Error('Informe um CPF válido com 11 números.'); error.status=400; throw error; }
  const customers=await customersByClient(env,'',cpf);
  if(!customers.length) { const error=new Error('Nenhum aluno foi localizado no Asaas com este CPF.'); error.status=404; throw error; }
  const customer=customers[0];
  const rows=await invoicesForCustomer(env,customer);
  rows.sort((a,b)=>String(b.dueDate||'').localeCompare(String(a.dueDate||'')));
  return {customer:{id:customer.id,name:customer.name||'Aluno',cpfCnpj:customer.cpfCnpj||cpf,complement:customer.complement||customer.addressComplement||''},summary:summarizeManual(rows),rows};
}

export async function onRequestGet({request,env}){
  try{
    const cpf=new URL(request.url).searchParams.get('cpf')||'';
    return json({ok:true,...await queryManualStudent(env,cpf)});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
