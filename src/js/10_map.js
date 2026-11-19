/* ================= Mapa de la estación ================= */
const MW = 48, MH = 39;
const grid = new Uint8Array(MW * MH).fill(1); // 1 pared · 0 suelo · 2 obstáculo
const roomGrid = new Int8Array(MW * MH).fill(-1);
const zoneGrid = new Int8Array(MW * MH).fill(-1);
const TI = (i, j) => j * MW + i;
const inMap = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH;
const tileAt = (i, j) => (inMap(i, j) ? grid[TI(i, j)] : 1);
const walkable = (i, j) => tileAt(i, j) === 0;
const opaque = (i, j) => tileAt(i, j) === 1;

const ROOMS = [
  { id: 'caf', name: 'Cafetería', r: [19, 2, 30, 12], tint: '#B4BCC6' },
  { id: 'lab', name: 'Laboratorio', r: [3, 3, 12, 10], tint: '#9FC6BE' },
  { id: 'nav', name: 'Navegación', r: [37, 3, 46, 10], tint: '#9AB0D8' },
  { id: 'rea', name: 'Reactor', r: [2, 17, 10, 24], tint: '#D6A393' },
  { id: 'med', name: 'Médica', r: [16, 17, 23, 23], tint: '#A2D5BF' },
  { id: 'com', name: 'Comunicaciones', r: [37, 17, 46, 24], tint: '#BDAFD9' },
  { id: 'mot', name: 'Motores', r: [2, 30, 10, 37], tint: '#C8AD89' },
  { id: 'ele', name: 'Electricidad', r: [15, 30, 23, 37], tint: '#D7C881' },
  { id: 'alm', name: 'Almacén', r: [27, 29, 37, 37], tint: '#B8A88C' },
];
const CORRIDORS = [
  [13, 6, 18, 8, 'el pasillo entre Laboratorio y Cafetería'],
  [31, 6, 36, 8, 'el pasillo entre Cafetería y Navegación'],
  [6, 11, 8, 16, 'el pasillo entre Laboratorio y Reactor'],
  [19, 13, 21, 16, 'el pasillo entre Cafetería y Médica'],
  [27, 13, 29, 28, 'el pasillo central'],
  [11, 19, 15, 21, 'el pasillo entre Reactor y Médica'],
  [24, 19, 26, 21, 'el pasillo central'],
  [30, 19, 36, 21, 'el pasillo hacia Comunicaciones'],
  [40, 11, 42, 16, 'el pasillo entre Navegación y Comunicaciones'],
  [5, 25, 7, 29, 'el pasillo entre Reactor y Motores'],
  [11, 32, 14, 34, 'el pasillo entre Motores y Electricidad'],
  [24, 32, 26, 34, 'el pasillo entre Electricidad y Almacén'],
  [40, 25, 42, 33, 'el pasillo entre Comunicaciones y Almacén'],
  [38, 31, 39, 33, 'el pasillo entre Comunicaciones y Almacén'],
];
const corridorGrid = new Int8Array(MW * MH).fill(-1);
const BLOCKS = [
  [24, 7, 25, 8], [21, 4, 21, 4], [28, 4, 28, 4], [21, 10, 21, 10], [28, 10, 28, 10],
  [6, 5, 8, 5], [43, 6, 43, 7], [5, 20, 6, 21], [17, 23, 18, 23], [21, 23, 22, 23],
  [44, 21, 44, 22], [8, 35, 9, 36], [18, 35, 19, 36], [31, 32, 32, 33], [34, 35, 35, 35],
];
const STATIONS = [
  { id: 'caf_datos', room: 'caf', t: [20, 2], f: 'N', type: 'download', name: 'Descargar datos' },
  { id: 'caf_basura', room: 'caf', t: [29, 2], f: 'N', type: 'hold', name: 'Vaciar basura' },
  { id: 'lab_muestra', room: 'lab', t: [3, 6], f: 'W', type: 'simon', name: 'Analizar muestra' },
  { id: 'lab_telescopio', room: 'lab', t: [10, 3], f: 'N', type: 'tune', name: 'Calibrar telescopio' },
  { id: 'nav_rumbo', room: 'nav', t: [44, 3], f: 'N', type: 'keypad', name: 'Introducir coordenadas' },
  { id: 'nav_escudos', room: 'nav', t: [46, 8], f: 'E', type: 'switches', name: 'Estabilizar escudos' },
  { id: 'rea_secuencia', room: 'rea', t: [2, 18], f: 'W', type: 'simon', name: 'Iniciar reactor' },
  { id: 'rea_nucleo', room: 'rea', t: [10, 24], f: 'S', type: 'hold', name: 'Enfriar núcleo' },
  { id: 'med_escaneo', room: 'med', t: [19, 20], f: null, type: 'scan', name: 'Escaneo médico' },
  { id: 'med_muestras', room: 'med', t: [23, 17], f: 'N', type: 'keypad', name: 'Inventariar muestras' },
  { id: 'com_frecuencia', room: 'com', t: [46, 19], f: 'E', type: 'tune', name: 'Sintonizar antena' },
  { id: 'com_descarga', room: 'com', t: [38, 24], f: 'S', type: 'download', name: 'Subir datos' },
  { id: 'mot_combustible', room: 'mot', t: [2, 33], f: 'W', type: 'hold', name: 'Cargar combustible' },
  { id: 'mot_alinear', room: 'mot', t: [6, 37], f: 'S', type: 'timing', name: 'Alinear motor' },
  { id: 'ele_cables', room: 'ele', t: [16, 30], f: 'N', type: 'wires', name: 'Reparar cables' },
  { id: 'ele_distribuidor', room: 'ele', t: [23, 37], f: 'S', type: 'timing', name: 'Calibrar distribuidor' },
  { id: 'alm_cajas', room: 'alm', t: [36, 29], f: 'N', type: 'keypad', name: 'Escanear cajas' },
  { id: 'alm_carga', room: 'alm', t: [28, 37], f: 'S', type: 'wires', name: 'Asegurar la carga' },
];
const LIGHTS_PANEL = { id: 'ele_luces', room: 'ele', t: [20, 30], f: 'N', type: 'switches', name: 'Restaurar luces' };
const EMERGENCY = { x: 25, z: 8, r: 2.15 };
const FACE = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };

