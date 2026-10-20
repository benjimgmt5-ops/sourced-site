// Chloe's live voice: ElevenLabs text-to-speech with the "Charlotte" British female voice.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(501).json({ error: 'Voice is not configured' });
  const text = String((req.body || {}).text || '').trim().slice(0, 400);
  if (!text) return res.status(400).json({ error: 'No text' });
  const voice = process.env.ELEVENLABS_VOICE_ID || 'I7QBbqvBcOGnmbD4D98p';
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5' }),
    });
    if (!r.ok) { console.error('ElevenLabs', r.status, await r.text()); return res.status(502).json({ error: 'Voice unavailable' }); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Voice unavailable' });
  }
}
