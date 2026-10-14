import { handleUpload } from '@vercel/blob/client';
import { isAdmin } from './_lib.js';

// Browser uploads go straight to Vercel Blob, so big videos are fine.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!isAdmin(req)) throw new Error('Please log in again.');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/quicktime', 'video/webm'],
          maximumSizeInBytes: 1024 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {}
    });
    res.json(json);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
