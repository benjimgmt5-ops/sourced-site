// AI Workforce bridge for the Hub (Agents tab). The agents run as scheduled flows on Sourced's Platform
// (Activepieces). This endpoint talks to its "Hub API" webhook flow, which reads and updates the agent tables.
//   GET  /api/agents                         -> dashboard data (agents, approvals, leads, tasks, audit) (admin)
//   POST /api/agents  { action:'approve', id, subject?, body? }  -> sends the approved email from the Sourced. sender, marks it Sent
//   POST /api/agents  { action:'reject', id }                    -> marks it Rejected
//   POST /api/agents  { action:'toggle', agent, enabled:'On'|'Off' }  (agent 'GLOBAL STOP' halts every agent)
//   POST /api/agents  { action:'lead'|'task', id, status }
// Env: AGENTS_WEBHOOK_URL (the flow's /sync URL), AGENTS_KEY (shared secret), plus the existing RESEND_API_KEY, NOTIFY_FROM, BLOB_READ_WRITE_TOKEN.
// Nothing is ever sent without a logged-in admin pressing Approve. Each approval can only be sent once.
import { put, list, requireAdmin } from './_lib.js';
import { finish } from './_footer.js';
import queue from './_outreach.json' with { type: 'json' };
import suppress from './_suppress.json' with { type: 'json' };
import replied from './_replied.json' with { type: 'json' };
import config from './_config.json' with { type: 'json' };

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const replyTo = () => (config.outreachReplyTo && config.outreachReplyTo.length ? config.outreachReplyTo : ['sourced.admin@gmail.com']);
const queued = new Set(queue.map(m => String(m.to || '').toLowerCase()));

function html(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text.split(/\n{2,}/).map(b => {
    const lines = b.split('\n');
    if (lines.every(l => l.startsWith('- '))) return '<ul style="padding-left:20px;margin:0 0 14px">' + lines.map(l => `<li>${esc(l.slice(2))}</li>`).join('') + '</ul>';
    return `<p style="margin:0 0 14px">${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}

function blockedReason(to) {
  const e = to.toLowerCase(), dom = '@' + e.split('@')[1];
  const bad = [...suppress, ...replied].map(x => String(x).toLowerCase());
  if (bad.includes(e) || bad.includes(dom)) return 'This address is on the do-not-contact list.';
  if (queued.has(e)) return 'This address is already in the automatic outreach queue, so it would be emailed twice.';
  return '';
}

async function flow(body) {
  const url = process.env.AGENTS_WEBHOOK_URL, key = process.env.AGENTS_KEY;
  if (!url || !key) throw Object.assign(new Error('The AI workforce is not connected yet (AGENTS_WEBHOOK_URL / AGENTS_KEY missing in Vercel).'), { code: 503 });
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sourced-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  let j = null; try { j = await r.json(); } catch (_) {}
  const data = j && j.body && typeof j.body === 'object' && 'ok' in j.body ? j.body : j;
  if (!r.ok || !data || data.ok === false) throw Object.assign(new Error('Agents platform: ' + ((data && data.error) || ('HTTP ' + r.status))), { code: 502 });
  return data;
}

async function approve(b) {
  const data = await flow({ action: 'dashboard' });
  const a = (data.approvals || []).find(x => x.id === b.id);
  if (!a) throw Object.assign(new Error('That item no longer exists.'), { code: 404 });
  if (a.Status !== 'Pending') throw Object.assign(new Error(`Already ${String(a.Status || '').toLowerCase()}.`), { code: 409 });
  if (!/Email/.test(a.Type || '')) throw Object.assign(new Error('Only emails can be sent from here for now. Mark it done instead.'), { code: 400 });
  const to = String(a.To || '').trim(), subject = String(b.subject || a.Subject || '').trim(), text = String(b.body || a.Body || '').trim();
  if (!VALID_EMAIL.test(to) || !subject || !text) throw Object.assign(new Error('The email is missing a recipient, subject or message.'), { code: 400 });
  const why = blockedReason(to);
  if (why) { await flow({ action: 'decide', id: a.id, status: 'Rejected', note: why }); throw Object.assign(new Error(why + ' Marked as rejected.'), { code: 409 }); }
  const rec = `outreach/sent/agent-${a.id}.json`;
  const exists = await list({ prefix: rec, limit: 1 });
  if (exists.blobs && exists.blobs.length) { await flow({ action: 'decide', id: a.id, status: 'Sent', note: 'already sent earlier' }); return { already: true }; }
  const from = process.env.NOTIFY_FROM;
  if (!process.env.RESEND_API_KEY || !from) throw Object.assign(new Error('The email sender is not set up in Vercel.'), { code: 503 });
  await put(rec, JSON.stringify({ to, subject, at: new Date().toISOString(), status: 'sending', agent: a.Agent }), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo(), subject, ...finish(text, html) }), signal: AbortSignal.timeout(10000)
  });
  const ok = r.ok, detail = ok ? '' : (await r.text()).slice(0, 300);
  await put(rec, JSON.stringify({ to, subject, at: new Date().toISOString(), status: ok ? 'sent' : 'failed', detail, agent: a.Agent }), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  await flow({ action: 'decide', id: a.id, status: ok ? 'Sent' : 'Failed', note: detail });
  if (!ok) throw Object.assign(new Error('Email failed: ' + detail), { code: 502 });
  return { sent: true, to };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') return res.json(await flow({ action: 'dashboard' }));
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};
    if (b.action === 'approve') return res.json({ ok: true, ...(await approve(b)) });
    if (b.action === 'reject') return res.json(await flow({ action: 'decide', id: b.id, status: 'Rejected' }));
    if (b.action === 'toggle') return res.json(await flow({ action: 'toggle', agent: String(b.agent || ''), enabled: b.enabled === 'On' ? 'On' : 'Off' }));
    if (b.action === 'lead' || b.action === 'task') return res.json(await flow({ action: b.action, id: b.id, status: b.status }));
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(e.code && e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message || 'Something went wrong' });
  }
}
