/* GameShelf — script.js
   1 CONFIG (edit here) · 2 helpers · 3 state & settings · 4 appearance · 5 rendering ·
   6 player · 7 status bar · 8 Supabase / leaderboards / account · 9 settings UI · 10 init */
(() => {
'use strict';

/* ═════════════ 1. CONFIG — edit this section ═════════════ */

const SITE_VERSION = '1.0.0';
const SUPABASE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

/* THE GAME CATALOG
   Your real HTML files go in /games. Register each one here. Nothing is registered by default,
   because no game files had been provided when this framework was generated.

   {
     id: 'my-game',                 // unique: lowercase letters, numbers, hyphens
     title: 'My Game',
     description: 'One sentence about the game.',
     category: 'arcade',            // any id from DEFAULT_CATEGORIES below, or a new one
     tags: ['example'],
     file: 'games/my-game.html',    // relative path, exactly as the file is named
     featured: false,
     status: 'ready',               // 'ready' | 'coming-soon' | 'unavailable'
     thumb: { colors: ['#39ff14', '#7b2cff'], symbol: '🕹️', pattern: 'grid' },  // optional
     display: { launch: 'player' }, // optional: 'player' (in-page, with Back button) | 'direct'
     leaderboard: { enabled: false, gameId: 'my-game', note: 'Why it is off' }   // optional
   }
   thumb.pattern: grid | stripes | dots | checker | waves | rays                                    */
const GAME_CATALOG = [
];

const DEFAULT_CATEGORIES = [
  { id: 'arcade', name: 'Arcade' }, { id: 'puzzle', name: 'Puzzle' }, { id: 'platformer', name: 'Platformer' },
  { id: 'racing', name: 'Racing' }, { id: 'action', name: 'Action' }, { id: 'classic', name: 'Classic' },
  { id: 'custom', name: 'Custom Games' }
];
const CATEGORY_SYMBOLS = { arcade: '🕹️', puzzle: '🧩', platformer: '🏃', racing: '🏁', action: '💥', classic: '👾', custom: '⭐' };

const SECTION_LABELS = { hero: 'Welcome', featured: 'Featured game', favorites: 'Favorites', recent: 'Recently played', popular: 'Most played', leaderboard: 'Top 10 leaderboard', library: 'Game library' };

/* Default configuration. User changes are stored separately in localStorage. */
const DEFAULT_SETTINGS = {
  siteTitle: 'GameShelf', logoText: 'GAMESHELF',
  tagline: 'PRESS START. FIND YOUR NEXT HIGH SCORE.',
  welcome: 'Your personal arcade shelf. Pick a game and play.',
  footer: 'GameShelf — a personal retro arcade.',
  theme: 'dark', accent: '#39ff14', bg: 'grid', bgColor: '', font: 'pixel', fontSize: 100,
  layout: 'comfortable', corners: 'square', density: 'medium', thumbSize: 'medium',
  scanlines: true, glow: true, animations: true,
  reducedMotion: 'system', highContrast: 'system', noFlash: false, simplified: false,
  featuredGame: 'auto',
  sections: [ 'hero', 'featured', 'favorites', 'recent', 'popular', 'leaderboard', 'library' ].map(id => ({ id, visible: true })),
  categories: DEFAULT_CATEGORIES.map(c => ({ ...c, hidden: false })),
  defaultCategory: 'all', defaultSort: 'title', rememberCategory: false, lastCategory: 'all',
  recentCount: 6,
  navLinks: [ { label: 'Library', href: '#library' }, { label: 'Leaderboards', href: '#leaderboard' } ],
  launchMode: 'player', confirmLeave: true, searchHistory: false,
  statusBar: true, stBattery: true, stOnline: true, stTime: true, stDate: true, stFullscreen: true
};

/* ═════════════ 2. HELPERS ═════════════ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const slug = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const titleize = s => String(s).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const hash = s => { let n = 5381; for (const c of String(s)) n = ((n << 5) + n + c.charCodeAt(0)) >>> 0; return n; };
const HEX = /^#[0-9a-f]{6}$/i;

/* Build DOM safely: text always goes through textContent / text nodes, never innerHTML. */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') Object.entries(v).forEach(([a, b]) => el.style.setProperty(a, b));
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  kids.flat().forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}

/* Inline SVG icons (constant strings only) */
const ICONS = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  back: '<polyline points="15 18 9 12 15 6"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  down: '<polyline points="6 9 12 15 18 9"/>'
};
function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

