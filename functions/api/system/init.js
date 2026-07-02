import {json, ensureSchema, sha256, uid, log} from '../_lib.js';
export async function onRequestPost({request, env}){
  await ensureSchema(env);
  const key = env.SUPPORT_MASTER_KEY || 'ceeb-suporte-2026';
  const hash = await sha256(key);
  const existing = await env.CEEB_DB.prepare("SELECT id FROM users WHERE role='support' LIMIT 1").first();
  if(!existing){
    const u={id:uid('usr'), name:'Suporte CEEB'};
    await env.CEEB_DB.prepare('INSERT INTO users (id,role,name,email,access_key_hash,active) VALUES (?,?,?,?,?,1)').bind(u.id,'support',u.name,'suporte@ceeb.local',hash).run();
    await env.CEEB_DB.prepare('INSERT OR IGNORE INTO polos (id,name,city) VALUES (?,?,?)').bind(uid('polo'),'Polo Principal','').run();
    await log(env,u,'Sistema inicializado','system','init',{});
  }
  return json({ok:true,message:'Banco verificado/inicializado. Use SUPPORT_MASTER_KEY para login do suporte.'});
}
export async function onRequestGet(ctx){return onRequestPost(ctx)}
