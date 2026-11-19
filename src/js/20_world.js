/* ================= Mundo 3D ================= */
let renderer, scene, camera;
const L3 = {};
const WALL_H = 1.25;
const CORRIDOR_TINT = '#8D94A1';
const fx = { markers: new Map(), rings: [], spinY: [], blink: [], core: null, holo: null, emergencyBtn: null, scanBeam: null, lightsScreen: null, look: { dark: 0 } };
let sparks = null, zapFx = null, hazardTex = null;

function initRenderer() {
  const canvas = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#05060A');
  scene.fog = new THREE.Fog('#05060A', 22, 42);
  camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
  L3.hemi = new THREE.HemisphereLight('#E6EDFF', '#3A2F2C', 1.9);
  L3.dir = new THREE.DirectionalLight('#FFF0D8', 2.0);
  L3.dir.position.set(-10, 24, 14);
  scene.add(L3.hemi, L3.dir);
  resize();
  addEventListener('resize', resize);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function makeTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const MAT = {};
function mesh(geo, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; }

function buildWorld() {
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  Object.assign(MAT, {
    steel: new THREE.MeshLambertMaterial({ color: '#4B515E' }),
    dark: new THREE.MeshLambertMaterial({ color: '#262A33' }),
    white: new THREE.MeshLambertMaterial({ color: '#EEF0F3' }),
    hull: new THREE.MeshLambertMaterial({ color: '#E3DED0' }),
    teal: new THREE.MeshLambertMaterial({ color: '#2FB89B' }),
    amber: new THREE.MeshBasicMaterial({ color: '#FFB31A' }),
    green: new THREE.MeshBasicMaterial({ color: '#69F5A8' }),
    red: new THREE.MeshBasicMaterial({ color: '#FF3B2F' }),
    cyan: new THREE.MeshBasicMaterial({ color: '#4FE6FF' }),
  });

  /* ---- suelo (instanciado) ---- */
  const floorTex = makeTex(128, 128, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(0,0,0,0.28)'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
    x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 2; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = 'rgba(0,0,0,0.25)';
    for (const [px, py] of [[15, 15], [w - 15, 15], [15, h - 15], [w - 15, h - 15]]) { x.beginPath(); x.arc(px, py, 3, 0, TAU); x.fill(); }
  });
  const tiles = [];
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) if (!opaque(i, j)) tiles.push(i, j);
  const nF = tiles.length / 2;
  const floor = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshLambertMaterial({ map: floorTex }), nF);
  for (let n = 0; n < nF; n++) {
    const i = tiles[n * 2], j = tiles[n * 2 + 1];
    m4.makeTranslation(i + 0.5, -0.1, j + 0.5); floor.setMatrixAt(n, m4);
    const rk = roomGrid[TI(i, j)];
    col.set(rk >= 0 ? ROOMS[rk].tint : CORRIDOR_TINT).multiplyScalar(0.95 + Math.random() * 0.07);
    floor.setColorAt(n, col);
  }
  scene.add(floor);

  /* ---- paredes (instanciadas, solo bordes) ---- */
  const wallSideTex = makeTex(64, 128, (x, w, h) => {
    x.fillStyle = '#E7E2D4'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#CFC9B9'; x.fillRect(0, 0, w, 9);
    x.fillStyle = '#FF7A21'; x.fillRect(0, h * 0.6, w, h * 0.1);
    x.fillStyle = '#3A3F4B'; x.fillRect(0, h * 0.86, w, h * 0.14);
    x.fillStyle = 'rgba(0,0,0,0.13)'; x.fillRect(w - 2, 0, 2, h);
  });
  const sideMat = new THREE.MeshLambertMaterial({ map: wallSideTex });
  const topMat = new THREE.MeshLambertMaterial({ color: '#2A2E37' });
  const walls = [];
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    if (!opaque(i, j)) continue;
    let edge = false;
    for (let dj = -1; dj <= 1 && !edge; dj++) for (let di = -1; di <= 1; di++) if (inMap(i + di, j + dj) && !opaque(i + di, j + dj)) { edge = true; break; }
    if (edge) walls.push(i, j);
  }
  const nW = walls.length / 2;
  const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_H, 1), [sideMat, sideMat, topMat, topMat, sideMat, sideMat], nW);
  for (let n = 0; n < nW; n++) { m4.makeTranslation(walls[n * 2] + 0.5, WALL_H / 2, walls[n * 2 + 1] + 0.5); wallMesh.setMatrixAt(n, m4); }
  scene.add(wallMesh);

  /* ---- franjas de seguridad en las puertas ---- */
  hazardTex = makeTex(64, 32, (x, w, h) => {
    x.fillStyle = '#1C1E24'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#FFC21A';
    for (let k = -h; k < w + h; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 8, 0); x.lineTo(k + 8 - h, h); x.lineTo(k - h, h); x.closePath(); x.fill(); }
  });
  const strips = [];
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    if (opaque(i, j) || roomGrid[TI(i, j)] >= 0) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (inMap(ni, nj) && roomGrid[TI(ni, nj)] >= 0) strips.push([i + 0.5 + di * 0.38, j + 0.5 + dj * 0.38, di ? Math.PI / 2 : 0]);
    }
  }
  const stripMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.22), new THREE.MeshLambertMaterial({ map: hazardTex }), strips.length);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  strips.forEach(([x, z, r], n) => { e.set(-Math.PI / 2, 0, r, 'XYZ'); q.setFromEuler(e); v.set(x, 0.006, z); m4.compose(v, q, one); stripMesh.setMatrixAt(n, m4); });
  scene.add(stripMesh);

  /* ---- nombres pintados en el suelo ---- */
  for (const rm of ROOMS) {
    const w = Math.min(rm.r[2] - rm.r[0] - 1, 7.4), h = w / 4;
    const tex = makeTex(512, 128, (x, W, H) => {
      x.fillStyle = 'rgba(18,20,26,0.32)';
      x.font = '86px "Saira Stencil One", Impact, "Arial Narrow", sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(rm.name.toUpperCase(), W / 2, H / 2 + 4, W - 24);
    });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false }));
    lm.rotation.x = -Math.PI / 2;
    lm.position.set(rm.cx, 0.009, rm.cz + (rm.r[3] - rm.r[1]) * 0.18);
    scene.add(lm);
  }

  buildDecor();
  for (const s of STATIONS) if (s.type !== 'scan') buildConsole(s, false);
  buildConsole(LIGHTS_PANEL, true);

  /* ---- marcadores de tareas ---- */
  const mkGeo = new THREE.ConeGeometry(0.2, 0.38, 4); mkGeo.rotateX(Math.PI);
  const mkMat = new THREE.MeshBasicMaterial({ color: '#FFB31A', fog: false });
  for (const s of [...STATIONS, LIGHTS_PANEL]) {
    const mk = new THREE.Mesh(mkGeo, s === LIGHTS_PANEL ? new THREE.MeshBasicMaterial({ color: '#FF4A1C', fog: false }) : mkMat);
    mk.position.set(s.con.x, 1.75, s.con.z); mk.visible = false; scene.add(mk); fx.markers.set(s.id, mk);
  }

  /* ---- estrellas bajo la estación ---- */
  const N = 1500, pos = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) { pos[k * 3] = rand(-80, 130); pos[k * 3 + 1] = rand(-45, -6); pos[k * 3 + 2] = rand(-80, 120); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#C9D6FF', size: 0.24, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85 })));

  sparks = new Sparks(420);
  zapFx = new Zap();
}

