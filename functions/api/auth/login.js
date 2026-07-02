import {json, body, ensureSchema, sha256, makeSession, log} from '../_lib.js';
export async function onRequestPost({request, env}){
  await ensureSchema(env);
  const b=await body(request); const role=b.role||'support'; const key=String(b.accessKey||'');
  if(!key) return json({ok:false,error:'Informe a chave de acesso.'},400);
  let user=null; const hash=await sha256(key);
  if(role==='support'){
    user=await env.CEEB_DB.prepare("SELECT * FROM users WHERE role='support' LIMIT 1").first();
    if(!user){ const master=env.SUPPORT_MASTER_KEY||'ceeb-suporte-2026'; if(key===master){ await fetch(new URL('/api/system/init', request.url), {method:'POST'}); user=await env.CEEB_DB.prepare("SELECT * FROM users WHERE role='support' LIMIT 1").first(); } }
  } else {
    user=await env.CEEB_DB.prepare("SELECT * FROM users WHERE role='coordinator' AND access_key_hash=? LIMIT 1").bind(hash).first();
  }
  if(role==='support' && user && user.access_key_hash!==hash) return json({ok:false,error:'Chave de suporte inválida.'},401);
  if(!user) return json({ok:false,error:'Acesso não encontrado.'},401);
  if(!user.active) return json({ok:false,error:'Acesso bloqueado pelo suporte.'},403);
  if(user.expires_at && new Date(user.expires_at)<new Date()) return json({ok:false,error:'Chave expirada.'},403);
  const token=await makeSession(env,user); await log(env,user,'Login realizado','auth',user.id,{role:user.role});
  return json({ok:true, token, user:{id:user.id,role:user.role,name:user.name,email:user.email,polo_id:user.polo_id}});
}