const store = {
  ok: true,
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { if (store.ok) { store.ok = false; toast('Browser storage is unavailable, so changes will not be saved.'); } } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
const K = { settings: 'gameshelf.settings.v1', favs: 'gameshelf.favorites.v1', recent: 'gameshelf.recent.v1', plays: 'gameshelf.plays.v1', hist: 'gameshelf.searchHistory.v1' };

function safeHref(v) {
  v = String(v || '').trim();
  if (/^#[\w-]*$/.test(v)) return v;
  if (/^https?:\/\/[^\s<>"']+$/i.test(v)) return v;
  if (/^[\w][\w./-]*(\?[\w=&.-]*)?(#[\w-]*)?$/.test(v) && !v.includes(':')) return v;   // relative path
  return null;
}
function safeGameFile(f) {
  if (typeof f !== 'string') return null;
  if (f.includes(':') || f.includes('\\') || f.startsWith('/') || f.includes('..') || f.length > 200) return null;
  return /\.html?$/i.test(f) ? f : null;
}

/* ═════════════ 3. CATALOG, STATE & SETTINGS ═════════════ */

const games = [];
const catalogIssues = [];
(function loadCatalog() {
  const seen = new Set();
  GAME_CATALOG.forEach((g, i) => {
    const label = `Catalog entry #${i + 1}${g && g.id ? ` (${g.id})` : ''}`;
    if (!g || typeof g !== 'object') return catalogIssues.push(`${label}: not an object`);
    if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(g.id || '')) return catalogIssues.push(`${label}: id must be lowercase letters, numbers and hyphens`);
    if (seen.has(g.id)) return catalogIssues.push(`${label}: duplicate id`);
    if (!g.title) return catalogIssues.push(`${label}: missing title`);
    const file = safeGameFile(g.file);
    if (!file) return catalogIssues.push(`${label}: "file" must be a relative .html path such as games/name.html`);
    seen.add(g.id);
    const lb = g.leaderboard || {};
    games.push({
      id: g.id, title: String(g.title).slice(0, 80), description: String(g.description || '').slice(0, 300),
      category: slug(g.category) || 'custom', tags: Array.isArray(g.tags) ? g.tags.map(t => String(t).slice(0, 24)).slice(0, 8) : [],
      file, featured: !!g.featured,
      status: ['ready', 'coming-soon', 'unavailable'].includes(g.status) ? g.status : 'ready',
      thumb: g.thumb && typeof g.thumb === 'object' ? g.thumb : {}, display: g.display && typeof g.display === 'object' ? g.display : {},
      leaderboard: { enabled: !!lb.enabled && /^[a-z0-9][a-z0-9-]{1,39}$/.test(lb.gameId || g.id), gameId: String(lb.gameId || g.id), note: String(lb.note || '') }
    });
  });
})();
const gameById = id => games.find(g => g.id === id);

const OPT = {
  theme: [['dark', 'Dark'], ['light', 'Light'], ['system', 'Match system']],
  bg: [['grid', 'Neon grid'], ['dots', 'Dots'], ['stars', 'Starfield'], ['plain', 'Plain']],
  font: [['pixel', 'Pixel headings'], ['mono', 'Monospace'], ['system', 'System sans-serif'], ['serif', 'Serif']],
  layout: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']],
  corners: [['square', 'Squared'], ['round', 'Rounded']],
  density: [['dense', 'Dense'], ['medium', 'Medium'], ['large', 'Large']],
  thumbSize: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']],
  tri: [['system', 'Follow system'], ['on', 'On'], ['off', 'Off']],
  sort: [['title', 'Title A–Z'], ['catalog', 'Catalog order'], ['category', 'Category'], ['favorites', 'Favorites first'], ['recent', 'Recently played'], ['plays', 'Most played']],
  launch: [['player', 'In-page player (with Back button)'], ['direct', 'Open the game page directly']]
};
const vals = o => o.map(x => x[0]);
const ENUMS = { theme: vals(OPT.theme), bg: vals(OPT.bg), font: vals(OPT.font), layout: vals(OPT.layout), corners: vals(OPT.corners), density: vals(OPT.density),
  thumbSize: vals(OPT.thumbSize), reducedMotion: vals(OPT.tri), highContrast: vals(OPT.tri), defaultSort: vals(OPT.sort), launchMode: vals(OPT.launch) };
const RANGES = { fontSize: [80, 140], recentCount: [1, 20] };
const TEXT_MAX = { siteTitle: 40, logoText: 24, tagline: 100, welcome: 300, footer: 200 };
const APPEARANCE_KEYS = new Set(['theme', 'accent', 'bg', 'bgColor', 'font', 'fontSize', 'layout', 'corners', 'density', 'thumbSize', 'scanlines', 'glow', 'animations', 'reducedMotion', 'highContrast', 'noFlash', 'simplified']);

/* Validate any settings object (from localStorage or an imported file). Never trusts input. */
function sanitizeSettings(raw) {
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const d = DEFAULT_SETTINGS[k], v = raw[k];
    if (v === undefined || typeof d === 'object') continue;
    if (typeof d === 'boolean') { if (typeof v === 'boolean') out[k] = v; }
    else if (typeof d === 'number') { if (Number.isFinite(v)) out[k] = Math.round(clamp(v, ...RANGES[k])); }
    else if (typeof v === 'string') {
      if (ENUMS[k]) { if (ENUMS[k].includes(v)) out[k] = v; }
      else if (k === 'accent') { if (HEX.test(v)) out[k] = v.toLowerCase(); }
      else if (k === 'bgColor') { if (v === '' || HEX.test(v)) out[k] = v.toLowerCase(); }
      else if (['featuredGame', 'defaultCategory', 'lastCategory'].includes(k)) { if (v === 'auto' || v === 'all' || /^[a-z0-9-]{1,60}$/.test(v)) out[k] = v; }
      else out[k] = v.slice(0, TEXT_MAX[k] || 200);
    }
  }
  if (Array.isArray(raw.sections)) {
    const ids = DEFAULT_SETTINGS.sections.map(s => s.id), seen = new Set(), list = [];
    raw.sections.forEach(s => { if (s && ids.includes(s.id) && !seen.has(s.id)) { seen.add(s.id); list.push({ id: s.id, visible: s.visible !== false }); } });
    ids.forEach(id => { if (!seen.has(id)) list.push({ id, visible: true }); });
    out.sections = list;
  }
  if (Array.isArray(raw.categories)) {
    const seen = new Set(), list = [];
    raw.categories.slice(0, 40).forEach(c => {
      const id = c && slug(c.id), name = c && typeof c.name === 'string' ? c.name.trim().slice(0, 30) : '';
      if (id && name && !seen.has(id)) { seen.add(id); list.push({ id, name, hidden: !!c.hidden }); }
    });
    if (list.length) out.categories = list;
  }
  if (Array.isArray(raw.navLinks)) {
    out.navLinks = raw.navLinks.slice(0, 8).map(l => l && typeof l.label === 'string' && safeHref(l.href) ? { label: l.label.trim().slice(0, 30), href: safeHref(l.href) } : null).filter(l => l && l.label);
  }
  return out;
}

const state = { settings: sanitizeSettings(store.get(K.settings, null)), favs: new Set(), recent: [], plays: {}, hist: [], query: '', category: 'all', sort: 'title' };
function loadUserData() {
  const ids = new Set(games.map(g => g.id));
  const f = store.get(K.favs, []); state.favs = new Set(Array.isArray(f) ? f.filter(id => typeof id === 'string') : []);
  const r = store.get(K.recent, []); state.recent = Array.isArray(r) ? r.filter(x => x && typeof x.id === 'string' && Number.isFinite(x.t)).slice(0, 30) : [];
  const p = store.get(K.plays, {}); state.plays = p && typeof p === 'object' && !Array.isArray(p) ? Object.fromEntries(Object.entries(p).filter(([k, v]) => ids.has(k) && Number.isFinite(v))) : {};
  const hi = store.get(K.hist, []); state.hist = Array.isArray(hi) ? hi.filter(x => typeof x === 'string').slice(0, 8) : [];
}
const saveSettings = () => store.set(K.settings, state.settings);
const saveFavs = () => store.set(K.favs, [...state.favs]);

function categoryList() {
  const list = state.settings.categories.map(c => ({ ...c })), ids = new Set(list.map(c => c.id));
  games.forEach(g => { if (!ids.has(g.category)) { ids.add(g.category); list.push({ id: g.category, name: titleize(g.category), hidden: false }); } });
  return list;
}
const catName = id => (categoryList().find(c => c.id === id) || { name: titleize(id) }).name;

function toggleFav(id) {
  state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
  saveFavs(); renderAll(); syncPlayerFav();
}
function recordPlay(id) {
  state.recent = [{ id, t: Date.now() }, ...state.recent.filter(x => x.id !== id)].slice(0, 30);
  state.plays[id] = (state.plays[id] || 0) + 1;
  store.set(K.recent, state.recent); store.set(K.plays, state.plays);
}

/* ═════════════ 4. APPEARANCE ═════════════ */

const mq = { dark: matchMedia('(prefers-color-scheme: dark)'), motion: matchMedia('(prefers-reduced-motion: reduce)'), contrast: matchMedia('(prefers-contrast: more)') };
const inkFor = hex => { const n = parseInt(hex.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.55 ? '#000000' : '#ffffff'; };

function applyAppearance() {
  const s = state.settings, r = document.documentElement, d = r.dataset;
  const theme = s.theme === 'system' ? (mq.dark.matches ? 'dark' : 'light') : s.theme;
  const reduce = s.reducedMotion === 'on' || (s.reducedMotion === 'system' && mq.motion.matches);
  const contrast = s.highContrast === 'on' || (s.highContrast === 'system' && mq.contrast.matches);
  Object.assign(d, { theme, bg: s.bg, font: s.font, layout: s.layout, corners: s.corners, density: s.density, thumb: s.thumbSize,
    scan: s.scanlines && !s.simplified ? 'on' : 'off', glow: s.glow && !s.simplified ? 'on' : 'off',
    anim: s.animations && !reduce ? 'on' : 'off', motion: reduce ? 'reduce' : 'full', contrast: contrast ? 'high' : 'normal',
    flash: s.noFlash ? 'off' : 'on', simple: s.simplified ? 'on' : 'off' });
  r.style.setProperty('--accent', s.accent);
  r.style.setProperty('--accent-ink', inkFor(s.accent));
  r.style.setProperty('--root-size', s.fontSize + '%');
  s.bgColor ? r.style.setProperty('--bg-custom', s.bgColor) : r.style.removeProperty('--bg-custom');
  const meta = $('meta[name="theme-color"]'); if (meta) meta.content = s.bgColor || (theme === 'dark' ? '#14101f' : '#f4f1fb');
}
Object.values(mq).forEach(m => m.addEventListener('change', applyAppearance));

/* ═════════════ 5. RENDERING ═════════════ */

const PATTERNS = ['grid', 'stripes', 'dots', 'checker', 'waves', 'rays'];
const PALETTES = [['#39ff14', '#7b2cff'], ['#ff8a1f', '#7b2cff'], ['#00e5ff', '#6a1bd6'], ['#ff3d71', '#ff8a1f'], ['#b6ff3d', '#00875a'], ['#c77dff', '#3a0ca3']];

function makeThumb(g, tag) {
  const t = g.thumb, hv = hash(g.id);
  const colors = Array.isArray(t.colors) && t.colors.length >= 2 && t.colors.slice(0, 2).every(c => HEX.test(c)) ? t.colors : PALETTES[hv % PALETTES.length];
  const pattern = PATTERNS.includes(t.pattern) ? t.pattern : PATTERNS[(hv >> 3) % PATTERNS.length];
  const symbol = (typeof t.symbol === 'string' && t.symbol.trim().slice(0, 4)) || CATEGORY_SYMBOLS[g.category] || g.title.charAt(0).toUpperCase();
  return h('div', { class: 'thumb', 'data-pattern': pattern, style: { '--c1': colors[0], '--c2': colors[1] }, 'aria-hidden': 'true' },
    h('span', { class: 'thumb-sym', text: symbol }), tag ? h('span', { class: 'thumb-tag', text: tag }) : null);
}

const playable = g => g.status === 'ready';

function makeCard(g) {
  const fav = state.favs.has(g.id);
  const badges = [h('span', { class: 'badge cat', text: catName(g.category) })];
  g.tags.slice(0, 3).forEach(t => badges.push(h('span', { class: 'badge', text: '#' + t })));
  if (g.status === 'coming-soon') badges.push(h('span', { class: 'badge warn', text: 'Coming soon' }));
  if (g.status === 'unavailable') badges.push(h('span', { class: 'badge warn', text: 'Unavailable' }));
  if (g.leaderboard.enabled) badges.push(h('span', { class: 'badge ok', text: 'Leaderboard' }));
  return h('article', { class: 'card', 'data-id': g.id },
    makeThumb(g),
    h('div', { class: 'card-body' }, h('h3', { text: g.title }), g.description ? h('p', { text: g.description }) : null, h('div', { class: 'meta' }, badges)),
    h('div', { class: 'card-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', disabled: !playable(g), 'aria-label': `Play ${g.title}`, onclick: e => launch(g, e.currentTarget) }, icon('play'), 'Play'),
      h('button', { class: 'btn fav', type: 'button', 'aria-pressed': String(fav), 'aria-label': `${fav ? 'Remove' : 'Add'} ${g.title} ${fav ? 'from' : 'to'} favorites`, onclick: () => toggleFav(g.id) }, icon('star'))));
}

function matches(g, q) {
  return !q || [g.title, g.description, catName(g.category), ...g.tags].join(' ').toLowerCase().includes(q);
}
function sortGames(list, mode) {
  const l = [...list], byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  const rank = id => { const i = state.recent.findIndex(x => x.id === id); return i < 0 ? 999 : i; };
  if (mode === 'title') l.sort(byTitle);
  else if (mode === 'category') l.sort((a, b) => catName(a.category).localeCompare(catName(b.category)) || byTitle(a, b));
  else if (mode === 'favorites') l.sort((a, b) => (state.favs.has(b.id) - state.favs.has(a.id)) || byTitle(a, b));
  else if (mode === 'recent') l.sort((a, b) => rank(a.id) - rank(b.id) || byTitle(a, b));
  else if (mode === 'plays') l.sort((a, b) => (state.plays[b.id] || 0) - (state.plays[a.id] || 0) || byTitle(a, b));
  return l;
}

function fillGrid(sel, list) { const el = $(sel); el.replaceChildren(...list.map(makeCard)); }

function featuredGame() {
  return gameById(state.settings.featuredGame) || games.find(g => g.featured) || games[0] || null;
}
function renderFeatured() {
  const box = $('#featuredBox'), g = featuredGame();
  if (!g) { box.replaceChildren(); return false; }
  box.replaceChildren(h('article', { class: 'featured' }, makeThumb(g, 'FEATURED'),
    h('div', { class: 'featured-body' }, h('h3', { text: g.title }), g.description ? h('p', { text: g.description }) : null,
      h('div', { class: 'meta' }, h('span', { class: 'badge cat', text: catName(g.category) }), g.leaderboard.enabled ? h('span', { class: 'badge ok', text: 'Leaderboard' }) : null),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', disabled: !playable(g), onclick: e => launch(g, e.currentTarget) }, icon('play'), `Play ${g.title}`),
        h('button', { class: 'btn fav', type: 'button', 'aria-pressed': String(state.favs.has(g.id)), 'aria-label': `Toggle favorite for ${g.title}`, onclick: () => toggleFav(g.id) }, icon('star'))))));
  return true;
}

function renderLibrary() {
  const s = state.settings, q = state.query.trim().toLowerCase();
  const chips = $('#catChips'); chips.replaceChildren();
  const cats = categoryList().filter(c => !c.hidden && games.some(g => g.category === c.id));
  if (state.category !== 'all' && !categoryList().some(c => c.id === state.category)) state.category = 'all';
  const mk = (id, name) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.category === id), text: name,
    onclick: () => { state.category = id; if (s.rememberCategory) { s.lastCategory = id; saveSettings(); } renderLibrary(); } });
  if (cats.length) chips.append(mk('all', 'All'), ...cats.map(c => mk(c.id, c.name)));
  const list = sortGames(games.filter(g => (state.category === 'all' || g.category === state.category) && matches(g, q)), state.sort);
  fillGrid('#gameGrid', list);
  $('#resultCount').textContent = games.length ? `${list.length} of ${games.length} games` : '';
  const empty = $('#libEmpty');
  if (!games.length) {
    empty.hidden = false;
    empty.replaceChildren(h('h3', { text: 'No games registered yet' }),
      h('p', { text: 'Put your game HTML files in the games/ folder, then add one entry per file to GAME_CATALOG at the top of script.js:' }),
      h('pre', { text: "{ id: 'my-game', title: 'My Game', description: 'One sentence.',\n  category: 'arcade', tags: [], file: 'games/my-game.html' }" }));
  } else if (!list.length) {
    empty.hidden = false; empty.replaceChildren(h('h3', { text: 'No matching games' }), h('p', { text: 'Try a different search or category.' }));
  } else empty.hidden = true;
  const dl = $('#searchHist'); dl.replaceChildren(...(s.searchHistory ? state.hist : []).map(v => h('option', { value: v })));
}

