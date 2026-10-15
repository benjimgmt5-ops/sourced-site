import { put, list, del, requireAdmin, storageReady, readJSON } from './_lib.js';
import config from './_config.json' with { type: 'json' };

const FIELDS = ['name', 'company', 'email', 'phone', 'date', 'location', 'categories', 'items', 'details', 'budget', 'transcript', 'source', 'summary', 'offer', 'area', 'links'];

const LABELS = { name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', date: 'Dates', location: 'Location',
  categories: 'Needs', items: 'Items', budget: 'Budget', summary: 'Summary', details: 'Details', offer: 'Offering', area: 'Area covered', links: 'Links and photos', transcript: 'Amelia transcript' };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const adminInbox = () => (process.env.NOTIFY_EMAIL || 'sourced.admin@gmail.com').split(',').map(s => s.trim()).filter(Boolean);
// NOTIFY_FROM: sender on the verified domain, e.g. "Sourced. <hello@wearesourced.co.uk>".
// Unset = Resend's test sender, which only delivers to the Resend account's own email.
const sender = () => process.env.NOTIFY_FROM || 'Sourced. <onboarding@resend.dev>';
const domainVerified = () => !/@resend\.dev>?\s*$/i.test(sender());
const isPartner = e => /^partner/i.test(e.source || '');

async function sendEmail(msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender(), ...msg }),
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

// Thank-you email to the client. Only sent once a verified sender domain is set (NOTIFY_FROM),
// because Resend's test sender can't deliver to clients.
async function emailClient(e) {
  if (!process.env.RESEND_API_KEY || !domainVerified() || !e.email || !VALID_EMAIL.test(e.email)) return;
  if (isPartner(e)) {
    const f = (e.name || '').trim().split(/\s+/)[0];
    const t = `Hi${f ? ' ' + f : ''},\n\nThanks for signing up as a Sourced. partner. We've got your details and will be in touch to confirm your listing, rates and availability.\n\nWhen a production brief matches what you offer, we'll send it straight to you. You approve every booking.\n\nSourced.\nSee it. Say it. Sourced.`;
    await sendEmail({ to: [e.email], reply_to: adminInbox()[0], subject: 'Welcome to Sourced. partners', text: t,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:560px"><p style="font-size:26px;font-weight:bold;margin:0 0 20px">Sourced.</p>` + t.split('\n\n').map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + `</div>` });
    return;
  }
  const first = (e.name || '').trim().split(/\s+/)[0];
  const asked = ['date', 'location', 'categories', 'items', 'budget'].filter(k => e[k]);
  const text = `Hi${first ? ' ' + first : ''},\n\nThanks for your brief. We've got it, and our team will review what you need and come back to you with a quote.\n\n`
    + (asked.length ? 'What you asked for:\n' + asked.map(k => `${LABELS[k]}: ${e[k]}`).join('\n') + '\n\n' : '')
    + `Nothing is booked until you accept a quote. If anything changes, just reply to this email.\n\nSourced.\nSee it. Say it. Sourced.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:560px">`
    + `<p style="font-size:26px;font-weight:bold;margin:0 0 20px">Sourced.</p>`
    + `<p>Hi${first ? ' ' + esc(first) : ''},</p><p>Thanks for your brief. We've got it, and our team will review what you need and come back to you with a quote.</p>`
    + (asked.length ? `<table cellpadding="6" style="border-collapse:collapse;margin:8px 0 16px">`
      + asked.map(k => `<tr><td valign="top" style="color:#666;white-space:nowrap">${LABELS[k]}</td><td style="white-space:pre-wrap">${esc(e[k])}</td></tr>`).join('') + `</table>` : '')
    + `<p>Nothing is booked until you accept a quote. If anything changes, just reply to this email.</p>`
    + `<p style="color:#666">Sourced.<br>See it. Say it. Sourced.</p></div>`;
  await sendEmail({ to: [e.email], reply_to: adminInbox()[0], subject: 'We\'ve got your brief | Sourced.', text, html });
}

// Copy of each brief to the admin inbox through Resend (https://resend.com).
// Env: RESEND_API_KEY (required), NOTIFY_EMAIL (default sourced.admin@gmail.com), NOTIFY_FROM (see above).
async function emailAdmin(e, req) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('RESEND_API_KEY not set: brief saved but not emailed'); return; }
  const to = adminInbox();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.wearesourced.co.uk';
  const rows = Object.keys(LABELS).filter(k => e[k]);
  const text = `New brief via ${e.source}\n\n` + rows.map(k => `${LABELS[k]}: ${e[k]}`).join('\n') + `\n\nOpen the back end: https://${host}/admin`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#000">`
    + `<p style="font-size:18px"><b>New brief</b> via ${esc(e.source)}</p><table cellpadding="6" style="border-collapse:collapse">`
    + rows.map(k => `<tr><td valign="top" style="color:#666;white-space:nowrap">${LABELS[k]}</td><td style="white-space:pre-wrap">${esc(e[k])}</td></tr>`).join('')
    + `</table><p><a href="https://${host}/admin" style="color:#000">Open the back end</a></p></div>`;
  const who = e.name || e.company || e.email || e.phone || 'website';
  const copy = config.leadCopy && !to.includes(config.leadCopy) ? { bcc: [config.leadCopy] } : {};
  const kind = isPartner(e) ? 'partner sign-up' : 'brief';
  await sendEmail({ to, ...copy, subject: `New Sourced. ${kind} from ${who}`, text, html,
    ...(e.email && VALID_EMAIL.test(e.email) ? { reply_to: e.email } : {}) });
}