function prepStation(s) {
  s.rk = ROOMS.findIndex(r => r.id === s.room);
  const cx = s.t[0] + 0.5, cz = s.t[1] + 0.5;
  if (!s.f) { s.stand = { x: cx, z: cz }; s.con = { x: cx, z: cz }; s.rot = 0; return; }
  const [dx, dz] = FACE[s.f];
  s.con = { x: cx + dx * 0.33, z: cz + dz * 0.33 };
  s.stand = { x: cx - dx * 0.12, z: cz - dz * 0.12 };
  s.rot = Math.atan2(-dx, -dz);
  if (!opaque(s.t[0] + dx, s.t[1] + dz)) console.warn('Estación sin pared detrás:', s.id);
}

function buildMap() {
  ROOMS.forEach((rm, k) => {
    rm.k = k;
    const [x0, z0, x1, z1] = rm.r;
    rm.cx = (x0 + x1 + 1) / 2; rm.cz = (z0 + z1 + 1) / 2;
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { grid[TI(i, j)] = 0; roomGrid[TI(i, j)] = k; }
  });
  CORRIDORS.forEach(([x0, z0, x1, z1], k) => { for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { grid[TI(i, j)] = 0; if (roomGrid[TI(i, j)] < 0) corridorGrid[TI(i, j)] = k; } });
  for (const [x0, z0, x1, z1] of BLOCKS) for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) grid[TI(i, j)] = 2;
  // zona = sala, o la sala más cercana para los pasillos (BFS multi-origen)
  const q = [];
  for (let k = 0; k < MW * MH; k++) if (roomGrid[k] >= 0) { zoneGrid[k] = roomGrid[k]; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % MW, j = (k / MW) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (!inMap(ni, nj) || opaque(ni, nj)) continue;
      const n = TI(ni, nj);
      if (zoneGrid[n] >= 0) continue;
      zoneGrid[n] = zoneGrid[k]; q.push(n);
    }
  }
  STATIONS.forEach(prepStation);
  prepStation(LIGHTS_PANEL);
}

const zoneAt = p => { const i = Math.floor(p.x), j = Math.floor(p.z); return inMap(i, j) ? zoneGrid[TI(i, j)] : -1; };
const roomAt = p => { const i = Math.floor(p.x), j = Math.floor(p.z); return inMap(i, j) ? roomGrid[TI(i, j)] : -1; };
const zn = k => (k >= 0 && ROOMS[k] ? ROOMS[k].name : 'un pasillo');
/* Nombre del lugar exacto (sala o pasillo concreto) para las declaraciones */
function placeName(p) {
  const i = Math.floor(p.x), j = Math.floor(p.z);
  if (!inMap(i, j)) return 'un pasillo';
  const r = roomGrid[TI(i, j)]; if (r >= 0) return ROOMS[r].name;
  const c = corridorGrid[TI(i, j)]; return c >= 0 ? CORRIDORS[c][4] : 'un pasillo';
}

