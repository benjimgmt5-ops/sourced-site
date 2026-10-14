import { put, list, del, requireAdmin, storageReady, readJSON } from './_lib.js';

const FIELDS = ['name', 'company', 'email', 'phone', 'date', 'location', 'categories', 'items', 'details', 'budget', 'transcript', 'source', 'summary'];

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
