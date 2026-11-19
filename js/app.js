// KBJU Track v9 — единый интерфейс добавления еды, приёмы пищи, прогресс, копия данных, офлайн
'use strict';
const APP_VERSION = '9';

// ============ НАСТРОЙКИ ============
const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
const SUPABASE_URL = 'https://yyehwrqhecqcejfdgafy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SwA5oaF3hSMHsF3xr6AwXA_VZNbG9Up';
const LS = { targets: 'ai_kbju_targets', profile: 'ai_kbju_profile', logs: 'ai_kbju_logs', favorites: 'ai_kbju_favorites', products: 'ai_kbju_product_database', key: 'ai_kbju_custom_api_key', icon: 'ai_kbju_app_icon' };
const TYPES = [{ id: 'breakfast', name: 'Завтрак' }, { id: 'lunch', name: 'Обед' }, { id: 'dinner', name: 'Ужин' }, { id: 'snack', name: 'Перекус' }];

// ============ ИКОНКИ (встроенные, без внешних библиотек) ============
const ICONS = {
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>',
  barcode: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  star: '<path d="m12 2.5 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1z"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  home: '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12a3.5 3.5 0 0 0 .5 7z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 3 3m-5-1 2 2"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>', upload: '<path d="M12 15V3m0 0L8 7m4-4 4 4M4 21h16"/>'
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
function paintIcons(root = document) { root.querySelectorAll('[data-i]').forEach(el => { if (!el.firstChild) el.innerHTML = ic(el.dataset.i); }); }

// ============ УТИЛИТЫ ============
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r0 = n => Math.round(Number(n) || 0);
const r1 = n => Math.round((Number(n) || 0) * 10) / 10;
const fmt = n => r0(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();
const todayStr = () => { const n = new Date(); return new Date(n - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function shiftDate(s, d) { const [y, m, dd] = s.split('-').map(Number); const t = new Date(y, m - 1, dd + d); return new Date(t - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function humanDate(s) {
  const t = todayStr();
  if (s === t) return 'Сегодня'; if (s === shiftDate(t, -1)) return 'Вчера'; if (s === shiftDate(t, 1)) return 'Завтра';
  const d = parseDate(s); return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fullDate(s) { const d = parseDate(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function autoType() { const h = new Date().getHours(); return h >= 5 && h < 11 ? 'breakfast' : h >= 11 && h < 16 ? 'lunch' : h >= 16 && h < 22 ? 'dinner' : 'snack'; }
function mealType(m) { if (m.type && TYPES.some(t => t.id === m.type)) return m.type; const h = parseInt(String(m.time || '').split(':')[0], 10); if (isNaN(h)) return 'snack'; return h >= 5 && h < 11 ? 'breakfast' : h >= 11 && h < 16 ? 'lunch' : h >= 16 && h < 22 ? 'dinner' : 'snack'; }
const getKey = () => (localStorage.getItem(LS.key) || '').trim();
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить библиотеку')); document.head.appendChild(s); }); }

let toastTimer;
function toast(msg, kind = '', ms = 3000) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (kind === 'err' ? ' err' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms); }

// ============ СОСТОЯНИЕ И ХРАНИЛИЩЕ ============
let state = {
  selectedDate: todayStr(),
  targets: { kcal: 3400, p: 180, f: 95, c: 455 },
  profile: { gender: 'male', age: 25, weight: 75, height: 180, activity: 'moderate', goal: 'bulk', notes: '' },
  logs: {}
};
let favorites = [];       // избранные блюда (наборы продуктов)
let productDatabase = []; // база продуктов: на 100 г
let view = 'today';
let rangeDays = 7;
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let lastNorm = null;

function readJSON(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
function loadState() {
  const t = readJSON(LS.targets, null); if (t) state.targets = { ...state.targets, ...t };
  state.profile = { ...state.profile, ...readJSON(LS.profile, {}) };
  const l = readJSON(LS.logs, {}); state.logs = l && typeof l === 'object' && !Array.isArray(l) ? l : {};
  const f = readJSON(LS.favorites, []); favorites = Array.isArray(f) ? f : [];
  const p = readJSON(LS.products, []); productDatabase = Array.isArray(p) ? p : [];
}
function persistState() {
  try {
    localStorage.setItem(LS.targets, JSON.stringify(state.targets));
    localStorage.setItem(LS.profile, JSON.stringify(state.profile));
    localStorage.setItem(LS.logs, JSON.stringify(state.logs));
    scheduleCloudSync();
  } catch (e) {
    Object.keys(state.logs).forEach(d => { if (d !== state.selectedDate) state.logs[d].forEach(m => m.thumbnail = null); });
    try { localStorage.setItem(LS.logs, JSON.stringify(state.logs)); scheduleCloudSync(); } catch (err) { toast('Память браузера заполнена. Сохраните копию и удалите старые записи.', 'err', 6000); }
  }
}
function saveFavorites() { try { localStorage.setItem(LS.favorites, JSON.stringify(favorites)); } catch (e) {} scheduleCloudSync(); }
function saveProducts() { try { localStorage.setItem(LS.products, JSON.stringify(productDatabase)); } catch (e) { toast('Не удалось сохранить базу продуктов', 'err'); } scheduleCloudSync(); }

// ============ ОБЛАКО (Supabase, как в прошлых версиях) ============
let supabaseClient = null, cloudUser = null, cloudTimer = null, applyingCloud = false, cloudReady = false, cloudMsg = '';
function updateCloudUI(msg) {
  if (msg) cloudMsg = msg;
  const st = $('cloud-status'); if (!st) return;
  st.textContent = cloudUser ? `Подключено: ${cloudUser.email || 'Google'}. Данные синхронизируются. ${cloudMsg}` : (cloudMsg || 'Войдите, чтобы данные были на всех ваших устройствах.');
  $('btn-signin').classList.toggle('hidden', !!cloudUser);
  $('btn-signout').classList.toggle('hidden', !cloudUser);
}
async function initCloud() {
  if (!window.supabase) { updateCloudUI(navigator.onLine ? 'Облако не загрузилось.' : 'Облако доступно при подключении к интернету.'); return; }
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) { cloudUser = session.user; updateCloudUI(); await loadCloud(); }
    supabaseClient.auth.onAuthStateChange(async (_e, s) => { cloudUser = s ? s.user : null; updateCloudUI(); if (cloudUser) await loadCloud(); });
  } catch (e) { console.error(e); updateCloudUI('Не удалось подключить облако.'); }
}
async function signIn() {
  if (!supabaseClient) { toast('Облако недоступно: проверьте интернет', 'err'); return; }
  const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) toast('Ошибка входа: ' + error.message, 'err');
}
async function signOut() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) toast('Ошибка выхода: ' + error.message, 'err'); else { cloudUser = null; cloudReady = false; updateCloudUI('Вы вышли. Данные остались на устройстве.'); }
}
async function loadCloud() {
  if (!supabaseClient || !cloudUser) return;
  try {
    const { data, error } = await supabaseClient.from('kbju_user_data').select('data').eq('user_id', cloudUser.id).maybeSingle();
    if (error) throw error;
    if (data && data.data) {
      applyingCloud = true;
      const d = data.data;
      state.targets = d.targets || state.targets;
      state.profile = { ...state.profile, ...(d.profile || {}) };
      state.logs = d.logs || state.logs;
      const ck = (d.geminiKey || '').trim(); if (ck) localStorage.setItem(LS.key, ck);
      const hasProd = Array.isArray(d.productDatabase), hasFav = Array.isArray(d.favorites);
      if (hasProd) { productDatabase = d.productDatabase; try { localStorage.setItem(LS.products, JSON.stringify(productDatabase)); } catch (e) {} }
      if (hasFav) { favorites = d.favorites; try { localStorage.setItem(LS.favorites, JSON.stringify(favorites)); } catch (e) {} }
      persistState(); renderAll();
      applyingCloud = false; cloudReady = true;
      if ((!ck && getKey()) || (!hasFav && favorites.length) || (!hasProd && productDatabase.length)) await saveCloud();
      updateCloudUI('Облачные данные загружены.');
    } else { cloudReady = true; await saveCloud(); }
  } catch (e) { applyingCloud = false; cloudReady = false; console.error(e); updateCloudUI('Не удалось загрузить данные из облака.'); }
}
function scheduleCloudSync() { if (!supabaseClient || !cloudUser || applyingCloud) return; clearTimeout(cloudTimer); cloudTimer = setTimeout(saveCloud, 900); }
async function saveCloud() {
  if (!supabaseClient || !cloudUser || applyingCloud || !cloudReady) return;
  const payload = { user_id: cloudUser.id, data: { targets: state.targets, profile: state.profile, logs: state.logs, geminiKey: getKey(), favorites, productDatabase }, updated_at: new Date().toISOString() };
  try { const { error } = await supabaseClient.from('kbju_user_data').upsert(payload, { onConflict: 'user_id' }); if (error) throw error; updateCloudUI('Изменения сохранены в облаке.'); }
  catch (e) { console.error(e); updateCloudUI('Ошибка облака: копия сохранена на устройстве.'); }
}

// ============ ЭКРАНЫ И ШТОРКИ ============
let openSheetId = null;
function showView(v) {
  view = v;
  ['today', 'progress', 'more'].forEach(n => { $('view-' + n).classList.toggle('hidden', n !== v); $('tab-' + n).classList.toggle('on', n === v); });
  $('fab').classList.toggle('hidden', v !== 'today');
  if (v === 'today') renderToday(); if (v === 'progress') renderProgress(); if (v === 'more') renderMore();
  window.scrollTo(0, 0);
}
const SHEET_OPEN = {};
function openSheet(id) {
  if (openSheetId) hideSheet();
  openSheetId = id; $(id).classList.remove('hidden'); document.body.classList.add('lock');
  history.pushState({ sheet: id }, '');
  const b = $(id).querySelector('.sheet-body'); if (b) b.scrollTop = 0;
  if (SHEET_OPEN[id]) SHEET_OPEN[id]();
}
function hideSheet() {
  if (!openSheetId) return;
  const id = openSheetId; openSheetId = null;
  $(id).classList.add('hidden'); document.body.classList.remove('lock');
  if (id === 'sheet-add') cleanupAdd();
}
function closeSheet() { if (!openSheetId) return; if (history.state && history.state.sheet) history.back(); else hideSheet(); }
window.addEventListener('popstate', () => { if (openSheetId) { hideSheet(); renderAll(); } });

function renderAll() { if (view === 'today') renderToday(); else if (view === 'progress') renderProgress(); else renderMore(); }
function gotoDate(d) { state.selectedDate = d; renderToday(); }

// ============ ЭКРАН «СЕГОДНЯ» ============
function dayTotals(date) {
  const t = { kcal: 0, p: 0, f: 0, c: 0, n: 0 };
  (state.logs[date] || []).forEach(m => { t.kcal += +m.totals.kcal || 0; t.p += +m.totals.p || 0; t.f += +m.totals.f || 0; t.c += +m.totals.c || 0; t.n++; });
  return t;
}
function renderToday() {
  const d = state.selectedDate, t = dayTotals(d), tg = state.targets;
  $('date-label').innerHTML = `<b>${esc(humanDate(d))}</b><small>${esc(fullDate(d))}</small>`;
  const left = tg.kcal - r0(t.kcal);
  $('ring-main').textContent = fmt(Math.abs(left));
  $('ring-sub').textContent = left >= 0 ? 'ккал осталось' : 'ккал сверх нормы';
  const fg = $('ring-fg'), pct = tg.kcal > 0 ? Math.min(1, t.kcal / tg.kcal) : 0;
  fg.style.strokeDashoffset = 326.73 * (1 - pct); fg.classList.toggle('over', left < 0);
  $('sum-line').textContent = `Съедено ${fmt(t.kcal)} из ${fmt(tg.kcal)} ккал`;
  ['p', 'f', 'c'].forEach(k => {
    $(`m-${k}-v`).textContent = `${r0(t[k])} / ${tg[k]} г`;
    const b = $(`m-${k}-b`); b.style.width = Math.min(100, tg[k] > 0 ? t[k] / tg[k] * 100 : 0) + '%'; b.classList.toggle('over', t[k] > tg[k] * 1.05);
  });
  const meals = state.logs[d] || [];
  $('meal-groups').innerHTML = TYPES.map(ty => {
    const ms = meals.filter(m => mealType(m) === ty.id);
    const k = ms.reduce((s, m) => s + (+m.totals.kcal || 0), 0);
    return `<section class="group"><div class="ghead"><div><h3>${ty.name}</h3><small>${ms.length ? fmt(k) + ' ккал' : 'пока пусто'}</small></div>
      <button class="addmini" data-act="open-add" data-v="${ty.id}" aria-label="Добавить: ${ty.name}">${ic('plus')}</button></div>${ms.map(mealRow).join('')}</section>`;
  }).join('');
}
function mealRow(m) {
  const names = (m.items || []).map(i => `${esc(i.name)} ${r0(i.weight)} г`).join(', ');
  const img = m.thumbnail ? `<img src="${m.thumbnail}" alt="">` : '';
  return `<button class="mrow" data-act="edit-meal" data-id="${esc(m.id)}">${img}<div class="mtxt"><div class="mname">${names || 'Приём пищи'}</div>
    <div class="msub">Б ${r0(m.totals.p)} · Ж ${r0(m.totals.f)} · У ${r0(m.totals.c)} · ${esc(m.time || '')}</div></div>
    <div class="mk">${fmt(m.totals.kcal)}<small>ккал</small></div></button>`;
}

// ============ ПРОГРЕСС ============
function renderProgress() {
  const N = rangeDays, today = todayStr(), tg = state.targets, days = [];
  for (let i = N - 1; i >= 0; i--) { const date = shiftDate(today, -i); days.push({ date, ...dayTotals(date) }); }
  const logged = days.filter(x => x.n > 0);
  const max = Math.max(tg.kcal * 1.25, ...days.map(x => x.kcal), 1);
  const W = 360, H = 170, base = 148, bw = W / N, gap = Math.min(6, bw * 0.25);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Калории по дням">`;
  days.forEach((x, i) => {
    const h = x.kcal > 0 ? Math.max(3, x.kcal / max * (base - 8)) : 3;
    const cls = 'bar-r' + (x.kcal <= 0 ? ' zero' : x.date === today ? ' today' : x.kcal > tg.kcal * 1.05 ? ' over' : '');
    const dt = parseDate(x.date);
    const label = N === 7 ? WD[dt.getDay()] : (dt.getDate() % 5 === 0 || i === N - 1 ? dt.getDate() : '');
    svg += `<rect class="${cls}" x="${(i * bw + gap / 2).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw - gap).toFixed(1)}" height="${h.toFixed(1)}" rx="3" data-act="goto-date" data-date="${x.date}"/>`;
    if (label !== '') svg += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
  });
  const ty = base - tg.kcal / max * (base - 8);
  svg += `<line x1="0" x2="${W}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#9a9aa4" stroke-width="1" stroke-dasharray="4 4"/></svg>`;
  $('chart').innerHTML = svg;
  const avg = k => logged.length ? logged.reduce((s, x) => s + x[k], 0) / logged.length : 0;
  const pctN = logged.length && tg.kcal ? r0(avg('kcal') / tg.kcal * 100) : 0;
  $('stats').innerHTML = `
    <div class="stat"><small>Среднее в день</small><b>${fmt(avg('kcal'))}</b> <em>ккал</em><br><em>${pctN}% от нормы</em></div>
    <div class="stat"><small>Дней с записями</small><b>${logged.length}</b> <em>из ${N}</em></div>
    <div class="stat"><small>Белки / Жиры</small><b>${r0(avg('p'))} / ${r0(avg('f'))}</b> <em>г</em></div>
    <div class="stat"><small>Углеводы</small><b>${r0(avg('c'))}</b> <em>г в день</em></div>`;
  $('day-list').innerHTML = logged.length ? logged.slice().reverse().map(x => `<button class="listrow" data-act="goto-date" data-date="${x.date}"><span class="lt"><b>${esc(humanDate(x.date))}</b><small>Б ${r0(x.p)} · Ж ${r0(x.f)} · У ${r0(x.c)}</small></span><span class="dk2">${fmt(x.kcal)} ккал</span></button>`).join('')
    : '<p class="empty" style="padding:14px 0">За этот период записей пока нет.</p>';
}

// ============ «ЕЩЁ» ============
function renderMore() {
  const row = (act, icon, title, sub) => `<button class="listrow" data-act="${act}">${ic(icon)}<span class="lt"><b>${title}</b><small>${esc(sub)}</small></span><span class="chev">${ic('right')}</span></button>`;
  $('more-list').innerHTML =
    row('open-goals', 'target', 'Цели и норма', `${fmt(state.targets.kcal)} ккал · Б ${state.targets.p} · Ж ${state.targets.f} · У ${state.targets.c}`) +
    row('open-products', 'list', 'Мои продукты', `${productDatabase.length} в базе · ${favorites.length} избранных блюд`) +
    row('open-account', 'cloud', 'Аккаунт и копия', cloudUser ? 'Синхронизация включена' : 'Вход через Google, файл с копией') +
    row('open-key', 'key', 'Ключ ИИ (Gemini)', getKey() ? 'Ключ задан' : 'Не задан: нужен для фото и ИИ') +
    row('open-app', 'phone', 'Приложение', 'Установка, иконка, очистка дня');
}

// ============ КАЛЕНДАРЬ ============
function renderCalendar() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth(), today = todayStr();
  $('cal-label').textContent = `${MONTHS_NOM[m]} ${y}`;
  let h = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => `<div class="wd">${d}</div>`).join('');
  const off = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < off; i++) h += '<div></div>';
  for (let d = 1; d <= dim; d++) {
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const has = Array.isArray(state.logs[date]) && state.logs[date].length > 0;
    h += `<button class="${date === state.selectedDate ? 'sel' : ''} ${date === today ? 'today' : ''}" data-act="cal-pick" data-date="${date}">${d}${has ? '<i></i>' : ''}</button>`;
  }
  $('cal-grid').innerHTML = h;
}
SHEET_OPEN['sheet-calendar'] = () => { const [y, m] = state.selectedDate.split('-').map(Number); calMonth = new Date(y, m - 1, 1); renderCalendar(); };

// ============ ДОБАВЛЕНИЕ ЕДЫ: ЕДИНЫЙ ПОИСК ============
let draft = null;
let onlineState = { q: '', items: [], loading: false, error: '' };
let onlineTimer = null, onlineSeq = 0;
const onlineCache = {};

function withBase(it) {
  const w = Number(it.weight) > 0 ? Number(it.weight) : 100;
  const k = x => (Number(x) || 0) / w * 100;
  return { name: it.name || 'Продукт', weight: w, kcal: Number(it.kcal) || 0, p: Number(it.p) || 0, f: Number(it.f) || 0, c: Number(it.c) || 0, base: { kcal: k(it.kcal), p: k(it.p), f: k(it.f), c: k(it.c) } };
}
function newDraft(typeId) { draft = { items: [], type: typeId || autoType(), note: '', thumb: null, b64: null, mime: 'image/jpeg', editId: null, open: new Set(), busy: false }; }
function openAdd(typeId, editId) {
  if (openSheetId) hideSheet();
  newDraft(typeId);
  if (editId) {
    const m = (state.logs[state.selectedDate] || []).find(x => x.id === editId);
    if (!m) return;
    draft.editId = editId; draft.type = mealType(m); draft.note = m.note || ''; draft.thumb = m.thumbnail || null; draft.items = (m.items || []).map(withBase);
  }
  onlineState = { q: '', items: [], loading: false, error: '' };
  $('q').value = ''; $('add-title').textContent = editId ? 'Изменить приём пищи' : 'Добавить еду';
  $('scan-panel').classList.add('hidden'); $('ai-status').classList.add('hidden');
  openSheet('sheet-add'); renderAdd();
}
function cleanupAdd() { stopScanner(); clearTimeout(onlineTimer); onlineSeq++; draft = null; }
function renderAdd() { renderTypeSeg(); renderDraft(); renderResults(); renderPhotoChip(); }
function renderTypeSeg() { $('type-seg').innerHTML = TYPES.map(t => `<button class="${draft.type === t.id ? 'on' : ''}" data-act="set-type" data-v="${t.id}">${t.name}</button>`).join(''); }
function draftTotals() { const t = { kcal: 0, p: 0, f: 0, c: 0 }; draft.items.forEach(i => { t.kcal += +i.kcal || 0; t.p += +i.p || 0; t.f += +i.f || 0; t.c += +i.c || 0; }); return t; }
function renderPhotoChip() {
  const c = $('photo-chip');
  if (!draft.thumb) { c.classList.add('hidden'); c.innerHTML = ''; return; }
  c.classList.remove('hidden');
  c.innerHTML = `<img src="${draft.thumb}" alt=""><span>${draft.b64 ? 'Фото готово к распознаванию' : 'Фото приложено к записи'}</span><button class="iconbtn sm" data-act="photo-clear" aria-label="Убрать фото">${ic('x')}</button>`;
}
function draftRow(it, i) {
  const open = draft.open.has(i);
  return `<div class="drow">
    <div class="drow-top"><div class="dn">${esc(it.name)}</div><button class="iconbtn sm" data-act="draft-del" data-idx="${i}" aria-label="Убрать продукт">${ic('x')}</button></div>
    <div class="drow-mid"><div class="stepper"><button data-act="w-dec" data-idx="${i}" aria-label="Меньше">−</button><input type="number" inputmode="decimal" min="1" value="${r0(it.weight)}" data-dw="${i}" aria-label="Вес в граммах"><span>г</span><button data-act="w-inc" data-idx="${i}" aria-label="Больше">+</button></div>
    <div class="dk"><b>${r0(it.kcal)}</b> ккал</div></div>
    <button class="dmore" data-act="draft-more" data-idx="${i}">Б ${r1(it.p)} · Ж ${r1(it.f)} · У ${r1(it.c)}<span>${open ? 'скрыть' : 'изменить'}</span></button>
    ${open ? `<div class="dedit"><label class="field"><span>Название</span><input type="text" value="${esc(it.name)}" data-df="name" data-idx="${i}"></label>
      ${[['kcal', 'Ккал'], ['p', 'Белки'], ['f', 'Жиры'], ['c', 'Углев.']].map(([k, l]) => `<label class="field"><span>${l}</span><input type="number" inputmode="decimal" step="0.1" value="${r1(it[k])}" data-df="${k}" data-idx="${i}"></label>`).join('')}</div>` : ''}
  </div>`;
}
function renderDraft() {
  const box = $('draft-box'), n = draft.items.length, t = draftTotals();
  box.innerHTML = n ? `<div class="card draft">${draft.items.map(draftRow).join('')}<div class="dtotal"><span>Итого: Б ${r0(t.p)} · Ж ${r0(t.f)} · У ${r0(t.c)}</span><b>${r0(t.kcal)} ккал</b></div></div>` : '';
  const save = $('btn-save');
  save.disabled = !n;
  save.textContent = n ? `${draft.editId ? 'Сохранить' : 'Записать'} · ${r0(t.kcal)} ккал` : 'Добавьте продукты';
  $('btn-fav-dish').classList.toggle('hidden', !n);
  $('btn-del-meal').classList.toggle('hidden', !draft.editId);
}
function setWeight(i, w) {
  const it = draft.items[i]; if (!it || !(w > 0)) return;
  it.weight = w; it.kcal = it.base.kcal * w / 100; it.p = it.base.p * w / 100; it.f = it.base.f * w / 100; it.c = it.base.c * w / 100;
}
function setField(i, field, val) {
  const it = draft.items[i]; if (!it) return;
  if (field === 'name') { it.name = String(val).trim() || it.name; return; }
  it[field] = Math.max(0, parseFloat(val) || 0); it.base[field] = it[field] / it.weight * 100;
}
function addToDraft(item, label) { draft.items.push(withBase(item)); renderDraft(); $('q').value = ''; onlineState = { q: '', items: [], loading: false, error: '' }; renderResults(); toast('Добавлено: ' + (label || item.name)); }

// --- поиск по локальной базе ---
function searchLocal(q) {
  const toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return { products: [], dishes: [] };
  const hit = s => { const n = norm(s); return toks.every(t => n.includes(t)); };
  const score = p => (p.favorite ? 1000 : 0) + (p.useCount || 0) * 5 + (p.lastUsed ? p.lastUsed / 1e12 : 0);
  return {
    dishes: favorites.filter(f => hit(f.name)).slice(0, 5),
    products: productDatabase.filter(p => hit(p.name + ' ' + (p.brand || ''))).sort((a, b) => score(b) - score(a)).slice(0, 12)
  };
}
const prodSub = p => `${p.brand ? esc(p.brand) + ' · ' : ''}${r0(p.kcal)} ккал · Б ${r1(p.p)} · Ж ${r1(p.f)} · У ${r1(p.c)} на 100 г${p.defaultWeight ? ' · обычно ' + r0(p.defaultWeight) + ' г' : ''}`;
const prodRow = (p, act) => `<button class="prow" data-act="${act}" data-id="${esc(p.id)}"><span class="pt"><b>${esc(p.name)}</b><small>${prodSub(p)}</small></span><span class="pl">${ic('plus')}</span></button>`;
const dishRow = f => `<button class="prow" data-act="add-dish" data-id="${esc(f.id)}"><span class="pt"><b>${esc(f.name)}<span class="tag">блюдо</span></b><small>${r0(f.totals.kcal)} ккал · ${f.items.length} продукт(а)</small></span><span class="pl">${ic('plus')}</span></button>`;

function renderResults() {
  const q = $('q').value.trim(); let h = '';
  if (!q) {
    const recent = productDatabase.filter(p => p.lastUsed).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 10);
    if (favorites.length) h += `<div class="sec">Избранные блюда</div>` + favorites.slice(0, 8).map(dishRow).join('');
    if (recent.length) h += `<div class="sec">Недавние продукты</div>` + recent.map(p => prodRow(p, 'add-local')).join('');
    if (!favorites.length && !recent.length) h = `<p class="empty" style="margin-top:18px">Начните вводить название продукта, опишите блюдо словами (например «гречка 200 г и куриная грудка»), сфотографируйте тарелку или отсканируйте штрихкод. Всё в одной строке выше.</p>`;
  } else {
    if (q.length >= 3) h += `<div class="sec">Подсчитать с ИИ</div><button class="prow ai" data-act="ai-text">${ic('sparkle')}<span class="pt"><b>Посчитать КБЖУ с помощью ИИ</b><small>«${esc(q.slice(0, 80))}»${draft.b64 ? ' + фото' : ''}</small></span></button>`;
    if (/^\d{8,14}$/.test(q.replace(/\s/g, ''))) h += `<button class="prow" data-act="barcode-q">${ic('barcode')}<span class="pt"><b>Найти по штрихкоду</b><small>${esc(q)}</small></span></button>`;
    const { products, dishes } = searchLocal(q);
    if (dishes.length || products.length) h += `<div class="sec">В вашей базе</div>` + dishes.map(dishRow).join('') + products.map(p => prodRow(p, 'add-local')).join('');
    if (q.length >= 3) {
      h += `<div class="sec">В интернет-базе</div>`;
      if (onlineState.q === q && onlineState.items.length) h += onlineState.items.map(p => prodRow(p, 'add-online')).join('');
      else if (onlineState.q === q && onlineState.loading) h += `<div class="status"><span class="spin"></span>Ищем в интернете…</div>`;
      else if (!navigator.onLine) h += `<p class="empty">Нет интернета: показаны только сохранённые продукты.</p>`;
      else if (onlineState.q === q && onlineState.error) h += `<p class="empty">${esc(onlineState.error)}</p>`;
      else if (onlineState.q === q) h += `<p class="empty">Ничего не найдено. Попробуйте «Посчитать с ИИ» выше.</p>`;
    }
  }
  $('results').innerHTML = h;
}
function onQuery() {
  const q = $('q').value.trim(); renderResults(); clearTimeout(onlineTimer);
  if (q.length < 3 || /^\d+$/.test(q.replace(/\s/g, '')) || !navigator.onLine) { onlineState = { q: '', items: [], loading: false, error: '' }; return; }
  if (onlineCache[q]) { onlineState = { q, items: onlineCache[q], loading: false, error: '' }; renderResults(); return; }
  onlineState = { q, items: [], loading: true, error: '' }; renderResults();
  onlineTimer = setTimeout(() => searchOnline(q), 600);
}
function normalizeOFF(p) {
  const n = p.nutriments || {}, pick = (...ks) => { for (const k of ks) { const v = Number(n[k]); if (Number.isFinite(v)) return v; } return 0; };
  return { id: 'off_' + (p.code || Math.random().toString(36).slice(2)), name: p.product_name_ru || p.product_name_uk || p.product_name || p.brands || 'Продукт', brand: p.brands || '',
    kcal: pick('energy-kcal_100g', 'energy-kcal_value', 'energy-kcal'), p: pick('proteins_100g', 'proteins'), f: pick('fat_100g', 'fat'), c: pick('carbohydrates_100g', 'carbohydrates'), source: 'off' };
}
async function searchOnline(q) {
  const seq = ++onlineSeq, ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,product_name_ru,product_name_uk,brands,nutriments';
    const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const items = (data.products || []).filter(x => x.product_name || x.product_name_ru || x.product_name_uk).map(normalizeOFF).filter(x => x.kcal > 0 || x.p > 0 || x.f > 0 || x.c > 0);
    onlineCache[q] = items;
    if (seq === onlineSeq && draft && $('q').value.trim() === q) { onlineState = { q, items, loading: false, error: '' }; renderResults(); }
  } catch (e) {
    if (seq === onlineSeq && draft && $('q').value.trim() === q) { onlineState = { q, items: [], loading: false, error: 'Интернет-база не ответила. Попробуйте позже или используйте ИИ.' }; renderResults(); }
  } finally { clearTimeout(timer); }
}
const productToItem = p => ({ name: p.name, weight: p.defaultWeight || 100, kcal: (p.kcal || 0) * (p.defaultWeight || 100) / 100, p: (p.p || 0) * (p.defaultWeight || 100) / 100, f: (p.f || 0) * (p.defaultWeight || 100) / 100, c: (p.c || 0) * (p.defaultWeight || 100) / 100 });

