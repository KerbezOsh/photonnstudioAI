// Vercel Serverless Function (CommonJS for maximum compatibility)
module.exports = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    // Preflight (usually not needed for same-origin, but harmless)
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'POST, GET, OPTIONS');
      return res.status(200).json({ ok: true });
    }

    // Health-check (helps to debug if route is wired correctly)
    if (req.method === 'GET') {
      res.setHeader('Allow', 'POST, GET, OPTIONS');
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, GET, OPTIONS');
      return res.status(405).json({ error: { message: 'Method not allowed' } });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: {
          message:
            'Server is not configured. Set OPENROUTER_API_KEY environment variable in Vercel project settings.'
        }
      });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};

    const model = (typeof body.model === 'string' && body.model.trim()) ? body.model.trim() : 'xiaomi/mimo-v2-flash:free';
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const temperature = Number.isFinite(body.temperature) ? body.temperature : 0.35;
    const top_p = Number.isFinite(body.top_p) ? body.top_p : 0.9;
    const max_tokens = Number.isFinite(body.max_tokens) ? body.max_tokens : 900;

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const siteUrl = host ? `${proto}://${host}` : '';

    const upstreamRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': 'photonn AI'
      },
      body: JSON.stringify({ model, messages, temperature, top_p, max_tokens })
    });

    const rawText = await upstreamRes.text().catch(() => '');
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      const snippet = String(rawText || '').trim();
      data = {
        error: {
          message: snippet ? snippet.slice(0, 800) : `Upstream returned non-JSON. HTTP ${upstreamRes.status}`
        }
      };
    }

    return res.status(upstreamRes.status).json(data);
  } catch (e) {
    const msg = (e && e.message) ? String(e.message) : 'Unknown server error';
    return res.status(500).json({ error: { message: msg } });
  }
};
