import { json } from '../asaas/_utils.js';
import { getAccountabilityRows } from '../accountability/query.js';

function xmlEscape(value = '') {
  return String(value ?? '').replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]));
}
function pdfEscape(value = '') {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()\\]/g, '\\$&');
}
function cleanFileName(value = '') {
  return String(value || 'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'relatorio';
}
function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function statusLabel(s = '') {
  const map = { RECEIVED: 'PAGA', CONFIRMED: 'PAGA', RECEIVED_IN_CASH: 'PAGA' };
  return map[String(s).toUpperCase()] || s || '-';
}

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABLE = crcTable();
function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u16(n) { return [n & 255, (n >>> 8) & 255]; }
function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
function concat(parts) {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function makeZip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    locals.push(local, name, data);
    const central = new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralStart = offset;
  const centralBytes = concat(centrals);
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralBytes.length), ...u32(centralStart), ...u16(0)]);
  return concat([...locals, centralBytes, end]);
}

function makeXlsx(data) {
  const headers = ['Nome', 'CPF/CNPJ', 'Forma de pagamento', 'Data de vencimento', 'Data de pagamento', 'Valor líquido', 'Status', 'Descrição'];
  const top = [
    ['Prestação de Contas por Polo'],
    ['Polo', data.polo],
    ['Período de pagamento', `${data.startDateBr} até ${data.endDateBr}`],
    ['Quantidade de faturas pagas', data.summary.paidCount],
    ['Valor total pago', `R$ ${money(data.summary.totalPaid)}`],
    []
  ];
  const rows = [
    ...top,
    headers,
    ...data.rows.map((r) => [
      r.name,
      r.cpfCnpj,
      r.billingTypeLabel || r.billingType,
      r.dueDateBr || r.dueDate,
      r.paymentDateBr || r.paymentDate,
      `R$ ${money(r.netValue ?? r.value)}`,
      statusLabel(r.status),
      r.description
    ])
  ];
  const sheetRows = rows.map((cols, idx) => `<row r="${idx + 1}">${cols.map((v, i) => `<c r="${String.fromCharCode(65 + i)}${idx + 1}" t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`).join('')}</row>`).join('\n');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="34"/><col min="2" max="2" width="16"/><col min="3" max="3" width="22"/><col min="4" max="5" width="17"/><col min="6" max="6" width="16"/><col min="7" max="7" width="15"/><col min="8" max="8" width="65"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Prestacao" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  return makeZip([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }
  ]);
}

function enc(s) { return new TextEncoder().encode(s); }
function concatBytes(parts) {
  const arrays = parts.map((p) => typeof p === 'string' ? enc(p) : p);
  const len = arrays.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}
function wrapText(value, maxChars) {
  const words = pdfEscape(value || '-').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}
