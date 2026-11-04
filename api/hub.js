// Sourced. Hub API, used by the operating system at hub.wearesourced.co.uk (served from /hub/).
//   GET    /api/hub?task=session    -> { loggedIn }
//   POST   /api/hub?task=login      -> { password }  (HUB_PASSWORD, only accepted on the hub.* host)
//   DELETE /api/hub?task=login      -> log out
//   GET    /api/hub?task=outreach   -> outreach stats, sent log, queue, templates (admin)
//   POST   /api/hub?task=send       -> { to, subject, text }  one-off email from the Sourced. sender (admin)
// A hub login issues the same signed session as /admin, so every existing API (enquiry, content, upload) works.
import crypto from 'node:crypto';
import { put, list, isAdmin, requireAdmin, sessionCookie, clearCookie, passwordSet } from './_lib.js';
import queue from './_outreach.json' with { type: 'json' };
import suppress from './_suppress.json' with { type: 'json' };
import replied from './_replied.json' with { type: 'json' };
import config from './_config.json' with { type: 'json' };
import templates from '../seo-src/outreach-templates.json' with { type: 'json' };

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 864e5;
const host = req => String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
const onHub = req => /^hub\./.test(host(req)) || /^localhost(:\d+)?$/.test(host(req));
const replyTo = () => (config.outreachReplyTo && config.outreachReplyTo.length ? config.outreachReplyTo : ['sourced.admin@gmail.com']);
const londonDay = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);

