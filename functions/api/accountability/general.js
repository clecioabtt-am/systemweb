import { json } from '../asaas/_utils.js';
import { getGeneralAccountabilityRows } from './query.js';

function parsePolos(url){
  const values=url.searchParams.getAll('polo').flatMap(v=>String(v||'').split('|'));
  return [...new Set(values.map(v=>v.trim()).filter(Boolean))];
}

export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url);
    const polos=parsePolos(url);
    const startDate=url.searchParams.get('startDate')||'';
    const endDate=url.searchParams.get('endDate')||'';
    const refresh=url.searchParams.get('refresh')==='1';
    if(!polos.length)return json({ok:false,error:'Selecione pelo menos um Polo.'},400);
    if(!startDate||!endDate)return json({ok:false,error:'Informe data inicial e data final.'},400);
    if(startDate>endDate)return json({ok:false,error:'A data inicial não pode ser posterior à data final.'},400);
    const data=await getGeneralAccountabilityRows(env,{polos,startDate,endDate,refresh});
    return json({ok:true,...data});
  }catch(err){return json({ok:false,error:err.message,detail:err.payload||null},err.status||500)}
}