function buildConsole(s, isLights) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.95, 0.3), isLights ? new THREE.MeshLambertMaterial({ color: '#5A4A1E' }) : MAT.steel);
  body.position.y = 0.475;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.07, 0.4), MAT.dark); top.position.set(0, 0.98, 0.03); top.rotation.x = -0.3;
  const scrTex = makeTex(64, 40, (x, w, h) => {
    x.fillStyle = isLights ? '#1A0B06' : '#1A1206'; x.fillRect(0, 0, w, h);
    x.fillStyle = isLights ? '#FF6A3A' : '#FFB31A';
    for (let y = 6; y < h - 4; y += 6) x.fillRect(6, y, 10 + Math.random() * 40, 2);
    x.fillStyle = 'rgba(255,190,60,0.12)'; for (let y = 0; y < h; y += 2) x.fillRect(0, y, w, 1);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.32), new THREE.MeshBasicMaterial({ map: scrTex }));
  screen.position.set(0, 0.68, 0.152);
  g.add(body, top, screen);
  if (isLights) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.12), new THREE.MeshLambertMaterial({ map: hazardTex }));
    stripe.position.set(0, 0.22, 0.152); g.add(stripe);
    fx.lightsScreen = screen;
  }
  g.position.set(s.con.x, 0, s.con.z); g.rotation.y = s.rot;
  scene.add(g); s.mesh = g;
}

