// Team accounts. GET list (owners), POST add (owners), PATCH change password (self, or owners for anyone), DELETE remove (owners).
import { getStaffInfo, staffUsers, cleanUser, hashPw, readAll, readOne, writeOne, deleteOne } from './_lib.js';

export default async function handler(req, res) {
  const me = await getStaffInfo(req);
  if (!me) return res.status(401).json({ error: 'Staff login needed' });
  const env = staffUsers();
  try {
    if (req.method === 'GET') {
      if (!me.owner) return res.status(403).json({ error: 'Only owners can manage the team' });
      const accs = (await readAll('staff/')).map((a) => ({ name: a.id, role: a.role || 'staff', createdAt: a.createdAt || 0, addedBy: a.addedBy || '' }));
      const owners = Object.keys(env).map((n) => ({ name: n, role: 'owner', fixed: true }));
      return res.status(200).json({ staff: [...owners, ...accs.filter((a) => !env[a.name])] });
    }
    const b = req.body || {};
    if (req.method === 'POST') {
      if (!me.owner) return res.status(403).json({ error: 'Only owners can add staff' });
      const u = cleanUser(b.username);
      if (u.length < 2) return res.status(400).json({ error: 'Username needs 2+ letters or numbers' });
      if (String(b.password || '').length < 8) return res.status(400).json({ error: 'Password needs at least 8 characters' });
      if (env[u] !== undefined || (await readOne('staff/', u))) return res.status(409).json({ error: 'That username is taken' });
      await writeOne('staff/', u, { hash: hashPw(b.password), role: b.role === 'owner' ? 'owner' : 'staff', v: 0, createdAt: Date.now(), addedBy: me.name });
      return res.status(201).json({ ok: true });
    }
    const u = cleanUser(req.query.u || b.username);
    if (!u) return res.status(400).json({ error: 'Missing username' });
    if (env[u] !== undefined) return res.status(400).json({ error: 'This owner login is set in Vercel (STAFF_USERS) and can only be changed there' });
    const acc = await readOne('staff/', u);
    if (!acc) return res.status(404).json({ error: 'No such staff member' });
    if (req.method === 'PATCH') {
      if (!me.owner && me.name !== u) return res.status(403).json({ error: 'You can only change your own password' });
      if (String(b.password || '').length < 8) return res.status(400).json({ error: 'Password needs at least 8 characters' });
      const next = { ...acc, hash: hashPw(b.password), v: (acc.v || 0) + 1 };
      if (me.owner && b.role) next.role = b.role === 'owner' ? 'owner' : 'staff';
      await writeOne('staff/', u, next);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (!me.owner) return res.status(403).json({ error: 'Only owners can remove staff' });
      if (u === me.name) return res.status(400).json({ error: "You can't remove yourself" });
      await deleteOne('staff/', u);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
}
