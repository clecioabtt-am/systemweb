import {json, body, uid, sha256, requireRole, log} from '../_lib.js';
export async function onRequestGet({request, env}){
 const {user,error}=await requireRole(request,env,'support'); if(error)return error;
 const rows=await env.CEEB_DB.prepare("SELECT u.id,u.name,u.email,u.active,u.expires_at,u.created_at,p.name polo FROM users u LEFT JOIN polos p ON p.id=u.polo_id WHERE u.role='coordinator' ORDER BY u.created_at DESC").all();
 return json({ok:true,data:rows.results});
}
export async function onRequestPost({request, env}){
 const {user,error}=await requireRole(request,env,'support'); if(error)return error; const b=await body(request);
 if(!b.name||!b.accessKey) return json({ok:false,error:'Nome e chave são obrigatórios.'},400);
 let poloId=b.polo_id||null;
 if(!poloId && b.poloName){ poloId=uid('polo'); await env.CEEB_DB.prepare('INSERT OR IGNORE INTO polos (id,name,city) VALUES (?,?,?)').bind(poloId,b.poloName,b.city||'').run(); }
 const id=uid('usr'); const hash=await sha256(String(b.accessKey));
 await env.CEEB_DB.prepare("INSERT INTO users (id,role,name,email,access_key_hash,polo_id,active,expires_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,'coordinator',b.name,b.email||'',hash,poloId,1,b.expires_at||null).run();
 await log(env,user,'Criou coordenador','user',id,{name:b.name,poloId}); return json({ok:true,id});
}
export async function onRequestPatch({request, env}){
 const {user,error}=await requireRole(request,env,'support'); if(error)return error; const b=await body(request);
 if(!b.id) return json({ok:false,error:'ID obrigatório'},400);
 const updates=[]; const vals=[];
 for(const k of ['name','email','expires_at','polo_id']) if(k in b){updates.push(`${k}=?`); vals.push(b[k]||null)}
 if('active' in b){updates.push('active=?'); vals.push(b.active?1:0)}
 if(b.accessKey){updates.push('access_key_hash=?'); vals.push(await sha256(String(b.accessKey)))}
 updates.push('updated_at=CURRENT_TIMESTAMP'); vals.push(b.id);
 await env.CEEB_DB.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=? AND role='coordinator'`).bind(...vals).run();
 await log(env,user,'Atualizou coordenador','user',b.id,b); return json({ok:true});
}
export async function onRequestDelete({request, env}){
 const {user,error}=await requireRole(request,env,'support'); if(error)return error; const id=new URL(request.url).searchParams.get('id');
 if(!id)return json({ok:false,error:'ID obrigatório'},400); await env.CEEB_DB.prepare("DELETE FROM users WHERE id=? AND role='coordinator'").bind(id).run(); await log(env,user,'Removeu coordenador','user',id,{}); return json({ok:true});
}
