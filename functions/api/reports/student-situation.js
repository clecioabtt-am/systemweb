import { json, onlyDigits } from '../asaas/_utils.js';
import { fetchInvoiceRows } from '../invoices/query.js';
import { makeXlsx, makePdf } from './invoices.js';

export async function onRequestPost({request,env}){
  try{
    const body=await request.json(),people=Array.isArray(body.people)?body.people:[],format=String(body.format||'xlsx').toLowerCase();
    if(!people.length)return json({ok:false,error:'Informe pelo menos um aluno.'},400);
    if(people.length>100)return json({ok:false,error:'Exporte no máximo 100 alunos por vez.'},400);
    const all=[];
    for(const person of people){
      const name=String(person.name||'').trim(),cpf=onlyDigits(person.cpf||'');
      if(!name&&!cpf)continue;
      const rows=await fetchInvoiceRows(env,{mode:'cliente',name,cpf,onlyPaid:true,concurrency:4});
      rows.sort((a,b)=>String(a.paymentDate||a.dueDate||'').localeCompare(String(b.paymentDate||b.dueDate||'')));
      rows.forEach((row,i)=>all.push({...row,description:`${i+1}ª mensalidade paga — ${row.description||'Sem descrição'}`}));
    }
    all.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'})||String(a.paymentDate||'').localeCompare(String(b.paymentDate||'')));
    const title='Situação financeira dos alunos — mensalidades pagas';
    const data=format==='pdf'?makePdf(all,title):makeXlsx(all,title),ext=format==='pdf'?'pdf':'xlsx';
    const type=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return new Response(data,{headers:{'content-type':type,'content-disposition':`attachment; filename="situacao_alunos_ceeb.${ext}"`}});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