function checkHubPassword(given) {
  const p = process.env.HUB_PASSWORD;
  if (!p || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(p).digest();
  return crypto.timingSafeEqual(a, b);
}

function html(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = text.split(/\n{2,}/).map(b => {
    const lines = b.split('\n');
    if (lines.every(l => l.startsWith('- '))) return '<ul style="padding-left:20px;margin:0 0 14px">' + lines.map(l => `<li>${esc(l.slice(2))}</li>`).join('') + '</ul>';
    return `<p style="margin:0 0 14px">${lines.map(esc).join('<br>')}</p>`;
  });
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:600px">${blocks.join('')}</div>`
    .replace(/www\.wearesourced\.co\.uk(\/[A-Za-z0-9\-\/]*)?/g, (u, p) => `<a href="https://www.wearesourced.co.uk${p || ''}" style="color:#000">${u}</a>`);
}

async function listAll(prefix) {
  let blobs = [], cursor;
  do { const r = await list({ prefix, limit: 1000, cursor }); blobs = blobs.concat(r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return blobs;
}

async function outreach() {
  const blobs = await listAll('outreach/sent/');
  const idOf = b => b.pathname.replace('outreach/sent/', '').replace(/\.json$/, '');
  const sentAt = new Map(blobs.map(b => [idOf(b), new Date(b.uploadedAt).getTime()]));
  const byId = new Map(queue.map(m => [m.id, m]));
  const blocked = new Set([...suppress, ...replied].map(x => String(x).toLowerCase()));
  const isBlocked = to => { const e = String(to).toLowerCase(); return blocked.has(e) || blocked.has('@' + e.split('@')[1]); };
  const now = Date.now();

  // 14-day series (London days), new emails vs follow-ups
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(londonDay(new Date(now - i * DAY)));
  const series = Object.fromEntries(days.map(d => [d, { day: d, sent: 0, followups: 0 }]));
  for (const b of blobs) {
    const d = londonDay(new Date(b.uploadedAt));
    if (!series[d] || /^test-/.test(idOf(b))) continue;
    if (/-f[12]$/.test(idOf(b))) series[d].followups++; else series[d].sent++;
  }

  const waitingList = queue.filter(m => m.id && !sentAt.has(m.id) && VALID_EMAIL.test(m.to) && (m.priority || !isBlocked(m.to)));
  let followDue = 0;
  for (const m of queue) {
    if (!m.id || m.priority || !sentAt.has(m.id) || isBlocked(m.to)) continue;
    const age = now - sentAt.get(m.id);
    if ((!sentAt.has(m.id + '-f1') && age >= 5 * DAY) || (sentAt.has(m.id + '-f1') && !sentAt.has(m.id + '-f2') && age >= 12 * DAY)) followDue++;
  }

  // recent log: newest 150 records with their real status
  const recentBlobs = [...blobs].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, 150);
  const recent = await Promise.all(recentBlobs.map(async b => {
    const id = idOf(b), q = byId.get(id.replace(/-f[12]$/, ''));
    let rec = {};
    try { rec = await (await fetch(b.url, { cache: 'no-store', signal: AbortSignal.timeout(6000) })).json(); } catch (_) {}
    return { id, to: rec.to || q?.to || '', subject: rec.subject || q?.subject || '', at: rec.at || b.uploadedAt,
      status: rec.status || 'sent', detail: rec.detail || '', step: (id.match(/-(f[12])$/) || [])[1] || (/^manual-/.test(id) ? 'manual' : 'first') };
  }));

  const totalNew = [...sentAt.keys()].filter(id => !/-f[12]$/.test(id) && !/^test-/.test(id)).length;
  const totalFollow = [...sentAt.keys()].filter(id => /-f[12]$/.test(id)).length;
  const last7 = blobs.filter(b => now - new Date(b.uploadedAt).getTime() < 7 * DAY && !/-f[12]$/.test(idOf(b))).length;

  return {
    stats: { queued: queue.length, waiting: waitingList.length, sentTotal: totalNew, followupsTotal: totalFollow, followupsDue: followDue,
      sent7: last7, replied: replied.length, suppressed: suppress.length, failedRecent: recent.filter(r => r.status === 'failed').length },
    series: days.map(d => series[d]),
    recent,
    upcoming: waitingList.slice(0, 60).map(m => ({ id: m.id, to: m.to, subject: m.subject, text: m.text, priority: !!m.priority })),
    templates: Object.entries(templates).map(([key, t]) => ({ key, subject: t.subject, text: t.text })),
    replied, suppress,
    sender: process.env.NOTIFY_FROM || '', replyTo: replyTo()
  };
}

async function sendOne(b) {
  const to = String(b.to || '').trim(), subject = String(b.subject || '').trim(), text = String(b.text || '').trim();
  if (!VALID_EMAIL.test(to)) throw Object.assign(new Error('Enter a valid email address.'), { code: 400 });
  if (!subject || !text) throw Object.assign(new Error('Add a subject and a message.'), { code: 400 });
  const from = process.env.NOTIFY_FROM;
  if (!process.env.RESEND_API_KEY || !from || /resend\.dev/i.test(from)) throw Object.assign(new Error('The email sender is not set up in Vercel.'), { code: 503 });
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo(), subject, text, html: html(text) }),
    signal: AbortSignal.timeout(10000)
  });
  const ok = r.ok, detail = ok ? '' : (await r.text()).slice(0, 300);
  const id = 'manual-' + Date.now() + '-' + to.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  await put(`outreach/sent/${id}.json`, JSON.stringify({ to, subject, at: new Date().toISOString(), status: ok ? 'sent' : 'failed', detail, manual: true }),
    { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  if (!ok) throw Object.assign(new Error('Email failed: ' + detail), { code: 502 });
  return { id };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const task = (req.query && req.query.task) || new URL(req.url, 'http://x').searchParams.get('task');
  try {
    if (task === 'session') return res.json({ loggedIn: isAdmin(req), ready: passwordSet() && !!process.env.HUB_PASSWORD });
    if (task === 'login') {
      if (req.method === 'DELETE') { res.setHeader('Set-Cookie', clearCookie()); return res.json({ ok: true }); }
      if (req.method !== 'POST') return res.status(405).end();
      if (!onHub(req)) return res.status(403).json({ error: 'Open hub.wearesourced.co.uk to log in.' });
      if (!passwordSet() || !process.env.HUB_PASSWORD) return res.status(503).json({ error: 'The hub password is not set up in Vercel yet.' });
      if (!checkHubPassword(req.body && req.body.password)) { await new Promise(r => setTimeout(r, 800)); return res.status(401).json({ error: 'Wrong password.' }); }
      res.setHeader('Set-Cookie', sessionCookie());
      return res.json({ ok: true });
    }
    if (!requireAdmin(req, res)) return;
    if (task === 'outreach' && req.method === 'GET') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Storage is not connected.' });
      return res.json(await outreach());
    }
    if (task === 'send' && req.method === 'POST') return res.json({ ok: true, ...(await sendOne(req.body || {})) });
    res.status(400).json({ error: 'Unknown task' });
  } catch (e) {
    res.status(e.code || 500).json({ error: e.message });
  }
}
