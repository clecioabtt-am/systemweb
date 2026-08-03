let coordinators = [];
const form = document.getElementById('coordForm');
const msg = document.getElementById('msg');
const tbody = document.getElementById('tbody');
const search = document.getElementById('search');
const keyInput = form?.querySelector('[name="accessKey"]');
const formTitle = form?.closest('.panel')?.querySelector('h2');
let editingId = '';
let allowKeyChange = false;

function e(v=''){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function statusText(s){return {ativo:'Ativo',vence_em_breve:'Vence em breve',expirado:'Expirado',bloqueado:'Bloqueado'}[s]||s}
function statusClass(s){return s==='ativo'?'paid':s==='vence_em_breve'?'pending':s==='bloqueado'?'blocked':'expired'}
function filtered(){const q=(search?.value||'').toLowerCase().trim();return coordinators.filter(c=>!q||String(c.name||'').toLowerCase().includes(q)||String(c.email||'').toLowerCase().includes(q)||String(c.polo||'').toLowerCase().includes(q));}
function render(){const rows=filtered(); tbody.innerHTML=rows.map(c=>`<tr><td><strong>${e(c.name)}</strong></td><td>${e(c.access_key||'••••••••')}</td><td>${e(c.expires_at_br||c.expires_at||'-')}</td><td><span class="status-badge ${statusClass(c.status)}">${e(statusText(c.status))}</span></td><td><div class="actions inline"><button class="btn small" data-edit="${c.id}">Editar</button><button class="btn small ${c.active?'danger':'success'}" data-toggle="${c.id}" data-active="${c.active?0:1}">${c.active?'Bloquear':'Desbloquear'}</button><button class="btn small danger" data-del="${c.id}">Remover</button></div></td></tr>`).join('')||'<tr><td colspan="5">Nenhum coordenador cadastrado.</td></tr>';}

function resetForm(){
  form?.reset();
  if(form?.elements?.id) form.elements.id.value='';
  editingId='';
  allowKeyChange=false;
  if(keyInput){
    keyInput.required=true;
    keyInput.disabled=false;
    keyInput.value='';
    keyInput.autocomplete='new-password';
    keyInput.placeholder='Senha que ele usará para entrar';
  }
  const changeKeyBtn=document.getElementById('changeKeyBtn');
  if(changeKeyBtn) changeKeyBtn.style.display='none';
  if(formTitle) formTitle.textContent='Novo coordenador';
  document.getElementById('saveBtn').textContent='Salvar coordenador';
  document.getElementById('cancelEdit').style.display='none';
}

async function load(){
  try{
    msg.className='msg';
    msg.textContent='Carregando coordenadores...';
    const j=await api('/api/support/coordinators');
    coordinators=j.data||[];
    document.getElementById('sumTotal').textContent=j.summary?.total??coordinators.length;
    document.getElementById('sumActive').textContent=j.summary?.ativos??coordinators.filter(c=>c.status==='ativo'||c.status==='vence_em_breve').length;
    document.getElementById('sumBlocked').textContent=j.summary?.bloqueados??coordinators.filter(c=>!c.active).length;
    document.getElementById('sumExpired').textContent=j.summary?.expirados??coordinators.filter(c=>c.status==='expirado').length;
    msg.textContent='';
    render();
  }catch(err){msg.className='msg';msg.textContent=err.message;}
}

form?.addEventListener('submit',async ev=>{
  ev.preventDefault();
  const fd=new FormData(form);
  const id=String(form.elements.id?.value||editingId||'').trim();
  const payload={
    name:String(fd.get('name')||'').trim(),
    expires_at:String(fd.get('expiresAt')||'').trim()||null,
    active:fd.get('active')==='1'
  };
  // Durante a edição a chave antiga é preservada. Só enviamos accessKey se
  // o suporte clicar em "Alterar chave" e digitar uma nova chave.
  const accessKey=(!id || allowKeyChange) ? String(keyInput?.value||'').trim() : '';
  if(accessKey) payload.accessKey=accessKey;
  if(id) payload.id=id;

  try{
    msg.className='msg';
    msg.textContent='Salvando...';
    if(id){
      await api('/api/support/coordinators',{method:'PATCH',body:JSON.stringify(payload)});
    }else{
      if(!accessKey) throw new Error('Informe a chave de acesso do coordenador.');
      await api('/api/support/coordinators',{method:'POST',body:JSON.stringify(payload)});
    }
    resetForm();
    await load();
    msg.className='msg ok';
    msg.textContent=id?'Coordenador atualizado com sucesso.':'Coordenador salvo com sucesso.';
  }catch(err){msg.className='msg';msg.textContent=err.message;}
});

tbody?.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');
  if(!b)return;
  const id=b.dataset.edit||b.dataset.toggle||b.dataset.del;
  const c=coordinators.find(x=>String(x.id)===String(id));
  if(!c)return;

  try{
    if(b.dataset.edit){
      editingId=String(c.id);
      allowKeyChange=false;
      form.elements.id.value=c.id;
      form.elements.name.value=c.name||'';
      form.elements.expiresAt.value=(c.expires_at||'').slice(0,10);
      form.elements.active.value=c.active?'1':'0';
      keyInput.required=false;
      keyInput.value='';
      keyInput.disabled=true;
      keyInput.autocomplete='new-password';
      keyInput.placeholder='Chave atual será mantida';
      const changeKeyBtn=document.getElementById('changeKeyBtn');
      if(changeKeyBtn) changeKeyBtn.style.display='inline-flex';
      if(formTitle) formTitle.textContent='Editar coordenador';
      document.getElementById('saveBtn').textContent='Salvar alterações';
      document.getElementById('cancelEdit').style.display='inline-flex';
      scrollTo({top:0,behavior:'smooth'});
      return;
    }

    if(b.dataset.toggle){
      msg.className='msg';
      msg.textContent=c.active?'Bloqueando coordenador...':'Desbloqueando coordenador...';
      await api('/api/support/coordinators',{method:'PATCH',body:JSON.stringify({id,active:b.dataset.active==='1'})});
      await load();
      return;
    }

    if(b.dataset.del){
      if(!confirm(`Deseja realmente remover o coordenador ${c.name}? Esta ação não pode ser desfeita.`))return;
      msg.className='msg';
      msg.textContent='Removendo coordenador...';
      await api('/api/support/coordinators?id='+encodeURIComponent(id),{method:'DELETE'});
      if(form.elements.id.value===String(id)) resetForm();
      await load();
      msg.className='msg ok';
      msg.textContent='Coordenador removido com sucesso.';
    }
  }catch(err){msg.className='msg';msg.textContent=err.message;}
});

document.getElementById('changeKeyBtn')?.addEventListener('click',()=>{
  allowKeyChange=true;
  keyInput.disabled=false;
  keyInput.value='';
  keyInput.required=true;
  keyInput.placeholder='Digite uma NOVA chave de acesso';
  keyInput.focus();
});

document.getElementById('cancelEdit')?.addEventListener('click',resetForm);
search?.addEventListener('input',render);
load();
