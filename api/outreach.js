// MYL outreach sender + CRM feed.
//   Cron (vercel.json) calls GET /api/outreach?task=send every 10 minutes: it sends queued
//   emails in api/_outreach.json from your own domain (NOTIFY_FROM, e.g. "Benji at MYL <hello@mylvisuals.com>")
//   with replies going to the MYL inbox, plus two automatic follow-ups.
//   Staff GET /api/outreach returns every lead with its status for the Proposals board.
//
// Queue an email: add { "id", "to", "company", "segment", "subject", "text" } to api/_outreach.json.
// api/_replied.json: addresses that replied (no more follow-ups; they show as Replied on the board).
// Leads with "via": "gmail" are sent by the Gmail outreach bot: the site never emails them, it only
// shows them on the board using their "stage", "sentAt" and "lastAt" fields.
// api/_suppress.json: addresses or "@domain" never to email (opt-outs, bounces).
// Env: RESEND_API_KEY, NOTIFY_FROM, BLOB_READ_WRITE_TOKEN, CRON_SECRET (optional, set by Vercel).
import { put, list, del } from '@vercel/blob';
import { getStaff } from './_lib.js';
import queue from './_outreach.json' with { type: 'json' };
import suppress from './_suppress.json' with { type: 'json' };
import replied from './_replied.json' with { type: 'json' };
import config from './_config.json' with { type: 'json' };

const DAY = 864e5, PER_RUN = 5;
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOLLOWUPS = [{ step: 'f1', days: 5 }, { step: 'f2', days: 12 }];
const SIG = "\n\nBest,\nBenji\nMYL (Made You Look) | Digital Creative Specialists\nwww.mylvisuals.com | +44 7590 474421";
const OPT = "\n\nIf this isn't relevant, just reply \"no thanks\" and I won't contact you again.";
const replyToList = () => (config.outreachReplyTo && config.outreachReplyTo.length ? config.outreachReplyTo : ['myl.visualsuk@gmail.com']);

function followText(m, step) {
  const greet = (m.text.split('\n')[0] || 'Hi,').trim();
  return greet + '\n\n' + (step === 'f1'
    ? "Just bringing this back to the top of your inbox. If AI visuals, VFX or fast campaign content could help on anything coming up, I'd be glad to send over a few examples. You can see recent work at www.mylvisuals.com."
    : "Last note from me. Whenever a campaign, launch or music video needs scroll-stopping visuals fast, we're one brief away at www.mylvisuals.com. Thanks for your time.") + SIG + OPT;
}

function html(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = text.split(/\n{2,}/).map((b) => `<p style="margin:0 0 14px">${b.split('\n').map(esc).join('<br>')}</p>`);
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:600px">${blocks.join('')}</div>`
    .replace(/www\.mylvisuals\.com(\/[A-Za-z0-9\-\/]*)?/g, (u, p) => `<a href="https://www.mylvisuals.com${p || ''}" style="color:#000">${u}</a>`);
}

