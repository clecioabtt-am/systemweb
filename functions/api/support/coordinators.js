import {json, body, uid, sha256, requireRole, log} from '../_lib.js';

function coordinatorStatus(row){
  if(!row.active) return 'bloqueado';
  if(!row.expires_at) return 'ativo';
  const today=new Date();
  today.setHours(0,0,0,0);
  const expires=new Date(String(row.expires_at).slice(0,10)+'T00:00:00');
  if(Number.isNaN(expires.getTime())) return 'ativo';
  if(expires<today) return 'expirado';
  const days=Math.ceil((expires-today)/(1000*60*60*24));
  return days<=7?'vence_em_breve':'ativo';
}

function brDate(value){
  if(!value) return null;
  const p=String(value).slice(0,10).split('-');
  return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:value;
}

export async function onRequestGet({request, env}){
  const {user,error}=await requireRole(request,env,'support'); if(error)return error;
  const rows=await env.CEEB_DB.prepare("SELECT u.id,u.name,u.email,u.active,u.expires_at,u.created_at,p.name polo FROM users u LEFT JOIN polos p ON p.id=u.polo_id WHERE u.role='coordinator' ORDER BY u.created_at DESC").all();
  const data=(rows.results||[]).map(r=>({...r,active:Boolean(r.active),status:coordinatorStatus(r),expires_at_br:brDate(r.expires_at)}));
  const summary={
    total:data.length,
    ativos:data.filter(x=>x.status==='ativo'||x.status==='vence_em_breve').length,
    bloqueados:data.filter(x=>x.status==='bloqueado').length,
    expirados:data.filter(x=>x.status==='expirado').length
  };
  return json({ok:true,data,summary});
}

export async function onRequestPost({request, env}){
  const {user,error}=await requireRole(request,env,'support'); if(error)return error;
  const b=await body(request);
  if(!b.name||!b.accessKey) return json({ok:false,error:'Nome e chave são obrigatórios.'},400);
  const expiresAt=b.expires_at??b.expiresAt??null;
  let poloId=b.polo_id||null;
  if(!poloId && b.poloName){
    const existing=await env.CEEB_DB.prepare('SELECT id FROM polos WHERE LOWER(name)=LOWER(?) LIMIT 1').bind(String(b.poloName).trim()).first();
    if(existing?.id) poloId=existing.id;
    else {
      poloId=uid('polo');
      await env.CEEB_DB.prepare('INSERT INTO polos (id,name,city) VALUES (?,?,?)').bind(poloId,String(b.poloName).trim(),b.city||'').run();
    }
  }
  const id=uid('usr');
  const hash=await sha256(String(b.accessKey));
  await env.CEEB_DB.prepare("INSERT INTO users (id,role,name,email,access_key_hash,polo_id,active,expires_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id,'coordinator',String(b.name).trim(),b.email||'',hash,poloId,b.active===false?0:1,expiresAt||null).run();
  await log(env,user,'Criou coordenador','user',id,{name:b.name,poloId,expires_at:expiresAt||null});
  return json({ok:true,id});
}

export async function onRequestPatch({request, env}){
  const {user,error}=await requireRole(request,env,'support'); if(error)return error;
  const b=await body(request);
  if(!b.id) return json({ok:false,error:'ID obrigatório'},400);

  const current=await env.CEEB_DB.prepare("SELECT id,name FROM users WHERE id=? AND role='coordinator'").bind(b.id).first();
  if(!current) return json({ok:false,error:'Coordenador não encontrado.'},404);

  const updates=[]; const vals=[];
  if('name' in b){updates.push('name=?');vals.push(String(b.name||'').trim())}
  if('email' in b){updates.push('email=?');vals.push(b.email||null)}
  if('expires_at' in b || 'expiresAt' in b){updates.push('expires_at=?');vals.push((b.expires_at??b.expiresAt)||null)}
  if('polo_id' in b){updates.push('polo_id=?');vals.push(b.polo_id||null)}
  if('active' in b){updates.push('active=?');vals.push(b.active?1:0)}
  if(b.accessKey){updates.push('access_key_hash=?');vals.push(await sha256(String(b.accessKey)))}
  if(!updates.length) return json({ok:false,error:'Nenhuma alteração informada.'},400);

  updates.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(b.id);
  await env.CEEB_DB.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=? AND role='coordinator'`).bind(...vals).run();
  await log(env,user,'Atualizou coordenador','user',b.id,{...b,accessKey:b.accessKey?'[alterada]':undefined});
  return json({ok:true});
}

export async function onRequestDelete({request, env}){
  const {user,error}=await requireRole(request,env,'support'); if(error)return error;
  const id=new URL(request.url).searchParams.get('id');
  if(!id)return json({ok:false,error:'ID obrigatório'},400);
  const current=await env.CEEB_DB.prepare("SELECT id,name FROM users WHERE id=? AND role='coordinator'").bind(id).first();
  if(!current) return json({ok:false,error:'Coordenador não encontrado.'},404);
  await env.CEEB_DB.prepare("DELETE FROM users WHERE id=? AND role='coordinator'").bind(id).run();
  await log(env,user,'Removeu coordenador','user',id,{name:current.name});
  return json({ok:true});
}
