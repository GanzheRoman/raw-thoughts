'use strict';
// ---------- состояние и API ----------
let DB = { admins: [], foremen: [], workers: [], sites: [], shifts: [], tasks: [] };
const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const ui = { sitesView: 'kanban', month: null, date: null, wf: { q: '', status: '', foreman: '', role: '' }, tf: '', map: null, addMode: false };

async function api(method, url, body) {
  const r = await fetch('/api/' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json()).error || r.status);
  return r.json();
}
const reload = async () => { DB = await api('GET', 'all'); };
async function save(col, item, extra) {
  if (item.id) await api('PUT', `${col}/${item.id}`, item); else await api('POST', col, item);
  await reload(); render(); if (extra !== false) toast('Сохранено');
}
async function remove(col, id, msg = 'Удалить запись?') {
  if (!(await askConfirm(msg))) return;
  await api('DELETE', `${col}/${id}`); await reload(); render(); toast('Удалено');
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }

// ---------- утилиты ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = () => iso(new Date());
ui.month = todayIso().slice(0, 7); ui.date = todayIso();
const money = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const num = (n) => Math.round(n).toLocaleString('ru-RU');
const byId = (col, id) => DB[col].find((x) => x.id === id);
const WSTATUS = { active: 'Активен', inactive: 'Неактивен', unreliable: 'Ненадёжный' };
const SSTATUS = { planned: 'Запланирован', active: 'Текущий', closed: 'Закрыт' };
const SCOLOR = { planned: '#f0a93b', active: '#4cb782', closed: '#9aa7b8' };
const TSTATUS = { todo: 'Новые', doing: 'В работе', review: 'На проверке', done: 'Готово' };
const PRIO = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const badge = (cls, text) => `<span class="badge b-${cls}">${esc(text)}</span>`;
const foremanName = (id) => byId('foremen', id)?.name || '— без бригадира —';
const siteName = (id) => byId('sites', id)?.name || '—';
const assigneeName = (v) => {
  const [t, id] = (v || '').split(':');
  const p = byId(t === 'admin' ? 'admins' : 'foremen', id);
  return p ? `${t === 'admin' ? '🔑' : '🦺'} ${p.name}` : 'Не назначен';
};
const opts = (list, sel, empty) => (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
  list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');
const foremanOpts = (sel, empty) => opts(DB.foremen.map((f) => [f.id, f.name]), sel, empty);
const siteOpts = (sel, empty) => opts(DB.sites.map((s) => [s.id, s.name]), sel, empty);
const assigneeOpts = (sel) => `<option value="">Не назначен</option>` +
  `<optgroup label="Администраторы">${opts(DB.admins.map((a) => ['admin:' + a.id, a.name]), sel)}</optgroup>` +
  `<optgroup label="Бригадиры">${opts(DB.foremen.map((f) => ['foreman:' + f.id, f.name]), sel)}</optgroup>`;

// ---------- модальные формы ----------
// fields: {name,label,type,options,half}
function form(title, fields, values, onSave) {
  const m = $('#modal');
  const input = (f) => {
    const v = values[f.name] ?? '';
    if (f.type === 'select') return `<select name="${f.name}">${f.html}</select>`;
    if (f.type === 'textarea') return `<textarea name="${f.name}" rows="3">${esc(v)}</textarea>`;
    return `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''} ${f.req ? 'required' : ''}>`;
  };
  let html = `<form class="dlg"><h3>${esc(title)}</h3>`;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.half && fields[i + 1]?.half) { html += `<div class="two"><label>${f.label}${input(f)}</label><label>${fields[i + 1].label}${input(fields[i + 1])}</label></div>`; i++; }
    else html += `<label>${f.label}${input(f)}</label>`;
  }
  html += `<div class="foot"><button type="button" data-close>Отмена</button><button class="primary">Сохранить</button></div></form>`;
  m.innerHTML = html; m.classList.remove('hidden');
  const fm = $('form', m);
  fields.filter((f) => f.type === 'select').forEach((f) => { fm.elements[f.name].value = values[f.name] ?? ''; });
  fm.onsubmit = async (e) => {
    e.preventDefault();
    const out = { ...values };
    for (const f of fields) { const v = fm.elements[f.name].value; out[f.name] = f.type === 'number' ? Number(v) : v; }
    closeModal(); await onSave(out);
  };
  m.onclick = (e) => { if (e.target === m || e.target.hasAttribute('data-close')) closeModal(); };
  const first = fm.querySelector('input,select,textarea'); first && first.focus();
}
function askConfirm(msg) {
  return new Promise((resolve) => {
    const m = $('#modal');
    m.innerHTML = `<div class="dlg"><h3>${esc(msg)}</h3><div class="foot"><button data-no>Отмена</button><button class="primary" data-yes>Да</button></div></div>`;
    m.classList.remove('hidden');
    m.onclick = (e) => { if (e.target === m || e.target.hasAttribute('data-no')) { closeModal(); resolve(false); } else if (e.target.hasAttribute('data-yes')) { closeModal(); resolve(true); } };
  });
}
const closeModal = () => { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; };

