
const qs = new URLSearchParams(location.search);
let currentRows = [];
let currentMode = location.pathname.includes('/consultas/polo') ? 'polo' : 'cliente';
let currentQuery = {};
const poloSelect = document.getElementById('poloSelect');
const tbody = document.getElementById('tbody');
const statusEl = document.getElementById('status');
const totalInfo = document.getElementById('totalInfo');
function esc(v=''){return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function fmtMoney(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function statusClass(s=''){s=String(s).toUpperCase(); if(['RECEIVED','CONFIRMED','RECEIVED_IN_CASH','PAGA'].includes(s))return 'status-paid'; if(['OVERDUE','VENCIDA'].includes(s))return 'status-overdue'; if(['PENDING','AGUARDANDO PAGAMENTO'].includes(s))return 'status-pending'; return 'status-other'}
function statusLabel(s=''){const map={PENDING:'AGUARDANDO PAGAMENTO',OVERDUE:'VENCIDA',RECEIVED:'PAGA',CONFIRMED:'PAGA',RECEIVED_IN_CASH:'PAGA',REFUNDED:'ESTORNADA',DELETED:'REMOVIDA'}; return map[String(s).toUpperCase()]||s||'-'}
function render(rows){currentRows=rows||[]; tbody.innerHTML=currentRows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.cpfCnpj)}</td><td>${esc(r.billingTypeLabel||r.billingType||'')}</td><td>${esc(r.dueDateBr||r.dueDate||'')}</td><td>${esc(r.paymentDateBr||r.paymentDate||'')}</td><td>${esc(fmtMoney(r.netValue ?? r.value))}</td><td class="${statusClass(r.status)}">${esc(statusLabel(r.status))}</td><td class="desc">${esc(r.description||'')}</td><td>${r.canDelete?`<button class="btn danger small" data-del="${esc(r.id)}">Remover</button>`:'-'}</td></tr>`).join('');
  tbody.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeInvoice(b.dataset.del));
  const txt = `${currentRows.length} fatura(s) encontrada(s).`;
  if(statusEl) statusEl.textContent = txt; if(totalInfo) totalInfo.textContent = txt;
}
async function loadPolos(refresh=false){ if(!poloSelect)return; statusEl.textContent='Carregando polos...'; const j=await api('/api/asaas/polos'+(refresh?'?refresh=1':'')); const polos=j.data||[]; poloSelect.innerHTML='<option value="">Selecione um Polo</option>'+polos.map(p=>`<option value="${esc(p.complement)}">${esc(p.complement)} (${p.total||0})</option>`).join(''); statusEl.textContent=`${polos.length} polo(s) carregado(s).`; }
async function buscarPolo(){ const polo=poloSelect.value; if(!polo) return alert('Selecione um Polo.'); statusEl.textContent='Buscando faturas no Asaas...'; currentMode='polo'; currentQuery={polo}; const j=await api('/api/invoices/query?mode=polo&polo='+encodeURIComponent(polo)); render(j.data||[]); }
async function buscarCliente(){ const nome=document.getElementById('nome')?.value||''; const cpf=document.getElementById('cpf')?.value||''; if(!nome && !cpf)return alert('Informe nome ou CPF.'); statusEl.textContent='Buscando faturas no Asaas...'; currentMode='cliente'; currentQuery={name:nome,cpf}; const j=await api('/api/invoices/query?mode=cliente&name='+encodeURIComponent(nome)+'&cpf='+encodeURIComponent(cpf)); render(j.data||[]); }
async function buscarPlanilha(){ const f=document.getElementById('file')?.files?.[0]; if(!f)return alert('Escolha um arquivo CSV.'); const text=await f.text(); statusEl.textContent='Buscando faturas da lista...'; const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const people=lines.slice(lines[0]?.toLowerCase().includes('nome')?1:0).map(l=>{const parts=l.split(/[;,]/); return {name:(parts[0]||'').trim(), cpf:(parts[1]||'').trim()};}).filter(p=>p.name||p.cpf); const all=[]; for(const p of people){try{const j=await api('/api/invoices/query?mode=cliente&name='+encodeURIComponent(p.name)+'&cpf='+encodeURIComponent(p.cpf)); all.push(...(j.data||[]));}catch(e){console.warn(e)}} all.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR',{sensitivity:'base'}) || String(a.dueDate||'').localeCompare(String(b.dueDate||''))); currentMode='lista'; currentQuery={}; render(all); }
async function removeInvoice(id){ if(!confirm('Remover esta fatura aguardando pagamento no Asaas?'))return; const j=await api('/api/invoices/remove',{method:'POST',body:JSON.stringify({id})}); statusEl.textContent=j.message||'Fatura removida.'; currentRows=currentRows.filter(r=>r.id!==id); render(currentRows); }
function exportUrl(fmt){ const p=new URLSearchParams({format:fmt}); if(currentMode==='polo' && currentQuery.polo){p.set('mode','polo'); p.set('polo',currentQuery.polo);} else if(currentMode==='cliente'){p.set('mode','cliente'); p.set('name',currentQuery.name||''); p.set('cpf',currentQuery.cpf||'');} else {sessionStorage.setItem('ceeb_export_rows',JSON.stringify(currentRows)); alert('Para exportar lista de planilha, use primeiro consulta por Polo ou Nome/CPF.'); return null;} return '/api/reports/invoices?'+p.toString(); }
document.getElementById('buscarPolo')?.addEventListener('click',buscarPolo);
document.getElementById('buscarCliente')?.addEventListener('click',buscarCliente);
document.getElementById('buscarPlanilha')?.addEventListener('click',buscarPlanilha);
document.getElementById('refreshPolos')?.addEventListener('click',()=>loadPolos(true));
document.getElementById('exportXlsx')?.addEventListener('click',()=>{const u=exportUrl('xlsx'); if(u) location.href=u;});
document.getElementById('exportPdf')?.addEventListener('click',()=>{const u=exportUrl('pdf'); if(u) location.href=u;});
if(poloSelect) loadPolos(false);