function buildDecor() {
  const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  /* Cafetería: mesa de emergencia + mesas */
  mesh(cyl(0.45, 0.62, 0.66, 16), MAT.steel, 25, 0.33, 8);
  mesh(cyl(1.05, 1.12, 0.12, 30), MAT.dark, 25, 0.7, 8);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.54, 32), new THREE.MeshBasicMaterial({ map: hazardTex }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(25, 0.765, 8); scene.add(ring);
  fx.emergencyBtn = mesh(new THREE.SphereGeometry(0.3, 22, 12, 0, TAU, 0, Math.PI / 2), MAT.red, 25, 0.76, 8);
  for (const [x, z] of [[21.5, 4.5], [28.5, 4.5], [21.5, 10.5], [28.5, 10.5]]) {
    mesh(cyl(0.12, 0.2, 0.62, 10), MAT.steel, x, 0.31, z);
    mesh(cyl(0.5, 0.5, 0.07, 22), MAT.hull, x, 0.64, z);
  }
  /* Reactor */
  mesh(cyl(1.0, 1.12, 0.3, 26), MAT.dark, 6, 0.15, 21);
  fx.core = mesh(cyl(0.6, 0.6, 2.2, 24), new THREE.MeshBasicMaterial({ color: '#4FE6FF', transparent: true, opacity: 0.9 }), 6, 1.4, 21);
  for (let k = 0; k < 3; k++) { const r = mesh(new THREE.TorusGeometry(0.84, 0.07, 8, 34), MAT.steel, 6, 0.75 + k * 0.62, 21); r.rotation.x = Math.PI / 2; fx.rings.push(r); }
  mesh(cyl(0.95, 0.95, 0.22, 26), MAT.dark, 6, 2.58, 21);
  /* Médica: escáner + camillas */
  const pad = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 36), new THREE.MeshBasicMaterial({ color: '#3AD7B1' }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(19.5, 0.012, 20.5); scene.add(pad);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 30), MAT.dark); disc.rotation.x = -Math.PI / 2; disc.position.set(19.5, 0.011, 20.5); scene.add(disc);
  fx.scanBeam = mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.7, 28, 1, true), new THREE.MeshBasicMaterial({ color: '#3AD7B1', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }), 19.5, 0.85, 20.5);
  fx.scanBeam.visible = false;
  for (const x of [18, 22]) { mesh(box(1.9, 0.45, 0.86), MAT.white, x, 0.23, 23.5); mesh(box(1.1, 0.06, 0.88), MAT.teal, x + 0.35, 0.48, 23.5); mesh(box(0.42, 0.12, 0.6), MAT.hull, x - 0.65, 0.5, 23.5); }
  /* Navegación: consola + holograma */
  mesh(box(0.9, 0.85, 1.9), MAT.steel, 43.5, 0.43, 7);
  const navScr = mesh(box(0.7, 0.04, 1.7), MAT.cyan, 43.5, 0.87, 7);
  navScr.rotation.z = 0.1;
  fx.holo = mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: '#4FE6FF', wireframe: true, transparent: true, opacity: 0.65 }), 43.5, 1.75, 7);
  /* Comunicaciones: antena */
  mesh(cyl(0.22, 0.32, 0.9, 14), MAT.steel, 44.5, 0.45, 22);
  const dish = mesh(new THREE.SphereGeometry(0.8, 22, 10, 0, TAU, 0, 0.95), new THREE.MeshLambertMaterial({ color: '#EEF0F3', side: THREE.DoubleSide }), 44.5, 1.65, 22);
  dish.rotation.x = Math.PI * 0.85; fx.spinY.push(dish);
  /* Motores */
  const eng = mesh(cyl(0.85, 0.85, 1.9, 26), MAT.steel, 9, 0.9, 36); eng.rotation.z = Math.PI / 2;
  const ex = mesh(new THREE.TorusGeometry(0.62, 0.1, 8, 30), new THREE.MeshBasicMaterial({ color: '#FF8A2A' }), 7.98, 0.9, 36); ex.rotation.y = Math.PI / 2;
  for (const dz of [-0.55, 0.55]) mesh(box(1.7, 0.1, 0.1), MAT.dark, 9, 1.72, 36 + dz);
  /* Electricidad: generador */
  mesh(box(1.8, 1.3, 1.8), MAT.dark, 19, 0.65, 36);
  const band = mesh(box(1.82, 0.16, 1.82), new THREE.MeshLambertMaterial({ map: hazardTex }), 19, 1.05, 36);
  band.material.map.wrapS = THREE.RepeatWrapping;
  for (let k = 0; k < 4; k++) { const b = mesh(box(0.16, 0.08, 0.16), k % 2 ? MAT.green : MAT.amber, 18.4 + k * 0.4, 1.34, 36); fx.blink.push(b); }
  /* Almacén: cajas */
  const crateTex = makeTex(64, 64, (x, w, h) => {
    x.fillStyle = '#8A7B52'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#5D5236'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.beginPath(); x.moveTo(6, 6); x.lineTo(w - 6, h - 6); x.stroke();
    x.fillStyle = 'rgba(20,20,20,0.55)'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.fillText('K-7', w / 2, h - 10);
  });
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTex });
  for (const [x, z, y] of [[31.5, 32.5, 0], [32.5, 32.5, 0], [31.5, 33.5, 0], [32.5, 33.5, 0], [32, 33, 0.92], [34.5, 35.5, 0], [35.5, 35.5, 0]]) {
    const c = mesh(box(0.92, 0.92, 0.92), crateMat, x, 0.46 + y, z); c.rotation.y = rand(-0.12, 0.12);
  }
  /* Laboratorio: mesa con tubos */
  mesh(box(2.9, 0.85, 0.86), MAT.white, 7.5, 0.43, 5.5);
  for (let k = 0; k < 3; k++) mesh(cyl(0.09, 0.09, 0.5, 10), new THREE.MeshBasicMaterial({ color: ['#69F5A8', '#4FE6FF', '#FF6FB5'][k], transparent: true, opacity: 0.85 }), 6.6 + k * 0.9, 1.1, 5.5);
}