// ---------- формы сущностей ----------
function editSite(s = {}, coords) {
  form(s.id ? 'Объект' : 'Новый объект', [
    { name: 'name', label: 'Название', req: true },
    { name: 'client', label: 'Заказчик' },
    { name: 'address', label: 'Адрес' },
    { name: 'status', label: 'Статус', type: 'select', html: opts(Object.entries(SSTATUS), s.status || 'planned') },
    { name: 'start', label: 'Начало', type: 'date', half: true }, { name: 'end', label: 'Окончание', type: 'date', half: true },
    { name: 'billRate', label: 'Ставка для заказчика, ₽/час', type: 'number' },
    { name: 'lat', label: 'Широта', type: 'number', step: 'any', half: true }, { name: 'lng', label: 'Долгота', type: 'number', step: 'any', half: true },
  ], { status: 'planned', billRate: 600, lat: coords?.lat ?? 55.75, lng: coords?.lng ?? 37.62, ...s }, (v) => save('sites', v));
}
function editWorker(w = {}) {
  form(w.id ? 'Рабочий' : 'Новый рабочий', [
    { name: 'name', label: 'ФИО', req: true },
    { name: 'phone', label: 'Телефон', half: true }, { name: 'role', label: 'Профессия', half: true },
    { name: 'foremanId', label: 'Чей человек (бригадир)', type: 'select', html: foremanOpts(w.foremanId, '— без бригадира —') },
    { name: 'status', label: 'Статус', type: 'select', html: opts(Object.entries(WSTATUS), w.status || 'active') },
    { name: 'rate', label: 'Ставка рабочего, ₽/час', type: 'number' },
    { name: 'note', label: 'Заметка', type: 'textarea' },
  ], { status: 'active', role: 'Разнорабочий', rate: 300, ...w }, (v) => save('workers', v));
}
function editForeman(f = {}) {
  form(f.id ? 'Бригадир' : 'Новый бригадир', [{ name: 'name', label: 'ФИО', req: true }, { name: 'phone', label: 'Телефон' }], f, (v) => save('foremen', v));
}
function editAdmin(a = {}) {
  form(a.id ? 'Администратор' : 'Новый администратор', [{ name: 'name', label: 'ФИО', req: true }, { name: 'phone', label: 'Телефон' }], a, (v) => save('admins', v));
}
function editTask(t = {}) {
  form(t.id ? 'Задача' : 'Новая задача', [
    { name: 'title', label: 'Название', req: true },
    { name: 'description', label: 'Описание', type: 'textarea' },
    { name: 'assignee', label: 'Ответственный', type: 'select', html: assigneeOpts(t.assignee) },
    { name: 'siteId', label: 'Объект', type: 'select', html: siteOpts(t.siteId, '— без объекта —') },
    { name: 'status', label: 'Колонка', type: 'select', html: opts(Object.entries(TSTATUS), t.status || 'todo'), half: true },
    { name: 'priority', label: 'Приоритет', type: 'select', html: opts(Object.entries(PRIO), t.priority || 'medium'), half: true },
    { name: 'due', label: 'Срок', type: 'date' },
  ], { status: 'todo', priority: 'medium', ...t }, (v) => save('tasks', v));
}
function addShift(date, siteId = '') {
  const workers = DB.workers.filter((w) => w.status !== 'inactive');
  const taken = new Set(DB.shifts.filter((s) => s.date === date).map((s) => s.workerId));
  const free = workers.filter((w) => !taken.has(w.id));
  if (!DB.sites.length || !free.length) return toast('Нет доступных рабочих или объектов');
  const siteSel = siteId || (DB.sites.find((s) => s.status === 'active') || DB.sites[0]).id;
  form('Добавить в табель на ' + date, [
    { name: 'siteId', label: 'Объект', type: 'select', html: siteOpts(siteSel) },
    { name: 'workerId', label: 'Рабочий (ненадёжные помечены ⚠)', type: 'select',
      html: opts(free.map((w) => [w.id, `${w.status === 'unreliable' ? '⚠ ' : ''}${w.name} — ${w.role} (${foremanName(w.foremanId)})`])) },
    { name: 'hours', label: 'Часов', type: 'number', step: '0.5', half: true },
    { name: 'rate', label: 'Ставка рабочего, ₽/час', type: 'number', half: true },
    { name: 'billRate', label: 'Ставка заказчику, ₽/час', type: 'number' },
  ], { siteId: siteSel, workerId: free[0].id, hours: 10, rate: free[0].rate, billRate: byId('sites', siteSel).billRate, date }, async (v) => {
    await api('POST', 'shifts', v); await reload(); render(); toast('Добавлено в табель');
  });
  // автоподстановка ставок
  const fm = $('#modal form');
  const sync = () => { fm.elements.rate.value = byId('workers', fm.elements.workerId.value)?.rate ?? ''; fm.elements.billRate.value = byId('sites', fm.elements.siteId.value)?.billRate ?? ''; };
  fm.elements.workerId.onchange = sync; fm.elements.siteId.onchange = sync;
}

