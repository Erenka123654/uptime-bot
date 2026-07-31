const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const USER_ID_PATTERN = /^[0-9a-f-]{36}$/i;

function json(data, status = 200) {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

function normalizeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Geçerli bir URL girin.");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Yalnızca http ve https adresleri desteklenir.");
  }

  const host = url.hostname.toLowerCase();
  const blocked = host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' ||
    host === '::1' || host.startsWith('127.') || host.startsWith('10.') ||
    host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '169.254.169.254';
  if (blocked) throw new Error("Yerel veya özel ağ adresleri izlenemez.");

  url.hash = '';
  return url.toString();
}

function getUserId(request) {
  const id = request.headers.get('x-user-id') || '';
  if (!USER_ID_PATTERN.test(id)) throw new Error("Geçersiz kullanıcı kimliği.");
  return id;
}

async function listMonitors(request, env) {
  const userId = getUserId(request);
  const result = await env.DB.prepare(
    `SELECT id, url, status, last_checked_at, last_status_code, consecutive_failures, created_at
     FROM monitors WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(userId).all();
  return json({ monitors: result.results });
}

async function addMonitor(request, env) {
  const userId = getUserId(request);
  const body = await request.json();
  const url = normalizeUrl(body.url);
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO users (user_id, plan, created_at) VALUES (?, ?, ?)')
      .bind(userId, 'free', now),
    env.DB.prepare('INSERT INTO monitors (user_id, url, created_at) VALUES (?, ?, ?)')
      .bind(userId, url, now),
  ]);
  return json({ ok: true }, 201);
}

async function deleteMonitor(request, env, id) {
  const userId = getUserId(request);
  const result = await env.DB.prepare('DELETE FROM monitors WHERE id = ? AND user_id = ?')
    .bind(id, userId).run();
  return json({ ok: result.meta.changes > 0 }, result.meta.changes > 0 ? 200 : 404);
}

async function checkMonitor(env, monitor) {
  const checkedAt = Date.now();
  let status = 'down';
  let statusCode = null;
  try {
    const response = await fetch(monitor.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'uptime-bot/1.0 (+Cloudflare Worker)' },
    });
    statusCode = response.status;
    status = response.status < 500 ? 'up' : 'down';
    await response.body?.cancel();
  } catch (error) {
    console.error(JSON.stringify({ event: 'monitor_check_failed', monitorId: monitor.id, message: String(error) }));
  }

  await env.DB.prepare(
    `UPDATE monitors SET status = ?, last_checked_at = ?, last_status_code = ?,
     consecutive_failures = CASE WHEN ? = 'up' THEN 0 ELSE consecutive_failures + 1 END
     WHERE id = ?`
  ).bind(status, checkedAt, statusCode, status, monitor.id).run();
}

async function runChecks(env) {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const result = await env.DB.prepare(
    `SELECT m.id, m.url FROM monitors m JOIN users u ON u.user_id = m.user_id
     WHERE m.last_checked_at IS NULL OR (u.plan = 'paid' AND m.last_checked_at < ?)
       OR (u.plan != 'paid' AND m.last_checked_at < ?)
     LIMIT 50`
  ).bind(Date.now() - 60 * 1000, fiveMinutesAgo).all();
  await Promise.all(result.results.map((monitor) => checkMonitor(env, monitor)));
}

function page() {
  return new Response(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Uptime Bot</title><style>
:root{font-family:Inter,system-ui,sans-serif;color:#e8edf5;background:#0b1020}body{max-width:920px;margin:0 auto;padding:48px 20px}h1{font-size:42px;margin:0 0 8px}.sub{color:#9aa8bd;margin-bottom:32px}.card{background:#141b2d;border:1px solid #26324b;border-radius:16px;padding:20px;margin-bottom:18px}form{display:flex;gap:10px}input{flex:1;background:#0b1020;border:1px solid #35425d;border-radius:10px;color:#fff;padding:12px}button{border:0;border-radius:10px;padding:11px 16px;background:#5b8cff;color:#fff;font-weight:700;cursor:pointer}.delete{background:#2a344b}.row{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #26324b}.row:last-child{border:0}.dot{width:12px;height:12px;border-radius:50%;background:#7b8495}.up{background:#3ddc97}.down{background:#ff637d}.url{overflow-wrap:anywhere}.meta{font-size:13px;color:#9aa8bd;margin-top:5px}.empty{color:#9aa8bd;text-align:center;padding:25px}.error{color:#ff8da1;margin-top:12px}</style></head>
<body><h1>Uptime Bot</h1><div class="sub">Sitelerinizi Cloudflare ağı üzerinden düzenli olarak kontrol edin.</div>
<section class="card"><form id="form"><input id="url" type="url" required placeholder="https://ornek.com"><button>Ekle</button></form><div id="error" class="error"></div></section>
<section class="card" id="list"><div class="empty">Yükleniyor…</div></section>
<script>
const key='uptime-user-id';let userId=localStorage.getItem(key);if(!userId){userId=crypto.randomUUID();localStorage.setItem(key,userId)}
const headers={'x-user-id':userId};const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){const r=await fetch('/api/monitors',{headers});const d=await r.json();list.innerHTML=d.monitors.length?d.monitors.map(m=>'<div class="row"><span class="dot '+m.status+'"></span><div><div class="url">'+esc(m.url)+'</div><div class="meta">'+esc(m.status.toUpperCase())+(m.last_status_code?' · HTTP '+m.last_status_code:'')+(m.last_checked_at?' · '+new Date(m.last_checked_at).toLocaleString('tr-TR'):' · Henüz kontrol edilmedi')+'</div></div><button class="delete" onclick="removeMonitor('+m.id+')">Sil</button></div>').join(''):'<div class="empty">Henüz izlenen bir adres yok.</div>'}
async function removeMonitor(id){await fetch('/api/monitors/'+id,{method:'DELETE',headers});await load()}
form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';const r=await fetch('/api/monitors',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({url:url.value})});if(!r.ok){const d=await r.json();error.textContent=d.error||'Bir hata oluştu.';return}url.value='';await load()});load();setInterval(load,30000);
</script></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/') return page();
      if (request.method === 'GET' && url.pathname === '/api/monitors') return listMonitors(request, env);
      if (request.method === 'POST' && url.pathname === '/api/monitors') return addMonitor(request, env);
      const match = url.pathname.match(/^\/api\/monitors\/(\d+)$/);
      if (request.method === 'DELETE' && match) return deleteMonitor(request, env, Number(match[1]));
      return json({ error: 'Bulunamadı.' }, 404);
    } catch (error) {
      console.error(JSON.stringify({ event: 'request_failed', message: String(error) }));
      return json({ error: error instanceof Error ? error.message : 'Beklenmeyen hata.' }, 400);
    }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runChecks(env));
  },
};
