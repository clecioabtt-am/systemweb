export async function onRequest(context) {
  const url = new URL(context.request.url);
  const publicPaths = ['/api/auth/login', '/api/auth/logout', '/api/system/health'];
  const isApi = url.pathname.startsWith('/api/');
  if (!isApi || publicPaths.includes(url.pathname)) return context.next();
  const session = await getSession(context);
  if (!session) return json({ ok: false, error: 'Sessão inválida ou expirada.' }, 401);
  context.data.user = session;
  return context.next();
}

async function getSession(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/ceeb_session=([^;]+)/);
  if (!match || !context.env.CEEB_KV) return null;
  const raw = await context.env.CEEB_KV.get(`session:${match[1]}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
