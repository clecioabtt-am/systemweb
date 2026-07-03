let customers = [];
let polos = [];

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
  const complement = document.getElementById('newComplement').value.trim() || customers[0]?.complement;
  if (!customers.length || !complement) return;
  msg.textContent = 'Atualizando clientes no Asaas...';
  msg.className = 'msg';
  try {
    const j = await api('/api/asaas/update-complement', {
      method: 'POST',
      body: JSON.stringify({ complement, customers })
    });
    msg.className = 'msg ok';
    msg.textContent = `Atualizados: ${j.success}. Falhas: ${j.failed}.`;
    await loadPolos(true);
  } catch (e) {
    msg.className = 'msg';
    msg.textContent = e.message;
  }
};

refreshPolosBtn.onclick = () => loadPolos(true);
loadPolos(false);
