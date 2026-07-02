import {json, requireRole} from '../_lib.js';
export async function onRequestGet({request, env}){ const {error}=await requireRole(request,env,'support'); if(error)return error; const rows=await env.CEEB_DB.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200').all(); return json({ok:true,data:rows.results}); }
