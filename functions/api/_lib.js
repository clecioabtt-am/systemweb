export const json = (data, status=200) => new Response(JSON.stringify(data,null,2), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function body(req){ try { return await req.json(); } catch { return {}; } }
export function uid(prefix='id'){ return `${prefix}_${crypto.randomUUID().replaceAll('-','')}`; }
export async function sha256(text){ const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function safeRun(env, sql){ try{ await env.CEEB_DB.prepare(sql).run(); }catch(e){} }
export async function ensureSchema(env){
  const stmts = [
`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('support','coordinator')), name TEXT NOT NULL, email TEXT, access_key_hash TEXT NOT NULL, polo_id TEXT, active INTEGER NOT NULL DEFAULT 1, expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS polos (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, city TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, polo_id TEXT, name TEXT NOT NULL, cpf TEXT, phone TEXT, email TEXT, course TEXT, class_name TEXT, complement TEXT, status TEXT DEFAULT 'ativo', asaas_customer_id TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, student_id TEXT, polo_id TEXT, asaas_id TEXT, description TEXT, value REAL NOT NULL DEFAULT 0, due_date TEXT, status TEXT DEFAULT 'PENDING', invoice_url TEXT, bank_slip_url TEXT, pix_qr_code TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS payment_links (id TEXT PRIMARY KEY, polo_id TEXT, student_id TEXT, title TEXT, url TEXT NOT NULL, value REAL DEFAULT 0, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS accountability (id TEXT PRIMARY KEY, polo_id TEXT, month_ref TEXT, total_charged REAL DEFAULT 0, total_paid REAL DEFAULT 0, total_pending REAL DEFAULT 0, notes TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY, actor_id TEXT, actor_name TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT, meta TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  ];
  for(const s of stmts) await env.CEEB_DB.prepare(s).run();
  await safeRun(env, `ALTER TABLE students ADD COLUMN complement TEXT`);
  await safeRun(env, `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  await safeRun(env, `CREATE INDEX IF NOT EXISTS idx_students_polo ON students(polo_id)`);
  await safeRun(env, `CREATE INDEX IF NOT EXISTS idx_students_cpf ON students(cpf)`);
  await safeRun(env, `CREATE INDEX IF NOT EXISTS idx_students_complement ON students(complement)`);
  await safeRun(env, `CREATE INDEX IF NOT EXISTS idx_invoices_polo ON invoices(polo_id)`);
  await safeRun(env, `CREATE INDEX IF NOT EXISTS idx_logs_actor ON activity_logs(actor_id)`);
}
export async function log(env, user, action, entity='', entity_id='', meta={}){ try{ await env.CEEB_DB.prepare('INSERT INTO activity_logs (id,actor_id,actor_name,action,entity,entity_id,meta) VALUES (?,?,?,?,?,?,?)').bind(uid('log'), user?.id||'', user?.name||'', action, entity, entity_id, JSON.stringify(meta)).run(); }catch(e){} }
export async function makeSession(env,user){ const token=crypto.randomUUID()+crypto.randomUUID(); await env.CEEB_KV.put('sess:'+token, JSON.stringify({id:user.id,role:user.role,name:user.name,polo_id:user.polo_id||null}), {expirationTtl: 60*60*12}); return token; }
export async function requireUser(req, env){
  const auth=req.headers.get('authorization')||'';
  const token=auth.replace(/^Bearer\s+/i,'');
  if(!token) return null;

  // Compatibilidade com as duas versões do projeto:
  // nova: sess:<token> | versão antiga do painel: session:<token>
  let data = await env.CEEB_KV.get('sess:'+token,'json').catch(()=>null);
  if(!data) data = await env.CEEB_KV.get('session:'+token,'json').catch(()=>null);
  if(!data) return null;

  if(data.id){
    const u=await env.CEEB_DB.prepare('SELECT * FROM users WHERE id=?').bind(data.id).first().catch(()=>null);
    if(u){
      if(!u.active) return null;
      if(u.expires_at && new Date(u.expires_at)<new Date()) return null;
      return u;
    }
  }

  // Fallback para sessões criadas pelo painel legado baseado em KV.
  if(data.role==='support'){
    return {id:'support-master', role:'support', name:data.name||'Suporte CEEB', active:1, polo_id:null};
  }
  if(data.role==='coordinator'){
    return {id:data.id||'coordinator', role:'coordinator', name:data.name||'Coordenador', active:1, polo_id:data.polo_id||null, polo:data.polo||null, expires_at:data.expiresAt||null};
  }
  return null;
}
export async function requireRole(req, env, role){ const u=await requireUser(req,env); if(!u || (role && u.role!==role)) return {error:json({ok:false,error:'Acesso não autorizado'},401)}; return {user:u}; }
export function asaasBase(env){ return env.ASAAS_ENV==='production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3'; }
export async function asaas(env, path, opts={}){ if(!env.ASAAS_API_KEY) return {status:500, ok:false, data:{error:'ASAAS_API_KEY não configurada'}}; const r=await fetch(asaasBase(env)+path,{...opts,headers:{'accept':'application/json','content-type':'application/json','access_token':env.ASAAS_API_KEY,...(opts.headers||{})}}); const txt=await r.text(); let data; try{data=JSON.parse(txt)}catch{data={raw:txt}} return {status:r.status, ok:r.ok, data}; }
export function cleanCpf(v=''){ return String(v||'').replace(/\D/g,''); }
export async function getOrCreatePolo(env, name){
  const clean=String(name||'').trim(); if(!clean) return null;
  let p=await env.CEEB_DB.prepare('SELECT * FROM polos WHERE LOWER(name)=LOWER(?) LIMIT 1').bind(clean).first();
  if(p) return p.id;
  const id=uid('pol'); await env.CEEB_DB.prepare('INSERT INTO polos (id,name) VALUES (?,?)').bind(id,clean).run(); return id;
}
