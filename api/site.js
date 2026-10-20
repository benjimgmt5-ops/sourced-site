// GET: public site content (text edits, film list, ticker). PUT: staff publish.
import { getStaff, readOne, writeOne } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return res.status(200).json({ content: await readOne('site/', 'content') });
    if (req.method === 'PUT') {
      const staff = await getStaff(req);
      if (!staff) return res.status(401).json({ error: 'Staff login needed' });
      const b = req.body || {};
      const body = { text: b.text || {}, work: b.work || {}, extra: Array.isArray(b.extra) ? b.extra.slice(0, 60) : [],
        ticker: Array.isArray(b.ticker) ? b.ticker.slice(0, 24).map((x) => String(x).slice(0, 40)) : [],
        updatedAt: Date.now(), updatedBy: staff };
      if (JSON.stringify(body).length > 300000) return res.status(413).json({ error: 'Too much content' });
      await writeOne('site/', 'content', body);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