function renderSections() {
  const s = state.settings;
  $('#heroTitle').textContent = s.siteTitle; $('#heroTagline').textContent = s.tagline; $('#heroWelcome').textContent = s.welcome;
  $('#logoText').textContent = s.logoText; document.title = s.siteTitle; $('#footerText').textContent = s.footer;
  $('#versionText').textContent = `v${SITE_VERSION}`;
  const byId = id => games.filter(g => g.id === id)[0];
  const recent = state.recent.map(x => byId(x.id)).filter(Boolean).slice(0, s.recentCount);
  const favs = sortGames(games.filter(g => state.favs.has(g.id)), 'title');
  const pop = sortGames(games.filter(g => state.plays[g.id] > 0), 'plays').slice(0, 4);
  const hasFeat = renderFeatured();
  fillGrid('#favGrid', favs); fillGrid('#recentGrid', recent); fillGrid('#popGrid', pop);
  const has = { hero: true, featured: hasFeat, favorites: favs.length > 0, recent: recent.length > 0, popular: pop.length > 0, leaderboard: true, library: true };
  s.sections.forEach((sec, i) => {
    const el = $(`[data-section="${sec.id}"]`); if (!el) return;
    el.style.order = i; el.hidden = !(sec.visible && has[sec.id]);
  });
  const nav = $('#mainNav'); nav.replaceChildren(...s.navLinks.map(l => {
    const ext = /^https?:/i.test(l.href);
    return h('a', { href: l.href, text: l.label, target: ext ? '_blank' : null, rel: ext ? 'noopener noreferrer' : null });
  }));
}

function renderAll() { renderSections(); renderLibrary(); renderPreviewSelect(); }

/* ═════════════ 6. PLAYER ═════════════ */

const player = { open: false, game: null, frame: null, opener: null };
const PAGE_PARTS = ['.site-header', '#statusBar', '#main', '.site-footer'];

function launch(g, opener) {
  if (!playable(g)) return;
  recordPlay(g.id);
  const mode = g.display.launch === 'direct' || g.display.launch === 'player' ? g.display.launch : state.settings.launchMode;
  if (mode === 'direct') { location.assign(g.file); return; }
  openPlayer(g, opener);
}

