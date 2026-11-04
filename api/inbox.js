// WhatsApp inbox for the Sourced. Hub, via YCloud (WhatsApp Business App coexistence: the number keeps
// working in the WhatsApp Business app on the phone, and every chat also lands here).
//
//   POST /api/inbox                       YCloud webhook (signed with YCloud-Signature). Events used:
//                                         whatsapp.inbound_message.received, whatsapp.smb.message.echoes
//   GET  /api/inbox?task=status           { ready, number, webhookUrl }              (admin)
//   GET  /api/inbox?task=threads          chat list with previews and unread counts   (admin)
//   GET  /api/inbox?task=thread&p=4475..  every message in one chat                   (admin)
//   POST /api/inbox?task=reply            { phone, text } send a WhatsApp reply       (admin)
//   POST /api/inbox?task=read             { phone } mark a chat as read               (admin)
//
// Env: YCLOUD_API_KEY, YCLOUD_WEBHOOK_SECRET, WHATSAPP_NUMBER (E.164, e.g. +447590474421), BLOB_READ_WRITE_TOKEN.
// Storage never overwrites a file (Blob URLs are CDN-cached), so state is encoded in file names:
//   inbox/msgs/<digits>/<time>-<in|out>-<id>.json     one file per message
//   inbox/read/<digits>/<time>.json                   chat marked read at <time>
import crypto from 'node:crypto';
import { put, list, requireAdmin } from './_lib.js';

const digits = s => String(s || '').replace(/\D/g, '');
const stamp = iso => new Date(iso).toISOString().replace(/[:.]/g, '-');
const unstamp = s => s.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1:$2:$3.$4Z');
const ready = () => !!(process.env.YCLOUD_API_KEY && process.env.WHATSAPP_NUMBER && process.env.BLOB_READ_WRITE_TOKEN);
const KIND = { image: 'Photo', video: 'Video', audio: 'Voice note', document: 'Document', sticker: 'Sticker', location: 'Location', contacts: 'Contact card' };

async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
}

