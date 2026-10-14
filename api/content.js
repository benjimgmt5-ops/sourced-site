import { latestContent, saveContent, requireAdmin, storageReady, readJSON } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      // ?versions=1 lists saved versions for undo (admin only)
      if (req.query.versions) {
        if (!requireAdmin(req, res)) return;
        const c = await latestContent();
        return res.json({ versions: c ? c.all.map(b => ({ url: b.url, at: b.uploadedAt })) : [] });
      }
      const c = await latestContent();
      return res.json(c ? c.data : {});
    }
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      if (!storageReady()) return res.status(503).json({ error: 'Storage is not connected yet.' });
      let body = req.body || {};
      if (body.restore) body = await readJSON(body.restore); // undo to an earlier version
      const clean = {
        text: obj(body.text), images: obj(body.images),
        reels: Array.isArray(body.reels) ? body.reels.slice(0, 200) : null,
        listings: {
          added: arr(body.listings && body.listings.added),
          edits: obj(body.listings && body.listings.edits),
          hidden: arr(body.listings && body.listings.hidden)
        }
      };
      const saved = await saveContent(clean);
      return res.json({ ok: true, updatedAt: saved.updatedAt });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function obj(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
function arr(x) { return Array.isArray(x) ? x : []; }