// --- сохранение приёма пищи ---
function rememberProducts(items) {
  const now = Date.now();
  items.forEach(it => {
    const w = it.weight > 0 ? it.weight : 100, k = x => (Number(x) || 0) / w * 100, key = norm(it.name);
    let e = productDatabase.find(x => norm(x.name) === key);
    if (!e) { e = { id: 'p_' + now + '_' + Math.random().toString(36).slice(2, 6), name: it.name, source: 'history', favorite: false, useCount: 0 }; productDatabase.unshift(e); }
    Object.assign(e, { kcal: r1(k(it.kcal)), p: r1(k(it.p)), f: r1(k(it.f)), c: r1(k(it.c)), lastUsed: now, useCount: (e.useCount || 0) + 1, defaultWeight: r0(w) });
  });
  if (productDatabase.length > 600) {
    const keep = productDatabase.filter(p => p.favorite || p.source === 'custom'), rest = productDatabase.filter(p => !(p.favorite || p.source === 'custom')).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    productDatabase = keep.concat(rest.slice(0, Math.max(0, 600 - keep.length)));
  }
  saveProducts();
}
function saveMeal() {
  if (!draft || !draft.items.length) { toast('Добавьте хотя бы один продукт', 'err'); return; }
  const t = draftTotals(), totals = { kcal: r0(t.kcal), p: r1(t.p), f: r1(t.f), c: r1(t.c) };
  const items = draft.items.map(({ name, weight, kcal, p, f, c }) => ({ name, weight: r0(weight), kcal: r0(kcal), p: r1(p), f: r1(f), c: r1(c) }));
  if (!state.logs[state.selectedDate]) state.logs[state.selectedDate] = [];
  if (draft.editId) {
    const m = state.logs[state.selectedDate].find(x => x.id === draft.editId);
    if (!m) { toast('Запись не найдена', 'err'); closeSheet(); return; }
    Object.assign(m, { items, totals, type: draft.type, note: draft.note, thumbnail: draft.thumb || m.thumbnail || null });
    toast('Изменения сохранены');
  } else {
    state.logs[state.selectedDate].push({ id: 'meal_' + Date.now(), time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), type: draft.type, thumbnail: draft.thumb, note: draft.note, items, totals });
    toast(`+${totals.kcal} ккал записано`);
  }
  rememberProducts(items); persistState(); closeSheet(); renderToday();
}
function deleteMeal() {
  if (!draft || !draft.editId || !confirm('Удалить этот приём пищи?')) return;
  state.logs[state.selectedDate] = (state.logs[state.selectedDate] || []).filter(m => m.id !== draft.editId);
  persistState(); closeSheet(); renderToday(); toast('Приём пищи удалён');
}
function saveFavoriteDish() {
  if (!draft || !draft.items.length) return;
  const name = (prompt('Название избранного блюда:', draft.items.map(i => i.name).join(', ').slice(0, 40)) || '').trim().slice(0, 40); if (!name) return;
  const t = draftTotals();
  const entry = { id: 'fav_' + Date.now(), name, items: draft.items.map(({ name, weight, kcal, p, f, c }) => ({ name, weight, kcal: r0(kcal), p: r1(p), f: r1(f), c: r1(c) })), totals: { kcal: r0(t.kcal), p: r1(t.p), f: r1(t.f), c: r1(t.c) } };
  favorites = favorites.filter(x => norm(x.name) !== norm(name)); favorites.unshift(entry); favorites = favorites.slice(0, 40);
  saveFavorites(); renderResults(); toast('Блюдо сохранено в избранное');
}

