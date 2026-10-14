import { checkPassword, passwordSet, sessionCookie, clearCookie, isAdmin, storageReady } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.json({ loggedIn: isAdmin(req), passwordSet: passwordSet(), storage: storageReady() });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    return res.json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!passwordSet()) return res.status(503).json({ error: 'The admin password has not been set up in Vercel yet.' });
  const pw = req.body && req.body.password;
  if (!checkPassword(pw)) {
    await new Promise(r => setTimeout(r, 800));
    return res.status(401).json({ error: 'Wrong password.' });
  }
  res.setHeader('Set-Cookie', sessionCookie());
  res.json({ ok: true });
}
