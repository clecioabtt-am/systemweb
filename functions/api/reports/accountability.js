import {json, body, uid, requireUser, log} from '../_lib.js';
export async function onRequestGet({request, env}){
 const u=await requireUser(request,env); if(!u)return json({ok:false},401); const url=new URL(request.url); const polo=url.searchParams.get('polo_id')||(u.role==='coordinator'?u.polo_id:'');
 const vals=[]; let where=''; if(polo){where=' WHERE i.polo_id=?'; vals.push(polo)}
 const rows=await env.CEEB_DB.prepare(`SELECT p.name polo, COUNT(i.id) qtd, COALESCE(SUM(i.value),0) total, COALESCE(SUM(CASE WHEN i.status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') THEN i.value ELSE 0 END),0) pago, COALESCE(SUM(CASE WHEN i.status NOT IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') THEN i.value ELSE 0 END),0) pendente FROM invoices i LEFT JOIN polos p ON p.id=i.polo_id ${where} GROUP BY i.polo_id,p.name`).bind(...vals).all();
 return json({ok:true,data:rows.results});
}
export async function onRequestPost({request, env}){ const u=await requireUser(request,env); if(!u)return json({ok:false},401); const b=await body(request); const id=uid('acc'); await env.CEEB_DB.prepare('INSERT INTO accountability (id,polo_id,month_ref,total_charged,total_paid,total_pending,notes,created_by) VALUES (?,?,?,?,?,?,?,?)').bind(id,b.polo_id||(u.role==='coordinator'?u.polo_id:null),b.month_ref||'',Number(b.total_charged||0),Number(b.total_paid||0),Number(b.total_pending||0),b.notes||'',u.id).run(); await log(env,u,'Registrou prestação de contas','accountability',id,b); return json({ok:true,id}); }
