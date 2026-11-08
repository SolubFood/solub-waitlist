// SolubFood community wall API (Cloudflare Worker + KV).
// GET  /marks                      → approved marks, oldest first (what everyone sees)
// POST /marks  {id, name, img}     → saves a new mark as pending (1 per visitor per day)
// GET  /admin                      → login form (password = ADMIN_KEY), then review page
// POST /admin/login                → checks the password, sets a short-lived session cookie
// POST /admin/approve|reject       → form field id=…  (requires session cookie)
// POST /admin/logout               → ends the session
// The admin password is never placed in a URL (URLs end up in browser history and logs).
// Marks are never deleted once approved; only pending marks can be rejected.

const ALLOWED_ORIGINS = ['https://solubfood.com', 'https://www.solubfood.com'];
const MAX_IMG_CHARS = 120000; // a 160×160 PNG drawing is usually far below this
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+\/]+={0,2}$/; // strict: blocks HTML injection via img
const SESSION_HOURS = 8;
const MAX_LOGIN_ATTEMPTS = 5; // per IP per hour

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

const ADMIN_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"
};
const STYLE = '<style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;padding:16px}.m{display:flex;gap:12px;align-items:center;margin:10px 0;padding:10px;background:#1b2229;border-radius:10px}img{width:96px;height:96px;background:#000}button,input{padding:8px 14px;border-radius:8px;border:0;font:inherit}button{cursor:pointer}</style>';

function esc(t) { return String(t).replace(/[<>&"']/g, (c) => '&#' + c.charCodeAt(0) + ';'); }

function html(body, status, extraHeaders) {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Community wall review</title>' + STYLE + body,
    { status: status || 200, headers: Object.assign({}, ADMIN_HEADERS, extraHeaders || {}) });
}

function loginPage(msg) {
  return '<h1>Admin</h1>' + (msg ? '<p>' + esc(msg) + '</p>' : '') +
    '<form method="post" action="/admin/login"><input type="password" name="key" autocomplete="current-password" required placeholder="Password"> <button>Enter</button></form>';
}

function adminPage(pending) {
  const rows = pending.map((m) => `
    <div class="m"><img src="${PNG_DATA_URL.test(m.img) ? m.img : ''}" alt=""><div>${esc(m.name || '—')}<br><small>${new Date(m.createdAt).toISOString()}</small></div>
    <form method="post" action="/admin/approve"><input type="hidden" name="id" value="${esc(m.id)}"><button>Approve</button></form>
    <form method="post" action="/admin/reject"><input type="hidden" name="id" value="${esc(m.id)}"><button>Reject</button></form></div>`).join('');
  return `<h1>Pending marks: ${pending.length}</h1>${rows || '<p>Nothing to review.</p>'}
  <form method="post" action="/admin/logout"><button>Log out</button></form>`;
}

// Constant-time comparison (avoids leaking the password through response timing).
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : '';
}

async function hasSession(request, env) {
  const token = getCookie(request, 'wall_admin');
  if (!/^[a-f0-9-]{36}$/.test(token)) return false;
  return Boolean(await env.WALL.get('session:' + token));
}

async function handleAdmin(request, env, url) {
  if (!env.ADMIN_KEY) return new Response('Not found', { status: 404 });
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (url.pathname === '/admin/login' && request.method === 'POST') {
    const hour = new Date().toISOString().slice(0, 13);
    const attemptsKey = 'login:' + hour + ':' + (await sha256(ip + env.ADMIN_KEY));
    const attempts = Number(await env.WALL.get(attemptsKey)) || 0;
    if (attempts >= MAX_LOGIN_ATTEMPTS) return html(loginPage('Too many attempts. Try again later.'), 429);
    const form = await request.formData();
    if (!(await safeEqual(form.get('key') || '', env.ADMIN_KEY))) {
      await env.WALL.put(attemptsKey, String(attempts + 1), { expirationTtl: 60 * 70 });
      return html(loginPage('Wrong password.'), 401);
    }
    const token = crypto.randomUUID();
    await env.WALL.put('session:' + token, '1', { expirationTtl: SESSION_HOURS * 3600 });
    return new Response(null, { status: 303, headers: {
      'Location': '/admin',
      'Set-Cookie': `wall_admin=${token}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`,
      'Cache-Control': 'no-store'
    } });
  }

  if (!(await hasSession(request, env))) return html(loginPage(''), 200);

  if (url.pathname === '/admin/logout' && request.method === 'POST') {
    await env.WALL.delete('session:' + getCookie(request, 'wall_admin'));
    return new Response(null, { status: 303, headers: {
      'Location': '/admin', 'Set-Cookie': 'wall_admin=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0' } });
  }

  if ((url.pathname === '/admin/approve' || url.pathname === '/admin/reject') && request.method === 'POST') {
    const form = await request.formData();
    const id = String(form.get('id') || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
    if (url.pathname === '/admin/approve') {
      const mark = await env.WALL.get('pending:' + id, 'json');
      if (mark) {
        mark.status = 'approved';
        await env.WALL.put('approved:' + String(mark.createdAt).padStart(15, '0') + ':' + id, JSON.stringify(mark));
        await env.WALL.delete('pending:' + id);
      }
    } else {
      await env.WALL.delete('pending:' + id);
    }
    return new Response(null, { status: 303, headers: { 'Location': '/admin', 'Cache-Control': 'no-store' } });
  }

  const pending = await listByPrefix(env, 'pending:');
  return html(adminPage(pending), 200);
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
      if (img.length > MAX_IMG_CHARS || !PNG_DATA_URL.test(img)) return json({ error: 'bad image' }, 400, request);
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

    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return handleAdmin(request, env, url);

    return new Response('Not found', { status: 404 });
  }
};
