// Сервер без внешних зависимостей: статика + REST API + хранение в JSON-файле.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC = path.join(__dirname, 'public');
const COLLECTIONS = ['admins', 'foremen', 'workers', 'sites', 'shifts', 'tasks'];

const uid = () => crypto.randomBytes(5).toString('hex');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- демо-данные ----------
function seed() {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const db = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));

  db.admins = [
    { id: 'a1', name: 'Анна Соколова', phone: '+7 900 111-22-33' },
    { id: 'a2', name: 'Игорь Власов', phone: '+7 900 444-55-66' },
  ];
  const foremanNames = ['Сергей Петров', 'Руслан Алиев', 'Дмитрий Кузнецов', 'Олег Назаров', 'Виктор Лебедев'];
  db.foremen = foremanNames.map((name, i) => ({ id: 'f' + (i + 1), name, phone: `+7 901 ${100 + i}-00-${10 + i}` }));

  const first = ['Алексей', 'Иван', 'Максим', 'Артём', 'Николай', 'Павел', 'Андрей', 'Роман', 'Евгений', 'Денис', 'Кирилл', 'Антон', 'Юрий', 'Тимур', 'Борис'];
  const last = ['Смирнов', 'Попов', 'Васильев', 'Морозов', 'Волков', 'Зайцев', 'Орлов', 'Макаров', 'Ковалёв', 'Ильин', 'Гусев', 'Титов', 'Белов', 'Комаров', 'Фролов'];
  const roles = ['Разнорабочий', 'Разнорабочий', 'Разнорабочий', 'Монтажник', 'Монтажник', 'Сварщик', 'Стропальщик'];
  for (let i = 0; i < 42; i++) {
    const role = pick(roles);
    const r = rnd();
    db.workers.push({
      id: 'w' + (i + 1),
      name: `${pick(last)} ${pick(first)}`,
      phone: `+7 9${Math.floor(10 + rnd() * 89)} ${Math.floor(100 + rnd() * 899)}-${Math.floor(10 + rnd() * 89)}-${Math.floor(10 + rnd() * 89)}`,
      role,
      foremanId: db.foremen[i % db.foremen.length].id,
      status: r < 0.74 ? 'active' : r < 0.9 ? 'inactive' : 'unreliable',
      rate: role === 'Разнорабочий' ? 300 + 50 * Math.floor(rnd() * 3) : role === 'Монтажник' ? 450 + 50 * Math.floor(rnd() * 3) : 550,
      note: '',
    });
  }

  const today = new Date();
  const off = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  db.sites = [
    { id: 's1', name: 'ПМЭФ — выставочная зона', client: 'Росконгресс', address: 'Санкт-Петербург, Экспофорум', lat: 59.7, lng: 30.32, status: 'active', start: off(-40), end: off(20), billRate: 650 },
    { id: 's2', name: 'ЖК «Северный парк»', client: 'СтройИнвест', address: 'Москва, Ходынская ул.', lat: 55.79, lng: 37.53, status: 'active', start: off(-60), end: off(90), billRate: 600 },
    { id: 's3', name: 'Склад «Логопарк»', client: 'ЛогоГрупп', address: 'Подольск, Московская обл.', lat: 55.43, lng: 37.55, status: 'active', start: off(-25), end: off(10), billRate: 560 },
    { id: 's4', name: 'Форум «Россия»', client: 'Эвент-Холл', address: 'Москва, ВДНХ', lat: 55.83, lng: 37.63, status: 'planned', start: off(15), end: off(25), billRate: 700 },
    { id: 's5', name: 'Сочи — Курортный отель', client: 'Юг-Девелопмент', address: 'Сочи, Курортный пр.', lat: 43.58, lng: 39.72, status: 'planned', start: off(30), end: off(120), billRate: 620 },
    { id: 's6', name: 'Казань — Спорткомплекс', client: 'ТатСтрой', address: 'Казань, ул. Спортивная', lat: 55.8, lng: 49.1, status: 'closed', start: off(-120), end: off(-45), billRate: 580 },
  ];

  const shiftSites = db.sites.filter((x) => x.status !== 'planned');
  for (let d = -45; d <= 0; d++) {
    const date = new Date(today); date.setDate(date.getDate() + d);
    const dayIso = iso(date);
    for (const site of shiftSites) {
      if (dayIso < site.start || dayIso > site.end) continue;
      const lead = db.foremen[(Number(site.id.slice(1)) - 1) % db.foremen.length].id;
      const crew = db.workers.filter((w) => w.status !== 'inactive' && (w.foremanId === lead || (w.status === 'active' && rnd() < 0.18)));
      for (const w of crew) {
        if (rnd() < 0.3) continue;
        // один рабочий — одна смена в день
        if (db.shifts.some((x) => x.workerId === w.id && x.date === dayIso)) continue;
        db.shifts.push({ id: uid(), date: dayIso, siteId: site.id, workerId: w.id, hours: pick([8, 10, 10, 12, 12]), rate: w.rate, billRate: site.billRate });
      }
    }
  }

  db.tasks = [
    { id: uid(), title: 'Набрать 15 монтажников на ПМЭФ', description: 'Нужны допуски на высоту', status: 'doing', assignee: 'foreman:f1', siteId: 's1', due: off(3), priority: 'high' },
    { id: uid(), title: 'Согласовать смету с «Эвент-Холл»', description: '', status: 'todo', assignee: 'admin:a1', siteId: 's4', due: off(5), priority: 'medium' },
    { id: uid(), title: 'Проверить пропуска на ВДНХ', description: '', status: 'todo', assignee: 'foreman:f2', siteId: 's4', due: off(10), priority: 'medium' },
    { id: uid(), title: 'Подписать акты за месяц', description: 'Склад «Логопарк»', status: 'review', assignee: 'admin:a2', siteId: 's3', due: off(1), priority: 'high' },
    { id: uid(), title: 'Выдать СИЗ новой бригаде', description: '', status: 'done', assignee: 'foreman:f3', siteId: 's2', due: off(-2), priority: 'low' },
  ];
  return db;
}

