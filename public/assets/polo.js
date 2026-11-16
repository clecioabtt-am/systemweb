let customers = [];
let polos = [];
let originalComplements = new Map();

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');
const count = document.getElementById('count');
const poloSelect = document.getElementById('poloSelect');
const poloStatus = document.getElementById('poloStatus');
const refreshPolosBtn = document.getElementById('refreshPolos');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function renderPolos() {
  if (!poloSelect) return;
  if (!polos.length) {
    poloSelect.innerHTML = '<option value="">Nenhum Polo encontrado no Asaas</option>';
    return;
  }
  poloSelect.innerHTML = '<option value="">Selecione um Polo</option>' + polos.map(p => {
    const value = escapeHtml(p.complement);
    const label = `${p.complement} (${p.total || 0})`;
    return `<option value="${value}">${escapeHtml(label)}</option>`;
  }).join('');
}

async function loadPolos(refresh = false) {
  if (!poloSelect) return;
  poloStatus.textContent = 'Buscando Polos no Asaas...';
  poloSelect.disabled = true;
  try {
    const j = await api('/api/asaas/polos' + (refresh ? '?refresh=1' : ''));
    polos = j.data || [];
    renderPolos();
    poloStatus.textContent = `${polos.length} Polo(s) carregado(s).`;
  } catch (e) {
    poloSelect.innerHTML = '<option value="">Erro ao carregar Polos</option>';
    poloStatus.textContent = e.message;
  } finally {
    poloSelect.disabled = false;
  }
}

function render() {
  tbody.innerHTML = customers.map((c, i) => `
    <tr>
      <td>${escapeHtml(c.name || '')}</td>
      <td>${escapeHtml(c.cpfCnpj || '')}</td>
      <td><input data-i="${i}" value="${escapeHtml(c.complement || '')}"></td>
    </tr>
  `).join('');
  count.textContent = `${customers.length} cliente(s)`;
  tbody.querySelectorAll('input').forEach(inp => {
    inp.oninput = () => customers[inp.dataset.i].complement = inp.value;
  });
}

document.getElementById('loadBtn').onclick = async () => {
  const polo = poloSelect.value.trim();
  if (!polo) {
    msg.className = 'msg';
    msg.textContent = 'Selecione um Polo existente no Asaas.';
    return;
  }
  msg.textContent = 'Buscando clientes no Asaas...';
  msg.className = 'msg';
  try {
    const j = await api('/api/asaas/by-polo?complement=' + encodeURIComponent(polo));
    customers = j.data || [];
    originalComplements = new Map(customers.map(c => [c.id, String(c.complement || '').trim()]));
    render();
    msg.className = 'msg ok';
    msg.textContent = `${customers.length} cliente(s) vinculado(s) ao Polo ${polo}.`;
    if (j.scanned) msg.textContent += ` ${j.scanned} cliente(s) verificado(s) no Asaas.`;
  } catch (e) {
    msg.className = 'msg';
    msg.textContent = e.message;
  }
};

document.getElementById('applyComplement').onclick = () => {
  const v = document.getElementById('newComplement').value.trim();
  if (!v) return;
  customers = customers.map(c => ({ ...c, complement: v }));
  render();
  msg.className = 'msg ok';
  msg.textContent = 'Complemento aplicado na coluna.';
};

document.getElementById('saveAsaas').onclick = async () => {
  const changes = customers.filter(c => String(c.complement || '').trim() !== originalComplements.get(c.id));
  if (!customers.length) {
    msg.textContent = 'Carregue os clientes de um Polo antes de atualizar.';
    msg.className = 'msg';
    return;
  }
  if (!changes.length) {
    msg.textContent = 'Nenhuma alteração detectada. Edite a coluna Complemento ou clique em Aplicar filtro na coluna complemento.';
    msg.className = 'msg';
    return;
  }
  if (changes.some(c => !String(c.complement || '').trim())) {
    msg.textContent = 'Preencha o complemento de todos os clientes alterados.';
    msg.className = 'msg';
    return;
  }
  const saveBtn = document.getElementById('saveAsaas');
  saveBtn.disabled = true;
  msg.textContent = 'Atualizando clientes no Asaas...';
  msg.className = 'msg';
  try {
    const j = await api('/api/asaas/update-complement', {
      method: 'POST',
      body: JSON.stringify({ customers: changes.map(c => ({ id: c.id, complement: String(c.complement).trim() })) })
    });
    for (const result of j.results || []) {
      if (result.ok) originalComplements.set(result.id, result.complement);
    }
    const failures = (j.results || []).filter(r => !r.ok);
    const warnings = (j.results || []).filter(r => r.warning);
    msg.className = j.failed || warnings.length ? 'msg' : 'msg ok';
    msg.textContent = `Confirmados no Asaas: ${j.success}. Falhas: ${j.failed}.`;
    if (failures.length) msg.textContent += ' Erros: ' + failures.map(r => `${r.id}: ${r.error}`).join(' | ');
    if (warnings.length) msg.textContent += ` Atenção: ${warnings.length} cadastro(s) sem sincronização local.`;
    if (j.success) msg.textContent += ' Para consultar o novo Polo, selecione o complemento atualizado e clique em Aplicar.';
    await loadPolos(true);
  } catch (e) {
    msg.className = 'msg';
    msg.textContent = e.message;
  } finally {
    saveBtn.disabled = false;
  }
};

refreshPolosBtn.onclick = () => loadPolos(true);
loadPolos(false);
