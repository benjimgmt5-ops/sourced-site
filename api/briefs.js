// POST: anyone sends a brief. GET/PATCH/DELETE and manual POST extras: staff only.
import crypto from 'node:crypto';
import { getStaff, readAll, readOne, writeOne, deleteOne, clip } from './_lib.js';

const FIELDS = ['name', 'company', 'email', 'phone', 'type', 'budget', 'deadline', 'deliverables', 'brief', 'references'];
const STAFF_FIELDS = ['status', 'quote', 'notes', 'source'];
const STATUSES = ['new', 'review', 'quoted', 'won', 'lost'];
const clean = (k, v) => (k === 'quote' ? Math.max(0, +String(v).replace(/[^0-9.]/g, '') || 0)
  : k === 'status' ? (STATUSES.includes(v) ? v : 'new') : clip(v, k === 'brief' || k === 'notes' ? 8000 : 500));

export default async function handler(req, res) {
  const staff = getStaff(req);
  try {
    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden field
      if (!staff && (!String(b.name || '').trim() || !/\S+@\S+\.\S+/.test(b.email || '')))
        return res.status(400).json({ error: 'Add your name and a valid email so we can send your proposal.' });
      const now = Date.now();
      const rec = { status: 'new', quote: 0, notes: '', source: b.source === 'Chloe' ? 'Chloe' : 'Form', createdAt: now, updatedAt: now };
      for (const k of FIELDS) rec[k] = clean(k, b[k]);
      if (staff) { for (const k of STAFF_FIELDS) if (b[k] != null) rec[k] = clean(k, b[k]); rec.source = clip(b.source || 'Manual', 40); rec.addedBy = staff; }
      const id = now.toString(36) + crypto.randomBytes(4).toString('hex');
      await writeOne('briefs/', id, rec);
      return res.status(201).json({ ok: true, id });
    }
    if (!staff) return res.status(401).json({ error: 'Staff login needed' });
    if (req.method === 'GET') return res.status(200).json({ briefs: await readAll('briefs/') });
    const id = String(req.query.id || '').replace(/[^a-z0-9]/gi, '');
    if (!id) return res.status(400).json({ error: 'Missing brief id' });
    if (req.method === 'PATCH') {
      const cur = await readOne('briefs/', id);
      if (!cur) return res.status(404).json({ error: 'Brief not found' });
      const b = req.body || {}, next = { ...cur };
      for (const k of [...FIELDS, ...STAFF_FIELDS]) if (b[k] != null) next[k] = clean(k, b[k]);
      next.updatedAt = Date.now(); next.updatedBy = staff;
      await writeOne('briefs/', id, next);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') { await deleteOne('briefs/', id); return res.status(200).json({ ok: true }); }
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
