import { json, onlyDigits } from '../asaas/_utils.js';
import { queryManualStudent } from '../invoices/manual.js';
import { makePdf } from './invoices.js';

export async function onRequestGet({request,env}){
  try{
    const cpf=onlyDigits(new URL(request.url).searchParams.get('cpf')||'');
    const result=await queryManualStudent(env,cpf);
    const s=result.summary;
    const rows=result.rows.map(row=>({...row,reportValue:row.value}));
    const title=`Relatorio financeiro - ${result.customer.name}`;
    const summaryText=`Pagas: ${s.paidCount}  |  Vencidas: ${s.overdueCount}  |  Aguardando: ${s.pendingCount}  |  Total: ${s.totalCount}`;
    const pdf=makePdf(rows,title,{summaryText});
    return new Response(pdf,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="consulta_manual_${cpf}.pdf"`}});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
