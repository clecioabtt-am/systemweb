const msg=document.getElementById('msg');
const result=document.getElementById('result');
function val(id){return document.getElementById(id).value.trim()}
document.getElementById('emitBtn').onclick=async()=>{
  msg.className='msg'; msg.textContent='Emitindo fatura no Asaas...';
  try{
    const j=await api('/api/asaas/invoices',{method:'POST',body:JSON.stringify({
      mode:'manual', name:val('name'), cpfCnpj:val('cpf'), complement:val('complement'),
      billingType:val('billingType'), dueDate:val('dueDate'), value:val('value'), description:val('description')
    })});
    const row=j.invoice;
    msg.className='msg ok'; msg.textContent='Fatura criada com sucesso.';
    result.className='link-list';
    result.innerHTML=`<div class="link-item"><strong>${escapeHtml(row.name)}</strong><a target="_blank" rel="noopener" href="${escapeHtml(row.url)}">${escapeHtml(row.url)}</a><small>${formatMoney(row.value)} • ${escapeHtml(row.dueDate||'')}</small></div>`;
    await loadRecentInvoices?.();
  }catch(e){msg.className='msg'; msg.textContent=e.message;}
};
