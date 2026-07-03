let polos = [];
let students = [];
let selectedPolo = '';

const poloSelect = document.getElementById('poloSelect');
const poloStatus = document.getElementById('poloStatus');
const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');
const count = document.getElementById('count');
const pdfBtn = document.getElementById('downloadPdf');
const xlsxBtn = document.getElementById('downloadXlsx');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function renderPolos() {
  if (!polos.length) {
    poloSelect.innerHTML = '<option value="">Nenhum Polo encontrado no Asaas</option>';
    return;
  }
  poloSelect.innerHTML = '<option value="">Selecione um Polo</option>' + polos.map(p => {
    const value = escapeHtml(p.complement);
    return `<option value="${value}">${escapeHtml(p.complement)} (${p.total || 0})</option>`;
  }).join('');
}

async function loadPolos(refresh = false) {
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

function renderStudents() {
  students.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }));
  tbody.innerHTML = students.map(s => `<tr><td>${escapeHtml(s.name || '')}</td><td>${escapeHtml(s.cpfCnpj || s.cpf || '')}</td><td>${escapeHtml(s.complement || '')}</td></tr>`).join('');
  count.textContent = `${students.length} aluno(s)`;
  pdfBtn.disabled = !students.length;
  xlsxBtn.disabled = !students.length;
}

async function loadStudents() {
  selectedPolo = poloSelect.value.trim();
  if (!selectedPolo) {
    msg.className = 'msg';
    msg.textContent = 'Selecione um Polo.';
    return;
  }
  msg.className = 'msg';
  msg.textContent = 'Buscando alunos/clientes do Polo selecionado...';
  pdfBtn.disabled = true;
  xlsxBtn.disabled = true;
  try {
    const j = await api('/api/asaas/by-polo?complement=' + encodeURIComponent(selectedPolo));
    students = j.data || [];
    renderStudents();
    msg.className = 'msg ok';
    msg.textContent = `${students.length} aluno(s) encontrado(s) para ${selectedPolo}. A lista abaixo está em ordem alfabética.`;
  } catch (e) {
    students = [];
    renderStudents();
    msg.className = 'msg';
    msg.textContent = e.message;
  }
}

function download(format) {
  if (!selectedPolo) return;
  const url = `/api/reports/students-by-polo?format=${encodeURIComponent(format)}&complement=${encodeURIComponent(selectedPolo)}`;
  window.location.href = url;
}

document.getElementById('loadBtn').onclick = loadStudents;
document.getElementById('refreshPolos').onclick = () => loadPolos(true);
pdfBtn.onclick = () => download('pdf');
xlsxBtn.onclick = () => download('xlsx');
loadPolos(false);