async function openPlayer(g, opener) {
  player.open = true; player.game = g; player.opener = opener || null;
  $('#player').hidden = false; document.body.classList.add('playing');
  PAGE_PARTS.forEach(sel => { const el = $(sel); if (el) el.inert = true; });
  $('#playerTitle').textContent = g.title; $('#pOpen').href = g.file;
  $('#pLb').hidden = !g.leaderboard.enabled; $('#pFs').hidden = !document.fullscreenEnabled;
  $('#pLoading').hidden = false; $('#pError').hidden = true; syncPlayerFav();
  history.pushState({ gsPlayer: g.id }, '', '#play');
  $('#pBack').focus();
  try {   // existence check; skipped silently when the browser cannot do it (e.g. file://)
    const r = await fetch(g.file, { method: 'HEAD', cache: 'no-store' });
    if (!player.open || player.game !== g) return;
    if (!r.ok) return showPlayerError(`Could not load ${g.file} (HTTP ${r.status}). Check that the file exists in the games folder and that the "file" path in GAME_CATALOG matches its name exactly.`);
  } catch { /* continue and let the iframe try */ }
  const f = h('iframe', { src: g.file, title: g.title, allow: 'fullscreen; autoplay; gamepad; clipboard-write', referrerpolicy: 'no-referrer',
    sandbox: 'allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups allow-modals allow-downloads' });
  f.addEventListener('load', () => { $('#pLoading').hidden = true; try { f.focus(); } catch { /* ignore */ } });
  player.frame = f; $('#pStage').append(f);
}
function showPlayerError(msg) { $('#pLoading').hidden = true; const e = $('#pError'); e.textContent = msg; e.hidden = false; }

function closePlayerUI() {
  if (!player.open) return;
  player.open = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (player.frame) { player.frame.src = 'about:blank'; player.frame.remove(); player.frame = null; }
  $('#player').hidden = true; document.body.classList.remove('playing');
  PAGE_PARTS.forEach(sel => { const el = $(sel); if (el) el.inert = false; });
  renderAll();
  if (player.opener && document.contains(player.opener)) player.opener.focus();
  player.game = null;
}
function requestClosePlayer() {
  if (state.settings.confirmLeave && !confirm('Leave this game? Any progress the game has not saved itself may be lost.')) return;
  if (history.state && history.state.gsPlayer) history.back(); else closePlayerUI();
}
function syncPlayerFav() {
  if (!player.open || !player.game) return;
  const on = state.favs.has(player.game.id), b = $('#pFav');
  b.setAttribute('aria-pressed', String(on)); b.classList.toggle('fav', true);
  b.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
}

/* Games may report scores via window.parent.postMessage (see gameshelf-score.js). Only same-origin messages
   from the active iframe, for a game with leaderboard.enabled, are accepted. */
window.addEventListener('message', e => {
  const d = e.data, g = player.game;
  if (!player.open || !g || !player.frame || e.origin !== location.origin || e.source !== player.frame.contentWindow) return;
  if (!d || d.source !== 'gameshelf' || d.type !== 'score' || !g.leaderboard.enabled || d.gameId !== g.leaderboard.gameId) return;
  submitScore(d.gameId, d.score);
});

/* ═════════════ 7. STATUS BAR ═════════════ */

const status = { battery: null, clockTimer: 0 };
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function renderStatus() {
  const s = state.settings, bar = $('#statusBar'), parts = [];
  if (s.statusBar) {
    if (s.stBattery && status.battery) {
      const b = status.battery, pct = Math.round(b.level * 100), low = !b.charging && b.level <= 0.2;
      parts.push(h('span', { class: low ? 'low pulse' : '', 'aria-label': `Battery ${pct} percent, ${b.charging ? 'charging' : 'discharging'}${low ? ', low' : ''}` },
        `🔋 ${pct}% · ${b.charging ? 'Charging' : 'Discharging'}${low ? ' · Low battery' : ''}`));
    }
    if (s.stOnline) { const on = navigator.onLine; parts.push(h('span', { class: on ? '' : 'off' }, h('i', { class: 'dot' }), on ? 'Online' : 'Offline')); }
    if (s.stTime) parts.push(h('span', { text: fmtTime.format(new Date()) }));
    if (s.stDate) parts.push(h('span', { text: fmtDate.format(new Date()) }));
    if (s.stFullscreen && document.fullscreenEnabled) parts.push(h('span', { text: `Fullscreen: ${document.fullscreenElement ? 'on' : 'off'}` }));
  }
  bar.hidden = !parts.length; bar.replaceChildren(...parts);
}
function scheduleClock() {
  clearTimeout(status.clockTimer);
  status.clockTimer = setTimeout(() => { renderStatus(); scheduleClock(); }, 60000 - (Date.now() % 60000) + 50);
}
async function initBattery() {
  if (typeof navigator.getBattery !== 'function') return;   // unsupported: the widget simply stays hidden
  try {
    status.battery = await navigator.getBattery();
    ['levelchange', 'chargingchange'].forEach(ev => status.battery.addEventListener(ev, renderStatus));
    renderStatus();
  } catch { status.battery = null; }
}
function initStatus() {
  addEventListener('online', renderStatus); addEventListener('offline', renderStatus);
  document.addEventListener('fullscreenchange', renderStatus);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderStatus(); scheduleClock(); } });
  addEventListener('pagehide', () => { clearTimeout(status.clockTimer); if (status.battery) ['levelchange', 'chargingchange'].forEach(ev => status.battery.removeEventListener(ev, renderStatus)); });
  renderStatus(); scheduleClock(); initBattery();
}

/* ═════════════ 8. SUPABASE: AUTH, LEADERBOARDS, SCORES ═════════════ */

const SB = { client: null, session: null, profile: null, status: 'idle', message: '' };
let sbInit = null;

function sbConfig() {
  const c = window.GAMESHELF_SUPABASE || {};
  try {
    const u = new URL(c.url);
    if (u.protocol !== 'https:' || /YOUR/i.test(c.url) || !c.publishableKey || /YOUR/i.test(c.publishableKey)) return null;
    return { url: u.origin, key: String(c.publishableKey) };
  } catch { return null; }
}
function loadSdk() {
  return new Promise((res, rej) => {
    if (window.supabase && window.supabase.createClient) return res();
    const s = h('script', { src: SUPABASE_SDK_URL, async: true });
    s.onload = res; s.onerror = () => rej(new Error('could not load the Supabase library'));
    document.head.append(s);
  });
}
function sbReady() {
  if (sbInit) return sbInit;
  sbInit = (async () => {
    const cfg = sbConfig();
    if (!cfg) { SB.status = 'unconfigured'; SB.message = 'Online leaderboards are not set up yet. Add your Supabase project URL and publishable key to supabase-config.js.'; return false; }
    try {
      await loadSdk();
      SB.client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data } = await SB.client.auth.getSession();
      setSession(data.session);
      SB.client.auth.onAuthStateChange((_e, sess) => setSession(sess));
      SB.status = 'ready'; return true;
    } catch (e) { SB.status = 'error'; SB.message = `Could not reach Supabase: ${e.message || e}`; sbInit = null; return false; }
  })();
  return sbInit;
}
function setSession(sess) {
  SB.session = sess || null;
  setTimeout(async () => { await refreshProfile(); updateAccountButton(); if ($('#accountDlg').open) renderAccount(); }, 0);
}
async function refreshProfile() {
  if (!SB.session) { SB.profile = null; return; }
  const { data, error } = await SB.client.from('profiles').select('display_name').eq('id', SB.session.user.id).maybeSingle();
  SB.profile = error ? null : data;
}
function updateAccountButton() { $('#accountLabel').textContent = SB.profile ? SB.profile.display_name : 'Account'; }
const isGuest = () => !!(SB.session && SB.session.user && SB.session.user.is_anonymous);

async function ensureSession() {
  if (SB.session) return SB.session;
  const { data, error } = await SB.client.auth.signInAnonymously();
  if (error) throw error;
  setSession(data.session); return data.session;
}

