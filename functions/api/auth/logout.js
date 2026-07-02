export async function onRequestPost({ request, env }) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/ceeb_session=([^;]+)/);
  if (match && env.CEEB_KV) await env.CEEB_KV.delete(`session:${match[1]}`);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'Set-Cookie': 'ceeb_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure' } });
}
