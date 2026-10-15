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

const PER_RUN = 5;
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const replyTo = () => (process.env.NOTIFY_EMAIL || 'sourced.admin@gmail.com').split(',')[0].trim();

function html(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = text.split(/\n{2,}/).map(b => {
    const lines = b.split('\n');
    if (lines.every(l => l.startsWith('- '))) return '<ul style="padding-left:20px;margin:0 0 14px">' + lines.map(l => `<li>${esc(l.slice(2))}</li>`).join('') + '</ul>';
    return `<p style="margin:0 0 14px">${lines.map(esc).join('<br>')}</p>`;
  });
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:600px">${blocks.join('')}</div>`
    .replace(/www\.wearesourced\.co\.uk/g, '<a href="https://www.wearesourced.co.uk" style="color:#000">www.wearesourced.co.uk</a>');
}

export default async function handler(req, res) {
  const from = process.env.NOTIFY_FROM;
  if (!process.env.RESEND_API_KEY || !from || /resend\.dev/i.test(from) || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, reason: 'Sender not configured' });
  }
  const { blobs } = await list({ prefix: 'outreach/sent/', limit: 1000 });
  const done = new Set(blobs.map(b => b.pathname.replace('outreach/sent/', '').replace('.json', '')));
  const blocked = new Set(suppress.map(x => String(x).toLowerCase()));
  const isBlocked = to => { const e = to.toLowerCase(); return blocked.has(e) || blocked.has('@' + e.split('@')[1]); };
  const todo = queue.filter(m => m.id && !done.has(m.id) && VALID_EMAIL.test(m.to) && !isBlocked(m.to)).slice(0, PER_RUN);
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
          from, to: [m.to], reply_to: replyTo(), subject: m.subject, text: m.text, html: html(m.text),
          headers: { 'List-Unsubscribe': `<mailto:${replyTo()}?subject=remove>` }
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
  res.status(200).json({ ok: true, sentNow: results, remaining: queue.filter(m => !done.has(m.id)).length - results.length });
}