// ---------- расчёты ----------
function monthStats(month) {
  const sh = DB.shifts.filter((s) => s.date.startsWith(month));
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const rev = (x) => x.hours * x.billRate, cost = (x) => x.hours * x.rate;
  return { sh, revenue: sum(sh, rev), cost: sum(sh, cost), hours: sum(sh, (x) => x.hours), rev, cost_: cost, sum };
}
const peopleOn = (date, siteId) => DB.shifts.filter((s) => s.date === date && (!siteId || s.siteId === siteId));

// ---------- страницы ----------
const pages = {
  dashboard() {
    const st = monthStats(ui.month);
    const [y, m] = ui.month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const perDay = Array.from({ length: days }, (_, i) => {
      const d = `${ui.month}-${String(i + 1).padStart(2, '0')}`;
      const arr = st.sh.filter((s) => s.date === d);
      return { d: i + 1, rev: st.sum(arr, st.rev), n: arr.length };
    });
    const max = Math.max(1, ...perDay.map((x) => x.rev));
    const activeW = DB.workers.filter((w) => w.status === 'active').length;
    const today = peopleOn(todayIso());
    const siteRows = DB.sites.map((s) => {
      const a = st.sh.filter((x) => x.siteId === s.id);
      return { s, rev: st.sum(a, st.rev), cost: st.sum(a, st.cost_), hours: st.sum(a, (x) => x.hours), ppl: new Set(a.map((x) => x.workerId)).size };
    }).filter((r) => r.rev || r.s.status === 'active').sort((a, b) => b.rev - a.rev);
    const foremanRows = DB.foremen.map((f) => {
      const ids = new Set(DB.workers.filter((w) => w.foremanId === f.id).map((w) => w.id));
      const a = st.sh.filter((x) => ids.has(x.workerId));
      return { f, total: ids.size, act: DB.workers.filter((w) => w.foremanId === f.id && w.status === 'active').length, rev: st.sum(a, st.rev), hours: st.sum(a, (x) => x.hours) };
    }).sort((a, b) => b.rev - a.rev);
    const openTasks = DB.tasks.filter((t) => t.status !== 'done');
    return `
    <div class="head"><h1>Дашборд</h1><input type="month" id="month" value="${ui.month}"><div class="sp"></div>
      <span class="muted small">Сегодня: ${today.length} чел. на объектах</span></div>
    <div class="grid kpis">
      <div class="card kpi g"><div class="l">Выручка за месяц</div><div class="v">${money(st.revenue)}</div></div>
      <div class="card kpi"><div class="l">Оплата рабочим</div><div class="v">${money(st.cost)}</div></div>
      <div class="card kpi b"><div class="l">Маржа</div><div class="v">${money(st.revenue - st.cost)}</div><div class="l">${st.revenue ? Math.round((1 - st.cost / st.revenue) * 100) : 0}%</div></div>
      <div class="card kpi"><div class="l">Отработано часов</div><div class="v">${num(st.hours)}</div></div>
      <div class="card kpi a"><div class="l">Активных рабочих</div><div class="v">${activeW}</div><div class="l">из ${DB.workers.length} в базе</div></div>
      <div class="card kpi"><div class="l">Текущих объектов</div><div class="v">${DB.sites.filter((s) => s.status === 'active').length}</div><div class="l">запланировано: ${DB.sites.filter((s) => s.status === 'planned').length}</div></div>
      <div class="card kpi"><div class="l">Открытых задач</div><div class="v">${openTasks.length}</div></div>
    </div>
    <div class="grid cols2">
      <div class="card"><h3>Выручка по дням</h3>
        <div class="bars">${perDay.map((x) => `<div class="bar" style="height:${(x.rev / max) * 100}%" data-tip="${x.d}: ${money(x.rev)} · ${x.n} чел."></div>`).join('')}</div>
        <div class="axis"><span>1</span><span>${Math.round(days / 2)}</span><span>${days}</span></div></div>
      <div class="card"><h3>Люди по статусам</h3>
        ${['active', 'inactive', 'unreliable'].map((k) => { const n = DB.workers.filter((w) => w.status === k).length;
          return `<div style="margin-bottom:10px">${badge(k, WSTATUS[k])} <b>${n}</b><div class="progress" style="margin-top:4px"><i style="width:${(n / (DB.workers.length || 1)) * 100}%;background:${k === 'active' ? 'var(--green)' : k === 'unreliable' ? 'var(--red)' : '#aab6c6'}"></i></div></div>`; }).join('')}
      </div>
    </div>
    <div class="grid cols2" style="margin-top:14px">
      <div class="card"><h3>Объекты за месяц</h3><div class="table-wrap"><table>
        <tr><th>Объект</th><th>Статус</th><th class="num">Людей</th><th class="num">Часы</th><th class="num">Выручка</th><th class="num">Маржа</th></tr>
        ${siteRows.map((r) => `<tr><td>${esc(r.s.name)}</td><td>${badge(r.s.status, SSTATUS[r.s.status])}</td><td class="num">${r.ppl}</td><td class="num">${num(r.hours)}</td><td class="num">${money(r.rev)}</td><td class="num">${money(r.rev - r.cost)}</td></tr>`).join('') || '<tr><td class="empty" colspan="6">Нет данных</td></tr>'}
      </table></div></div>
      <div class="card"><h3>Бригадиры</h3><div class="table-wrap"><table>
        <tr><th>Бригадир</th><th class="num">Людей</th><th class="num">Выручка</th></tr>
        ${foremanRows.map((r) => `<tr><td>${esc(r.f.name)}</td><td class="num">${r.act}/${r.total}</td><td class="num">${money(r.rev)}</td></tr>`).join('')}
      </table></div><div class="muted small" style="margin-top:6px">Людей: активных / всего в бригаде</div></div>
    </div>`;
  },

  sites() {
    const head = `<div class="head"><h1>Объекты</h1>
      <button data-act="sv" data-v="kanban" class="${ui.sitesView === 'kanban' ? 'on' : ''}">Канбан</button>
      <button data-act="sv" data-v="map" class="${ui.sitesView === 'map' ? 'on' : ''}">Карта</button>
      <div class="sp"></div>
      ${ui.sitesView === 'map' ? `<button data-act="addmode" class="${ui.addMode ? 'on' : ''}">📍 Поставить на карте</button>` : ''}
      <button class="primary" data-act="new-site">+ Объект</button></div>`;
    if (ui.sitesView === 'map') {
      return head + (ui.addMode ? '<div class="hint">Кликните по карте, чтобы добавить объект в этой точке. Маркеры можно перетаскивать.</div>' : '') +
        `<div class="mapbox"><div id="map" class="${ui.addMode ? 'adding' : ''}"></div>
         <div class="card maplist"><h3>Список</h3>${DB.sites.map((s) => `<div class="item" data-act="focus-site" data-id="${s.id}"><span class="dot" style="background:${SCOLOR[s.status]}"></span><b>${esc(s.name)}</b><div class="muted small">${SSTATUS[s.status]} · ${esc(s.address)}</div></div>`).join('')}</div></div>`;
    }
    const cols = Object.keys(SSTATUS).map((k) => {
      const list = DB.sites.filter((s) => s.status === k);
      return `<div class="kcol" data-drop="${k}" data-kind="site"><h4>${SSTATUS[k]} <span class="muted">${list.length}</span></h4>${list.map((s) => {
        const todayN = peopleOn(todayIso(), s.id).length;
        return `<div class="kcard" draggable="true" data-id="${s.id}" data-kind="site">
          <div class="t">${esc(s.name)}</div><div class="muted small">${esc(s.client)} · ${esc(s.address)}</div>
          <div class="row small"><span>📅 ${esc(s.start || '?')} → ${esc(s.end || '?')}</span></div>
          <div class="row small"><span class="badge b-active">Сегодня: ${todayN} чел.</span><span class="muted">${s.billRate} ₽/ч</span></div>
          <div class="acts"><button class="small" data-act="edit-site" data-id="${s.id}">Изменить</button><button class="small" data-act="show-map" data-id="${s.id}">На карте</button><button class="small danger" data-act="del-site" data-id="${s.id}">✕</button></div></div>`;
      }).join('')}</div>`;
    }).join('');
    return head + `<div class="kanban">${cols}</div>`;
  },

  timesheet() {
    const rows = peopleOn(ui.date);
    const sites = DB.sites.filter((s) => rows.some((r) => r.siteId === s.id));
    const tot = (a, f) => a.reduce((x, r) => x + f(r), 0);
    return `<div class="head"><h1>Табель</h1>
      <button data-act="day" data-d="-1">←</button><input type="date" id="date" value="${ui.date}"><button data-act="day" data-d="1">→</button>
      <div class="sp"></div><button data-act="copy-prev">Копировать с пред. дня</button><button class="primary" data-act="add-shift">+ Рабочий в табель</button></div>
      <div class="grid kpis">
        <div class="card kpi b"><div class="l">Людей в день</div><div class="v">${rows.length}</div></div>
        <div class="card kpi"><div class="l">Часов</div><div class="v">${num(tot(rows, (r) => r.hours))}</div></div>
        <div class="card kpi g"><div class="l">Выручка</div><div class="v">${money(tot(rows, (r) => r.hours * r.billRate))}</div></div>
        <div class="card kpi"><div class="l">Оплата рабочим</div><div class="v">${money(tot(rows, (r) => r.hours * r.rate))}</div></div></div>
      ${sites.map((s) => { const a = rows.filter((r) => r.siteId === s.id);
        return `<div class="card" style="margin-bottom:12px"><h3>${esc(s.name)} ${badge(s.status, SSTATUS[s.status])} <span class="muted small">${a.length} чел.</span></h3><div class="table-wrap"><table>
        <tr><th>Рабочий</th><th>Бригадир</th><th class="num">Часы</th><th class="num">Ставка</th><th class="num">Заказчику</th><th class="num">Выручка</th><th></th></tr>
        ${a.map((r) => { const w = byId('workers', r.workerId); return `<tr><td>${esc(w?.name)} ${w?.status === 'unreliable' ? badge('unreliable', 'ненадёжный') : ''}<div class="muted small">${esc(w?.role)}</div></td><td>${esc(foremanName(w?.foremanId))}</td>
          <td class="num"><input type="number" step="0.5" style="width:70px" data-shift="${r.id}" data-f="hours" value="${r.hours}"></td>
          <td class="num"><input type="number" style="width:80px" data-shift="${r.id}" data-f="rate" value="${r.rate}"></td>
          <td class="num"><input type="number" style="width:80px" data-shift="${r.id}" data-f="billRate" value="${r.billRate}"></td>
          <td class="num">${money(r.hours * r.billRate)}</td><td><button class="small danger" data-act="del-shift" data-id="${r.id}">✕</button></td></tr>`; }).join('')}</table></div></div>`; }).join('')
        || '<div class="card empty">На эту дату в табеле никого нет. Добавьте рабочих или скопируйте предыдущий день.</div>'}`;
  },

  workers() {
    const f = ui.wf, month = ui.month;
    const roles = [...new Set(DB.workers.map((w) => w.role).filter(Boolean))];
    const list = DB.workers.filter((w) => (!f.q || (w.name + w.phone).toLowerCase().includes(f.q.toLowerCase())) && (!f.status || w.status === f.status) &&
      (!f.foreman || (f.foreman === '-' ? !w.foremanId : w.foremanId === f.foreman)) && (!f.role || w.role === f.role));
    const hrs = {}; DB.shifts.filter((s) => s.date.startsWith(month)).forEach((s) => { hrs[s.workerId] = (hrs[s.workerId] || 0) + s.hours; });
    return `<div class="head"><h1>Рабочие <span class="muted small">${list.length} из ${DB.workers.length}</span></h1><div class="sp"></div><button class="primary" data-act="new-worker">+ Рабочий</button></div>
      <div class="filters"><input type="search" id="wq" placeholder="Поиск по имени, телефону" value="${esc(f.q)}">
        <select data-wf="status">${opts(Object.entries(WSTATUS), f.status, 'Все статусы')}</select>
        <select data-wf="foreman">${foremanOpts(f.foreman, 'Все бригадиры').replace('</option>', '</option><option value="-" ' + (f.foreman === '-' ? 'selected' : '') + '>Без бригадира</option>')}</select>
        <select data-wf="role">${opts(roles.map((r) => [r, r]), f.role, 'Все профессии')}</select></div>
      <div class="card table-wrap"><table><tr><th>ФИО</th><th>Профессия</th><th>Телефон</th><th>Чей человек</th><th>Статус</th><th class="num">Ставка</th><th class="num">Часов (${month})</th><th></th></tr>
      ${list.map((w) => `<tr><td><b>${esc(w.name)}</b></td><td>${esc(w.role)}</td><td>${esc(w.phone)}</td><td>${esc(foremanName(w.foremanId))}</td>
        <td><select data-wstatus="${w.id}">${opts(Object.entries(WSTATUS), w.status)}</select></td><td class="num">${w.rate} ₽</td><td class="num">${num(hrs[w.id] || 0)}</td>
        <td><button class="small" data-act="edit-worker" data-id="${w.id}">Изменить</button> <button class="small danger" data-act="del-worker" data-id="${w.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Никого не найдено</td></tr>'}
      </table></div>`;
  },

  brigades() {
    const groups = [...DB.foremen, { id: '', name: 'Без бригадира', phone: '', none: true }];
    return `<div class="head"><h1>Бригады</h1><div class="sp"></div><button class="primary" data-act="new-foreman">+ Бригадир</button></div>
      <div class="grid cols3">${groups.map((f) => {
        const ws = DB.workers.filter((w) => (w.foremanId || '') === f.id);
        if (f.none && !ws.length) return '';
        const cnt = (k) => ws.filter((w) => w.status === k).length;
        return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:start"><div><h3 style="margin:0">🦺 ${esc(f.name)}</h3><div class="muted small">${esc(f.phone)}</div></div>
          ${f.none ? '' : `<div><button class="small" data-act="edit-foreman" data-id="${f.id}">Изменить</button> <button class="small danger" data-act="del-foreman" data-id="${f.id}">✕</button></div>`}</div>
          <div style="margin:10px 0">${badge('active', 'Активных ' + cnt('active'))} ${badge('inactive', 'Неактивных ' + cnt('inactive'))} ${badge('unreliable', 'Ненадёжных ' + cnt('unreliable'))}</div>
          ${ws.map((w) => `<div class="person"><span>${esc(w.name)}<span class="muted small"> · ${esc(w.role)}</span></span><select data-wstatus="${w.id}">${opts(Object.entries(WSTATUS), w.status)}</select></div>`).join('') || '<div class="muted small">Пока никого</div>'}
          ${f.none ? '' : `<button class="small" style="margin-top:10px" data-act="new-worker" data-foreman="${f.id}">+ Добавить в бригаду</button>`}</div>`;
      }).join('')}</div>`;
  },

  tasks() {
    const list = DB.tasks.filter((t) => !ui.tf || t.assignee === ui.tf);
    return `<div class="head"><h1>Задачи</h1><select id="tf">${assigneeOpts(ui.tf).replace('Не назначен', 'Все ответственные')}</select><div class="sp"></div><button class="primary" data-act="new-task">+ Задача</button></div>
      <div class="kanban">${Object.entries(TSTATUS).map(([k, label]) => {
        const col = list.filter((t) => t.status === k);
        return `<div class="kcol" data-drop="${k}" data-kind="task"><h4>${label} <span class="muted">${col.length}</span></h4>${col.map((t) => {
          const late = t.due && t.status !== 'done' && t.due < todayIso();
          return `<div class="kcard" draggable="true" data-id="${t.id}" data-kind="task"><div class="t">${esc(t.title)}</div>
          ${t.description ? `<div class="muted small">${esc(t.description)}</div>` : ''}
          <div class="row">${badge(t.priority, PRIO[t.priority])}${t.siteId ? `<span class="small muted">🏗️ ${esc(siteName(t.siteId))}</span>` : ''}</div>
          <div class="row small"><span>${esc(assigneeName(t.assignee))}</span>${t.due ? `<span class="${late ? 'badge b-unreliable' : 'muted'}">⏰ ${t.due}</span>` : ''}</div>
          <div class="acts"><button class="small" data-act="edit-task" data-id="${t.id}">Изменить</button><button class="small danger" data-act="del-task" data-id="${t.id}">✕</button></div></div>`;
        }).join('')}</div>`;
      }).join('')}</div>`;
  },

  team() {
    return `<div class="head"><h1>Администраторы платформы</h1><div class="sp"></div><button class="primary" data-act="new-admin">+ Администратор</button></div>
      <div class="card table-wrap"><table><tr><th>ФИО</th><th>Телефон</th><th>Открытых задач</th><th></th></tr>
      ${DB.admins.map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(a.phone)}</td><td>${DB.tasks.filter((t) => t.assignee === 'admin:' + a.id && t.status !== 'done').length}</td>
        <td><button class="small" data-act="edit-admin" data-id="${a.id}">Изменить</button> <button class="small danger" data-act="del-admin" data-id="${a.id}">✕</button></td></tr>`).join('')}</table></div>
      <div class="card" style="margin-top:14px"><h3>Демо-данные</h3><p class="muted">Сбросить базу к демонстрационным данным (все изменения будут потеряны).</p><button class="danger" data-act="reset">Сбросить данные</button></div>`;
  },
};

// ---------- карта ----------
function initMap() {
  const el = $('#map'); if (!el) return;
  if (typeof L === 'undefined') { el.innerHTML = '<div class="empty">Карта недоступна</div>'; return; }
  const map = ui.map = L.map(el).setView([56, 38], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
  ui.markers = {};
  for (const s of DB.sites) {
    const icon = L.divIcon({ className: '', iconSize: [24, 24], iconAnchor: [12, 12], html: `<div style="width:24px;height:24px;border-radius:50%;background:${SCOLOR[s.status]};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>` });
    const mk = L.marker([s.lat, s.lng], { icon, draggable: true }).addTo(map);
    mk.bindPopup(() => `<b>${esc(s.name)}</b><br>${SSTATUS[s.status]} · сегодня ${peopleOn(todayIso(), s.id).length} чел.<br><span class="muted small">${esc(s.address)}</span><br>
      <select data-mapstatus="${s.id}" style="margin:6px 0">${opts(Object.entries(SSTATUS), s.status)}</select><br>
      <button class="small" data-act="edit-site" data-id="${s.id}">Изменить</button> <button class="small danger" data-act="del-site" data-id="${s.id}">Удалить</button>`);
    ui.markers[s.id] = mk;
    mk.on('dragend', async () => { const p = mk.getLatLng(); await api('PUT', `sites/${s.id}`, { lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) }); await reload(); toast('Положение объекта обновлено'); });
  }
  if (DB.sites.length) map.fitBounds(L.latLngBounds(DB.sites.map((s) => [s.lat, s.lng])).pad(0.3), { maxZoom: 9 });
  map.on('click', (e) => {
    if (!ui.addMode) return;
    ui.addMode = false; editSite({}, { lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) });
  });
}

