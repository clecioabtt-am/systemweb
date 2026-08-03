import { json as baseJson, sha256, requireRole, uid } from '../_lib.js';

const json = (data, status=200) => baseJson(data, status);

function isSupportData(data){ return data?.user?.role === 'support'; }
async function auth(request, env, data){
  if (isSupportData(data)) return { user: data.user };
  return requireRole(request, env, 'support');
}
function brDate(v=''){
  if(!v) return '';
  const [y,m,d]=String(v).slice(0,10).split('-');
  return y&&m&&d ? `${d}/${m}/${y}` : String(v);
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function statusOf(row){
  if(!Number(row.active)) return 'bloqueado';
  const exp = row.expires_at ? String(row.expires_at).slice(0,10) : '';
  if(exp && exp < todayISO()) return 'expirado';
  const soon=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  if(exp && exp <= soon) return 'vence_em_breve';
  return 'ativo';
}
async function columns(env){
  const r=await env.CEEB_DB.prepare('PRAGMA table_info(users)').all();
  return r.results||[];
}
function colSet(info){ return new Set(info.map(c=>c.name)); }
async function ensureUsers(env){
  if(!env.CEEB_DB) throw Object.assign(new Error('Binding CEEB_DB não encontrado.'),{status:500});
  await env.CEEB_DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    access_key TEXT,
    access_key_hash TEXT,
    polo_id TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const set=colSet(await columns(env));
  const adds=[
    ['email','TEXT'],['access_key','TEXT'],['access_key_hash','TEXT'],['polo_id','TEXT'],
    ['active','INTEGER NOT NULL DEFAULT 1'],['expires_at','TEXT'],['created_at','TEXT'],['updated_at','TEXT']
  ];
  for(const [name,type] of adds){
    if(!set.has(name)) await env.CEEB_DB.prepare(`ALTER TABLE users ADD COLUMN ${name} ${type}`).run().catch(()=>null);
  }
}
async function newId(env, info){
  const idCol=info.find(c=>c.name==='id');
  const type=String(idCol?.type||'').toUpperCase();
  if(type.includes('INT')){
    const r=await env.CEEB_DB.prepare("SELECT COALESCE(MAX(CAST(id AS INTEGER)),0)+1 AS next_id FROM users WHERE CAST(id AS TEXT) GLOB '[0-9]*'").first();
    return Number(r?.next_id||Date.now());
  }
  return uid('usr');
}

// Alguns coordenadores criados por versões antigas ficaram com id NULL/vazio.
// Eles aparecem na lista, mas não podem ser editados/removidos. Corrigimos isso
// automaticamente usando rowid, sem alterar nome, chave, validade ou status.
async function repairLegacyCoordinatorIds(env){
  const info=await columns(env);
  const set=colSet(info);
  if(!set.has('id')) return 0;
  let broken=[];
  try{
    const r=await env.CEEB_DB.prepare(`SELECT rowid AS _rowid, id
      FROM users
      WHERE role='coordinator'
        AND (id IS NULL OR TRIM(CAST(id AS TEXT))='' OR LOWER(TRIM(CAST(id AS TEXT)))='null')`).all();
    broken=r.results||[];
  }catch(_){ return 0; }
  let fixed=0;
  for(const row of broken){
    const id=await newId(env, info);
    const r=await env.CEEB_DB.prepare(`UPDATE users SET id=?${set.has('updated_at')?', updated_at=CURRENT_TIMESTAMP':''}
      WHERE rowid=? AND (id IS NULL OR TRIM(CAST(id AS TEXT))='' OR LOWER(TRIM(CAST(id AS TEXT)))='null')`)
      .bind(id,row._rowid).run();
    fixed += Number(r.meta?.changes||0);
  }
  return fixed;
}
async function findCoordinator(env,id){
  return env.CEEB_DB.prepare("SELECT rowid AS _rowid, * FROM users WHERE CAST(id AS TEXT)=? AND role='coordinator' LIMIT 1").bind(String(id)).first();
}
async function findByRowToken(env,token){
  if(!String(token||'').startsWith('row_')) return null;
  const rowid=Number(String(token).slice(4));
  if(!Number.isFinite(rowid)||rowid<=0) return null;
  return env.CEEB_DB.prepare("SELECT rowid AS _rowid, * FROM users WHERE rowid=? AND role='coordinator' LIMIT 1").bind(rowid).first();
}
async function resolveCoordinator(env,id){
  return (await findCoordinator(env,id)) || (await findByRowToken(env,id));
}
async function logCompat(env,user,action,id,request,meta={}){
  const ip=request.headers.get('CF-Connecting-IP')||'';
  const attempts=[
    ['INSERT INTO activity_logs (id,actor_id,actor_name,action,entity,entity_id,meta) VALUES (?,?,?,?,?,?,?)', [uid('log'),user?.id||'',user?.name||'Suporte',action,'user',String(id),JSON.stringify(meta)]],
    ['INSERT INTO activity_logs (actor_id,actor_name,action,target,metadata,ip) VALUES (?,?,?,?,?,?)', [user?.id||null,user?.name||'Suporte',action,`users:${id}`,JSON.stringify(meta),ip]]
  ];
  for(const [sql,args] of attempts){ try{ await env.CEEB_DB.prepare(sql).bind(...args).run(); return; }catch(_){} }
}

export async function listCoordinators({request,env,data}){
  try{
    const {user,error}=await auth(request,env,data); if(error)return error;
    await ensureUsers(env);
    const repaired=await repairLegacyCoordinatorIds(env);
    const info=await columns(env), set=colSet(info);
    const fields=['rowid AS _rowid','id','name'];
    for(const c of ['email','access_key','active','expires_at','created_at','updated_at']) if(set.has(c)) fields.push(c);
    const r=await env.CEEB_DB.prepare(`SELECT ${fields.join(',')} FROM users WHERE role='coordinator' ORDER BY name COLLATE NOCASE ASC, rowid ASC`).all();
    const rows=(r.results||[]).map(row=>{
      // Fallback row_X evita que até um registro extremamente antigo fique sem ações.
      const publicId=(row.id===null||row.id===undefined||String(row.id).trim()==='') ? `row_${row._rowid}` : String(row.id);
      return {...row,id:publicId,access_key:String(row.access_key||''),active:Number(row.active??1),expires_at_br:brDate(row.expires_at),status:statusOf(row)};
    });
    return json({ok:true,data:rows,summary:{
      total:rows.length,
      ativos:rows.filter(x=>x.status==='ativo'||x.status==='vence_em_breve').length,
      bloqueados:rows.filter(x=>x.status==='bloqueado').length,
      expirados:rows.filter(x=>x.status==='expirado').length,
      vencendo:rows.filter(x=>x.status==='vence_em_breve').length
    }, repairedLegacyIds:repaired});
  }catch(err){ return json({ok:false,error:err.message},err.status||500); }
}

export async function createCoordinator({request,env,data}){
  try{
    const {user,error}=await auth(request,env,data); if(error)return error;
    await ensureUsers(env); await repairLegacyCoordinatorIds(env);
    const info=await columns(env), set=colSet(info);
    const b=await request.json().catch(()=>({}));
    const name=String(b.name||'').trim(), key=String(b.accessKey||'').trim();
    const expires=String(b.expires_at??b.expiresAt??'').trim()||null;
    if(!name)return json({ok:false,error:'Informe o nome do coordenador.'},400);
    if(!key)return json({ok:false,error:'Informe a senha/chave de acesso do coordenador.'},400);
    const h=await sha256(key);
    let ex=null;
    if(set.has('access_key_hash')) ex=await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key_hash=? LIMIT 1').bind(h).first();
    if(!ex&&set.has('access_key')) ex=await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key=? LIMIT 1').bind(key).first();
    if(ex)return json({ok:false,error:'Essa senha/chave já está em uso por outro usuário.'},409);
    const id=await newId(env,info);
    const cols=['id','name','role'], vals=[id,name,'coordinator'], marks=['?','?','?'];
    const add=(c,v)=>{if(set.has(c)){cols.push(c);vals.push(v);marks.push('?')}};
    add('access_key',key); add('access_key_hash',h); add('active',b.active===false?0:1); add('expires_at',expires);
    if(set.has('email')) add('email',b.email||'');
    const q=`INSERT INTO users (${cols.join(',')}) VALUES (${marks.join(',')})`;
    await env.CEEB_DB.prepare(q).bind(...vals).run();
    await logCompat(env,user,'Criou coordenador',id,request,{name,expires_at:expires});
    return json({ok:true,id:String(id)});
  }catch(err){ return json({ok:false,error:err.message},err.status||500); }
}

export async function updateCoordinator({request,env,data,routeId=null}){
  try{
    const {user,error}=await auth(request,env,data); if(error)return error;
    await ensureUsers(env); await repairLegacyCoordinatorIds(env);
    const info=await columns(env), set=colSet(info);
    const b=await request.json().catch(()=>({}));
    const id=String(routeId ?? b.id ?? '').trim();
    if(!id)return json({ok:false,error:'ID do coordenador não informado.'},400);
    const current=await resolveCoordinator(env,id);
    if(!current)return json({ok:false,error:'Coordenador não encontrado. Atualize a página e tente novamente.'},404);
    const realId=current.id;
    const fields=[], vals=[];
    if(b.name!==undefined){const v=String(b.name||'').trim();if(!v)return json({ok:false,error:'Informe o nome do coordenador.'},400);fields.push('name=?');vals.push(v)}
    if(b.expires_at!==undefined||b.expiresAt!==undefined){fields.push('expires_at=?');vals.push(String(b.expires_at??b.expiresAt??'').trim()||null)}
    if(b.active!==undefined){fields.push('active=?');vals.push(b.active?1:0)}
    if(b.accessKey!==undefined&&String(b.accessKey||'').trim()!==''){
      const key=String(b.accessKey).trim(), h=await sha256(key);
      let ex=null;
      if(set.has('access_key_hash')) ex=await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key_hash=? AND rowid<>? LIMIT 1').bind(h,current._rowid).first();
      if(!ex&&set.has('access_key')) ex=await env.CEEB_DB.prepare('SELECT id FROM users WHERE access_key=? AND rowid<>? LIMIT 1').bind(key,current._rowid).first();
      if(ex)return json({ok:false,error:'Essa senha/chave já está em uso por outro usuário.'},409);
      if(set.has('access_key')){fields.push('access_key=?');vals.push(key)}
      if(set.has('access_key_hash')){fields.push('access_key_hash=?');vals.push(h)}
    }
    if(!fields.length)return json({ok:false,error:'Nenhuma alteração enviada.'},400);
    if(set.has('updated_at'))fields.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(current._rowid);
    const r=await env.CEEB_DB.prepare(`UPDATE users SET ${fields.join(',')} WHERE rowid=? AND role='coordinator'`).bind(...vals).run();
    if(Number(r.meta?.changes||0)<1)return json({ok:false,error:'Não foi possível atualizar o coordenador.'},409);
    await logCompat(env,user,'Atualizou coordenador',realId??id,request,{name:b.name,expires_at:b.expires_at??b.expiresAt,active:b.active,accessKey:b.accessKey?'[alterada]':undefined});
    return json({ok:true,id:String(realId??id)});
  }catch(err){ return json({ok:false,error:err.message},err.status||500); }
}

export async function deleteCoordinator({request,env,data,routeId=null}){
  try{
    const {user,error}=await auth(request,env,data); if(error)return error;
    await ensureUsers(env); await repairLegacyCoordinatorIds(env);
    const url=new URL(request.url);
    const id=String(routeId ?? url.searchParams.get('id') ?? '').trim();
    if(!id)return json({ok:false,error:'ID do coordenador não informado.'},400);
    const current=await resolveCoordinator(env,id);
    if(!current)return json({ok:false,error:'Coordenador não encontrado. Atualize a página e tente novamente.'},404);
    const r=await env.CEEB_DB.prepare("DELETE FROM users WHERE rowid=? AND role='coordinator'").bind(current._rowid).run();
    if(Number(r.meta?.changes||0)<1)return json({ok:false,error:'Não foi possível remover o coordenador.'},409);
    await logCompat(env,user,'Removeu coordenador',current.id??id,request,{name:current.name});
    return json({ok:true,deleted:Number(r.meta?.changes||0)});
  }catch(err){ return json({ok:false,error:err.message},err.status||500); }
}
