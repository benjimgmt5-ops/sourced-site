// Staff reply to a brief. Emails the client through Resend (RESEND_API_KEY + NOTIFY_FROM) with replies going to
// REPLY_TO (default the MYL inbox), and keeps the conversation on the brief. {log:true} just records a message
// (e.g. a client reply that came in by email or WhatsApp) without sending anything.
import { getStaff, readOne, writeOne, clip } from './_lib.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okUrl = (u) => /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(String(u));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const staff = await getStaff(req);
  if (!staff) return res.status(401).json({ error: 'Staff login needed' });
  try {
    const b = req.body || {};
    const id = String(b.id || '').replace(/[^a-z0-9]/gi, '');
    const brief = id && (await readOne('briefs/', id));
    if (!brief) return res.status(404).json({ error: 'Brief not found' });
    const text = clip(b.message, 8000).trim();
    const images = (Array.isArray(b.images) ? b.images : []).filter(okUrl).slice(0, 12);
    if (!text && !images.length) return res.status(400).json({ error: 'Write a message or add a picture' });
    const entry = { at: Date.now(), by: staff, text, images, from: b.log ? (b.from === 'client' ? 'client' : 'note') : 'staff' };

    if (!b.log) {
      const key = process.env.RESEND_API_KEY, from = process.env.NOTIFY_FROM;
      if (!key || !from) return res.status(503).json({ error: "Email sending isn't set up yet (RESEND_API_KEY and NOTIFY_FROM in Vercel)", code: 'no_sender' });
      if (!/\S+@\S+\.\S+/.test(brief.email || '')) return res.status(400).json({ error: 'This brief has no valid client email' });
      const replyTo = process.env.REPLY_TO || 'myl.visualsuk@gmail.com';
      const subject = clip(b.subject, 200).trim() || `Re: your ${brief.type ? brief.type.toLowerCase() + ' ' : ''}project with MYL`;
      const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px">
        ${esc(text).replace(/\n/g, '<br>')}
        ${images.map((u) => `<p><a href="${esc(u)}"><img src="${esc(u)}" alt="" style="max-width:100%;border-radius:8px"></a></p>`).join('')}
        <p style="color:#666;font-size:13px;margin-top:24px">${esc(staff.charAt(0).toUpperCase() + staff.slice(1))} · MYL — Made You Look<br>Reply to this email to get back to us.</p></div>`;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [brief.email], reply_to: replyTo, subject, html, text: text + (images.length ? '\n\n' + images.join('\n') : '') }),
      });
      if (!r.ok) { console.error('Resend', r.status, await r.text()); return res.status(502).json({ error: "The email didn't send. Try again in a minute." }); }
      entry.subject = subject;
    }
    const next = { ...brief, thread: [...(brief.thread || []), entry].slice(-200), updatedAt: Date.now(), updatedBy: staff };
    if (!b.log && (next.status || 'new') === 'new') next.status = 'review';
    await writeOne('briefs/', id, next);
    return res.status(200).json({ ok: true, entry, status: next.status });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
}
