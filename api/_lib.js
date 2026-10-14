import crypto from 'node:crypto';
import { put, list, del } from '@vercel/blob';

const COOKIE = 'sourced_admin';
const DAY = 24 * 60 * 60;

function secret() {
  const p = process.env.ADMIN_PASSWORD;
  if (!p) return null;
  return crypto.createHash('sha256').update('sourced-admin:' + p).digest();
}

function sign(exp) {
  return crypto.createHmac('sha256', secret()).update(String(exp)).digest('base64url');
}

export function passwordSet() {
  return !!process.env.ADMIN_PASSWORD;
}

export function checkPassword(given) {
  const p = process.env.ADMIN_PASSWORD;
  if (!p || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(p).digest();
  return crypto.timingSafeEqual(a, b);
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + 30 * DAY;
  const v = exp + '.' + sign(exp);
  return `${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * DAY}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function isAdmin(req) {
  if (!secret()) return false;
  const raw = req.headers.cookie || '';
  const m = raw.split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!m) return false;
  const [exp, sig] = m.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const good = sign(exp);
  return good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}

export function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.status(401).json({ error: 'Please log in again.' });
  return false;
}

export function storageReady() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function readJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Could not read ' + url);
  return r.json();
}

/* every save of the site content is a new file, so cached copies never go stale */
export async function latestContent() {
  if (!storageReady()) return null;
  const { blobs } = await list({ prefix: 'content/', limit: 1000 });
  if (!blobs.length) return null;
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return { data: await readJSON(blobs[0].url), all: blobs };
}

export async function saveContent(data) {
  data.updatedAt = new Date().toISOString();
  const name = 'content/' + Date.now() + '.json';
  await put(name, JSON.stringify(data), {
    access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 31536000
  });
  // keep the last 30 versions for undo
  const { blobs } = await list({ prefix: 'content/', limit: 1000 });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const old = blobs.slice(30).map(b => b.url);
  if (old.length) await del(old);
  return data;
}

export { put, list, del };