// ---------- хранилище ----------
let db;
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    for (const c of COLLECTIONS) db[c] = db[c] || [];
  } else {
    db = seed();
    save();
  }
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

// Целостность при удалении
function cascade(col, id) {
  if (col === 'sites') {
    db.shifts = db.shifts.filter((x) => x.siteId !== id);
    db.tasks.forEach((t) => { if (t.siteId === id) t.siteId = ''; });
  } else if (col === 'workers') {
    db.shifts = db.shifts.filter((x) => x.workerId !== id);
  } else if (col === 'foremen') {
    db.workers.forEach((w) => { if (w.foremanId === id) w.foremanId = ''; });
    db.tasks.forEach((t) => { if (t.assignee === 'foreman:' + id) t.assignee = ''; });
  } else if (col === 'admins') {
    db.tasks.forEach((t) => { if (t.assignee === 'admin:' + id) t.assignee = ''; });
  }
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 5e6) req.destroy(); });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
});

async function api(req, res, parts) {
  if (parts[0] === 'all' && req.method === 'GET') return send(res, 200, db);
  if (parts[0] === 'reset' && req.method === 'POST') { db = seed(); save(); return send(res, 200, db); }
  const col = parts[0];
  if (!COLLECTIONS.includes(col)) return send(res, 404, { error: 'unknown collection' });
  const id = parts[1];
  try {
    if (req.method === 'GET' && !id) return send(res, 200, db[col]);
    if (req.method === 'POST' && !id) {
      const item = { ...(await readBody(req)), id: uid() };
      db[col].push(item); save();
      return send(res, 201, item);
    }
    if (req.method === 'POST' && id === 'bulk') {
      const items = (await readBody(req)).map((x) => ({ ...x, id: uid() }));
      db[col].push(...items); save();
      return send(res, 201, items);
    }
    const idx = db[col].findIndex((x) => x.id === id);
    if (idx < 0) return send(res, 404, { error: 'not found' });
    if (req.method === 'PUT') {
      db[col][idx] = { ...db[col][idx], ...(await readBody(req)), id }; save();
      return send(res, 200, db[col][idx]);
    }
    if (req.method === 'DELETE') {
      db[col].splice(idx, 1); cascade(col, id); save();
      return send(res, 200, { ok: true });
    }
  } catch (e) {
    return send(res, 400, { error: String(e.message || e) });
  }
  send(res, 405, { error: 'method not allowed' });
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

load();
http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname.startsWith('/api/')) return api(req, res, pathname.slice(5).split('/').filter(Boolean));
  serveStatic(req, res);
}).listen(PORT, HOST, () => console.log(`Система учёта персонала: http://localhost:${PORT}`));
