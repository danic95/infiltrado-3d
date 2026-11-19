import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ================= Utilidades ================= */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
const dist2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };
const dist = (a, b) => Math.sqrt(dist2(a, b));
const angLerp = (a, b, t) => { const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI; return a + d * t; };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const listJoin = arr => (arr.length <= 1 ? arr[0] || '' : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1]);
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined && v[k] !== null ? v[k] : ''));
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= Configuración ================= */
const PALETTE = [
  ['#FF5A4E', 'coral'], ['#3D7BFF', 'azul'], ['#33D69F', 'menta'], ['#FFB627', 'ámbar'],
  ['#A974FF', 'lila'], ['#2CD3E1', 'cian'], ['#FF6FB5', 'rosa'], ['#A6E22E', 'lima'],
  ['#FF8A2A', 'naranja'], ['#E9EEF5', 'blanco'], ['#7A8194', 'grafito'],
];
const colorName = hex => (PALETTE.find(p => p[0] === hex) || [0, 'gris'])[1];

const ROSTER = [
  { name: 'NOVA', pers: 'calma' }, { name: 'REX', pers: 'directa' }, { name: 'KIRA', pers: 'seca' },
  { name: 'TITO', pers: 'nerviosa' }, { name: 'PIXEL', pers: 'bromista' }, { name: 'LUNA', pers: 'lider' },
  { name: 'ZARA', pers: 'dramatica' }, { name: 'BOLT', pers: 'despistada' }, { name: 'COBRE', pers: 'grunona' },
];
const PERS = {
  calma: { desc: 'serena y analítica; habla con datos y orden', paranoia: 0.25, logic: 0.9, chat: 0.7, follow: 0.2 },
  directa: { desc: 'impulsiva y frontal; acusa sin rodeos', paranoia: 0.7, logic: 0.5, chat: 0.95, follow: 0.3 },
  seca: { desc: 'lacónica; frases muy cortas, casi telegráficas', paranoia: 0.4, logic: 0.85, chat: 0.3, follow: 0.2 },
  nerviosa: { desc: 'nerviosa; tartamudea, se justifica y duda', paranoia: 0.85, logic: 0.4, chat: 0.6, follow: 0.65 },
  bromista: { desc: 'bromista; mete chistes de robots incluso en plena crisis', paranoia: 0.3, logic: 0.5, chat: 0.8, follow: 0.4 },
  lider: { desc: 'líder nata; ordena la discusión y busca consenso', paranoia: 0.3, logic: 0.8, chat: 0.9, follow: 0.1 },
  dramatica: { desc: 'dramática y teatral; todo es una tragedia', paranoia: 0.6, logic: 0.4, chat: 0.85, follow: 0.5 },
  despistada: { desc: 'despistada; se distrae y no confía en su memoria', paranoia: 0.4, logic: 0.3, chat: 0.5, follow: 0.7 },
  grunona: { desc: 'gruñona y quisquillosa; se queja de todo, pero es observadora', paranoia: 0.55, logic: 0.75, chat: 0.6, follow: 0.25 },
};

const DIFF = {
  facil: { label: 'Fácil', killCd: 40, firstCd: 28, witness: 0.72, playerBias: -3, playerKill: 0.3, sabCd: 85, lie: 0, selfReport: 0, npcTasks: 5, playerTasks: 4, grace: 40 },
  normal: { label: 'Normal', killCd: 30, firstCd: 20, witness: 0.96, playerBias: -0.6, playerKill: 0.6, sabCd: 60, lie: 1, selfReport: 0.08, npcTasks: 6, playerTasks: 5, grace: 26 },
  dificil: { label: 'Difícil', killCd: 24, firstCd: 16, witness: 1.12, playerBias: 0.6, playerKill: 0.85, sabCd: 45, lie: 2, selfReport: 0.2, npcTasks: 6, playerTasks: 6, grace: 18 },
};

const DEFAULTS = { name: 'VEGA', color: '#3D7BFF', diff: 'normal', crew: 8, voice: 'claude', sound: true };
let settings = { ...DEFAULTS };
let record = { w: 0, l: 0 };
function loadPrefs() {
  try {
    const s = JSON.parse(localStorage.getItem('infiltrado.v1') || 'null');
    if (s) { settings = { ...DEFAULTS, ...(s.settings || {}) }; record = { ...record, ...(s.record || {}) }; }
  } catch (e) { /* almacenamiento no disponible */ }
}
function savePrefs() {
  try { localStorage.setItem('infiltrado.v1', JSON.stringify({ settings, record })); } catch (e) { /* sin almacenamiento */ }
}

const game = {
  state: 'boot', t: 0, agents: [], player: null, impostor: null, bodies: [],
  cfg: DIFF.normal, tasksDone: 0, tasksTotal: 0, meetings: 0, lastMeetingT: -1,
  blackout: null, emergencyLeft: 1, emergencyCd: 0, timeScale: 1, ejectedLog: [],
  startedAt: 0, endInfo: null, dying: null,
};
