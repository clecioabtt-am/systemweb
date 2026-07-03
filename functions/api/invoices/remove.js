import { asaasFetch, json, log } from '../asaas/_utils.js';
export async function onRequestPost({request,env,data}){
  try{
    const body=await request.json().catch(()=>({})); const id=String(body.id||'').trim();
    if(!id)return json({ok:false,error:'Informe a fatura.'},400);
    await asaasFetch(env,`/payments/${encodeURIComponent(id)}`,{method:'DELETE'});
    await log(env,data.user,'asaas.invoice.delete',id,{},request);
    return json({ok:true,message:'Fatura removida com sucesso.'});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
