// SolubFood community wall API (Cloudflare Worker + KV).
// GET  /marks                      → approved marks, oldest first (what everyone sees)
// POST /marks  {id, name, img}     → saves a new mark as pending (1 per visitor per day)
// GET  /admin?key=ADMIN_KEY        → review page: approve or reject pending marks
// POST /admin/approve|reject?key=ADMIN_KEY&id=…
// Marks are never deleted once approved; only pending marks can be rejected.

const ALLOWED_ORIGINS = ['https://solubfood.com', 'https://www.solubfood.com'];
const MAX_IMG_CHARS = 120000; // a 160×160 PNG drawing is usually far below this

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors(request))
  });
}

async function listByPrefix(env, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await env.WALL.list({ prefix, cursor });
    for (const k of page.keys) {
      const value = await env.WALL.get(k.name, 'json');
      if (value) out.push(value);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function adminPage(pending, key) {
  const rows = pending.map((m) => `
    <div class="m"><img src="${m.img}" alt=""><div>${(m.name || '—').replace(/[<>&"]/g, '')}<br><small>${new Date(m.createdAt).toISOString()}</small></div>
    <form method="post" action="/admin/approve?key=${encodeURIComponent(key)}&id=${m.id}"><button>Approve</button></form>
    <form method="post" action="/admin/reject?key=${encodeURIComponent(key)}&id=${m.id}"><button>Reject</button></form></div>`).join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Community wall review</title>
  <style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;padding:16px}.m{display:flex;gap:12px;align-items:center;margin:10px 0;padding:10px;background:#1b2229;border-radius:10px}img{width:96px;height:96px;background:#000}button{padding:8px 14px;border-radius:8px;border:0;cursor:pointer}</style>
  <h1>Pending marks: ${pending.length}</h1>${rows || '<p>Nothing to review.</p>'}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) });

    if (url.pathname === '/marks' && request.method === 'GET') {
      const marks = await listByPrefix(env, 'approved:');
      return json(marks.map(({ id, name, img, createdAt }) => ({ id, name, img, createdAt })), 200, request);
    }

    if (url.pathname === '/marks' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (err) { return json({ error: 'bad json' }, 400, request); }
      const img = String(body.img || '');
      if (!img.startsWith('data:image/png;base64,') || img.length > MAX_IMG_CHARS) return json({ error: 'bad image' }, 400, request);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const day = new Date().toISOString().slice(0, 10);
      const limitKey = 'limit:' + day + ':' + (await sha256(ip + env.ADMIN_KEY));
      if (await env.WALL.get(limitKey)) return json({ error: 'one mark per day' }, 429, request);
      const id = String(body.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
      const mark = { id, name: String(body.name || '').slice(0, 24), img, createdAt: Date.now(), status: 'pending' };
      await env.WALL.put('pending:' + id, JSON.stringify(mark));
      await env.WALL.put(limitKey, '1', { expirationTtl: 60 * 60 * 26 });
      return json({ status: 'pending' }, 201, request);
    }

    if (url.pathname.startsWith('/admin')) {
      const key = url.searchParams.get('key') || '';
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return new Response('Not found', { status: 404 });
      const id = url.searchParams.get('id') || '';
      if (url.pathname === '/admin/approve' && request.method === 'POST') {
        const mark = await env.WALL.get('pending:' + id, 'json');
        if (mark) {
          mark.status = 'approved';
          await env.WALL.put('approved:' + String(mark.createdAt).padStart(15, '0') + ':' + id, JSON.stringify(mark));
          await env.WALL.delete('pending:' + id);
        }
      } else if (url.pathname === '/admin/reject' && request.method === 'POST') {
        await env.WALL.delete('pending:' + id);
      }
      const pending = await listByPrefix(env, 'pending:');
      return new Response(adminPage(pending, key), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  }
};