/* Aspecto de apagón: interpolación suave de luces y niebla */
function updateLook(dt) {
  const target = game.blackout ? 1 : 0;
  fx.look.dark = lerp(fx.look.dark, target, Math.min(1, dt * 3));
  const d = fx.look.dark;
  L3.hemi.intensity = lerp(1.9, 0.5, d);
  L3.dir.intensity = lerp(2.0, 0.22, d);
  L3.hemi.color.setRGB(lerp(0.9, 1.0, d), lerp(0.93, 0.45, d), lerp(1.0, 0.4, d));
}

function updateWorldFx(dt, t) {
  fx.rings.forEach((r, k) => { r.rotation.z += dt * (0.6 + k * 0.35) * (k % 2 ? -1 : 1); r.position.y = 0.75 + k * 0.62 + Math.sin(t * 1.4 + k) * 0.05; });
  if (fx.core) fx.core.material.opacity = 0.72 + Math.sin(t * 3) * 0.18;
  if (fx.holo) fx.holo.rotation.y += dt * 0.6;
  fx.spinY.forEach(o => { o.rotation.z += dt * 0.25; });
  fx.blink.forEach((b, k) => { b.visible = Math.sin(t * (2 + k) + k) > -0.2; });
  if (fx.emergencyBtn) { const s = 1 + Math.sin(t * 4) * 0.05; fx.emergencyBtn.scale.set(s, s, s); }
  if (fx.lightsScreen) fx.lightsScreen.material.color.setRGB(1, game.blackout && Math.sin(t * 10) > 0 ? 0.25 : 1, game.blackout && Math.sin(t * 10) > 0 ? 0.25 : 1);
  for (const mk of fx.markers.values()) if (mk.visible) { mk.position.y = 1.75 + Math.sin(t * 3 + mk.position.x) * 0.12; mk.rotation.y += dt * 2; }
  if (fx.scanBeam && fx.scanBeam.visible) { fx.scanBeam.rotation.y += dt * 3; fx.scanBeam.material.opacity = 0.18 + Math.sin(t * 12) * 0.08; }
  sparks.update(dt);
  zapFx.update(dt);
}