// ---------- рендер ----------
function render() {
  const page = (location.hash.slice(1) || 'dashboard');
  const name = pages[page] ? page : 'dashboard';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === name));
  if (ui.map) { ui.map.remove(); ui.map = null; }
  main.innerHTML = pages[name]();
  if (name === 'sites' && ui.sitesView === 'map') initMap();
}
window.addEventListener('hashchange', () => { ui.addMode = false; render(); });

// ---------- события ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id, a = b.dataset.act;
  const actions = {
    sv: () => { ui.sitesView = b.dataset.v; ui.addMode = false; render(); },
    addmode: () => { ui.addMode = !ui.addMode; render(); },
    'new-site': () => editSite(), 'edit-site': () => { ui.map?.closePopup(); editSite(byId('sites', id)); },
    'del-site': () => remove('sites', id, 'Удалить объект вместе с его записями в табеле?'),
    'show-map': () => { ui.sitesView = 'map'; render(); const s = byId('sites', id); ui.map?.setView([s.lat, s.lng], 11); ui.markers[id]?.openPopup(); },
    'focus-site': () => { const s = byId('sites', id); ui.map.setView([s.lat, s.lng], 11); ui.markers[id].openPopup(); },
    day: () => { const d = new Date(ui.date + 'T00:00'); d.setDate(d.getDate() + Number(b.dataset.d)); ui.date = iso(d); render(); },
    'add-shift': () => addShift(ui.date),
    'del-shift': () => remove('shifts', id, 'Убрать из табеля?'),
    'copy-prev': async () => {
      const d = new Date(ui.date + 'T00:00'); d.setDate(d.getDate() - 1);
      const prev = peopleOn(iso(d)), have = new Set(peopleOn(ui.date).map((s) => s.workerId));
      const add = prev.filter((s) => !have.has(s.workerId) && byId('workers', s.workerId)?.status !== 'inactive').map(({ id: _i, ...s }) => ({ ...s, date: ui.date }));
      if (!add.length) return toast('Копировать нечего');
      await api('POST', 'shifts/bulk', add); await reload(); render(); toast(`Скопировано: ${add.length}`);
    },
    'new-worker': () => editWorker(b.dataset.foreman ? { foremanId: b.dataset.foreman } : {}),
    'edit-worker': () => editWorker(byId('workers', id)), 'del-worker': () => remove('workers', id, 'Удалить рабочего и его записи в табеле?'),
    'new-foreman': () => editForeman(), 'edit-foreman': () => editForeman(byId('foremen', id)),
    'del-foreman': () => remove('foremen', id, 'Удалить бригадира? Рабочие останутся без бригадира.'),
    'new-task': () => editTask(), 'edit-task': () => editTask(byId('tasks', id)), 'del-task': () => remove('tasks', id),
    'new-admin': () => editAdmin(), 'edit-admin': () => editAdmin(byId('admins', id)), 'del-admin': () => remove('admins', id),
    reset: async () => { if (await askConfirm('Сбросить все данные?')) { await api('POST', 'reset'); await reload(); render(); toast('Данные сброшены'); } },
  };
  actions[a]?.();
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'month') { ui.month = t.value || ui.month; render(); }
  else if (t.id === 'date') { ui.date = t.value || ui.date; render(); }
  else if (t.id === 'tf') { ui.tf = t.value; render(); }
  else if (t.dataset.wf !== undefined) { ui.wf[t.dataset.wf] = t.value; render(); }
  else if (t.dataset.wstatus) { await api('PUT', `workers/${t.dataset.wstatus}`, { status: t.value }); await reload(); render(); toast('Статус обновлён'); }
  else if (t.dataset.mapstatus) { await api('PUT', `sites/${t.dataset.mapstatus}`, { status: t.value }); await reload(); render(); toast('Статус обновлён'); }
  else if (t.dataset.shift) { await api('PUT', `shifts/${t.dataset.shift}`, { [t.dataset.f]: Number(t.value) }); await reload(); render(); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'wq') { ui.wf.q = e.target.value; const pos = e.target.selectionStart; render(); const el = $('#wq'); el.focus(); el.setSelectionRange(pos, pos); }
});

// drag & drop для канбанов
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest?.('.kcard'); if (!c) return;
  e.dataTransfer.setData('text/plain', JSON.stringify({ id: c.dataset.id, kind: c.dataset.kind })); c.classList.add('dragging');
});
document.addEventListener('dragend', () => document.querySelectorAll('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')));
document.addEventListener('dragover', (e) => { const c = e.target.closest?.('.kcol'); if (c) { e.preventDefault(); document.querySelectorAll('.over').forEach((x) => x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('drop', async (e) => {
  const col = e.target.closest?.('.kcol'); if (!col) return; e.preventDefault();
  const { id, kind } = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
  if (!id || kind !== col.dataset.kind) return;
  await api('PUT', `${kind === 'site' ? 'sites' : 'tasks'}/${id}`, { status: col.dataset.drop }); await reload(); render();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

reload().then(render).catch((e) => { main.innerHTML = `<div class="card">Не удалось загрузить данные: ${esc(e.message)}</div>`; });