async function submitScore(gameId, score) {
  const g = games.find(x => x.leaderboard.enabled && x.leaderboard.gameId === gameId);
  if (!g) return { ok: false, error: 'Leaderboard is not enabled for this game.' };
  if (!Number.isSafeInteger(score) || score < 0) return { ok: false, error: 'Invalid score.' };
  if (!(await sbReady())) { toast(SB.message); return { ok: false, error: SB.message }; }
  try {
    await ensureSession();
    const { data, error } = await SB.client.functions.invoke('submit-score', { body: { gameId, score } });
    if (error) {
      let detail = error.message;
      try { const j = await error.context.json(); if (j && j.error) detail = j.error; } catch { /* keep default */ }
      throw new Error(detail);
    }
    toast(`Score ${score.toLocaleString()} submitted${data.rank ? ` — rank #${data.rank}` : ''}${data.isPersonalBest ? ' (new personal best!)' : ''}`);
    refreshBoards(); return data;
  } catch (e) { toast(`Score not submitted: ${e.message}`); return { ok: false, error: e.message }; }
}

const msg = (text, cls = '') => h('div', { class: `msg ${cls}`, text });

function boardTable(rows, myId) {
  return h('table', { class: 'lb' }, h('caption', { class: 'sr-only', text: 'Leaderboard' }),
    h('thead', {}, h('tr', {}, ['Rank', 'Player', 'Score', 'Date'].map(t => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, rows.map((r, i) => h('tr', { class: r.user_id === myId ? 'me' : '' },
      h('td', { text: `#${i + 1}` }), h('td', { text: r.display_name }), h('td', { class: 'num', text: Number(r.score).toLocaleString() }),
      h('td', { text: new Date(r.created_at).toLocaleDateString() })))));
}

async function renderBoard(box, youBox, gameId, limit) {
  const token = (box._tok = (box._tok || 0) + 1), g = games.find(x => x.leaderboard.gameId === gameId && x.leaderboard.enabled);
  youBox.textContent = '';
  if (!g) { box.replaceChildren(msg(lbGames().length ? 'Choose a game.' : 'No game has leaderboard support yet. A game needs a score hook before its leaderboard can be turned on (see README).')); return; }
  box.replaceChildren(msg('Loading scores…'));
  if (!navigator.onLine) { box.replaceChildren(msg('You are offline. Scores need an internet connection.')); return; }
  if (!(await sbReady())) { box.replaceChildren(msg(SB.message, SB.status === 'error' ? 'error' : '')); return; }
  try {
    const { data, error } = await SB.client.from('leaderboard_best').select('user_id,display_name,score,created_at')
      .eq('game_id', gameId).order('score', { ascending: false }).order('created_at', { ascending: true }).limit(limit);
    if (error) throw error;
    if (token !== box._tok) return;
    box.replaceChildren(data.length ? boardTable(data, SB.session && SB.session.user.id) : msg('No scores yet. Be the first!'));
    if (SB.session) {
      const uid = SB.session.user.id;
      const mine = await SB.client.from('leaderboard_best').select('score').eq('game_id', gameId).eq('user_id', uid).maybeSingle();
      if (token !== box._tok) return;
      if (mine.data) {
        const better = await SB.client.from('leaderboard_best').select('user_id', { count: 'exact', head: true }).eq('game_id', gameId).gt('score', mine.data.score);
        if (token !== box._tok) return;
        youBox.textContent = `Your best: ${Number(mine.data.score).toLocaleString()} · Rank #${(better.count || 0) + 1}`;
      } else youBox.textContent = 'You have no score for this game yet.';
    } else youBox.textContent = 'Play a game with leaderboard support to get a rank.';
  } catch (e) { if (token === box._tok) box.replaceChildren(msg(`Could not load scores: ${e.message || e}`, 'error')); }
}

const lbGames = () => games.filter(g => g.leaderboard.enabled);
function fillGameSelect(sel, keep) {
  const list = lbGames(); sel.replaceChildren(...list.map(g => h('option', { value: g.leaderboard.gameId, text: g.title })));
  sel.disabled = !list.length;
  if (keep && list.some(g => g.leaderboard.gameId === keep)) sel.value = keep;
}
let previewKey = null;
function renderPreviewSelect() {   // refetch only when the list of leaderboard games changed, not on every re-render
  const sel = $('#lbPreviewSelect'), keep = sel.value;
  fillGameSelect(sel, keep);
  const key = lbGames().map(g => g.leaderboard.gameId).join(',') + '|' + sel.value;
  if (key === previewKey) return;
  previewKey = key;
  renderBoard($('#lbPreview'), $('#lbPreviewYou'), sel.value, 10);
}
function refreshBoards() {
  renderBoard($('#lbPreview'), $('#lbPreviewYou'), $('#lbPreviewSelect').value, 10);
  if ($('#lbDlg').open) loadFullBoard();
}
function openLeaderboard(gameId) {
  fillGameSelect($('#lbSelect'), gameId || $('#lbPreviewSelect').value);
  $('#lbDlg').showModal(); loadFullBoard();
}
async function loadFullBoard() {
  renderBoard($('#lbFull'), $('#lbYou'), $('#lbSelect').value, 100);
  const box = $('#lbBests'); box.replaceChildren(msg('Loading…'));
  if (!(await sbReady())) return box.replaceChildren(msg(SB.message));
  if (!SB.session) return box.replaceChildren(msg('Sign in or play a game with leaderboard support to see personal bests.'));
  const { data, error } = await SB.client.from('leaderboard_best').select('game_id,score,created_at').eq('user_id', SB.session.user.id);
  if (error) return box.replaceChildren(msg(`Could not load personal bests: ${error.message}`, 'error'));
  const titles = Object.fromEntries(lbGames().map(g => [g.leaderboard.gameId, g.title]));
  const rows = data.filter(r => titles[r.game_id]);
  box.replaceChildren(rows.length ? h('table', { class: 'lb' }, h('thead', {}, h('tr', {}, ['Game', 'Best', 'Date'].map(t => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, rows.map(r => h('tr', {}, h('td', { text: titles[r.game_id] }), h('td', { class: 'num', text: Number(r.score).toLocaleString() }), h('td', { text: new Date(r.created_at).toLocaleDateString() }))))) : msg('No personal bests yet.'));
}

/* Account dialog */
async function openAccount() { $('#accountDlg').showModal(); renderAccount(); if (await sbReady()) renderAccount(); }
function formMsg() { return h('p', { class: 'form-msg', role: 'status' }); }
function showMsg(el, text, err) { el.textContent = text; el.className = 'form-msg' + (err ? ' error' : ''); }

function renderAccount() {
  const body = $('#accountBody');
  if (SB.status === 'unconfigured' || !sbConfig()) {
    return body.replaceChildren(h('p', { text: 'Online accounts and leaderboards are optional and are not configured yet.' }),
      h('p', { class: 'hint', text: 'Add your Supabase project URL and publishable key to supabase-config.js (see README.md) to turn them on. Everything else on GameShelf works without them.' }));
  }
  if (SB.status !== 'ready') return body.replaceChildren(msg(SB.status === 'error' ? SB.message : 'Connecting…', SB.status === 'error' ? 'error' : ''));
  const out = [];
  const email = h('input', { type: 'email', id: 'acEmail', autocomplete: 'email', maxlength: '120' });
  const pass = h('input', { type: 'password', id: 'acPass', autocomplete: 'new-password', minlength: '8', maxlength: '72' });
  const fm = formMsg();
  const credentials = () => h('div', { class: 'field' }, h('label', { for: 'acEmail', text: 'Email' }), email, h('label', { for: 'acPass', text: 'Password (8+ characters)' }), pass);
  const run = async (fn, okText) => { try { showMsg(fm, 'Working…'); await fn(); showMsg(fm, okText); } catch (e) { showMsg(fm, e.message || String(e), true); } };

  if (!SB.session) {
    out.push(h('p', { text: 'Sign in to keep your scores under one name.' }), credentials(),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => run(async () => { const r = await SB.client.auth.signInWithPassword({ email: email.value.trim(), password: pass.value }); if (r.error) throw r.error; }, 'Signed in.') }, 'Sign in'),
        h('button', { class: 'btn', type: 'button', onclick: () => run(async () => { const r = await SB.client.auth.signUp({ email: email.value.trim(), password: pass.value, options: { emailRedirectTo: location.origin + location.pathname } }); if (r.error) throw r.error; }, 'Account created. Check your email if confirmation is required.') }, 'Create account'),
        h('button', { class: 'btn', type: 'button', onclick: () => run(async () => { await ensureSession(); }, 'Playing as a guest.') }, 'Continue as guest')),
      fm, h('div', { class: 'panel-box' }, h('strong', { text: 'About guest accounts' }),
        h('ul', {}, h('li', { text: 'A guest account lives only in this browser. Clearing site data or signing out loses it for good.' }),
          h('li', { text: 'Guests can submit scores and appear on leaderboards. You can upgrade a guest to a permanent account later and keep your scores.' }))));
  } else {
    const nameIn = h('input', { type: 'text', id: 'acName', maxlength: '24', value: SB.profile ? SB.profile.display_name : '' });
    out.push(h('p', { text: isGuest() ? 'Signed in as a guest.' : `Signed in as ${SB.session.user.email || 'player'}.` }),
      h('div', { class: 'field' }, h('label', { for: 'acName', text: 'Display name (shown on leaderboards)' }), nameIn,
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => run(async () => {
          const n = nameIn.value.trim();
          if (n.length < 2 || n.length > 24 || /[<>\u0000-\u001f]/.test(n)) throw new Error('Use 2–24 characters, without < or >.');
          const r = await SB.client.from('profiles').update({ display_name: n }).eq('id', SB.session.user.id); if (r.error) throw r.error;
          await refreshProfile(); updateAccountButton(); refreshBoards();
        }, 'Display name saved.') }, 'Save name'))));
    if (isGuest()) {
      out.push(h('div', { class: 'panel-box' }, h('strong', { text: 'Make this account permanent' }),
        h('p', { class: 'hint', text: 'Add an email and password to keep your scores across browsers. Supabase will email a confirmation link.' }), credentials(),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => run(async () => {
          const r = await SB.client.auth.updateUser({ email: email.value.trim(), password: pass.value }, { emailRedirectTo: location.origin + location.pathname }); if (r.error) throw r.error;
        }, 'Check your email to confirm the upgrade.') }, 'Upgrade account'))));
    }
    out.push(fm, h('div', { class: 'row' }, h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
      if (isGuest() && !confirm('Sign out of this guest account? Guest accounts cannot be recovered, so you will lose access to its scores.')) return;
      await SB.client.auth.signOut(); toast('Signed out.'); renderAll();
    } }, 'Sign out')));
  }
  body.replaceChildren(...out);
}