// ============ ИИ (Gemini) ============
async function fetchWithBackoff(url, options, maxRetries = 1, timeoutMs = 25000) {
  let delay = 1000;
  for (let a = 0; a <= maxRetries; a++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { ...options, signal: ctl.signal }); clearTimeout(timer);
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status >= 500) { if (a === maxRetries) throw new Error('HTTP ' + r.status); await new Promise(s => setTimeout(s, delay)); delay *= 2; continue; }
      const fe = new Error(`API Error (${r.status}): ${await r.text()}`); fe.fatal = true; throw fe;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') { const te = new Error('Timeout: Gemini не ответил за ' + Math.round(timeoutMs / 1000) + ' секунд'); te.fatal = true; throw te; }
      if (err.fatal || a === maxRetries) throw err;
      await new Promise(s => setTimeout(s, delay)); delay *= 2;
    }
  }
}
async function callGemini(payload) {
  const key = getKey(); let last = null;
  for (const model of GEMINI_MODELS) {
    try { return await fetchWithBackoff(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
    catch (err) { err.model = model; last = err; if (/API key not valid|API_KEY_INVALID|API Error \((401|403)\)/i.test(String(err.message))) throw err; }
  }
  throw last;
}
function describeAiError(error) {
  const raw = String((error && error.message) || error || ''); let apiMsg = ''; const i = raw.indexOf('{');
  if (i >= 0) { try { apiMsg = (JSON.parse(raw.slice(i)).error || {}).message || ''; } catch (e) { apiMsg = raw.slice(i, i + 160); } }
  const code = (raw.match(/\((\d{3})\)/) || raw.match(/HTTP (\d{3})/) || [])[1]; let reason;
  if (/Timeout/i.test(raw)) reason = 'Gemini слишком долго отвечает. Попробуйте ещё раз.';
  else if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) reason = 'Нет связи с Gemini (интернет, VPN или блокировщик рекламы).';
  else if (code === '429') reason = 'Закончился лимит Gemini. Подождите минуту.';
  else if (/API key not valid|API_KEY_INVALID|expired/i.test(raw)) reason = 'Gemini не принял ключ. Проверьте его: Ещё → Ключ ИИ.';
  else if (code === '404') reason = 'Модель Gemini недоступна.';
  else if (code === '403') reason = 'Доступ запрещён: ключ ограничен или недоступен в вашем регионе.';
  else if (/JSON|Unexpected token|Пустой ответ/i.test(raw)) reason = 'Gemini вернул непонятный ответ. Попробуйте ещё раз.';
  else reason = 'Не удалось распознать.';
  return reason + (code ? ' [' + code + '] ' : ' ') + (apiMsg || raw).replace(/\s+/g, ' ').slice(0, 120);
}
function setAIStatus(msg) { const s = $('ai-status'); if (!msg) { s.classList.add('hidden'); s.innerHTML = ''; return; } s.classList.remove('hidden'); s.innerHTML = `<span class="spin"></span>${esc(msg)}`; }

async function runAI(text) {
  const d = draft; if (!d || d.busy) return;
  if (!d.b64 && !text) { toast('Опишите еду словами или сфотографируйте её', 'err'); return; }
  if (!getKey()) { toast('Нужен ключ ИИ: Ещё → Ключ ИИ (Gemini)', 'err', 5000); return; }
  d.busy = true; setAIStatus('ИИ считает КБЖУ…');
  try {
    const systemPrompt = `Ты — профессиональный спортивный нутрициолог и эксперт по оценке калорийности блюд по фото и тексту.
Твоя задача:
1. Определить каждый отдельный продукт или блюдо на фотографии и/или из текстового описания пользователя.
2. Обязательно учесть все уточнения пользователя (добавки, способ приготовления, вес в граммах и т.д.).
3. Реалистично оценить вес каждой порции в граммах (для готового блюда) и рассчитать калории (kcal), белки (p), жиры (f) и углеводы (c).
4. Названия продуктов пиши понятно и кратко на русском языке.`;
    const userText = d.b64 ? `Проанализируй это фото еды и посчитай КБЖУ каждого продукта. ${text ? 'Дополнительное уточнение от пользователя: ' + text : ''}` : `Посчитай КБЖУ для следующего приёма пищи: ${text}`;
    const parts = [{ text: userText }]; if (d.b64) parts.push({ inlineData: { mimeType: d.mime, data: d.b64 } });
    const num = t => ({ type: 'NUMBER', description: t });
    const result = await callGemini({
      contents: [{ role: 'user', parts }], systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' }, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Название продукта на русском' }, weight: num('Вес порции, г'), kcal: num('Калории порции'), p: num('Белки, г'), f: num('Жиры, г'), c: num('Углеводы, г') }, required: ['name', 'weight', 'kcal', 'p', 'f', 'c'] } } }, required: ['items'] } }
    });
    const jt = result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text;
    if (!jt) throw new Error('Пустой ответ от модели');
    const parsed = JSON.parse(jt);
    if (draft !== d) return;
    (parsed.items || []).forEach(it => d.items.push(withBase({ name: it.name || 'Продукт', weight: Math.round(it.weight || 100), kcal: Math.round(it.kcal || 0), p: r1(it.p), f: r1(it.f), c: r1(it.c) })));
    if (text) d.note = text; d.b64 = null; $('q').value = '';
    renderPhotoChip(); renderDraft(); renderResults(); toast('Готово: проверьте вес и нажмите «Записать»');
  } catch (e) { console.error(e); if (draft === d) toast(describeAiError(e), 'err', 9000); }
  finally { d.busy = false; if (draft === d) setAIStatus(''); }
}
function handlePhoto(file) {
  if (!file || !draft) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1024; let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) { if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; } }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
      draft.b64 = cv.toDataURL('image/jpeg', 0.85).split(',')[1]; draft.mime = 'image/jpeg';
      const tc = document.createElement('canvas'); tc.width = tc.height = 160; const side = Math.min(img.width, img.height);
      tc.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 160, 160);
      draft.thumb = tc.toDataURL('image/jpeg', 0.7);
      renderPhotoChip(); renderResults(); runAI($('q').value.trim());
    };
    img.onerror = () => toast('Не удалось открыть фото', 'err'); img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ============ СКАНЕР ШТРИХКОДОВ ============
