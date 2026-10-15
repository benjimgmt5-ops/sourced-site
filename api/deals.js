// Deals automation, run by Vercel Cron (see vercel.json).
//   /api/deals?task=chase       hourly: chases quotes 2 and 5 days after a brief is marked "Quoted" in /admin
//   /api/deals?task=scoreboard  Mondays: emails the weekly scoreboard (once per week, however often it's called)
// Env: RESEND_API_KEY, NOTIFY_FROM, BLOB_READ_WRITE_TOKEN. Settings in api/_config.json.
import { put, list, del } from '@vercel/blob';
import config from './_config.json' with { type: 'json' };

const DAY = 864e5;
const MIN_COMMISSION = 300, WEEK_TARGET = 1000;
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const replyTo = () => (config.outreachReplyTo && config.outreachReplyTo.length ? config.outreachReplyTo : ['sourced.admin@gmail.com']);

async function listAll(prefix) {
  let blobs = [], cursor;
  do { const r = await list({ prefix, limit: 1000, cursor }); blobs = blobs.concat(r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return blobs;
}

async function send(msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM, ...msg }),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const wrap = t => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#000;max-width:560px"><p style="font-size:26px;font-weight:bold;margin:0 0 20px">Sourced.</p>`
  + t.split('\n\n').map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + `</div>`;

async function readEnquiries() {
  const blobs = await listAll('enquiries/');
  const out = await Promise.all(blobs.map(async b => {
    try { const r = await fetch(b.url, { cache: 'no-store' }); return { url: b.url, pathname: b.pathname, ...(await r.json()) }; } catch (_) { return null; }
  }));
  return out.filter(Boolean);
}

async function rewrite(e) {
  const { url, pathname, ...data } = e;
  const path = pathname.replace(/-[A-Za-z0-9]{20,}\.json$/, '.json');
  await put(path, JSON.stringify(data), { access: 'public', contentType: 'application/json', addRandomSuffix: true });
  await del(url);
}

async function chase() {
  const now = Date.now(), sent = [];
  for (const e of await readEnquiries()) {
    if (e.status !== 'quoted' || !e.quotedAt || !e.email || !VALID_EMAIL.test(e.email)) continue;
    const age = now - new Date(e.quotedAt).getTime();
    const first = (e.name || '').trim().split(/\s+/)[0];
    const hi = `Hi${first ? ' ' + first : ''},`;
    let step = null, text = '';
    if (!e.chased && age >= 2 * DAY) {
      step = 'chase 1';
      text = `${hi}\n\nJust checking you got the quote I sent over for your shoot${e.date ? ' on ' + e.date : ''}. Happy to adjust anything, swap options or talk it through on a quick call.\n\nIf you're ready to go ahead, just reply and I'll lock everything in.\n\nBenji\nSourced.\n07590 474421`;
    } else if (e.chased === 'chase 1' && age >= 5 * DAY) {
      step = 'chase 2';
      text = `${hi}\n\nFollowing up one last time on your quote. Availability on houses, cars and transport moves quickly, so if you'd like me to hold anything, let me know and I'll reserve it.\n\nIf plans have changed, no problem at all. Just reply and I'll close it off.\n\nBenji\nSourced.\n07590 474421`;
    }
    if (!step) continue;
    try {
      await send({ to: [e.email], reply_to: replyTo(), subject: 'Your Sourced. quote', text, html: wrap(text) });
      e.chased = step; e.chasedAt = new Date().toISOString();
      await rewrite(e);
      sent.push({ to: e.email, step });
    } catch (err) { sent.push({ to: e.email, step, error: err.message }); }
  }
  return { chased: sent };
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - n + 3);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return t.getUTCFullYear() + '-W' + String(1 + Math.round(((t - y) / DAY - 3 + ((y.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0');
}

async function scoreboard(force) {
  const now = new Date(), wk = isoWeek(now);
  const marker = `scoreboard/${wk}.json`;
  if (!force && (await list({ prefix: marker, limit: 1 })).blobs.length) return { skipped: 'already sent this week' };
  const since = now.getTime() - 7 * DAY;
  const inWeek = t => t && new Date(t).getTime() >= since;

  const sentBlobs = await listAll('outreach/sent/');
  const recent = sentBlobs.filter(b => new Date(b.uploadedAt).getTime() >= since);
  const newEmails = recent.filter(b => !/-f[12]\.json$/.test(b.pathname) && !/\/test-/.test(b.pathname)).length;
  const followups = recent.filter(b => /-f[12]\.json$/.test(b.pathname)).length;

  const all = await readEnquiries();
  const briefs = all.filter(e => !/^partner/i.test(e.source || ''));
  const partners = all.filter(e => /^partner/i.test(e.source || '') && inWeek(e.at)).length;
  const newBriefs = briefs.filter(e => inWeek(e.at)).length;
  const quoted = briefs.filter(e => inWeek(e.quotedAt)).length;
  const won = briefs.filter(e => (e.status === 'won' || e.status === 'done') && inWeek(e.wonAt));
  const lost = briefs.filter(e => e.status === 'lost' && inWeek(e.lostAt)).length;
  const commission = won.reduce((a, e) => a + (e.commission || 0), 0);
  const value = won.reduce((a, e) => a + (e.value || 0), 0);
  const openQuotes = briefs.filter(e => e.status === 'quoted');
  const openComm = openQuotes.reduce((a, e) => a + (e.commission || 0), 0);
  const lowJobs = won.filter(e => e.commission != null && e.commission < MIN_COMMISSION).length;
  const jobsNeeded = Math.ceil(WEEK_TARGET / MIN_COMMISSION);
  const untouched = briefs.filter(e => (e.status || 'new') === 'new' && new Date(e.at).getTime() < now.getTime() - DAY).length;

  let fix;
  if (commission >= WEEK_TARGET) fix = 'Target hit. Keep the same pace and push for bigger jobs (multi-car, multi-day, transport plus security).';
  else if (untouched) fix = `${untouched} brief${untouched > 1 ? 's have' : ' has'} been sitting as "New" for over a day. Quote these first; speed wins jobs.`;
  else if (newBriefs === 0) fix = 'No briefs this week. The outreach is going out; the fastest win is calling the people who replied and asking what they have coming up.';
  else if (quoted < newBriefs) fix = 'Some briefs haven\'t been quoted. Aim to quote every brief within 24 hours.';
  else if (won.length === 0 && quoted) fix = 'Quotes are going out but not closing. Call each open quote, and check your prices against what producers expect.';
  else fix = `You need ${Math.max(0, jobsNeeded - won.length)} more job${jobsNeeded - won.length === 1 ? '' : 's'} at £${MIN_COMMISSION}+ to hit £${WEEK_TARGET}. Chase the open quotes by phone.`;

  const rows = [
    ['Commission won', `£${commission.toLocaleString('en-GB')} of £${WEEK_TARGET.toLocaleString('en-GB')} target`],
    ['Jobs won', `${won.length} (need ${jobsNeeded} at £${MIN_COMMISSION}+)`],
    ['Job value won', `£${value.toLocaleString('en-GB')}`],
    ['New briefs', newBriefs], ['Quotes sent', quoted], ['Lost', lost],
    ['Open quotes', `${openQuotes.length} (worth £${openComm.toLocaleString('en-GB')} commission)`],
    ['Outreach emails sent', newEmails], ['Follow-ups sent', followups], ['New partner sign-ups', partners]
  ];
  if (lowJobs) rows.splice(2, 0, ['Below £300 minimum', `${lowJobs} job${lowJobs > 1 ? 's' : ''}`]);
  const subject = `Sourced. week: £${commission.toLocaleString('en-GB')} of £${WEEK_TARGET.toLocaleString('en-GB')} · ${won.length} won · ${newBriefs} briefs`;
  const text = `Your Sourced. scoreboard for the last 7 days\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nWhat to do this week: ${fix}\n\nOpen your deals: https://www.wearesourced.co.uk/admin`;
  const pct = Math.min(100, Math.round(commission / WEEK_TARGET * 100));
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#000;max-width:560px"><p style="font-size:26px;font-weight:bold;margin:0 0 6px">Sourced.</p><p style="margin:0 0 16px;color:#666">Scoreboard for the last 7 days</p>`
    + `<div style="background:#eee;height:10px;margin:0 0 16px"><div style="background:#1f7a3f;height:10px;width:${pct}%"></div></div>`
    + `<table cellpadding="6" style="border-collapse:collapse">` + rows.map(([k, v]) => `<tr><td style="color:#666">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('') + `</table>`
    + `<p style="margin-top:16px"><b>What to do this week:</b> ${esc(fix)}</p><p><a href="https://www.wearesourced.co.uk/admin" style="color:#000">Open your deals</a></p></div>`;
  const to = [...new Set([config.leadCopy, 'sourced.admin@gmail.com'].filter(Boolean))];
  await send({ to, subject, text, html });
  await put(marker, JSON.stringify({ at: now.toISOString(), commission, won: won.length }), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return { sent: subject };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_FROM || /resend\.dev/i.test(process.env.NOTIFY_FROM) || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, reason: 'Not configured' });
  }
  try {
    const task = (req.query && req.query.task) || new URL(req.url, 'http://x').searchParams.get('task');
    if (task === 'chase') return res.json({ ok: true, ...(await chase()) });
    if (task === 'scoreboard') return res.json({ ok: true, ...(await scoreboard(false)) });
    res.status(400).json({ error: 'Unknown task' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