/* ═════════════ 9. SETTINGS UI ═════════════ */

function setSetting(k, v) {
  state.settings[k] = v; saveSettings();
  APPEARANCE_KEYS.has(k) ? applyAppearance() : (applyAppearance(), renderAll(), renderStatus());
}
function cb(checked, onchange, label) {
  const i = h('input', { type: 'checkbox', onchange: e => onchange(e.target.checked) }); i.checked = checked;
  return h('label', { class: 'grow' }, i, label);
}
function field(f) {
  const id = 'f-' + f.k, v = state.settings[f.k];
  const wrap = h('div', { class: 'field' + (f.t === 'toggle' ? ' field-toggle' : '') });
  const help = f.help ? h('p', { class: 'hint', text: f.help }) : null;
  if (f.t === 'toggle') {
    const i = h('input', { type: 'checkbox', class: 'sw', id, role: 'switch', onchange: e => setSetting(f.k, e.target.checked) }); i.checked = !!v;
    wrap.append(h('div', {}, h('label', { for: id, text: f.l }), help), i); return wrap;
  }
  wrap.append(h('label', { for: id, text: f.l }));
  if (f.t === 'select') {
    const s = h('select', { id, onchange: e => setSetting(f.k, e.target.value) }, f.o().map(([val, lab]) => h('option', { value: val, text: lab })));
    s.value = v; wrap.append(s);
  } else if (f.t === 'range') {
    const out = h('span', { class: 'muted', text: f.fmt ? f.fmt(v) : v });
    wrap.append(h('div', { class: 'row' }, h('input', { type: 'range', id, min: f.min, max: f.max, step: f.step || 1, value: v,
      oninput: e => { out.textContent = f.fmt ? f.fmt(+e.target.value) : e.target.value; }, onchange: e => setSetting(f.k, +e.target.value) }), out));
  } else if (f.t === 'color') {
    const inp = h('input', { type: 'color', id, value: v || '#14101f', oninput: e => setSetting(f.k, e.target.value) });
    const row = h('div', { class: 'row' }, inp);
    (f.presets || []).forEach(([name, hex]) => row.append(h('button', { class: 'swatch', type: 'button', style: { background: hex }, title: name, 'aria-label': `${name} accent`, onclick: () => { setSetting(f.k, hex); inp.value = hex; } })));
    if (f.clearable) row.append(h('button', { class: 'btn', type: 'button', onclick: () => setSetting(f.k, '') }, 'Use theme default'));
    wrap.append(row);
  } else if (f.t === 'text') {
    wrap.append(h('input', { type: 'text', id, value: v, maxlength: TEXT_MAX[f.k] || 100, oninput: e => setSetting(f.k, e.target.value) }));
  }
  if (help) wrap.append(help);
  return wrap;
}

function move(list, i, d) { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; }
const arrowBtns = (list, i, redraw, after) => [['up', -1, 'Move up'], ['down', 1, 'Move down']].map(([ic, d, lab]) =>
  h('button', { class: 'btn', type: 'button', 'aria-label': lab, onclick: () => { move(list, i, d); after(); redraw(); } }, icon(ic)));

function sectionsEditor() {
  const wrap = h('div', { class: 'orderlist' }), list = state.settings.sections;
  const draw = () => wrap.replaceChildren(...list.map((s, i) => h('div', { class: 'orow' },
    cb(s.visible, v => { s.visible = v; saveSettings(); renderSections(); }, SECTION_LABELS[s.id]), ...arrowBtns(list, i, draw, () => { saveSettings(); renderSections(); }))));
  draw(); return h('div', { class: 'field' }, h('span', { class: 'label', text: 'Homepage sections' }), wrap, h('p', { class: 'hint', text: 'Sections with nothing to show (for example, Favorites before you have any) stay hidden automatically.' }));
}
function categoriesEditor() {
  state.settings.categories = categoryList(); saveSettings();
  const wrap = h('div', { class: 'orderlist' }), list = state.settings.categories;
  const after = () => { saveSettings(); renderLibrary(); };
  const draw = () => wrap.replaceChildren(...list.map((c, i) => h('div', { class: 'orow' },
    h('input', { type: 'text', value: c.name, maxlength: 30, 'aria-label': `Name for category ${c.id}`, onchange: e => { const n = e.target.value.trim().slice(0, 30); if (n) { c.name = n; after(); renderSections(); } else e.target.value = c.name; } }),
    cb(!c.hidden, v => { c.hidden = !v; after(); }, 'Show'), ...arrowBtns(list, i, draw, after))));
  draw();
  const add = h('input', { type: 'text', placeholder: 'New category name', maxlength: 30, 'aria-label': 'New category name' });
  return h('div', { class: 'field' }, h('span', { class: 'label', text: 'Categories' }), wrap,
    h('div', { class: 'row' }, add, h('button', { class: 'btn', type: 'button', onclick: () => {
      const name = add.value.trim(), id = slug(name);
      if (!id) return toast('Enter a category name first.');
      if (list.some(c => c.id === id)) return toast('That category already exists.');
      list.push({ id, name, hidden: false }); add.value = ''; after(); draw();
    } }, 'Add category')),
    h('p', { class: 'hint', text: 'Hiding a category only removes its filter button; its games still appear under All. To put a game in a category, set that category id in the game’s catalog entry.' }));
}
function navEditor() {
  const ta = h('textarea', { id: 'navTa', rows: 4, spellcheck: 'false', 'aria-describedby': 'navHint' }); ta.value = state.settings.navLinks.map(l => `${l.label} | ${l.href}`).join('\n');
  const hint = h('p', { id: 'navHint', class: 'hint', text: 'One link per line: Label | URL. Use #library for in-page links, a relative path, or an https:// address.' });
  ta.addEventListener('change', () => {
    const links = [], lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean); let bad = 0;
    lines.slice(0, 8).forEach(l => { const [label, ...rest] = l.split('|'), href = safeHref(rest.join('|')); if (label.trim() && href) links.push({ label: label.trim().slice(0, 30), href }); else bad++; });
    setSetting('navLinks', links); hint.textContent = bad ? `${bad} line(s) skipped: they need a label and a safe URL.` : 'Saved.';
  });
  return h('div', { class: 'field' }, h('label', { for: 'navTa', text: 'Navigation links' }), ta, hint);
}
const featuredField = () => ({ k: 'featuredGame', t: 'select', l: 'Featured game', help: games.length ? '' : 'Add games to the catalog first.',
  o: () => [['auto', 'Automatic (first marked featured)'], ...games.map(g => [g.id, g.title])] });