/* ---------- Línea de visión (recorrido de cuadrícula) ---------- */
function los(ax, az, bx, bz) {
  let i = Math.floor(ax), j = Math.floor(az);
  const ti = Math.floor(bx), tj = Math.floor(bz);
  const dx = bx - ax, dz = bz - az;
  const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx !== 0 ? (si > 0 ? i + 1 - ax : ax - i) * tdx : Infinity;
  let tmz = dz !== 0 ? (sj > 0 ? j + 1 - az : az - j) * tdz : Infinity;
  let n = Math.abs(ti - i) + Math.abs(tj - j);
  while (n-- > 0) {
    if (tmx < tmz) { i += si; tmx += tdx; } else { j += sj; tmz += tdz; }
    if (opaque(i, j)) return false;
  }
  return true;
}

/* ---------- A* ---------- */
class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pr) {
    const k = this.k, p = this.p; let i = k.length; k.push(key); p.push(pr);
    while (i > 0) { const par = (i - 1) >> 1; if (p[par] <= pr) break; k[i] = k[par]; p[i] = p[par]; i = par; }
    k[i] = key; p[i] = pr;
  }
  pop() {
    const k = this.k, p = this.p; const top = k[0]; const lk = k.pop(), lp = p.pop();
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i, mp = lp;
        if (l < n && p[l] < mp) { m = l; mp = p[l]; }
        if (r < n && p[r] < mp) { m = r; mp = p[r]; }
        if (m === i) break;
        k[i] = k[m]; p[i] = p[m]; i = m;
      }
      k[i] = lk; p[i] = lp;
    }
    return top;
  }
}
const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const octile = (i, j, ti, tj) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };

function nearestWalkable(i, j) {
  if (walkable(i, j)) return [i, j];
  for (let r = 1; r <= 5; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (walkable(i + di, j + dj)) return [i + di, j + dj];
  }
  return null;
}

function astar(si, sj, ti, tj) {
  const s0 = nearestWalkable(si, sj), t0 = nearestWalkable(ti, tj);
  if (!s0 || !t0) return null;
  [si, sj] = s0; [ti, tj] = t0;
  const N = MW * MH, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const s = TI(si, sj), t = TI(ti, tj), heap = new MinHeap();
  g[s] = 0; heap.push(s, octile(si, sj, ti, tj));
  while (heap.size) {
    const cur = heap.pop();
    if (cur === t) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % MW, cj = (cur / MW) | 0;
    for (const [di, dj, c] of DIRS8) {
      const ni = ci + di, nj = cj + dj;
      if (!walkable(ni, nj)) continue;
      if (di && dj && (!walkable(ci + di, cj) || !walkable(ci, cj + dj))) continue;
      const n = TI(ni, nj), ng = g[cur] + c;
      if (ng < g[n]) { g[n] = ng; came[n] = cur; heap.push(n, ng + octile(ni, nj, ti, tj)); }
    }
  }
  if (s !== t && came[t] === -1) return null;
  const path = [];
  for (let c = t; c !== -1 && c !== s; c = came[c]) path.push(c);
  path.reverse();
  return path.map(k => ({ x: (k % MW) + 0.5, z: ((k / MW) | 0) + 0.5 }));
}

function clearLine(a, b, r = 0.34) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.25));
  for (let k = 1; k <= n; k++) {
    const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (!walkable(Math.floor(x - r), Math.floor(z - r)) || !walkable(Math.floor(x + r), Math.floor(z - r)) ||
        !walkable(Math.floor(x - r), Math.floor(z + r)) || !walkable(Math.floor(x + r), Math.floor(z + r))) return false;
  }
  return true;
}

function smoothPath(start, pts) {
  if (pts.length < 2) return pts;
  const out = []; let anchor = start, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !clearLine(anchor, pts[j])) j--;
    out.push(pts[j]); anchor = pts[j]; i = j + 1;
  }
  return out;
}

function findPath(from, to) {
  const raw = astar(Math.floor(from.x), Math.floor(from.z), Math.floor(to.x), Math.floor(to.z));
  if (!raw) return null;
  const target = { x: to.x, z: to.z };
  if (raw.length) { if (clearLine(raw[raw.length - 1], target, 0.3)) raw[raw.length - 1] = target; }
  else if (clearLine(from, target, 0.3)) raw.push(target);
  return smoothPath(from, raw);
}

function randomPointInRoom(rm) {
  const [x0, z0, x1, z1] = rm.r;
  for (let k = 0; k < 40; k++) {
    const i = randi(x0, x1), j = randi(z0, z1);
    if (walkable(i, j) && walkable(i + 1, j) && walkable(i - 1, j) && walkable(i, j + 1) && walkable(i, j - 1)) return { x: i + 0.5 + rand(-0.2, 0.2), z: j + 0.5 + rand(-0.2, 0.2) };
  }
  return { x: rm.cx, z: rm.cz };
}