let scanStream = null, scanDetector = null, scanFrame = null, scanZX = null, scanBusy = false;
function setScanStatus(msg, bad) { const e = $('scan-status'); e.textContent = msg; e.style.color = bad ? 'var(--bad)' : ''; }
async function startScanner() {
  $('scan-panel').classList.remove('hidden'); $('scan-manual').value = '';
  const video = $('scan-video');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setScanStatus('Камера недоступна. Введите цифры штрихкода вручную.', true); return; }
  try {
    setScanStatus('Запрашиваем доступ к камере…'); video.classList.remove('hidden');
    if (!('BarcodeDetector' in window)) {
      if (!window.ZXingBrowser) await loadScript('https://unpkg.com/@zxing/browser@0.2.1');
      const reader = new ZXingBrowser.BrowserMultiFormatReader();
      scanZX = await reader.decodeFromVideoDevice(undefined, video, (res, err, controls) => { if (controls) scanZX = controls; if (res && res.getText()) { const c = res.getText(); stopScanner(); lookupBarcode(c); } });
      setScanStatus('Наведите камеру на штрихкод.'); return;
    }
    const supported = await BarcodeDetector.getSupportedFormats();
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter(x => supported.includes(x));
    if (!formats.length) throw new Error('Браузер не поддерживает нужные форматы штрихкодов.');
    scanDetector = new BarcodeDetector({ formats });
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = scanStream; await video.play(); setScanStatus('Наведите камеру на штрихкод.'); scanLoop();
  } catch (e) { stopScanner(true); setScanStatus(e.name === 'NotAllowedError' ? 'Нет доступа к камере. Разрешите его в настройках браузера или введите цифры вручную.' : (e.message || 'Не удалось запустить камеру. Введите цифры вручную.'), true); }
}
async function scanLoop() {
  const v = $('scan-video');
  if (!scanDetector || !v || v.readyState < 2 || scanBusy) { scanFrame = requestAnimationFrame(scanLoop); return; }
  try { const codes = await scanDetector.detect(v); if (codes.length && codes[0].rawValue) { const c = codes[0].rawValue; stopScanner(); await lookupBarcode(c); return; } } catch (e) {}
  scanFrame = requestAnimationFrame(scanLoop);
}
function stopScanner(keepPanel) {
  if (scanFrame) cancelAnimationFrame(scanFrame); scanFrame = null;
  if (scanZX) { try { scanZX.stop(); } catch (e) {} } scanZX = null;
  if (scanStream) scanStream.getTracks().forEach(t => t.stop()); scanStream = null; scanDetector = null;
  const v = $('scan-video'); if (v) { v.pause(); v.srcObject = null; v.classList.add('hidden'); }
  if (!keepPanel) $('scan-panel').classList.add('hidden');
}
async function lookupBarcode(value) {
  const code = String(value || $('scan-manual').value || '').replace(/\s/g, '');
  if (!/^\d{8,14}$/.test(code)) { $('scan-panel').classList.remove('hidden'); setScanStatus('Штрихкод — это 8–14 цифр.', true); return; }
  if (scanBusy || !draft) return; scanBusy = true; const d = draft;
  $('scan-panel').classList.remove('hidden'); setScanStatus('Ищем продукт…');
  try {
    if (!navigator.onLine) throw new Error('Нет интернета: поиск по штрихкоду недоступен.');
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_ru,product_name_uk,brands,nutriments`);
    if (!r.ok) throw new Error('База продуктов временно недоступна.');
    const data = await r.json(); if (data.status !== 1 || !data.product) throw new Error('Продукт не найден. Найдите его по названию или добавьте вручную.');
    const p = data.product, n = p.nutriments || {};
    const kcal = Number(n['energy-kcal_100g'] ?? n['energy-kcal_value'] ?? (Number(n.energy_100g) / 4.184)), pr = Number(n.proteins_100g), fa = Number(n.fat_100g), ca = Number(n.carbohydrates_100g);
    if (![kcal, pr, fa, ca].every(Number.isFinite)) throw new Error('В базе нет полных данных КБЖУ для этого продукта.');
    const name = String(p.product_name_ru || p.product_name_uk || p.product_name || p.brands || 'Продукт ' + code).trim();
    if (draft === d) { stopScanner(); d.items.push(withBase({ name, weight: 100, kcal: Math.round(kcal), p: r1(pr), f: r1(fa), c: r1(ca) })); $('q').value = ''; renderDraft(); renderResults(); toast('Добавлено: ' + name + '. Проверьте вес.'); }
  } catch (e) { setScanStatus(e.message || 'Не удалось найти продукт.', true); }
  finally { scanBusy = false; }
}

// ============ ЦЕЛИ И НОРМА ============
function paintGender() { document.querySelectorAll('#gender-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === state.profile.gender)); }
SHEET_OPEN['sheet-goals'] = () => {
  const t = state.targets, p = state.profile;
  $('g-kcal').value = t.kcal; $('g-p').value = t.p; $('g-f').value = t.f; $('g-c').value = t.c;
  $('pr-age').value = p.age; $('pr-weight').value = p.weight; $('pr-height').value = p.height; $('pr-activity').value = p.activity; $('pr-goal').value = p.goal; $('pr-notes').value = p.notes || '';
  paintGender(); $('norm-result').classList.add('hidden'); lastNorm = null;
};
function readProfile() {
  const p = state.profile;
  p.age = parseInt($('pr-age').value, 10) || 25; p.weight = parseFloat($('pr-weight').value) || 75; p.height = parseInt($('pr-height').value, 10) || 180;
  p.activity = $('pr-activity').value; p.goal = $('pr-goal').value; p.notes = $('pr-notes').value.trim();
}
function saveGoals() {
  readProfile();
  state.targets = { kcal: parseInt($('g-kcal').value, 10) || 3400, p: parseInt($('g-p').value, 10) || 180, f: parseInt($('g-f').value, 10) || 95, c: parseInt($('g-c').value, 10) || 455 };
  persistState(); closeSheet(); renderAll(); toast('Цели сохранены');
}
async function calcNorm() {
  readProfile(); persistState();
  if (!getKey()) { toast('Нужен ключ ИИ: Ещё → Ключ ИИ (Gemini)', 'err', 5000); return; }
  const act = { sedentary: 'Сидячий образ жизни (коэффициент ~1.2)', light: 'Лёгкая активность, 1–3 тренировки в неделю (~1.375)', moderate: 'Умеренная активность, 3–5 тренировок (~1.55)', high: 'Высокая активность, 6–7 тренировок (~1.725)', extreme: 'Экстремальная активность (~1.9)' };
  const goal = { bulk: 'Набор мышечной массы (профицит ~10–15% к TDEE)', maintain: 'Поддержание веса (равен TDEE)', cut: 'Похудение (дефицит ~15–20% от TDEE с повышенным белком)' };
  const btn = $('btn-calc'); btn.disabled = true; $('norm-loading').classList.remove('hidden'); $('norm-result').classList.add('hidden');
  try {
    const p = state.profile;
    const system = `Ты — сертифицированный спортивный нутрициолог.
Рассчитай базовый обмен веществ (формула Миффлина — Сан Жеора), суточный расход энергии (TDEE) и оптимальную суточную норму калорий и БЖУ в граммах под цель пользователя.
Убедись, что калории из БЖУ (Б*4 + Ж*9 + У*4) соответствуют итоговой калорийности.
Дай краткое обоснование на русском языке (2–3 предложения).`;
    const user = `Данные человека:\n- Пол: ${p.gender === 'female' ? 'Женский' : 'Мужской'}\n- Возраст: ${p.age} лет\n- Вес: ${p.weight} кг\n- Рост: ${p.height} см\n- Образ жизни: ${act[p.activity]}\n- Цель: ${goal[p.goal]}${p.notes ? '\n- Пожелания: ' + p.notes : ''}`;
    const N = t => ({ type: 'NUMBER', description: t });
    const res = await callGemini({ contents: [{ role: 'user', parts: [{ text: user }] }], systemInstruction: { parts: [{ text: system }] },
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' }, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { bmr: N('BMR'), tdee: N('TDEE'), targetKcal: N('Рекомендуемая калорийность'), protein: N('Белки, г'), fat: N('Жиры, г'), carbs: N('Углеводы, г'), explanation: { type: 'STRING', description: 'Обоснование на русском' } }, required: ['bmr', 'tdee', 'targetKcal', 'protein', 'fat', 'carbs', 'explanation'] } } });
    const jt = res && res.candidates && res.candidates[0] && res.candidates[0].content.parts[0].text; if (!jt) throw new Error('Пустой ответ от ИИ');
    const j = JSON.parse(jt); lastNorm = { kcal: r0(j.targetKcal), p: r0(j.protein), f: r0(j.fat), c: r0(j.carbs) };
    $('res-bmr').textContent = r0(j.bmr) + ' ккал'; $('res-tdee').textContent = r0(j.tdee) + ' ккал'; $('res-kcal').textContent = lastNorm.kcal + ' ккал';
    $('res-pfc').textContent = `${lastNorm.p} / ${lastNorm.f} / ${lastNorm.c} г`; $('res-explain').textContent = j.explanation || '';
    $('norm-result').classList.remove('hidden');
  } catch (e) { console.error(e); toast(describeAiError(e), 'err', 8000); }
  finally { btn.disabled = false; $('norm-loading').classList.add('hidden'); }
}
function applyNorm() { if (!lastNorm) return; state.targets = { ...lastNorm }; persistState(); closeSheet(); renderAll(); toast(`Новая норма: ${state.targets.kcal} ккал`); }

// ============ МОИ ПРОДУКТЫ ============
let pmFilter = 'all';
SHEET_OPEN['sheet-products'] = () => { $('pm-q').value = ''; pmFilter = 'all'; paintPM(); renderPM(); };
function paintPM() { document.querySelectorAll('#pm-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === pmFilter)); }
function renderPM() {
  const q = norm($('pm-q').value), box = $('pm-list'), tokens = q.split(/\s+/).filter(Boolean), hit = s => tokens.every(t => norm(s).includes(t));
  if (pmFilter === 'dish') {
    const list = favorites.filter(f => hit(f.name));
    box.innerHTML = list.length ? list.map(f => `<div class="listrow"><span class="lt"><b>${esc(f.name)}</b><small>${r0(f.totals.kcal)} ккал · ${f.items.length} продукт(а)</small></span><button class="iconbtn sm" data-act="dish-del" data-id="${esc(f.id)}" aria-label="Удалить">${ic('trash')}</button></div>`).join('') : '<p class="empty" style="padding:14px 0">Избранных блюд пока нет. Их можно сохранить звёздочкой при добавлении еды.</p>';
    return;
  }
  let list = productDatabase.filter(p => hit(p.name + ' ' + (p.brand || '')));
  if (pmFilter === 'fav') list = list.filter(p => p.favorite); if (pmFilter === 'custom') list = list.filter(p => p.source === 'custom');
  list.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.lastUsed || 0) - (a.lastUsed || 0));
  box.innerHTML = list.length ? list.slice(0, 150).map(p => `<div class="listrow"><span class="lt"><b>${esc(p.name)}</b><small>${prodSub(p)}</small></span>
    <button class="iconbtn sm" data-act="pm-fav" data-id="${esc(p.id)}" aria-label="В избранное" style="color:${p.favorite ? 'var(--warn)' : 'var(--mu)'}">${p.favorite ? ic('star').replace('fill="none"', 'fill="currentColor"') : ic('star')}</button>
    <button class="iconbtn sm" data-act="pm-del" data-id="${esc(p.id)}" aria-label="Удалить">${ic('trash')}</button></div>`).join('')
    : '<p class="empty" style="padding:14px 0">Здесь появятся продукты, которые вы добавляете в дневник. Они находятся поиском за секунду, даже без интернета.</p>';
}
function saveCustom() {
  const name = $('cp-name').value.trim(); if (!name) { toast('Введите название', 'err'); return; }
  const v = ['kcal', 'p', 'f', 'c'].map(k => Number($('cp-' + k).value));
  if (v.some(n => !Number.isFinite(n) || n < 0)) { toast('Заполните КБЖУ числами', 'err'); return; }
  productDatabase.unshift({ id: 'custom_' + Date.now(), name, kcal: v[0], p: v[1], f: v[2], c: v[3], source: 'custom', favorite: false, lastUsed: Date.now(), useCount: 0 });
  saveProducts(); ['name', 'kcal', 'p', 'f', 'c'].forEach(k => $('cp-' + k).value = ''); pmFilter = 'custom'; paintPM(); renderPM(); toast('Продукт сохранён');
}

// ============ АККАУНТ, КОПИЯ, КЛЮЧ, ПРИЛОЖЕНИЕ ============
SHEET_OPEN['sheet-account'] = () => { updateCloudUI(); const lb = localStorage.getItem('ai_kbju_last_backup'); $('backup-info').textContent = lb ? 'Последняя копия: ' + lb : 'Копию в файл вы ещё не сохраняли.'; };
function exportBackup() {
  const data = { app: 'kbju-track', version: 9, exportedAt: new Date().toISOString(), targets: state.targets, profile: state.profile, logs: state.logs, favorites, productDatabase };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `kbju-backup-${todayStr()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  localStorage.setItem('ai_kbju_last_backup', fullDate(todayStr())); $('backup-info').textContent = 'Последняя копия: ' + fullDate(todayStr()); toast('Копия сохранена в файл');
}
function importBackup(file) {
  if (!file) return; const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || typeof d !== 'object' || !d.logs || typeof d.logs !== 'object') throw new Error('bad');
      if (!confirm('Добавить данные из копии к текущим? Новые записи и продукты добавятся, цели и профиль возьмутся из файла.')) return;
      let added = 0;
      if (d.targets) state.targets = { ...state.targets, ...d.targets }; if (d.profile) state.profile = { ...state.profile, ...d.profile };
      Object.keys(d.logs).forEach(date => {
        const cur = state.logs[date] || [], ids = new Set(cur.map(m => m.id));
        (Array.isArray(d.logs[date]) ? d.logs[date] : []).forEach(m => { if (m && m.id && !ids.has(m.id)) { cur.push(m); added++; } });
        cur.sort((a, b) => String(a.time).localeCompare(String(b.time))); state.logs[date] = cur;
      });
      if (Array.isArray(d.favorites)) { const ids = new Set(favorites.map(f => f.id)); d.favorites.forEach(f => { if (f && f.id && !ids.has(f.id)) favorites.push(f); }); saveFavorites(); }
      if (Array.isArray(d.productDatabase)) { const ids = new Set(productDatabase.map(p => p.id)); d.productDatabase.forEach(p => { if (p && p.id && !ids.has(p.id)) productDatabase.push(p); }); saveProducts(); }
      persistState(); renderAll(); toast(`Копия загружена: добавлено записей — ${added}`);
    } catch (e) { toast('Это не файл копии КБЖУ', 'err'); }
  };
  rd.readAsText(file);
}
SHEET_OPEN['sheet-key'] = () => { $('key-input').value = getKey(); $('key-input').type = 'password'; };
function saveKey() {
  const v = $('key-input').value.trim();
  if (v) localStorage.setItem(LS.key, v); else localStorage.removeItem(LS.key);
  scheduleCloudSync(); closeSheet(); renderAll(); toast(v ? 'Ключ сохранён' : 'Ключ удалён');
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = $('install-native'); if (b) b.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Приложение установлено'); });
SHEET_OPEN['sheet-app'] = () => {
  $('install-native').classList.toggle('hidden', !deferredInstall);
  $('sw-status').textContent = ('serviceWorker' in navigator && navigator.serviceWorker.controller) ? 'Работа без интернета включена: дневник открывается и без сети.' : 'Работа без интернета включится после следующего запуска приложения.';
};
function makeDefaultIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#9bdca0'; x.lineWidth = 34; x.lineCap = 'round'; x.beginPath(); x.arc(256, 256, 170, -Math.PI / 2, Math.PI * 1.1); x.stroke();
  x.fillStyle = '#f3f3f4'; x.font = '800 108px -apple-system, "Segoe UI", Roboto, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('КБЖУ', 256, 262);
  return c.toDataURL('image/png');
}
function applyIcon(url) {
  const a = $('apple-touch-icon'); if (a) a.href = url;
  const m = { name: 'КБЖУ — дневник питания', short_name: 'КБЖУ', start_url: location.href.split('#')[0], display: 'standalone', orientation: 'portrait', background_color: '#0b0b0c', theme_color: '#0b0b0c', icons: [{ src: url, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] };
  const el = $('pwa-manifest'); if (el) el.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
}
function pickIcon(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Выберите картинку', 'err'); return; }
  const rd = new FileReader();
  rd.onload = () => { const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 512, 512);
    const url = c.toDataURL('image/png'); try { localStorage.setItem(LS.icon, url); applyIcon(url); toast('Иконка обновлена'); } catch (e) { toast('Картинка слишком большая', 'err'); }
  }; img.onerror = () => toast('Не удалось открыть картинку', 'err'); img.src = rd.result; };
  rd.readAsDataURL(file);
}
function initPWA() {
  try { applyIcon(localStorage.getItem(LS.icon) || makeDefaultIcon()); } catch (e) {}
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
function updateOnlinePill() { $('offline-pill').classList.toggle('hidden', navigator.onLine); }

// ============ ИИ-СОВЕТ ============
async function askCoach() {
  if (!getKey()) { toast('Нужен ключ ИИ: Ещё → Ключ ИИ (Gemini)', 'err', 5000); return; }
  const meals = state.logs[state.selectedDate] || [], t = dayTotals(state.selectedDate), tg = state.targets, p = state.profile;
  const eaten = meals.map((m, i) => `${i + 1}) ${m.time} (${(TYPES.find(x => x.id === mealType(m)) || {}).name}): ${m.items.map(x => `${x.name} (${x.weight}г)`).join(', ')} [${m.totals.kcal} ккал, Б:${m.totals.p} Ж:${m.totals.f} У:${m.totals.c}]`);
  const q = $('coach-q').value.trim(), btn = $('btn-coach'); btn.disabled = true; $('coach-loading').classList.remove('hidden'); $('coach-out').classList.add('hidden');
  try {
    const prompt = `Ты — дружелюбный и практичный персональный нутрициолог. Проанализируй рацион за день (${humanDate(state.selectedDate)}) и дай конкретные советы на русском языке.

АНКЕТА: ${p.gender === 'female' ? 'женщина' : 'мужчина'}, ${p.age} лет, ${p.weight} кг, ${p.height} см. Активность: ${p.activity}. Цель: ${p.goal}.${p.notes ? ' Особенности: ' + p.notes : ''}
НОРМА НА ДЕНЬ: ${tg.kcal} ккал, Б ${tg.p} г, Ж ${tg.f} г, У ${tg.c} г.
УЖЕ СЪЕДЕНО:
${eaten.length ? eaten.join('\n') : 'Пока ничего не записано.'}
ИТОГО: ${r0(t.kcal)} ккал (Б ${r0(t.p)}, Ж ${r0(t.f)}, У ${r0(t.c)}). ОСТАЛОСЬ: ${tg.kcal - r0(t.kcal)} ккал (Б ${r0(tg.p - t.p)}, Ж ${r0(tg.f - t.f)}, У ${r0(tg.c - t.c)}).
${q ? 'ВОПРОС ПОЛЬЗОВАТЕЛЯ: "' + q + '"' : ''}

Ответ кратко и по делу: 1) оценка баланса, 2) на что сделать упор дальше, 3) 2–3 примера блюд с граммовкой под остаток. Без звёздочек и markdown-разметки.`;
    const res = await callGemini({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } });
    const reply = res && res.candidates && res.candidates[0] && res.candidates[0].content.parts[0].text; if (!reply) throw new Error('Пустой ответ от ИИ');
    const out = $('coach-out'); out.textContent = reply.replace(/\*\*/g, '').replace(/^\s*[*#]+\s?/gm, ''); out.classList.remove('hidden');
  } catch (e) { console.error(e); toast(describeAiError(e), 'err', 8000); }
  finally { btn.disabled = false; $('coach-loading').classList.add('hidden'); }
}

// ============ ОБРАБОТЧИКИ ============
const ACT = {
  tab: d => showView(d.v),
  'day-prev': () => gotoDate(shiftDate(state.selectedDate, -1)), 'day-next': () => gotoDate(shiftDate(state.selectedDate, 1)),
  'open-calendar': () => openSheet('sheet-calendar'),
  'cal-prev': () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); },
  'cal-next': () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); },
  'cal-pick': d => { state.selectedDate = d.date; closeSheet(); showView('today'); },
  'cal-today': () => { state.selectedDate = todayStr(); closeSheet(); showView('today'); },
  'close-sheet': () => closeSheet(),
  'goto-date': d => { state.selectedDate = d.date; showView('today'); },
  range: d => { rangeDays = +d.v; document.querySelectorAll('#range-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); renderProgress(); },
  'open-add': d => openAdd(d.v), 'edit-meal': d => openAdd(null, d.id),
  'open-coach': () => openSheet('sheet-coach'), 'ask-coach': askCoach,
  'open-goals': () => openSheet('sheet-goals'), 'open-products': () => openSheet('sheet-products'), 'open-account': () => openSheet('sheet-account'), 'open-key': () => openSheet('sheet-key'), 'open-app': () => openSheet('sheet-app'),
  // окно добавления
  'set-type': d => { draft.type = d.v; renderTypeSeg(); },
  'pick-photo': () => { if (!getKey()) { toast('Для фото нужен ключ ИИ: Ещё → Ключ ИИ (Gemini)', 'err', 5000); return; } $('photo-input').click(); },
  'photo-clear': () => { draft.thumb = null; draft.b64 = null; renderPhotoChip(); renderResults(); },
  'open-scan': () => startScanner(), 'scan-close': () => stopScanner(), 'scan-find': () => lookupBarcode(),
  'barcode-q': () => lookupBarcode($('q').value),
  'ai-text': () => runAI($('q').value.trim()),
  'draft-del': d => { draft.items.splice(+d.idx, 1); draft.open.clear(); renderDraft(); },
  'draft-more': d => { const i = +d.idx; draft.open.has(i) ? draft.open.delete(i) : draft.open.add(i); renderDraft(); },
  'w-dec': d => { const it = draft.items[+d.idx], st = it.weight > 50 ? 10 : 5; setWeight(+d.idx, Math.max(st, it.weight - st)); renderDraft(); },
  'w-inc': d => { const it = draft.items[+d.idx], st = it.weight >= 50 ? 10 : 5; setWeight(+d.idx, it.weight + st); renderDraft(); },
  'add-local': d => { const p = productDatabase.find(x => x.id === d.id); if (p) addToDraft(productToItem(p), p.name); },
  'add-online': d => { const p = onlineState.items.find(x => x.id === d.id); if (p) addToDraft(productToItem(p), p.name); },
  'add-dish': d => { const f = favorites.find(x => x.id === d.id); if (!f) return; f.items.forEach(i => draft.items.push(withBase(i))); renderDraft(); $('q').value = ''; renderResults(); toast('Добавлено: ' + f.name); },
  'save-meal': () => saveMeal(), 'del-meal': () => deleteMeal(), 'fav-dish': () => saveFavoriteDish(),
  // цели
  gender: d => { state.profile.gender = d.v; paintGender(); }, 'calc-norm': () => calcNorm(), 'apply-norm': () => applyNorm(), 'save-goals': () => saveGoals(),
  // продукты
  'pm-filter': d => { pmFilter = d.v; paintPM(); renderPM(); },
  'pm-fav': d => { const p = productDatabase.find(x => x.id === d.id); if (p) { p.favorite = !p.favorite; saveProducts(); renderPM(); } },
  'pm-del': d => { const p = productDatabase.find(x => x.id === d.id); if (p && confirm(`Удалить «${p.name}» из базы?`)) { productDatabase = productDatabase.filter(x => x.id !== d.id); saveProducts(); renderPM(); } },
  'dish-del': d => { const f = favorites.find(x => x.id === d.id); if (f && confirm(`Удалить блюдо «${f.name}»?`)) { favorites = favorites.filter(x => x.id !== d.id); saveFavorites(); renderPM(); } },
  'save-custom': () => saveCustom(),
  // аккаунт, ключ, приложение
  signin: () => signIn(), signout: () => signOut(),
  'backup-export': () => exportBackup(), 'backup-import': () => $('backup-input').click(),
  'key-toggle': () => { const i = $('key-input'); i.type = i.type === 'password' ? 'text' : 'password'; }, 'key-save': () => saveKey(),
  'install-native': async () => { if (!deferredInstall) return; deferredInstall.prompt(); const r = await deferredInstall.userChoice; if (r.outcome === 'accepted') deferredInstall = null; $('install-native').classList.add('hidden'); },
  'icon-pick': () => $('icon-input').click(),
  'icon-reset': () => { localStorage.removeItem(LS.icon); applyIcon(makeDefaultIcon()); toast('Стандартная иконка возвращена'); },
  'clear-day': () => { if (confirm('Очистить все записи за ' + humanDate(state.selectedDate).toLowerCase() + '?')) { state.logs[state.selectedDate] = []; persistState(); closeSheet(); renderAll(); toast('День очищен'); } }
};
function bindEvents() {
  document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const fn = ACT[el.dataset.act]; if (fn) fn(el.dataset, el, e); });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'photo-input') { handlePhoto(t.files[0]); t.value = ''; }
    else if (t.id === 'backup-input') { importBackup(t.files[0]); t.value = ''; }
    else if (t.id === 'icon-input') { pickIcon(t.files[0]); t.value = ''; }
    else if (draft && t.dataset.dw !== undefined) { setWeight(+t.dataset.dw, parseFloat(t.value)); renderDraft(); }
    else if (draft && t.dataset.df) { setField(+t.dataset.idx, t.dataset.df, t.value); renderDraft(); }
  });
  $('q').addEventListener('input', onQuery);
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('pm-q').addEventListener('input', renderPM);
  window.addEventListener('online', () => { updateOnlinePill(); initCloud(); }); window.addEventListener('offline', updateOnlinePill);
}
function start() { paintIcons(); initPWA(); loadState(); bindEvents(); updateOnlinePill(); showView('today'); initCloud(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
