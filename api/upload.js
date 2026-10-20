// Staff-only direct-to-Blob uploads of films and pictures (bypasses the 4.5MB function body limit).
import { handleUpload } from '@vercel/blob/client';
import { getStaff } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await getStaff(req))) throw new Error('Staff login needed');
        return { allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'], maximumSizeInBytes: 300 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(json);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
