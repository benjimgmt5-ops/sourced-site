// Chloe's brain: turns what a client types into brief fields + a short reply, using Claude.
const TYPES = ['Animation', 'Hyper-realism', 'Corporate', 'Branded content', 'Music / entertainment', 'VFX / post-production', 'Other / bespoke'];
const KEYS = ['name', 'company', 'email', 'phone', 'type', 'budget', 'deadline', 'deliverables', 'brief', 'references'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'Chloe AI is not configured' });
  const b = req.body || {};
  const transcript = (Array.isArray(b.transcript) ? b.transcript : []).slice(-12).map((t) => String(t).slice(0, 1500));
  if (!transcript.length) return res.status(400).json({ error: 'Nothing to read' });
  const form = Object.fromEntries(KEYS.map((k) => [k, String((b.form || {})[k] || '').slice(0, 1500)]));
  const prompt = `You are Chloe, the friendly British creative assistant for MYL (Made You Look), a London AI creative studio making AI films, hyper-real campaigns, animation, branded content, music visuals and VFX.
A potential client is describing a project. Everything they have said so far, in order:
${transcript.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Current form values (may be empty): ${JSON.stringify(form)}

Return ONLY JSON: {"fields":{"name":"","company":"","email":"","phone":"","type":"","budget":"","deadline":"","deliverables":"","brief":"","references":""},"reply":""}
Rules: fill only fields the client actually stated; leave others "". "type" must be one of: ${TYPES.join(', ')}. "brief" is a clear 2-4 sentence write-up of the project in third person. "reply" is 1-2 short warm sentences in British English that confirm what you captured and ask for the single most useful missing detail (budget, deadline, deliverables, or contact email). No emoji.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.CHLOE_MODEL || 'claude-haiku-5-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) { console.error('Anthropic', r.status, await r.text()); return res.status(502).json({ error: 'Chloe is unavailable' }); }
    const j = await r.json();
    const text = (j.content || []).map((c) => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    const out = JSON.parse(m ? m[0] : '{}');
    return res.status(200).json({ fields: out.fields || {}, reply: String(out.reply || '').slice(0, 400) });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Chloe is unavailable' });
  }
}
