import {json} from '../_lib.js';
export async function onRequestPost({request, env}){ const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,''); if(token) await env.CEEB_KV.delete('sess:'+token); return json({ok:true}); }
