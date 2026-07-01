const DATE_FMT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");

  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  try {
    if (path === "login" && request.method === "POST") return cors(await login(request, env));
    if (path === "logout" && request.method === "POST") return cors(await logout(request, env));

    const auth = await requireAuth(request, env);
    if (!auth.ok) return cors(json({ error: auth.error }, 401));

    if (path === "me") return cors(json({ partner: auth.partner, exp: auth.exp, role: auth.role || "coordenador", accessId: auth.accessId || "legacy" }));
    if (path === "support/coordinators" && request.method === "GET") return cors(await supportListCoordinators(env, auth));
    if (path === "support/coordinators" && request.method === "POST") return cors(await supportCreateCoordinator(request, env, auth));
    if (path === "support/coordinators/toggle" && request.method === "POST") return cors(await supportToggleCoordinator(request, env, auth));
    if (path === "support/coordinators/delete" && request.method === "POST") return cors(await supportDeleteCoordinator(request, env, auth));
    if (path === "support/logs" && request.method === "GET") return cors(await supportLogs(env, auth));
    if (path === "dashboard") return cors(await dashboard(env));
    if (path === "links/clear" && request.method === "POST") return cors(await saveKV(env, "dashboard_links", []));
    if (path === "customers" && request.method === "GET") return cors(await customers(request, env));
    if (path === "customers" && request.method === "POST") return cors(await upsertCustomer(request, env, auth.partner));
    if (path === "customers/batch" && request.method === "POST") return cors(await batchCustomers(request, env, auth.partner));
    if (path === "payments" && request.method === "POST") return cors(await createPayment(request, env, auth.partner));
    if (path === "payments/batch" && request.method === "POST") return cors(await batchPayments(request, env, auth.partner));
    if (path === "payments/search" && request.method === "POST") return cors(await searchPayments(request, env));
    if (path === "payments/delete" && request.method === "POST") return cors(await deletePayment(request, env, auth.partner));
    if (path === "links/search" && request.method === "POST") return cors(await linksSearch(request, env));
    if (path === "prestacao" && request.method === "POST") return cors(await prestacao(request, env));

    return cors(json({ error: "Rota não encontrada." }, 404));
  } catch (err) {
    return cors(json({ error: err.message || String(err) }, 500));
  }
}

function cors(resp) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return new Response(resp.body, { status: resp.status, headers: h });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  return Object.fromEntries((await request.formData()).entries());
}

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

