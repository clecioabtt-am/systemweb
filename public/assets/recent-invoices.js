async function loadRecentInvoices(){
  const box=document.getElementById('recentInvoices');
  const msg=document.getElementById('recentMsg');
  if(!box)return;
  try{
    const j=await api('/api/invoices/recent');
    const rows=j.data||[];
    if(!rows.length){box.innerHTML=''; if(msg)msg.textContent='Nenhum link gerado ainda.'; return;}
    if(msg)msg.textContent=`${rows.length} fatura(s) recente(s).`;
    box.innerHTML=rows.map(r=>`<div class="link-item"><strong>${escapeHtml(r.name||'Cliente')}</strong><a href="${escapeAttr(r.url||'#')}" target="_blank" rel="noopener">${escapeHtml(r.url||'Sem link')}</a><small>${escapeHtml(formatMoney(r.value||0))} • ${escapeHtml(r.dueDate||'')}</small></div>`).join('');
  }catch(e){ if(msg)msg.textContent=e.message; }
}
function recentText(){
  return [...document.querySelectorAll('#recentInvoices .link-item')].map(el=>{
    const name=el.querySelector('strong')?.textContent||'';
    const link=el.querySelector('a')?.textContent||'';
    return `${name} - ${link}`;
  }).join('\n');
}
async function copyRecentInvoices(){
  const text=recentText();
  if(!text)return alert('Nenhum link para copiar.');
  await navigator.clipboard.writeText(text);
  alert('Nomes e links copiados.');
}
async function clearRecentInvoices(){
  await api('/api/invoices/recent',{method:'DELETE'});
  await loadRecentInvoices();
}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function escapeAttr(v=''){return escapeHtml(v).replace(/`/g,'&#96;')}
function formatMoney(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
document.getElementById('copyRecent')?.addEventListener('click',copyRecentInvoices);
document.getElementById('clearRecent')?.addEventListener('click',clearRecentInvoices);
if(document.getElementById('recentInvoices')) loadRecentInvoices();