const catDefaultField = () => ({ k: 'defaultCategory', t: 'select', l: 'Default category', o: () => [['all', 'All'], ...categoryList().map(c => [c.id, c.name])] });

/* Export / import / reset */
function exportData() {
  const payload = { app: 'GameShelf', version: SITE_VERSION, exportedAt: new Date().toISOString(), settings: state.settings, favorites: [...state.favs] };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: 'gameshelf-settings.json' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importData() {
  const inp = h('input', { type: 'file', accept: 'application/json,.json' });
  inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    if (file.size > 200000) return toast('That file is too large to be a GameShelf export.');
    try {
      const data = JSON.parse(await file.text());   // parsed as data only, never executed
      if (!data || data.app !== 'GameShelf' || typeof data.settings !== 'object') throw new Error('not a GameShelf export');
      if (!confirm('Replace your current settings and favorites with the contents of this file?')) return;
      state.settings = sanitizeSettings(data.settings); saveSettings();
      if (Array.isArray(data.favorites)) { state.favs = new Set(data.favorites.filter(x => typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x)).slice(0, 500)); saveFavs(); }
      initViewState(); applyAppearance(); renderAll(); renderStatus(); renderSettings(); toast('Settings imported.');
    } catch (e) { toast(`Import failed: ${e.message}`); }
  });
  inp.click();
}
function confirmDo(text, fn) { if (confirm(text)) { fn(); } }
function resetAppearance() {
  APPEARANCE_KEYS.forEach(k => { state.settings[k] = DEFAULT_SETTINGS[k]; }); saveSettings(); applyAppearance(); renderSettings(); toast('Appearance reset.');
}
function dataButtons() {
  return h('div', { class: 'row' },
    h('button', { class: 'btn', type: 'button', onclick: exportData }, 'Export settings (JSON)'),
    h('button', { class: 'btn', type: 'button', onclick: importData }, 'Import settings'));
}
const action = (label, fn, danger = true) => h('button', { class: 'btn' + (danger ? ' btn-danger' : ''), type: 'button', onclick: fn }, label);

function diagnostics() {
  const cfg = sbConfig();
  const d = {
    gameshelf: SITE_VERSION, online: navigator.onLine, secureContext: isSecureContext, standalone: matchMedia('(display-mode: standalone)').matches,
    supabase: { configured: !!cfg, status: SB.status, signedIn: !!SB.session, guest: isGuest() },   // never includes keys or tokens
    browser: { batteryApi: typeof navigator.getBattery === 'function', fullscreen: !!document.fullscreenEnabled, serviceWorker: 'serviceWorker' in navigator, localStorage: store.ok, language: navigator.language, userAgent: navigator.userAgent },
    catalog: { games: games.length, issues: catalogIssues }
  };
  return JSON.stringify(d, null, 2);
}

const TABS = [
  { id: 'appearance', label: 'Appearance', build: () => [
    { k: 'theme', t: 'select', l: 'Theme', o: () => OPT.theme },
    { k: 'accent', t: 'color', l: 'Accent color', presets: [['Neon green', '#39ff14'], ['Purple', '#a855ff'], ['Blue', '#2bb7ff'], ['Red', '#ff3b4e'], ['Orange', '#ff8a1f']] },
    { k: 'bg', t: 'select', l: 'Background', o: () => OPT.bg },
    { k: 'bgColor', t: 'color', l: 'Custom background color', clearable: true },
    { k: 'font', t: 'select', l: 'Font', o: () => OPT.font },
    { k: 'fontSize', t: 'range', l: 'Font size', min: 80, max: 140, step: 5, fmt: v => v + '%' },
    { k: 'layout', t: 'select', l: 'Layout spacing', o: () => OPT.layout },
    { k: 'corners', t: 'select', l: 'Card corners', o: () => OPT.corners },
    { k: 'density', t: 'select', l: 'Grid density', o: () => OPT.density },
    { k: 'thumbSize', t: 'select', l: 'Thumbnail size', o: () => OPT.thumbSize },
    { k: 'scanlines', t: 'toggle', l: 'CRT scanlines' }, { k: 'glow', t: 'toggle', l: 'Glow effects' }, { k: 'animations', t: 'toggle', l: 'Animations' },
    { t: 'node', n: () => action('Reset appearance', () => confirmDo('Reset all appearance settings to their defaults?', resetAppearance)) }
  ] },
  { id: 'home', label: 'Homepage', build: () => [
    { k: 'siteTitle', t: 'text', l: 'Website title' }, { k: 'logoText', t: 'text', l: 'Logo text' }, { k: 'tagline', t: 'text', l: 'Tagline' },
    { k: 'welcome', t: 'text', l: 'Welcome message' }, { k: 'footer', t: 'text', l: 'Footer text' },
    featuredField(), { t: 'node', n: sectionsEditor }, { t: 'node', n: categoriesEditor }, catDefaultField(),
    { k: 'defaultSort', t: 'select', l: 'Default sorting', o: () => OPT.sort },
    { k: 'rememberCategory', t: 'toggle', l: 'Remember last category' },
    { t: 'node', n: navEditor },
    { k: 'statusBar', t: 'toggle', l: 'Show status bar' }, { k: 'stBattery', t: 'toggle', l: 'Battery', help: 'Shown only if your browser exposes the Battery Status API (mostly Chromium).' },
    { k: 'stOnline', t: 'toggle', l: 'Online / offline', help: 'Browser connectivity only; it does not prove the leaderboard server is reachable.' },
    { k: 'stTime', t: 'toggle', l: 'Time' }, { k: 'stDate', t: 'toggle', l: 'Date' }, { k: 'stFullscreen', t: 'toggle', l: 'Fullscreen status' }
  ] },
  { id: 'games', label: 'Games', build: () => [
    { k: 'launchMode', t: 'select', l: 'Default launch behavior', o: () => OPT.launch, help: 'A game can override this with display.launch in its catalog entry.' },
    { k: 'confirmLeave', t: 'toggle', l: 'Warn before leaving a game', help: 'Asks before you leave the in-page player. GameShelf cannot see whether a game has unsaved progress.' },
    { k: 'recentCount', t: 'range', l: 'Recently played to show', min: 1, max: 20 },
    { k: 'searchHistory', t: 'toggle', l: 'Remember search history', help: 'Stores your last 8 searches in this browser.' },
    { t: 'node', n: () => h('div', { class: 'panel-box' }, h('strong', { text: 'Keyboard shortcuts' }), h('ul', {},
      h('li', {}, h('kbd', { text: '/' }), ' focus search'), h('li', {}, h('kbd', { text: ',' }), ' open settings'), h('li', {}, h('kbd', { text: 'Esc' }), ' close a panel'),
      h('li', {}, h('kbd', { text: 'Tab' }), ' / ', h('kbd', { text: 'Shift+Tab' }), ' move between controls'))) },
    { t: 'node', n: () => h('p', { class: 'hint', text: 'Sound, volume and touch controls belong to each game. GameShelf cannot change them, so there are no switches for them here.' }) }
  ] },
  { id: 'access', label: 'Accessibility', build: () => [
    { k: 'reducedMotion', t: 'select', l: 'Reduce motion', o: () => OPT.tri }, { k: 'highContrast', t: 'select', l: 'High contrast', o: () => OPT.tri },
    { k: 'fontSize', t: 'range', l: 'Font size', min: 80, max: 140, step: 5, fmt: v => v + '%' },
    { k: 'noFlash', t: 'toggle', l: 'Disable flashing effects', help: 'Stops the blinking cursor and low-battery pulse. It cannot affect effects inside a game.' },
    { k: 'simplified', t: 'toggle', l: 'Simplified interface', help: 'Turns off scanlines, glow and decorative patterns.' },
    { t: 'node', n: () => h('p', { class: 'hint', text: 'Every control is keyboard reachable with a visible focus outline. “Follow system” respects your operating system’s reduced-motion and contrast settings.' }) }
  ] },
  { id: 'privacy', label: 'Privacy', build: () => [
    { t: 'node', n: () => h('div', { class: 'panel-box' }, h('strong', { text: 'Stored in this browser (localStorage)' }),
      h('ul', {}, h('li', { text: 'Your settings, favorites, recently played list, play counts and optional search history.' }), h('li', { text: 'If you use online features, a sign-in session managed by the Supabase library.' })),
      h('strong', { text: 'Sent to Supabase (only if you use accounts or leaderboards)' }),
      h('ul', {}, h('li', { text: 'Sign-in requests (your email if you create an account), your display name, and the scores you submit with their timestamps.' }), h('li', { text: 'Like any web service, Supabase also sees your IP address and browser details in requests.' })),
      h('p', { class: 'hint', text: 'Games are separate pages and may store their own data. Nothing else leaves your device.' })) },
    { t: 'node', n: () => h('div', { class: 'row' },
      action('Clear recently played', () => confirmDo('Clear your recently played history and play counts?', () => { state.recent = []; state.plays = {}; store.del(K.recent); store.del(K.plays); renderAll(); toast('History cleared.'); })),
      action('Reset favorites', () => confirmDo('Remove all favorites?', () => { state.favs.clear(); saveFavs(); renderAll(); toast('Favorites reset.'); })),
      action('Clear search history', () => confirmDo('Clear saved searches?', () => { state.hist = []; store.del(K.hist); renderLibrary(); toast('Search history cleared.'); }))) },
    { t: 'node', n: dataButtons }
  ] },
  { id: 'advanced', label: 'Advanced', build: () => [
    { t: 'node', n: () => h('div', { class: 'panel-box' }, h('p', { text: `GameShelf version ${SITE_VERSION}` }),
      h('p', { text: `Connection: ${navigator.onLine ? 'browser reports online' : 'browser reports offline'}` }),
      h('p', { text: `Supabase: ${sbConfig() ? 'configured' : 'not configured (edit supabase-config.js)'}` }),
      h('p', { text: `Catalog: ${games.length} game(s)${catalogIssues.length ? `, ${catalogIssues.length} problem(s) — see diagnostics` : ''}` })) },
    { t: 'node', n: dataButtons },
    { t: 'node', n: () => { const pre = h('pre', { class: 'diag', hidden: true }); return h('div', { class: 'field' }, action('Show diagnostics', () => { pre.textContent = diagnostics(); pre.hidden = false; }, false), pre, h('p', { class: 'hint', text: 'Diagnostics never include keys, tokens or secrets.' })); } },
    { t: 'node', n: () => action('Reset all settings', () => confirmDo('Reset every setting to its default? Favorites and history are kept.', () => { state.settings = sanitizeSettings(null); saveSettings(); initViewState(); applyAppearance(); renderAll(); renderStatus(); renderSettings(); toast('All settings reset.'); })) }
  ] }
];
let activeTab = 'appearance';