async function hmacHex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function nowManaus() { return new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" }); }
function isoNow() { return new Date().toISOString(); }
function parseExp(exp) {
  if (!exp) return null;
  if (DATE_FMT.test(exp)) return new Date(exp.replace(" ", "T") + "-04:00");
  return new Date(exp);
}
function expired(exp) { const d = parseExp(exp); return d && Date.now() > d.getTime(); }
async function loadAccessKeys(env) { return await loadKV(env, "access_keys", []); }
async function saveAccessKeys(env, keys) { await env.CEEB_DATA.put("access_keys", JSON.stringify(keys)); }
function publicKey(k) { const { keyHash, ...rest } = k; return rest; }
async function validateLegacyToken(token, env) {
  const secret = env.TOKEN_SECRET_KEY || "MINHA_CHAVE_SECRETA_FORTE_2025";
  let raw = "";
  try { raw = base64urlDecode(token); } catch { return { ok: false }; }
  const parts = raw.split("|");
  if (parts.length !== 3 || !DATE_FMT.test(parts[1])) return { ok: false };
  const [partner, exp, signature] = parts;
  const expected = await hmacHex(secret, `${partner}|${exp}`);
  if (expected !== signature) return { ok: false };
  if (expired(exp)) return { ok: false, partner, exp, expired: true };
  return { ok: true, partner, name: partner, exp, role: "suporte", accessId: "legacy-support" };
}
async function validateToken(token, env) {
  const clean = String(token || "").trim();
  if (!clean) return { ok: false };
  if (env.SUPPORT_ACCESS_KEY && clean === env.SUPPORT_ACCESS_KEY) {
    return { ok: true, partner: "Suporte CEEB", name: "Suporte CEEB", role: "suporte", exp: "Sem expiração", accessId: "env-support" };
  }
  const keys = await loadAccessKeys(env);
  const keyHash = await sha256Hex(clean);
  const found = keys.find(k => k.keyHash === keyHash);
  if (found) {
    if (found.blocked) return { ok: false, blocked: true, partner: found.name };
    if (expired(found.expiresAt)) return { ok: false, expired: true, partner: found.name, exp: found.expiresAt };
    return { ok: true, partner: found.name, name: found.name, polo: found.polo || "", role: found.role || "coordenador", exp: found.expiresAt || "Sem expiração", accessId: found.id };
  }
  return await validateLegacyToken(clean, env);
}
async function login(request, env) {
  const body = await readBody(request);
  const token = String(body.access_key || "").trim();
  const valid = await validateToken(token, env);
  if (!valid.ok) {
    if (valid.blocked) return json({ error: `Acesso bloqueado para ${valid.partner}. Procure o suporte.` }, 403);
    return json({ error: valid.expired ? `Chave expirada para ${valid.partner}.` : "Chave de acesso inválida." }, 401);
  }
  const sessionId = crypto.randomUUID();
  const timeout = Number(env.SESSION_TIMEOUT_SECONDS || 3600);
  const session = { partner: valid.partner, name: valid.name || valid.partner, role: valid.role || "coordenador", polo: valid.polo || "", exp: valid.exp, accessId: valid.accessId, last: Date.now() };
  await env.CEEB_DATA.put(`session:${sessionId}`, JSON.stringify(session), { expirationTtl: timeout });
  await appendLog(env, valid.partner, `Login no sistema (${session.role})`);
  return json({ token: sessionId, partner: valid.partner, role: session.role, exp: valid.exp });
}
async function logout(request, env) {
  const sid = bearer(request);
  if (sid) await env.CEEB_DATA.delete(`session:${sid}`);
  return json({ ok: true });
}
function bearer(request) {
  const h = request.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}
async function requireAuth(request, env) {
  const sid = bearer(request);
  if (!sid) return { ok: false, error: "Sessão ausente." };
  const raw = await env.CEEB_DATA.get(`session:${sid}`);
  if (!raw) return { ok: false, error: "Sessão expirada. Faça login novamente." };
  const data = JSON.parse(raw);
  if (data.accessId && !String(data.accessId).startsWith("env-") && !String(data.accessId).startsWith("legacy")) {
    const keys = await loadAccessKeys(env);
    const k = keys.find(x => x.id === data.accessId);
    if (!k) return { ok: false, error: "Acesso removido pelo suporte." };
    if (k.blocked) return { ok: false, error: "Acesso bloqueado pelo suporte." };
    if (expired(k.expiresAt)) return { ok: false, error: "Sua chave expirou. Procure o suporte." };
  }
  const timeout = Number(env.SESSION_TIMEOUT_SECONDS || 3600);
  await env.CEEB_DATA.put(`session:${sid}`, JSON.stringify({ ...data, last: Date.now() }), { expirationTtl: timeout });
  return { ok: true, ...data };
}
async function loadKV(env, key, fallback) {
  const raw = await env.CEEB_DATA.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
async function saveKV(env, key, value) { await env.CEEB_DATA.put(key, JSON.stringify(value)); return json({ ok: true }); }
async function appendLog(env, partner, action) {
  const logs = await loadKV(env, "client_logs", []);
  logs.push({ timestamp: nowManaus(), partner, action });
  await env.CEEB_DATA.put("client_logs", JSON.stringify(logs.slice(-2000)));
}
function requireSupport(auth) {
  if ((auth.role || "coordenador") !== "suporte") throw new Error("Acesso permitido somente ao suporte.");
}
function makeAccessKey() {
  const part = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 5).padEnd(5, "X");
  return `CEEB-${part()}-${part()}-${part()}`;
}
async function supportListCoordinators(env, auth) {
  requireSupport(auth);
  const keys = await loadAccessKeys(env);
  return json({ coordinators: keys.map(publicKey).sort((a,b)=>String(a.name).localeCompare(String(b.name), "pt-BR")) });
}
async function supportCreateCoordinator(request, env, auth) {
  requireSupport(auth);
  const b = await readBody(request);
  const name = String(b.name || "").trim();
  if (!name) throw new Error("Informe o nome do coordenador.");
  const role = b.role === "suporte" ? "suporte" : "coordenador";
  const expiresAt = String(b.expiresAt || "").trim();
  const accessKey = makeAccessKey();
  const keys = await loadAccessKeys(env);
  const item = { id: crypto.randomUUID(), name, polo: String(b.polo || "").trim(), role, expiresAt, blocked: false, createdAt: isoNow(), createdBy: auth.partner, keyHash: await sha256Hex(accessKey) };
  keys.push(item);
  await saveAccessKeys(env, keys);
  await appendLog(env, auth.partner, `Criou acesso ${role}: ${name} / expiração: ${expiresAt || "sem expiração"}`);
  return json({ coordinator: publicKey(item), accessKey });
}
async function supportToggleCoordinator(request, env, auth) {
  requireSupport(auth);
  const b = await readBody(request);
  const keys = await loadAccessKeys(env);
  const idx = keys.findIndex(k => k.id === b.id);
  if (idx < 0) throw new Error("Coordenador não encontrado.");
  keys[idx].blocked = Boolean(b.blocked);
  keys[idx].updatedAt = isoNow();
  await saveAccessKeys(env, keys);
  await appendLog(env, auth.partner, `${keys[idx].blocked ? "Bloqueou" : "Liberou"} acesso de ${keys[idx].name}`);
  return json({ ok: true, coordinator: publicKey(keys[idx]) });
}
async function supportDeleteCoordinator(request, env, auth) {
  requireSupport(auth);
  const b = await readBody(request);
  const keys = await loadAccessKeys(env);
  const item = keys.find(k => k.id === b.id);
  await saveAccessKeys(env, keys.filter(k => k.id !== b.id));
  await appendLog(env, auth.partner, `Removeu acesso: ${item?.name || b.id}`);
  return json({ ok: true });
}
async function supportLogs(env, auth) {
  requireSupport(auth);
  const logs = await loadKV(env, "client_logs", []);
  return json({ logs: logs.slice(-1000).reverse() });
}

function asaasBase(env) { return String(env.ASAAS_PRODUCTION || "true").toLowerCase() === "false" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3"; }
async function asaas(env, method, path, data) {
  if (!env.ASAAS_API_KEY) throw new Error("Configure ASAAS_API_KEY nas variáveis do Cloudflare.");
  const resp = await fetch(asaasBase(env) + path, {
    method,
    headers: { "Content-Type": "application/json", "accept": "application/json", "access_token": env.ASAAS_API_KEY, "User-Agent": "GestaoPoloCEEBCloudflare/2.0" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const text = await resp.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!resp.ok) throw new Error(`Erro Asaas ${resp.status}: ${text}`);
  return parsed;
}
async function listAllCustomers(env) {
  const all = []; let offset = 0; const limit = 100;
  while (true) {
    const data = await asaas(env, "GET", `/customers?limit=${limit}&offset=${offset}`);
    all.push(...(data.data || []));
    if (!data.hasMore) break;
    offset += limit;
  }
  return all;
}
async function findCustomer(env, cpf) {
  const data = await asaas(env, "GET", `/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=1`);
  return (data.data || [])[0] || null;
}
async function getOrCreateCustomer(env, item) {
  const existing = await findCustomer(env, item.cpf || item.cpfCnpj || "");
  const payload = { name: item.nome || item.name, cpfCnpj: item.cpf || item.cpfCnpj, complement: item.complemento || item.complement || item.polo || "" };
  if (existing) return await asaas(env, "PUT", `/customers/${existing.id}`, payload);
  return await asaas(env, "POST", "/customers", payload);
}
function poloOf(c) { return c.complement || c.observations || ""; }
function byPolo(customers, polo) { return customers.filter(c => poloOf(c).trim().toLowerCase() === polo.trim().toLowerCase()); }
function uniquePolos(customers) { return [...new Set(customers.map(poloOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR")); }
function billingType(v) { const x = String(v||"").toLowerCase(); if (x.includes("pix")) return "PIX"; if (x.includes("cart")) return "CREDIT_CARD"; return "BOLETO"; }
function statusPt(s) { return ({PENDING:"AGUARDANDO PAGAMENTO", RECEIVED:"PAGA", CONFIRMED:"PAGA", OVERDUE:"VENCIDA", REFUNDED:"ESTORNADA", RECEIVED_IN_CASH:"PAGA"})[s] || s || "-"; }
function paid(s) { return ["RECEIVED","CONFIRMED","RECEIVED_IN_CASH"].includes(s); }
async function listPaymentsByCustomer(env, id) {
  const all = []; let offset = 0; const limit = 100;
  while (true) {
    const data = await asaas(env, "GET", `/payments?customer=${id}&limit=${limit}&offset=${offset}`);
    all.push(...(data.data || []));
    if (!data.hasMore) break;
    offset += limit;
  }
  return all;
}

async function dashboard(env) {
  const links = await loadKV(env, "dashboard_links", []);
  return json({ links: links.slice(-200).reverse(), totalLinks: links.length });
}
async function customers(request, env) {
  const url = new URL(request.url); const polo = url.searchParams.get("polo") || "";
  const list = await listAllCustomers(env);
  return json({ polos: uniquePolos(list), customers: polo ? byPolo(list, polo) : list });
}
async function upsertCustomer(request, env, partner) {
  const body = await readBody(request);
  const customer = await getOrCreateCustomer(env, body);
  await appendLog(env, partner, `Cadastro/atualização de aluno: ${body.nome || body.name}`);
  return json({ ok: true, customer });
}
async function batchCustomers(request, env, partner) {
  const { rows = [] } = await readBody(request); const result = [];
  for (const row of rows) { try { await getOrCreateCustomer(env, row); result.push({ ok: true, nome: row.nome || row.name }); } catch (e) { result.push({ ok: false, nome: row.nome || row.name, error: e.message }); } }
  await appendLog(env, partner, `Cadastro em lote: ${result.filter(r=>r.ok).length} sucesso(s)`);
  return json({ result });
}
async function createPayment(request, env, partner) {
  const b = await readBody(request);
  const c = await getOrCreateCustomer(env, b);
  const pay = await asaas(env, "POST", "/payments", { customer: c.id, billingType: billingType(b.forma), value: Number(String(b.valor).replace(",",".")), dueDate: b.vencimento, description: b.descricao || "Mensalidade" });
  const links = await loadKV(env, "dashboard_links", []);
  links.push({ Nome: b.nome, CPF: b.cpf, Descrição: b.descricao || "", Link: pay.invoiceUrl || pay.bankSlipUrl || "", CriadoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" }) });
  await env.CEEB_DATA.put("dashboard_links", JSON.stringify(links.slice(-1000)));
  await appendLog(env, partner, `Fatura emitida: ${b.nome}`);
  return json({ ok: true, payment: pay });
}
async function batchPayments(request, env, partner) {
  const { rows = [] } = await readBody(request); const links = await loadKV(env, "dashboard_links", []); const result = [];
  for (const r of rows) { try { const pay = await asaas(env, "POST", "/payments", { customer: r.customer_id, billingType: billingType(r.forma), value: Number(String(r.valor).replace(",",".")), dueDate: r.vencimento, description: r.descricao || "Mensalidade" }); links.push({ Nome: r.nome, CPF: r.cpf, Descrição: r.descricao || "", Link: pay.invoiceUrl || pay.bankSlipUrl || "", CriadoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" }) }); result.push({ ok:true, nome:r.nome, link: pay.invoiceUrl || pay.bankSlipUrl || "" }); } catch(e){ result.push({ok:false,nome:r.nome,error:e.message}); } }
  await env.CEEB_DATA.put("dashboard_links", JSON.stringify(links.slice(-1000)));
  await appendLog(env, partner, `Emissão por polo: ${result.filter(r=>r.ok).length} fatura(s)`);
  return json({ result });
}
async function searchPayments(request, env) {
  const b = await readBody(request); const customers = b.polo ? byPolo(await listAllCustomers(env), b.polo) : [await findCustomer(env, b.cpf)].filter(Boolean); const rows = [];
  for (const c of customers) { for (const p of await listPaymentsByCustomer(env, c.id)) rows.push({ payment_id:p.id, Nome:c.name, CPF:c.cpfCnpj, Polo:poloOf(c), Forma:p.billingType, Vencimento:p.dueDate, DataPagamento:p.clientPaymentDate || p.paymentDate || "", ValorLiquido:p.netValue ?? p.value, Status:statusPt(p.status), StatusRaw:p.status, Descrição:p.description || "", Link:p.invoiceUrl || p.bankSlipUrl || "" }); }
  return json({ rows });
}
async function deletePayment(request, env, partner) { const { payment_id } = await readBody(request); await asaas(env, "DELETE", `/payments/${payment_id}`); await appendLog(env, partner, `Fatura removida: ${payment_id}`); return json({ ok:true }); }
async function linksSearch(request, env) { return await searchPayments(request, env); }
async function prestacao(request, env) {
  const b = await readBody(request); const ini = new Date(b.data_ini + "T00:00:00"); const fim = new Date(b.data_fim + "T23:59:59"); const customers = byPolo(await listAllCustomers(env), b.polo); const detalhes = []; let total = 0;
  for (const c of customers) for (const p of await listPaymentsByCustomer(env, c.id)) { const dRaw = p.paymentDate || ""; const d = dRaw ? new Date(dRaw + "T12:00:00") : null; if (!paid(p.status) || !d || d < ini || d > fim) continue; const valor = Number(p.netValue ?? p.value ?? 0); total += valor; detalhes.push({ Nome:c.name, CPF:c.cpfCnpj, Polo:poloOf(c), Forma:p.billingType, Vencimento:p.dueDate, DataPagamento:dRaw, ValorLiquido:valor, Status:statusPt(p.status), Descrição:p.description || "" }); }
  return json({ resumo: { polo:b.polo, inicio:b.data_ini, fim:b.data_fim, total_pago:total, quantidade:detalhes.length }, detalhes });
}