function draw(lines, x, y, size = 7, leading = 8.5) {
  return lines.map((line, i) => `BT /F1 ${size} Tf ${x} ${y - i * leading} Td (${line}) Tj ET`).join('\n');
}
function makePdf(data) {
  const pageW = 842, pageH = 595;
  const rows = [...data.rows].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  const cols = [
    { k: 'name', l: 'Nome', x: 32, max: 24 },
    { k: 'cpf', l: 'CPF/CNPJ', x: 165, max: 14 },
    { k: 'forma', l: 'Forma', x: 235, max: 16 },
    { k: 'venc', l: 'Vencimento', x: 320, max: 10 },
    { k: 'pag', l: 'Pagamento', x: 390, max: 10 },
    { k: 'valor', l: 'Valor líquido', x: 462, max: 13 },
    { k: 'desc', l: 'Descrição completa', x: 555, max: 50 }
  ];
  const pages = [];
  let lines = [];
  let y = 0;
  let pageNo = 1;
  function header() {
    lines = [];
    lines.push('0.94 0.99 0.96 rg 0 0 842 595 re f');
    lines.push('0.02 0.45 0.18 rg 0 520 842 75 re f');
    lines.push('1 1 1 rg');
    lines.push('BT /F2 22 Tf 34 562 Td (CEEB) Tj ET');
    lines.push(`BT /F2 18 Tf 100 560 Td (Prestacao de Contas por Polo) Tj ET`);
    lines.push(`BT /F1 10 Tf 100 542 Td (Polo: ${pdfEscape(data.polo)} | Periodo de pagamento: ${pdfEscape(data.startDateBr)} ate ${pdfEscape(data.endDateBr)}) Tj ET`);
    lines.push(`BT /F2 10 Tf 100 526 Td (Quantidade paga: ${data.summary.paidCount} | Valor total pago: R$ ${money(data.summary.totalPaid)} | Pagina ${pageNo}) Tj ET`);
    lines.push('0.03 0.16 0.32 rg 26 486 790 24 re f');
    lines.push('1 1 1 rg');
    cols.forEach((c) => lines.push(`BT /F2 7 Tf ${c.x} 495 Td (${pdfEscape(c.l)}) Tj ET`));
    y = 472;
  }
  function finish() {
    lines.push('0.35 0.45 0.40 rg');
    lines.push('BT /F1 7 Tf 650 18 Td (Centro Educacional Emmanuel Butel) Tj ET');
    pages.push(lines.join('\n'));
  }
  header();
  for (const r of rows) {
    const vals = {
      name: r.name || '-',
      cpf: r.cpfCnpj || '-',
      forma: r.billingTypeLabel || r.billingType || '-',
      venc: r.dueDateBr || r.dueDate || '-',
      pag: r.paymentDateBr || r.paymentDate || '-',
      valor: `R$ ${money(r.netValue ?? r.value)}`,
      desc: r.description || '-'
    };
    const w = {};
    cols.forEach((c) => { w[c.k] = wrapText(vals[c.k], c.max); });
    const maxLines = Math.max(...Object.values(w).map((a) => a.length));
    const rowH = Math.max(22, maxLines * 8.5 + 10);
    if (y - rowH < 42) { finish(); pageNo++; header(); }
    lines.push(`0.98 1.00 0.99 rg 26 ${y - rowH + 4} 790 ${rowH} re f`);
    lines.push(`0.84 0.93 0.88 RG 26 ${y - rowH + 4} 790 ${rowH} re S`);
    cols.forEach((c) => {
      lines.push(c.k === 'valor' ? '0.00 0.45 0.22 rg' : '0.05 0.10 0.20 rg');
      lines.push(draw(w[c.k], c.x, y - 8, c.k === 'desc' ? 6.2 : 6.8, 8.2));
    });
    y -= rowH + 4;
  }
  finish();
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  objects.push('');
  objects.push('');
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];
  pages.forEach((content) => {
    const bytes = enc(content);
    const cid = add(concatBytes([`<< /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']));
    const pid = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cid} 0 R >>`);
    pageIds.push(pid);
  });
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const parts = ['%PDF-1.4\n'];
  const offsets = [0];
  let off = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(off);
    const ob = concatBytes([`${i + 1} 0 obj\n`, typeof body === 'string' ? body : body, '\nendobj\n']);
    parts.push(ob);
    off += ob.length;
  });
  const xrefStart = off;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((o) => { xref += `${String(o).padStart(10, '0')} 00000 n \n`; });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(xref);
  return concatBytes(parts);
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const polo = url.searchParams.get('polo') || '';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const format = (url.searchParams.get('format') || 'xlsx').toLowerCase();
    if (!polo || !startDate || !endDate) return json({ ok: false, error: 'Informe Polo, data inicial e data final.' }, 400);
    const data = await getAccountabilityRows(env, { polo, startDate, endDate });
    const base = `prestacao_contas_${cleanFileName(polo)}_${cleanFileName(startDate)}_${cleanFileName(endDate)}`;
    if (format === 'pdf') {
      const body = makePdf(data);
      return new Response(body, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${base}.pdf"` } });
    }
    const body = makeXlsx(data);
    return new Response(body, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${base}.xlsx"` } });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
