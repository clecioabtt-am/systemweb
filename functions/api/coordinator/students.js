import {json, body, uid, requireUser, log, getOrCreatePolo} from '../_lib.js';
export async function onRequestGet({request, env}){
 const u=await requireUser(request,env); if(!u)return json({ok:false},401); const q=new URL(request.url).searchParams.get('q')||''; let sql='SELECT s.*,p.name polo FROM students s LEFT JOIN polos p ON p.id=s.polo_id'; const vals=[];
 if(u.role==='coordinator'){ sql+=' WHERE s.polo_id=?'; vals.push(u.polo_id); if(q){sql+=' AND (s.name LIKE ? OR s.cpf LIKE ?)'; vals.push(`%${q}%`,`%${q}%`);} }
 else if(q){ sql+=' WHERE (s.name LIKE ? OR s.cpf LIKE ?)'; vals.push(`%${q}%`,`%${q}%`); }
 sql+=' ORDER BY s.created_at DESC LIMIT 300'; const rows=await env.CEEB_DB.prepare(sql).bind(...vals).all(); return json({ok:true,data:rows.results});
}
export async function onRequestPost({request, env}){
 const u=await requireUser(request,env); if(!u)return json({ok:false},401); const b=await body(request); if(!b.name)return json({ok:false,error:'Nome obrigatório'},400);
 let poloId=u.role==='coordinator'?u.polo_id:b.polo_id; if(!poloId && b.complement) poloId=await getOrCreatePolo(env,b.complement); if(!poloId)return json({ok:false,error:'Polo/complemento obrigatório'},400);
 const id=uid('stu'); await env.CEEB_DB.prepare('INSERT INTO students (id,polo_id,name,cpf,phone,email,course,class_name,complement,status,asaas_customer_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,poloId,b.name,b.cpf||'',b.phone||'',b.email||'',b.course||'',b.class_name||'',b.complement||'',b.status||'ativo',b.asaas_customer_id||'',u.id).run();
 await log(env,u,'Cadastrou aluno','student',id,b); return json({ok:true,id});
}
export async function onRequestPatch({request, env}){
 const u=await requireUser(request,env); if(!u)return json({ok:false},401); const b=await body(request); if(!b.id)return json({ok:false,error:'ID obrigatório'},400);
 const st=await env.CEEB_DB.prepare('SELECT * FROM students WHERE id=?').bind(b.id).first(); if(!st)return json({ok:false,error:'Aluno não encontrado'},404); if(u.role==='coordinator'&&st.polo_id!==u.polo_id)return json({ok:false,error:'Sem permissão'},403);
 const fields=['name','cpf','phone','email','course','class_name','complement','status','asaas_customer_id']; const ups=[]; const vals=[]; for(const f of fields) if(f in b){ups.push(`${f}=?`); vals.push(b[f]||'');} if(u.role==='support'&&b.polo_id){ups.push('polo_id=?');vals.push(b.polo_id)} ups.push('updated_at=CURRENT_TIMESTAMP'); vals.push(b.id);
 await env.CEEB_DB.prepare(`UPDATE students SET ${ups.join(',')} WHERE id=?`).bind(...vals).run(); await log(env,u,'Atualizou aluno','student',b.id,b); return json({ok:true});
}
export async function onRequestDelete({request, env}){ const u=await requireUser(request,env); if(!u)return json({ok:false},401); const id=new URL(request.url).searchParams.get('id'); const st=await env.CEEB_DB.prepare('SELECT * FROM students WHERE id=?').bind(id).first(); if(!st)return json({ok:false},404); if(u.role==='coordinator'&&st.polo_id!==u.polo_id)return json({ok:false},403); await env.CEEB_DB.prepare('DELETE FROM students WHERE id=?').bind(id).run(); await log(env,u,'Removeu aluno','student',id,{}); return json({ok:true}); }
