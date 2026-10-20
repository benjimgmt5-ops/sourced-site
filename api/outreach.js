// Outreach sender. Vercel Cron calls this every 10 minutes (see vercel.json).
// It sends any emails in api/_outreach.json that haven't been sent yet, from the
// verified Sourced. domain, with replies going to the admin inbox. Each email is
// sent once: a record is saved in Blob storage under outreach/sent/<id>.json.
//
// To queue emails, add entries to api/_outreach.json: { "id", "to", "subject", "text" }.
// api/_suppress.json lists addresses (or "@domain") that must never be emailed, e.g. after a "remove" reply.
// Env: RESEND_API_KEY, NOTIFY_FROM (e.g. "Sourced. <hello@wearesourced.co.uk>"),
//      NOTIFY_EMAIL (reply-to, default sourced.admin@gmail.com), BLOB_READ_WRITE_TOKEN.
import { put, list } from '@vercel/blob';
import queue from './_outreach.json' with { type: 'json' };
import suppress from './_suppress.json' with { type: 'json' };
import replied from './_replied.json' with { type: 'json' };
import config from './_config.json' with { type: 'json' };

// Follow-ups: sent automatically to anyone who hasn't replied (api/_replied.json) or asked to be removed.
const FOLLOWUPS = [
  { step: 'f1', days: 5, after: '' },
  { step: 'f2', days: 12, after: 'f1' }
];
const SIG = "\n\nBest,\n\nBenji\nSourced.\nSee it. Say it. Sourced.\nwww.wearesourced.co.uk | 07590 474421 | sourced.admin@gmail.com\n\nIf you'd rather not hear from us, just reply \"remove\" and we won't contact you again.";
function followText(m, step) {
  const greet = (m.text.split('\n')[0] || 'Hi,').trim();
  const supplier = /^Bookings|^Film and music video bookings|bookings for your/i.test(m.subject) || /Bookings from productions/i.test(m.subject);
  if (step === 'f1') return greet + '\n\n' + (supplier
    ? "Just following up on my note last week. We're building our list of partners for upcoming shoots and events, and I'd love to include you. It's free to join, you set your own rates and you approve every booking.\n\nIt takes two minutes at www.wearesourced.co.uk/partners/ or just reply here."
    : "Just following up on my email last week. If you've got any shoots, shows or events coming up, I'd be glad to quote on locations, cars, transport, security or anything else you need, even at short notice.\n\nA brief takes two minutes at www.wearesourced.co.uk, or just reply with what you need.") + SIG;
  return greet + '\n\n' + (supplier
    ? "Last note from me. If working with Sourced. on future bookings is of interest, you can join at www.wearesourced.co.uk/partners/ whenever suits. Thanks for your time."
    : "Last note from me, I promise. Whenever a job comes up that needs a location, hero cars, talent transport or security sorted fast, we're one brief away at www.wearesourced.co.uk. Thanks for your time.") + SIG;
}

const PER_RUN = 5;
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const replyTo = () => (process.env.NOTIFY_EMAIL || 'sourced.admin@gmail.com').split(',')[0].trim();
const replyToList = () => (config.outreachReplyTo && config.outreachReplyTo.length ? config.outreachReplyTo : [replyTo()]);

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

export default async function handler(req, res) {
  const from = process.env.NOTIFY_FROM;
  if (!process.env.RESEND_API_KEY || !from || /resend\.dev/i.test(from) || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, reason: 'Sender not configured' });
  }
  let blobs = [], cursor;
  do {
    const r = await list({ prefix: 'outreach/sent/', limit: 1000, cursor });
    blobs = blobs.concat(r.blobs); cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  const sentAt = new Map(blobs.map(b => [b.pathname.replace('outreach/sent/', '').replace('.json', ''), new Date(b.uploadedAt).getTime()]));
  const done = new Set(sentAt.keys());
  const blocked = new Set([...suppress, ...replied].map(x => String(x).toLowerCase()));
  const isBlocked = to => { const e = to.toLowerCase(); return blocked.has(e) || blocked.has('@' + e.split('@')[1]); };
  const blockedSuppress = new Set(suppress.map(x => String(x).toLowerCase()));
  const isSuppressed = to => { const e = to.toLowerCase(); return blockedSuppress.has(e) || blockedSuppress.has('@' + e.split('@')[1]); };
  const fresh = queue.filter(m => m.id && !done.has(m.id) && VALID_EMAIL.test(m.to) && (m.priority ? !isSuppressed(m.to) : !isBlocked(m.to)));
  const now = Date.now(), DAY = 864e5;
  const follow = [];
  for (const m of queue) {
    if (!m.id || m.priority || !sentAt.has(m.id) || isBlocked(m.to) || !VALID_EMAIL.test(m.to)) continue;
    for (const f of FOLLOWUPS) {
      const fid = m.id + '-' + f.step;
      if (done.has(fid)) continue;
      const base = f.after ? sentAt.get(m.id + '-' + f.after) : sentAt.get(m.id);
      if (!base || now - sentAt.get(m.id) < f.days * DAY) break;
      follow.push({ id: fid, to: m.to, subject: 'Re: ' + m.subject.replace(/^Re: /, ''), text: followText(m, f.step) });
      break;
    }
  }
  // New emails first, then follow-ups, within the per-run cap.
  // Lead replies (priority: true) go first, then new emails, then follow-ups.
  const todo = [...fresh.filter(m => m.priority), ...fresh.filter(m => !m.priority), ...follow].slice(0, PER_RUN);
  const results = [];
  for (const m of todo) {
    // Claim first, so an overlapping run can't send the same email twice.
    await put(`outreach/sent/${m.id}.json`, JSON.stringify({ to: m.to, subject: m.subject, at: new Date().toISOString(), status: 'sending' }),
      { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    let status = 'sent', detail = '';
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [m.to], reply_to: replyToList(), subject: m.subject, text: m.text, html: html(m.text),
          ...(m.cc ? { cc: [].concat(m.cc) } : {}),
          headers: { ...(m.priority ? {} : { 'List-Unsubscribe': `<mailto:${replyTo()}?subject=remove>` }), ...(m.headers || {}) }
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) { status = 'failed'; detail = (await r.text()).slice(0, 300); }
    } catch (e) { status = 'failed'; detail = String(e).slice(0, 300); }
    await put(`outreach/sent/${m.id}.json`, JSON.stringify({ to: m.to, subject: m.subject, at: new Date().toISOString(), status, detail }),
      { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    results.push({ id: m.id, to: m.to, status });
    await new Promise(r => setTimeout(r, 1500));
  }
  res.status(200).json({ ok: true, sentNow: results, newWaiting: Math.max(0, fresh.length - results.length), followupsDue: follow.length });
}
