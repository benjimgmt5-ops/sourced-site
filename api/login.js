import { staffUsers, safeEq, makeSession, sessionCookie } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SESSION_SECRET || !process.env.STAFF_USERS)
    return res.status(500).json({ error: "Staff login isn't set up yet. Add STAFF_USERS and SESSION_SECRET in Vercel." });
  const { username = '', password = '' } = req.body || {};
  const u = String(username).trim().toLowerCase();
  const expected = staffUsers()[u];
  const ok = expected !== undefined && safeEq(password, expected);
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return res.status(401).json({ error: 'Wrong username or password' }); }
  res.setHeader('Set-Cookie', sessionCookie(makeSession(u), 7 * 86400));
  return res.status(200).json({ ok: true, name: u });
}
