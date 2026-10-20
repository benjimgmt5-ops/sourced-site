// Public status check: shows which services are switched on (true/false only, never the keys).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    staffLogin: !!process.env.SESSION_SECRET,
    storage: !!process.env.BLOB_READ_WRITE_TOKEN,
    voice: !!process.env.ELEVENLABS_API_KEY,
    smartReplies: !!process.env.ANTHROPIC_API_KEY,
    email: !!(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM),
    time: new Date().toISOString(),
  });
}
