import crypto from 'node:crypto';

const partner = process.argv[2] || 'CEEB';
const exp = process.argv[3] || '2026-12-31 23:59:59';
const secret = process.argv[4] || process.env.TOKEN_SECRET_KEY || 'MINHA_CHAVE_SECRETA_FORTE_2025';
const data = `${partner}|${exp}`;
const sig = crypto.createHmac('sha256', secret).update(data).digest('hex');
const token = Buffer.from(`${data}|${sig}`).toString('base64url');
console.log(token);
