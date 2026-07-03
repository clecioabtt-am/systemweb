import { json } from '../asaas/_utils.js';
import { getAccountabilityRows } from '../accountability/query.js';

const LOGO_JPEG_BASE64 = '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';
const LOGO_WIDTH = 160;
const LOGO_HEIGHT = 160;
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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
    lines.push('q 58 0 0 58 30 528 cm /Logo Do Q');
    lines.push('1 1 1 rg');
    lines.push(`BT /F2 18 Tf 102 560 Td (Prestacao de Contas por Polo) Tj ET`);
    lines.push(`BT /F1 10 Tf 102 542 Td (Polo: ${pdfEscape(data.polo)} | Periodo de pagamento: ${pdfEscape(data.startDateBr)} ate ${pdfEscape(data.endDateBr)}) Tj ET`);
    lines.push(`BT /F2 10 Tf 102 526 Td (Quantidade paga: ${data.summary.paidCount} | Valor total pago: R$ ${money(data.summary.totalPaid)} | Pagina ${pageNo}) Tj ET`);
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
  const logoBytes = base64ToBytes(LOGO_JPEG_BASE64);
  const logoId = add(concatBytes([`<< /Type /XObject /Subtype /Image /Width ${LOGO_WIDTH} /Height ${LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`, logoBytes, '\nendstream']));
  const pageIds = [];
  pages.forEach((content) => {
    const bytes = enc(content);
    const cid = add(concatBytes([`<< /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']));
    const pid = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> /XObject << /Logo ${logoId} 0 R >> >> /Contents ${cid} 0 R >>`);
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
