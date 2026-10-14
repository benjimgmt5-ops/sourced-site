import { put, list, del, requireAdmin, storageReady, readJSON } from './_lib.js';

const FIELDS = ['name', 'company', 'email', 'phone', 'date', 'location', 'categories', 'items', 'details', 'budget', 'transcript', 'source', 'summary'];

const LABELS = { name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', date: 'Dates', location: 'Location',
  categories: 'Needs', items: 'Items', budget: 'Budget', summary: 'Summary', details: 'Details', transcript: 'Amelia transcript' };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Sends a copy of each brief to the admin inbox through Resend (https://resend.com).
// Env: RESEND_API_KEY (required), NOTIFY_EMAIL (default sourced.admin@gmail.com),
//      NOTIFY_FROM (default Resend's test sender, which only delivers to the Resend account's own email).
async function emailAdmin(e, req) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('RESEND_API_KEY not set: brief saved but not emailed'); return; }
  const to = (process.env.NOTIFY_EMAIL || 'sourced.admin@gmail.com').split(',').map(s => s.trim()).filter(Boolean);
  const from = process.env.NOTIFY_FROM || 'Sourced. <onboarding@resend.dev>';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'wearesourcedit.com';
  const rows = Object.keys(LABELS).filter(k => e[k]);
  const text = `New brief via ${e.source}\n\n` + rows.map(k => `${LABELS[k]}: ${e[k]}`).join('\n') + `\n\nOpen the back end: https://${host}/admin`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#000">`
    + `<p style="font-size:18px"><b>New brief</b> via ${esc(e.source)}</p><table cellpadding="6" style="border-collapse:collapse">`
    + rows.map(k => `<tr><td valign="top" style="color:#666;white-space:nowrap">${LABELS[k]}</td><td style="white-space:pre-wrap">${esc(e[k])}</td></tr>`).join('')
    + `</table><p><a href="https://${host}/admin" style="color:#000">Open the back end</a></p></div>`;
  const who = e.name || e.company || e.email || e.phone || 'website';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: `New Sourced. brief from ${who}`, text, html,
      ...(e.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email) ? { reply_to: e.email } : {}) }),
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
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
      const { url, status } = req.body || {};
      const e = await readJSON(url);
      e.status = status === 'done' ? 'done' : 'new';
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