async function sentLog() {
  let blobs = [], cursor;
  do {
    const r = await list({ prefix: 'outreach/sent/', limit: 1000, cursor });
    blobs = blobs.concat(r.blobs); cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  const out = new Map();
  await Promise.all(blobs.map(async (b) => {
    const id = b.pathname.replace('outreach/sent/', '').replace('.json', '');
    let rec = {};
    try { rec = await (await fetch(b.url, { cache: 'no-store' })).json(); } catch (_) {}
    out.set(id, { at: new Date(rec.at || b.uploadedAt).getTime(), status: rec.status || 'sent' });
  }));
  return out;
}

const lower = (x) => String(x || '').toLowerCase();
const blockedSet = () => new Set([...suppress, ...replied].map(lower));
const isIn = (set, to) => { const e = lower(to); return set.has(e) || set.has('@' + e.split('@')[1]); };

// Staff view: one row per lead with its stage.
async function leads() {
  const log = await sentLog();
  const rep = new Set(replied.map(lower)), sup = new Set(suppress.map(lower));
  return queue.filter((m) => m.id && m.to).map((m) => {
    if (m.via === 'gmail') {
      let stage = m.stage || (m.sentAt ? 'emailed' : 'queued');
      if (isIn(rep, m.to)) stage = 'replied'; else if (isIn(sup, m.to)) stage = 'stopped';
      const t = (x) => (x ? new Date(x).getTime() : null);
      return { id: m.id, to: m.to, company: m.company || m.to.split('@')[1], segment: m.segment || '', subject: m.subject || '',
        stage, sentAt: t(m.sentAt), lastAt: t(m.lastAt || m.sentAt), via: 'gmail' };
    }
    const first = log.get(m.id), f1 = log.get(m.id + '-f1'), f2 = log.get(m.id + '-f2');
    let stage = 'queued';
    if (first) stage = first.status === 'failed' ? 'failed' : 'emailed';
    if (f1 && f1.status !== 'failed') stage = 'followed';
    if (f2 && f2.status !== 'failed') stage = 'final';
    if (isIn(rep, m.to)) stage = 'replied';
    else if (isIn(sup, m.to)) stage = 'stopped';
    return { id: m.id, to: m.to, company: m.company || m.to.split('@')[1], segment: m.segment || '', subject: m.subject,
      stage, sentAt: first ? first.at : null, lastAt: Math.max(first?.at || 0, f1?.at || 0, f2?.at || 0) || null };
  });
}

async function send() {
  const from = process.env.NOTIFY_FROM;
  if (!process.env.RESEND_API_KEY || !from || !process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, reason: 'Sender not configured yet (RESEND_API_KEY / NOTIFY_FROM)' };
  const log = await sentLog(), blocked = blockedSet(), now = Date.now();
  const own = queue.filter((m) => m.via !== 'gmail');
  const fresh = own.filter((m) => m.id && !log.has(m.id) && VALID_EMAIL.test(m.to) && !isIn(blocked, m.to));
  const follow = [];
  for (const m of own) {
    if (!m.id || !log.has(m.id) || log.get(m.id).status === 'failed' || isIn(blocked, m.to)) continue;
    for (const f of FOLLOWUPS) {
      const fid = m.id + '-' + f.step;
      if (log.has(fid)) continue;
      if (now - log.get(m.id).at < f.days * DAY) break;
      follow.push({ id: fid, to: m.to, subject: 'Re: ' + m.subject.replace(/^Re: /, ''), text: followText(m, f.step) });
      break;
    }
  }
  const todo = [...fresh, ...follow].slice(0, PER_RUN), results = [];
  for (const m of todo) {
    const path = `outreach/sent/${m.id}.json`, opts = { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true };
    await put(path, JSON.stringify({ to: m.to, subject: m.subject, at: new Date().toISOString(), status: 'sending' }), opts);
    let status = 'sent', detail = '', retry = false;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [m.to], reply_to: replyToList(), subject: m.subject, text: m.text, html: html(m.text),
          headers: { 'List-Unsubscribe': `<mailto:${replyToList()[0]}?subject=remove>` } }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) {
        status = 'failed'; detail = (await r.text()).slice(0, 300);
        // Domain not verified yet, bad key, rate limit or Resend outage: nothing was sent, so
        // release the lead to retry on a later run and stop this run.
        retry = [401, 403, 429].includes(r.status) || r.status >= 500;
      }
    } catch (e) { status = 'failed'; detail = String(e).slice(0, 300); retry = true; }
    if (retry) {
      const b = (await list({ prefix: path })).blobs.find((x) => x.pathname === path);
      if (b) await del(b.url).catch(() => {});
      results.push({ id: m.id, to: m.to, status: 'paused', detail });
      break;
    }
    await put(path, JSON.stringify({ to: m.to, subject: m.subject, at: new Date().toISOString(), status, detail }), opts);
    results.push({ id: m.id, to: m.to, status });
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { ok: true, sentNow: results, newWaiting: Math.max(0, fresh.length - results.length), followupsDue: follow.length };
}

export default async function handler(req, res) {
  try {
    if (req.query.task === 'send') {
      const cron = process.env.CRON_SECRET;
      if (cron && req.headers.authorization !== `Bearer ${cron}` && !(await getStaff(req))) return res.status(401).json({ error: 'Not allowed' });
      return res.status(200).json(await send());
    }
    if (!(await getStaff(req))) return res.status(401).json({ error: 'Staff login needed' });
    return res.status(200).json({ leads: await leads(), sender: !!(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM), from: process.env.NOTIFY_FROM || '' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