function renderSettings() {
  const tabs = $('#settingsTabs'), panel = $('#settingsPanel');
  tabs.replaceChildren(...TABS.map(t => h('button', { class: 'tab', type: 'button', role: 'tab', id: `tab-${t.id}`, 'aria-selected': String(t.id === activeTab), 'aria-controls': 'settingsPanel', tabindex: t.id === activeTab ? '0' : '-1', text: t.label,
    onclick: () => { activeTab = t.id; renderSettings(); }, onkeydown: e => {
      const i = TABS.findIndex(x => x.id === activeTab), n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (n) { activeTab = TABS[(i + n + TABS.length) % TABS.length].id; renderSettings(); $(`#tab-${activeTab}`).focus(); e.preventDefault(); }
    } })));
  panel.setAttribute('aria-labelledby', `tab-${activeTab}`);
  panel.replaceChildren(...TABS.find(t => t.id === activeTab).build().map(f => f.t === 'node' ? f.n() : field(f)));
}

/* ═════════════ 10. INIT ═════════════ */

function initViewState() {
  const s = state.settings, cats = new Set(categoryList().map(c => c.id));
  const start = s.rememberCategory ? s.lastCategory : s.defaultCategory;
  state.category = start === 'all' || cats.has(start) ? start : 'all';
  state.sort = s.defaultSort;
  $('#sortSel').value = state.sort;
}

function bind() {
  $$('[data-icon]').forEach(el => el.prepend(icon(el.dataset.icon)));
  $('#sortSel').replaceChildren(...OPT.sort.map(([v, l]) => h('option', { value: v, text: l })));
  $('#sortSel').addEventListener('change', e => { state.sort = e.target.value; renderLibrary(); });
  const search = $('#search');
  search.addEventListener('input', e => { state.query = e.target.value; renderLibrary(); });
  search.addEventListener('change', e => {   // remember search only if the user opted in
    const q = e.target.value.trim();
    if (state.settings.searchHistory && q) { state.hist = [q, ...state.hist.filter(x => x !== q)].slice(0, 8); store.set(K.hist, state.hist); renderLibrary(); }
  });
  $$('dialog.dlg').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  });
  const openSettings = () => { renderSettings(); $('#settingsDlg').showModal(); };
  $('#btnSettings').addEventListener('click', openSettings); $('#footSettings').addEventListener('click', openSettings);
  $('#btnAccount').addEventListener('click', openAccount);
  $('#btnLb').addEventListener('click', () => openLeaderboard());
  $('#lbPreviewFull').addEventListener('click', () => openLeaderboard($('#lbPreviewSelect').value));
  $('#lbPreviewSelect').addEventListener('change', e => renderBoard($('#lbPreview'), $('#lbPreviewYou'), e.target.value, 10));
  $('#lbPreviewRefresh').addEventListener('click', () => renderBoard($('#lbPreview'), $('#lbPreviewYou'), $('#lbPreviewSelect').value, 10));
  $('#lbSelect').addEventListener('change', loadFullBoard); $('#lbRefresh').addEventListener('click', loadFullBoard);
  $('#btnRandom').addEventListener('click', () => {
    const list = games.filter(playable); if (!list.length) return toast('Add games to the catalog first.');
    launch(list[Math.floor(Math.random() * list.length)], $('#btnRandom'));
  });
  $('#pBack').addEventListener('click', requestClosePlayer);
  $('#pFav').addEventListener('click', () => player.game && toggleFav(player.game.id));
  $('#pLb').addEventListener('click', () => player.game && openLeaderboard(player.game.leaderboard.gameId));
  $('#pFs').addEventListener('click', () => { document.fullscreenElement ? document.exitFullscreen() : $('#player').requestFullscreen().catch(() => toast('Fullscreen was blocked by the browser.')); });
  window.addEventListener('popstate', () => { if (player.open) closePlayerUI(); });
  window.addEventListener('beforeunload', e => { if (player.open && state.settings.confirmLeave) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || player.open) return;
    const t = e.target, typing = t.matches && t.matches('input, textarea, select, [contenteditable]');
    if (typing || document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    else if (e.key === ',') { e.preventDefault(); openSettings(); }
  });
}

function init() {
  loadUserData(); applyAppearance(); bind(); initViewState();
  const hasSession = sbConfig();   // loading the SDK only when Supabase is configured keeps unconfigured sites free of extra requests
  renderAll(); initStatus();
  if (hasSession) sbReady().then(() => updateAccountButton());
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (catalogIssues.length) console.warn('GameShelf catalog problems:\n' + catalogIssues.join('\n'));
}
init();
})();
