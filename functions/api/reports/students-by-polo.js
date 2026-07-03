import { asaasFetch, json } from '../asaas/_utils.js';

function normalize(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
function getComplement(customer = {}) {
  return String(customer.complement || customer.addressComplement || customer.complemento || '').trim();
}
function cleanFileName(value = '') {
  return String(value || 'lista').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'lista';
}
async function findStudentsByComplement(env, complement) {
  const target = normalize(complement);
  const matched = [];
  let offset = 0;
  const limit = 100;
  for (let pageIndex = 0; pageIndex < 160; pageIndex++) {
    const page = await asaasFetch(env, `/customers?limit=${limit}&offset=${offset}`);
    const rows = page.data || [];
    for (const customer of rows) {
      const currentComplement = getComplement(customer);
      if (normalize(currentComplement) === target) {
        matched.push({
          name: customer.name || '',
          cpfCnpj: customer.cpfCnpj || '',
          complement: currentComplement
        });
      }
    }
    if (!page.hasMore || rows.length === 0) break;
    offset += limit;
  }
  matched.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }));
  return matched;
}
function xmlEscape(value = '') {
  return String(value).replace(/[<>&'"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]));
}
function pdfEscape(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()\\]/g, '\\$&');
}
function makePdf(rows, complement) {
  const perPage = 32;
  const pages = [];
  const chunks = [];
  for (let i = 0; i < rows.length; i += perPage) chunks.push(rows.slice(i, i + perPage));
  if (!chunks.length) chunks.push([]);
  for (let p = 0; p < chunks.length; p++) {
    let y = 805;
    const lines = [];
    lines.push('BT /F1 16 Tf 40 ' + y + ` Td (Lista de alunos - ${pdfEscape(complement)}) Tj ET`); y -= 24;
    lines.push('BT /F1 10 Tf 40 ' + y + ` Td (Total: ${rows.length} aluno(s) | Ordem alfabetica) Tj ET`); y -= 28;
    lines.push('BT /F1 10 Tf 40 ' + y + ' Td (Nome) Tj ET');
    lines.push('BT /F1 10 Tf 320 ' + y + ' Td (CPF/CNPJ) Tj ET');
    lines.push('BT /F1 10 Tf 430 ' + y + ' Td (Complemento) Tj ET'); y -= 18;
    chunks[p].forEach(r => {
      const name = pdfEscape(String(r.name || '').slice(0, 48));
      const cpf = pdfEscape(r.cpfCnpj || '');
      const comp = pdfEscape(String(r.complement || '').slice(0, 26));
      lines.push('BT /F1 9 Tf 40 ' + y + ` Td (${name}) Tj ET`);
      lines.push('BT /F1 9 Tf 320 ' + y + ` Td (${cpf}) Tj ET`);
      lines.push('BT /F1 9 Tf 430 ' + y + ` Td (${comp}) Tj ET`);
      y -= 20;
    });
    lines.push('BT /F1 8 Tf 500 24 Td (Pagina ' + (p + 1) + '/' + chunks.length + ') Tj ET');
    pages.push(lines.join('\n'));
  }
  const objects = [];
  const add = s => { objects.push(s); return objects.length; };
  const catalogId = 1;
  const pagesId = 2;
  objects.push('');
  objects.push('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  pages.forEach(content => {
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(o => { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
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
  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function makeZip(files) {
  const enc = new TextEncoder();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new Uint8Array([0x50,0x4b,0x03,0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    locals.push(local, name, data);
    const central = new Uint8Array([0x50,0x4b,0x01,0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralStart = offset;
  const centralBytes = concat(centrals);
  const end = new Uint8Array([0x50,0x4b,0x05,0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralBytes.length), ...u32(centralStart), ...u16(0)]);
  return concat([...locals, centralBytes, end]);
}
function makeXlsx(rows, complement) {
  const sheetRows = [
    ['Nome', 'CPF/CNPJ', 'Complemento'],
    ...rows.map(r => [r.name || '', r.cpfCnpj || '', r.complement || ''])
  ].map((cols, idx) => `<row r="${idx + 1}">${cols.map((v, i) => {
    const col = String.fromCharCode(65 + i);
    return `<c r="${col}${idx + 1}" t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="42" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="28" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`;
  return makeZip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(complement).slice(0,31)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }
  ]);
}
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const complement = String(url.searchParams.get('complement') || url.searchParams.get('polo') || '').trim();
    const format = String(url.searchParams.get('format') || 'xlsx').toLowerCase();
    if (!complement) return json({ ok: false, error: 'Informe o Polo.' }, 400);
    const rows = await findStudentsByComplement(env, complement);
    const base = `lista_alunos_${cleanFileName(complement)}`;
    if (format === 'pdf') {
      const body = makePdf(rows, complement);
      return new Response(body, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${base}.pdf"` } });
    }
    const body = makeXlsx(rows, complement);
    return new Response(body, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${base}.xlsx"` } });
  } catch (err) {
    return json({ ok: false, error: err.message, detail: err.payload || null }, err.status || 500);
  }
}
