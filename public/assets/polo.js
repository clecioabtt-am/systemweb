let customers = [];
let polos = [];
let originalComplements = new Map();
const rowStatuses = new Map();
let saving = false;

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
      <td><input data-i="${i}" value="${escapeHtml(c.complement || '')}" ${saving ? 'disabled' : ''}></td>
      <td data-status-i="${i}">${escapeHtml(rowStatuses.get(c.id) || '')}</td>
      <td><button class="btn ghost" type="button" data-save-i="${i}" ${saving ? 'disabled' : ''}>Salvar aluno</button></td>
    </tr>
  `).join('');
  count.textContent = `${customers.length} cliente(s) — somente os alterados serão enviados`;
  tbody.querySelectorAll('input').forEach(inp => {
    inp.oninput = () => {
      const customer = customers[Number(inp.dataset.i)];
      customer.complement = inp.value;
      setRowStatus(customer.id, 'Alteração pendente');
    };
  });
  tbody.querySelectorAll('[data-save-i]').forEach(button => {
    button.onclick = () => saveChanges([customers[Number(button.dataset.saveI)]]);
  });
}

function setRowStatus(id, message) {
  rowStatuses.set(id, message);
  const index = customers.findIndex(c => c.id === id);
  if (index >= 0) {
    const cell = Array.from(tbody.querySelectorAll('[data-status-i]'))
      .find(el => Number(el.dataset.statusI) === index);
    if (cell) cell.textContent = message;
  }
}

document.getElementById('loadBtn').onclick = async () => {
  if (saving) return;
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
    rowStatuses.clear();
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
  if (saving) return;
  const v = document.getElementById('newComplement').value.trim();
  if (!v) return;
  customers = customers.map(c => ({ ...c, complement: v }));
  for (const c of customers) {
    if (v !== originalComplements.get(c.id)) rowStatuses.set(c.id, 'Alteração pendente');
  }
  render();
  msg.className = 'msg ok';
  msg.textContent = 'Complemento aplicado na coluna.';
};

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function saveChanges(selection = customers) {
  if (saving) return;
  const changes = selection.filter(c => String(c.complement || '').trim() !== originalComplements.get(c.id));
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
  if (changes.some(c => !String(c.complement || '').trim() || String(c.complement).trim().length > 255)) {
    msg.textContent = 'O complemento dos alunos alterados deve ter de 1 a 255 caracteres.';
    msg.className = 'msg';
    return;
  }
  const saveBtn = document.getElementById('saveAsaas');
  saving = true;
  saveBtn.disabled = true;
  tbody.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
  document.getElementById('loadBtn').disabled = true;
  document.getElementById('applyComplement').disabled = true;
  refreshPolosBtn.disabled = true;
  msg.textContent = `Preparando atualização de ${changes.length} aluno(s)...`;
  msg.className = 'msg';
  let success = 0;
  const failures = [];
  const warnings = [];
  try {
    // Uma solicitação por aluno: falhas de um cadastro não interrompem os outros,
    // e o Asaas consegue aplicar os próprios limites de requisições.
    for (let index = 0; index < changes.length; index++) {
      const customer = changes[index];
      const complement = String(customer.complement).trim();
      let result;
      for (let attempt = 0; attempt < 5; attempt++) {
        setRowStatus(customer.id, attempt ? `Nova tentativa ${attempt}/4...` : 'Enviando ao Asaas...');
        try {
          const response = await api('/api/asaas/update-complement', {
            method: 'POST',
            body: JSON.stringify({ customers: [{ id: customer.id, complement }] })
          });
          result = response.results?.[0] || { ok: false, error: 'Resposta sem confirmação do cliente.' };
        } catch (err) {
          result = { ok: false, error: err.message || 'Falha de comunicação.', retryable: false };
        }
        if (result.ok || !result.retryable || attempt === 4) break;
        // Aguardar RateLimit-Reset quando houver HTTP 429; nunca tentar imediatamente.
        const seconds = result.retryAfterSeconds > 0
          ? Math.min(90, Math.ceil(result.retryAfterSeconds) + 1)
          : Math.min(45, Math.pow(2, attempt + 1) * 3);
        setRowStatus(customer.id, `Asaas temporariamente indisponível; aguardando ${seconds}s...`);
        await wait(seconds * 1000);
      }
      if (result.ok) {
        success++;
        originalComplements.set(customer.id, complement);
        setRowStatus(customer.id, result.warning ? `Confirmado; ${result.warning}` : 'Confirmado no Asaas');
        if (result.warning) warnings.push({ customer, error: result.warning });
      } else {
        const reason = `${result.status ? `HTTP ${result.status}: ` : ''}${result.error || 'Não confirmado'}`;
        failures.push({ customer, error: reason });
        setRowStatus(customer.id, `Falha: ${reason}`);
      }
      msg.textContent = `Processados: ${index + 1}/${changes.length}. Confirmados: ${success}. Falhas: ${failures.length}.`;
      if (index < changes.length - 1) await wait(500);
    }
    msg.className = failures.length || warnings.length ? 'msg' : 'msg ok';
    msg.textContent = `Confirmados no Asaas: ${success}. Falhas: ${failures.length}.`;
    if (failures.length) msg.textContent += ' Erros: ' + failures.map(r => `${r.customer.name || r.customer.id}: ${r.error}`).join(' | ');
    if (warnings.length) msg.textContent += ` Atenção: ${warnings.length} cadastro(s) sem sincronização local.`;
    if (success) msg.textContent += ' Para consultar o novo Polo, selecione o complemento atualizado e clique em Aplicar.';
    try { await loadPolos(true); } catch { /* A confirmação dos alunos independe da lista de polos. */ }
  } catch (e) {
    msg.className = 'msg';
    msg.textContent = e.message;
  } finally {
    saving = false;
    saveBtn.disabled = false;
    document.getElementById('loadBtn').disabled = false;
    document.getElementById('applyComplement').disabled = false;
    refreshPolosBtn.disabled = false;
    tbody.querySelectorAll('input, button').forEach(el => { el.disabled = false; });
  }
}

document.getElementById('saveAsaas').onclick = () => saveChanges();

refreshPolosBtn.onclick = () => loadPolos(true);
loadPolos(false);