function verify(raw, header) {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET;
  if (!secret) return false;
  const parts = Object.fromEntries(String(header || '').split(',').map(p => { const i = p.indexOf('='); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));
  if (!parts.t || !parts.s || Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return false;
  const good = crypto.createHmac('sha256', secret).update(parts.t + '.' + raw).digest('hex');
  return good.length === parts.s.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(parts.s));
}

function textOf(m) {
  const t = m.type, o = m[t] || {};
  if (t === 'text') return (m.text && m.text.body) || '';
  if (o.caption) return o.caption;
  if (t === 'button') return o.text || '';
  if (t === 'interactive') return (o.button_reply && o.button_reply.title) || (o.list_reply && o.list_reply.title) || '';
  if (t === 'location') return [o.name, o.address].filter(Boolean).join(', ');
  if (t === 'reaction') return o.emoji ? 'Reacted ' + o.emoji : '';
  return '';
}

async function listAll(prefix) {
  let blobs = [], cursor;
  do { const r = await list({ prefix, limit: 1000, cursor }); blobs = blobs.concat(r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return blobs;
}
const getJSON = async url => { try { return await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json(); } catch (_) { return null; } };

async function save(msg) {
  const id = String(msg.id || crypto.randomUUID()).replace(/[^A-Za-z0-9_-]/g, '').slice(-60);
  const path = `inbox/msgs/${digits(msg.phone)}/${stamp(msg.at)}-${msg.dir}-${id}.json`;
  await put(path, JSON.stringify(msg), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
}

function parsePath(p) {
  const m = p.match(/^inbox\/msgs\/(\d+)\/(.+?Z)-(in|out)-(.+)\.json$/);
  return m && { phone: m[1], at: unstamp(m[2]), dir: m[3] };
}

async function handleWebhook(evt) {
  const t = evt.type || '';
  if (t === 'whatsapp.inbound_message.received') {
    const m = evt.whatsappInboundMessage || {};
    if (!m.from) return 'skip';
    await save({ id: m.wamid || m.id, phone: '+' + digits(m.from), dir: 'in', via: 'whatsapp', type: m.type || 'text', text: textOf(m),
      kind: KIND[m.type] || '', media: (m[m.type] && m[m.type].link) || '', name: (m.customerProfile && m.customerProfile.name) || '',
      at: new Date(m.sendTime || evt.createTime || Date.now()).toISOString() });
    return 'saved in';
  }
  if (t === 'whatsapp.smb.message.echoes') { // sent from the WhatsApp Business app on the phone
    const m = evt.whatsappMessage || {};
    if (!m.to) return 'skip';
    await save({ id: m.wamid || m.id, phone: '+' + digits(m.to), dir: 'out', via: 'app', type: m.type || 'text', text: textOf(m),
      kind: KIND[m.type] || '', media: (m[m.type] && m[m.type].link) || '', at: new Date(m.sendTime || m.createTime || evt.createTime || Date.now()).toISOString() });
    return 'saved echo';
  }
  return 'ignored ' + t;
}

async function threads() {
  const [msgs, reads] = await Promise.all([listAll('inbox/msgs/'), listAll('inbox/read/')]);
  const lastRead = {};
  for (const b of reads) {
    const m = b.pathname.match(/^inbox\/read\/(\d+)\/(.+?Z)\.json$/); if (!m) continue;
    const at = unstamp(m[2]); if (!lastRead[m[1]] || at > lastRead[m[1]]) lastRead[m[1]] = at;
  }
  const by = {};
  for (const b of msgs) {
    const p = parsePath(b.pathname); if (!p) continue;
    const t = by[p.phone] || (by[p.phone] = { phone: '+' + p.phone, count: 0, unread: 0, last: null, lastIn: null });
    t.count++;
    if (p.dir === 'in' && (!lastRead[p.phone] || p.at > lastRead[p.phone])) t.unread++;
    if (!t.last || p.at > t.last.at) t.last = { ...p, url: b.url };
    if (p.dir === 'in' && (!t.lastIn || p.at > t.lastIn.at)) t.lastIn = { ...p, url: b.url };
  }
  const list = Object.values(by).sort((a, b) => b.last.at.localeCompare(a.last.at)).slice(0, 150);
  await Promise.all(list.map(async t => {
    const last = await getJSON(t.last.url);
    const inMsg = t.lastIn && t.lastIn.url !== t.last.url ? await getJSON(t.lastIn.url) : (t.last.dir === 'in' ? last : null);
    t.name = (inMsg && inMsg.name) || '';
    t.preview = last ? (last.text || last.kind || 'Message') : '';
    t.lastDir = t.last.dir; t.lastAt = t.last.at; t.lastInAt = t.lastIn ? t.lastIn.at : null;
    delete t.last; delete t.lastIn;
  }));
  return list;
}

async function thread(p) {
  const blobs = await listAll(`inbox/msgs/${digits(p)}/`);
  blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
  const out = await Promise.all(blobs.slice(-400).map(b => getJSON(b.url)));
  return out.filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
}

async function reply(b) {
  const to = '+' + digits(b.phone), text = String(b.text || '').trim();
  if (digits(b.phone).length < 8 || !text) throw Object.assign(new Error('Write a message first.'), { code: 400 });
  const r = await fetch('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.YCLOUD_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.WHATSAPP_NUMBER, to, type: 'text', text: { body: text.slice(0, 4096) } }),
    signal: AbortSignal.timeout(12000)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status === 'failed') {
    const why = (d.error && (d.error.message || d.error.whatsappApiError?.message)) || d.message || d.errorMessage || `YCloud ${r.status}`;
    const window = /24|window|re-?engage|131047/i.test(JSON.stringify(d));
    throw Object.assign(new Error(window ? 'WhatsApp only allows free replies within 24 hours of their last message. Reply from the WhatsApp Business app on your phone instead.' : 'WhatsApp send failed: ' + why), { code: 502 });
  }
  const msg = { id: d.wamid || d.id, phone: to, dir: 'out', via: 'hub', type: 'text', text, at: new Date().toISOString() };
  await save(msg);
  await markRead(to);
  return msg;
}

async function markRead(p) {
  await put(`inbox/read/${digits(p)}/${stamp(new Date().toISOString())}.json`, '{}', { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const task = new URL(req.url, 'http://x').searchParams.get('task');
  try {
    if (req.method === 'POST' && !task) {
      const raw = await rawBody(req);
      if (!verify(raw, req.headers['ycloud-signature'])) return res.status(401).json({ error: 'Bad signature' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Storage not connected' });
      let evt = {}; try { evt = JSON.parse(raw); } catch (_) {}
      return res.status(200).json({ ok: true, result: await handleWebhook(evt) });
    }
    if (!requireAdmin(req, res)) return;
    if (task === 'status') return res.json({ ready: ready(), webhookReady: !!process.env.YCLOUD_WEBHOOK_SECRET, number: process.env.WHATSAPP_NUMBER || '', webhookUrl: 'https://www.wearesourced.co.uk/api/inbox' });
    if (!ready()) return res.status(503).json({ error: 'WhatsApp is not connected yet.' });
    const p = new URL(req.url, 'http://x').searchParams.get('p');
    if (task === 'threads' && req.method === 'GET') return res.json({ threads: await threads() });
    if (task === 'thread' && req.method === 'GET') return res.json({ messages: await thread(p) });
    if (req.method === 'POST') {
      let b = {}; try { b = JSON.parse(await rawBody(req) || '{}'); } catch (_) {}
      if (task === 'reply') return res.json({ ok: true, message: await reply(b) });
      if (task === 'read') { await markRead(b.phone); return res.json({ ok: true }); }
    }
    res.status(400).json({ error: 'Unknown task' });
  } catch (e) {
    res.status(e.code || 500).json({ error: e.message });
  }
}