// Thank-you + Google review request, sent once when a brief is marked done in /admin (needs reviewUrl in _config.json).
async function emailReview(e) {
  const f = (e.name || '').trim().split(/\s+/)[0];
  const t = `Hi${f ? ' ' + f : ''},\n\nThanks for booking with Sourced. We hope the shoot went brilliantly.\n\nIf you have a minute, a quick Google review would mean a lot to us and helps other productions find us:\n${config.reviewUrl}\n\nWhenever you need anything for the next one, just reply to this email.\n\nSourced.\nSee it. Say it. Sourced.`;
  await sendEmail({ to: [e.email], reply_to: adminInbox()[0], subject: 'Thanks from Sourced.', text: t,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:560px"><p style="font-size:26px;font-weight:bold;margin:0 0 20px">Sourced.</p>` + t.split('\n\n').map(p => `<p>${esc(p).replace(/\n/g, '<br>').replace(esc(config.reviewUrl), `<a href="${esc(config.reviewUrl)}" style="color:#000">Leave a Google review</a>`)}</p>`).join('') + `</div>` });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      if (!storageReady()) return res.status(503).json({ error: 'Not ready' });
      const b = req.body || {};
      if (b.hp || b._gotcha) return res.json({ ok: true }); // spam trap
      const e = { at: new Date().toISOString(), status: 'new' };
      for (const k of FIELDS) {
        let v = b[k];
        if (Array.isArray(v)) v = v.join(', ');
        if (v != null && v !== '') e[k] = String(v).slice(0, 20000);
      }
      if (!e.source) e.source = 'Website form';
      if (!e.name && !e.email && !e.phone && !e.details && !e.summary && !e.transcript) return res.status(400).json({ error: 'Empty brief' });
      const id = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
      await put('enquiries/' + id + '.json', JSON.stringify(e), {
        access: 'public', contentType: 'application/json', addRandomSuffix: true
      });
      // copy every brief to the admin inbox; a failed email never loses the brief, it's already saved
      try { await emailAdmin(e, req); } catch (err) { console.error('Admin email failed:', err.message); }
      try { await emailClient(e); } catch (err) { console.error('Client email failed:', err.message); }
      return res.json({ ok: true });
    }
    if (!requireAdmin(req, res)) return;
    if (req.method === 'GET') {
      let blobs = [], cursor;
      do {
        const r = await list({ prefix: 'enquiries/', limit: 1000, cursor });
        blobs = blobs.concat(r.blobs); cursor = r.hasMore ? r.cursor : null;
      } while (cursor);
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const out = await Promise.all(blobs.slice(0, 300).map(async bl => {
        try { return { url: bl.url, ...(await readJSON(bl.url)) }; } catch (_) { return null; }
      }));
      return res.json({ enquiries: out.filter(Boolean).sort((a, b) => (b.at || '').localeCompare(a.at || '')) });
    }
    if (req.method === 'PATCH') {
      // mark as done / new: rewrite the record under a new name, delete the old one
      const { url, status, value, commission, note } = req.body || {};
      const e = await readJSON(url);
      const STAT = ['new', 'quoted', 'won', 'lost', 'done'];
      const prev = e.status || 'new';
      if (STAT.includes(status)) e.status = status;
      const num = v => (v === '' || v == null ? undefined : Math.max(0, Math.round(Number(String(v).replace(/[^0-9.]/g, '')) || 0)));
      if (value !== undefined) e.value = num(value);
      if (commission !== undefined) e.commission = num(commission);
      if (note !== undefined) e.note = String(note).slice(0, 2000);
      const stamp = new Date().toISOString();
      if (e.status !== prev) {
        if (e.status === 'quoted') { e.quotedAt = stamp; delete e.chased; }
        if (e.status === 'won') e.wonAt = e.wonAt || stamp;
        if (e.status === 'lost') e.lostAt = stamp;
        if (e.status === 'done') { e.doneAt = stamp; e.wonAt = e.wonAt || stamp; }
      }
      if (e.status === 'done' && prev !== 'done' && config.reviewUrl && !e.reviewAsked && !isPartner(e) && e.email && VALID_EMAIL.test(e.email) && domainVerified()) {
        try { await emailReview(e); e.reviewAsked = new Date().toISOString(); } catch (err) { console.error('Review email failed:', err.message); }
      }
      const path = new URL(url).pathname.slice(1).replace(/-[A-Za-z0-9]{20,}\.json$/, '.json');
      await put(path, JSON.stringify(e), { access: 'public', contentType: 'application/json', addRandomSuffix: true });
      await del(url);
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { url } = req.body || {};
      await del(url);
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
