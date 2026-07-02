import {json, body, uid, requireUser, asaas, log, cleanCpf, getOrCreatePolo} from '../_lib.js';

function customerPayload(b){
  const payload={ name:String(b.name||'').trim(), cpfCnpj:cleanCpf(b.cpf||b.cpfCnpj||''), complement:String(b.complement||b.polo||'').trim() };
  if(b.email) payload.email=String(b.email).trim();
  if(b.phone) { payload.phone=String(b.phone).trim(); payload.mobilePhone=String(b.phone).trim(); }
  if(b.address) payload.address=String(b.address).trim();
  if(b.addressNumber) payload.addressNumber=String(b.addressNumber).trim();
  if(b.province) payload.province=String(b.province).trim();
  if(b.postalCode) payload.postalCode=String(b.postalCode).replace(/\D/g,'');
  if(b.externalReference) payload.externalReference=String(b.externalReference).trim();
  return payload;
}
async function listAllCustomersByComplement(env, complement){
  const target=String(complement||'').trim().toLowerCase();
  if(!target) return [];
  const cacheKey='asaas:customers:complement:'+target;
  const cached=await env.CEEB_KV.get(cacheKey,'json').catch(()=>null);
  if(cached) return cached;
  let offset=0, limit=100, out=[];
  for(let page=0; page<20; page++){
    const r=await asaas(env, `/customers?limit=${limit}&offset=${offset}`);
    if(!r.ok) throw new Error(JSON.stringify(r.data));
    const data=Array.isArray(r.data?.data)?r.data.data:[];
    out.push(...data.filter(c=>String(c.complement||'').trim().toLowerCase()===target));
    if(!r.data?.hasMore || data.length===0) break;
    offset+=limit;
  }
  await env.CEEB_KV.put(cacheKey, JSON.stringify(out), {expirationTtl:180}).catch(()=>{});
  return out;
}

export async function onRequestGet({request, env}){
  const u=await requireUser(request,env); if(!u)return json({ok:false,error:'Acesso não autorizado'},401);
  const url=new URL(request.url); const complement=url.searchParams.get('complement')||url.searchParams.get('polo')||''; const q=url.searchParams.get('q')||'';
  try{
    if(complement){ const data=await listAllCustomersByComplement(env, complement); return json({ok:true,data}); }
    const r=await asaas(env, `/customers?name=${encodeURIComponent(q)}&limit=100`); return json({ok:r.ok,data:r.data,status:r.status}, r.ok?200:502);
  }catch(e){ return json({ok:false,error:'Falha ao consultar clientes no Asaas',detail:String(e.message||e)},502); }
}

export async function onRequestPost({request, env}){
  const u=await requireUser(request,env); if(!u)return json({ok:false,error:'Acesso não autorizado'},401);
  const b=await body(request); if(!b.name)return json({ok:false,error:'Nome obrigatório'},400); if(!b.cpf&&!b.cpfCnpj)return json({ok:false,error:'CPF/CNPJ obrigatório'},400);
  const payload=customerPayload(b);
  const r=await asaas(env,'/customers',{method:'POST',body:JSON.stringify(payload)});
  if(!r.ok){ await log(env,u,'Falha cadastro cliente Asaas','asaas','customer',{payload,detail:r.data}); return json({ok:false,error:'Falha ao cadastrar cliente no Asaas',detail:r.data,status:r.status},502); }
  const poloId=await getOrCreatePolo(env, payload.complement || b.polo || 'Sem polo');
  const id=uid('stu');
  await env.CEEB_DB.prepare('INSERT INTO students (id,polo_id,name,cpf,phone,email,complement,status,asaas_customer_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id,poloId,payload.name,payload.cpfCnpj||'',b.phone||'',b.email||'',payload.complement||'', 'ativo', r.data.id||'', u.id).run();
  await log(env,u,'Cadastrou cliente no Asaas','asaas_customer',r.data.id||id,{name:payload.name,cpf:payload.cpfCnpj,complement:payload.complement});
  return json({ok:true,id,asaasCustomer:r.data});
}

export async function onRequestPatch({request, env}){
  const u=await requireUser(request,env); if(!u)return json({ok:false,error:'Acesso não autorizado'},401);
  const b=await body(request); const customers=Array.isArray(b.customers)?b.customers:[]; const complement=String(b.complement||'').trim();
  if(!customers.length)return json({ok:false,error:'Nenhum cliente informado'},400); if(!complement)return json({ok:false,error:'Novo complemento obrigatório'},400);
  let updated=0, failed=0, errors=[];
  for(const c of customers){
    const id=c.id||c.asaasId||c.asaas_customer_id; if(!id){failed++; continue;}
    const r=await asaas(env, `/customers/${id}`, {method:'POST', body:JSON.stringify({complement})});
    if(r.ok){ updated++; await env.CEEB_DB.prepare('UPDATE students SET complement=?, updated_at=CURRENT_TIMESTAMP WHERE asaas_customer_id=?').bind(complement,id).run().catch(()=>{}); }
    else { failed++; errors.push({id,detail:r.data}); }
  }
  await env.CEEB_KV.delete('asaas:customers:complement:'+String(b.oldComplement||'').trim().toLowerCase()).catch(()=>{});
  await env.CEEB_KV.delete('asaas:customers:complement:'+complement.toLowerCase()).catch(()=>{});
  await log(env,u,'Atualizou complemento em lote no Asaas','asaas_customer','bulk',{updated,failed,complement});
  return json({ok:failed===0,updated,failed,errors});
}
