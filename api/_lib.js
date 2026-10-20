// Shared helpers: staff sessions (signed cookie) and simple JSON records stored in Vercel Blob.
import crypto from 'node:crypto';
import { put, list, del } from '@vercel/blob';

const SECRET = () => process.env.SESSION_SECRET || '';
const hmac = (p) => crypto.createHmac('sha256', SECRET()).update(p).digest('base64url');
export const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// STAFF_USERS="benji:long-password,sam:another-password"
export function staffUsers() {
  const out = {};
  for (const pair of (process.env.STAFF_USERS || '').split(',')) {
    const i = pair.indexOf(':');
    if (i > 0) out[pair.slice(0, i).trim().toLowerCase()] = pair.slice(i + 1).trim();
  }
  return out;
}
export function makeSession(user) {
  const p = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  return p + '.' + hmac(p);
}
export function getStaff(req) {
  if (!SECRET()) return null;
  const m = /(?:^|;\s*)myl_staff=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, h] = m[1].split('.');
  if (!p || !h || !safeEq(h, hmac(p))) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.exp > Date.now() && staffUsers()[d.u] !== undefined ? d.u : null;
  } catch { return null; }
}
export const sessionCookie = (value, maxAge) =>
  `myl_staff=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export const clip = (v, n = 4000) => String(v ?? '').slice(0, n);

// Records live at <prefix><id>/<timestamp>-<random>.json. Newest version wins; older ones are deleted.
async function listAll(prefix) {
  const out = []; let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}
const tsOf = (b) => parseInt(b.pathname.split('/').pop(), 10) || 0;
async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Blob read failed ' + r.status);
  return r.json();
}
export async function readAll(prefix) {
  const groups = {};
  for (const b of await listAll(prefix)) {
    const id = b.pathname.slice(prefix.length).split('/')[0];
    if (!groups[id] || tsOf(b) > tsOf(groups[id])) groups[id] = b;
  }
  const recs = await Promise.all(Object.entries(groups).map(async ([id, b]) => ({ id, ...(await fetchJSON(b.url)) })));
  return recs.filter((r) => !r.deleted);
}
export async function readOne(prefix, id) {
  const blobs = await listAll(`${prefix}${id}/`);
  if (!blobs.length) return null;
  const b = blobs.reduce((a, c) => (tsOf(c) > tsOf(a) ? c : a));
  const rec = await fetchJSON(b.url);
  return rec.deleted ? null : rec;
}
export async function writeOne(prefix, id, data) {
  const res = await put(`${prefix}${id}/${Date.now()}.json`, JSON.stringify(data), {
    access: 'public', contentType: 'application/json', addRandomSuffix: true, cacheControlMaxAge: 31536000,
  });
  const old = (await listAll(`${prefix}${id}/`)).filter((b) => b.url !== res.url).map((b) => b.url);
  if (old.length) await del(old).catch(() => {});
  return res;
}
export async function deleteOne(prefix, id) {
  const urls = (await listAll(`${prefix}${id}/`)).map((b) => b.url);
  if (urls.length) await del(urls);
}
