import { staffUsers, safeEq, makeSession, sessionCookie, cleanUser, readOne, checkPw } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SESSION_SECRET)
    return res.status(500).json({ error: "Staff login isn't set up yet. Add SESSION_SECRET in Vercel." });
  const { username = '', password = '' } = req.body || {};
  const u = cleanUser(username);
  let ok = false, v = 0, owner = false;
  const env = staffUsers()[u];
  if (env !== undefined) { ok = safeEq(password, env); owner = true; }
  else if (u) {
    try {
      const acc = await readOne('staff/', u);
      if (acc && !acc.disabled && checkPw(password, acc.hash)) { ok = true; v = acc.v || 0; owner = acc.role === 'owner'; }
    } catch {}
  }
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return res.status(401).json({ error: 'Wrong username or password' }); }
  res.setHeader('Set-Cookie', sessionCookie(makeSession(u, v), 7 * 86400));
  return res.status(200).json({ ok: true, name: u, owner });
}
