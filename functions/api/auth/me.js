import {json, requireUser} from '../_lib.js';
export async function onRequestGet({request, env}){ const u=await requireUser(request,env); if(!u)return json({ok:false},401); return json({ok:true,user:{id:u.id,role:u.role,name:u.name,email:u.email,polo_id:u.polo_id}}); }
