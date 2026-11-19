/* ================= Robots (diseño original: cabeza-pantalla flotante) ================= */
const RGEO = {
  torso: new RoundedBoxGeometry(0.62, 0.5, 0.46, 3, 0.12),
  belly: new THREE.PlaneGeometry(0.3, 0.15),
  led: new THREE.CircleGeometry(0.03, 10),
  head: new RoundedBoxGeometry(0.66, 0.46, 0.5, 3, 0.13),
  screen: new THREE.PlaneGeometry(0.5, 0.3),
  neck: new THREE.CylinderGeometry(0.08, 0.1, 0.12, 10),
  antenna: new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6),
  tip: new THREE.SphereGeometry(0.055, 12, 8),
  ring: new THREE.TorusGeometry(0.24, 0.05, 8, 28),
  halfRing: new THREE.TorusGeometry(0.24, 0.05, 8, 20, Math.PI * 1.3),
  hand: new THREE.SphereGeometry(0.095, 14, 10),
  shadow: new THREE.CircleGeometry(0.4, 24),
  bolt: new THREE.BoxGeometry(0.07, 0.07, 0.07),
};

function tone(hex, f) {
  const c = new THREE.Color(hex);
  return f >= 0 ? c.lerp(new THREE.Color('#ffffff'), f) : c.lerp(new THREE.Color('#000000'), -f);
}

function rr(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }

function drawFace(x, mode, look) {
  const W = 96, H = 56;
  x.fillStyle = '#0A0E13'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(120,220,255,0.07)'; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);
  const col = mode === 'evil' ? '#FF3B2F' : '#BDF4FF';
  x.fillStyle = col; x.strokeStyle = col; x.lineCap = 'round'; x.lineWidth = 5;
  const e1 = 31 + look * 7, e2 = 65 + look * 7, ey = 28;
  const ln = (a, b, c, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
  if (mode === 'blink') { ln(e1 - 7, ey, e1 + 7, ey); ln(e2 - 7, ey, e2 + 7, ey); }
  else if (mode === 'dead') { for (const e of [e1, e2]) { ln(e - 7, ey - 7, e + 7, ey + 7); ln(e + 7, ey - 7, e - 7, ey + 7); } }
  else if (mode === 'happy') { for (const e of [e1, e2]) { x.beginPath(); x.arc(e, ey + 5, 8, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); } }
  else if (mode === 'sus') { rr(x, e1 - 7, ey - 3, 14, 7, 3); x.fill(); rr(x, e2 - 7, ey - 3, 14, 7, 3); x.fill(); }
  else if (mode === 'evil') { x.beginPath(); x.moveTo(e1 - 9, ey - 8); x.lineTo(e1 + 8, ey - 2); x.lineTo(e1 + 6, ey + 6); x.lineTo(e1 - 8, ey + 4); x.fill(); x.beginPath(); x.moveTo(e2 + 9, ey - 8); x.lineTo(e2 - 8, ey - 2); x.lineTo(e2 - 6, ey + 6); x.lineTo(e2 + 8, ey + 4); x.fill(); }
  else { rr(x, e1 - 5, ey - 11, 10, 22, 5); x.fill(); rr(x, e2 - 5, ey - 11, 10, 22, 5); x.fill(); }
}

class Face {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 96; this.c.height = 56;
    this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mode = ''; this.look = 0; this.set('idle');
  }
  set(mode, look = 0) {
    if (mode === this.mode && Math.abs(look - this.look) < 0.2) return;
    this.mode = mode; this.look = look; drawFace(this.x, mode, look); this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); }
}

class Robot {
  constructor(hex) {
    this.hex = hex; this.mats = []; this.opacity = 1;
    const M = m => (this.mats.push(m), m);
    this.bodyMat = M(new THREE.MeshLambertMaterial({ color: hex }));
    this.headMat = M(new THREE.MeshLambertMaterial({ color: tone(hex, 0.2) }));
    this.darkMat = M(new THREE.MeshLambertMaterial({ color: '#2A2E37' }));
    this.glowMat = M(new THREE.MeshBasicMaterial({ color: tone(hex, 0.35) }));
    this.face = new Face();
    this.screenMat = M(new THREE.MeshBasicMaterial({ map: this.face.tex }));
    this.shadowMat = M(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    this.group = new THREE.Group();
    const shadow = new THREE.Mesh(RGEO.shadow, this.shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015;
    this.bob = new THREE.Group();
    const ring = new THREE.Mesh(RGEO.ring, this.glowMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2;
    const torso = new THREE.Mesh(RGEO.torso, this.bodyMat); torso.position.y = 0.48;
    const belly = new THREE.Mesh(RGEO.belly, this.darkMat); belly.position.set(0, 0.47, 0.232);
    const led1 = new THREE.Mesh(RGEO.led, this.glowMat); led1.position.set(-0.08, 0.47, 0.234);
    const led2 = new THREE.Mesh(RGEO.led, this.glowMat); led2.position.set(0.08, 0.47, 0.234);
    this.handL = new THREE.Mesh(RGEO.hand, this.bodyMat); this.handL.position.set(-0.42, 0.46, 0.02);
    this.handR = new THREE.Mesh(RGEO.hand, this.bodyMat); this.handR.position.set(0.42, 0.46, 0.02);
    const neck = new THREE.Mesh(RGEO.neck, this.darkMat); neck.position.y = 0.78;
    this.head = new THREE.Group(); this.head.position.y = 0.83;
    const skull = new THREE.Mesh(RGEO.head, this.headMat); skull.position.y = 0.23;
    const screen = new THREE.Mesh(RGEO.screen, this.screenMat); screen.position.set(0, 0.23, 0.252);
    const ant = new THREE.Mesh(RGEO.antenna, this.darkMat); ant.position.set(0.17, 0.58, -0.04);
    const tip = new THREE.Mesh(RGEO.tip, this.glowMat); tip.position.set(0.17, 0.72, -0.04);
    this.head.add(skull, screen, ant, tip);
    this.bob.add(ring, torso, belly, led1, led2, this.handL, this.handR, neck, this.head);
    this.group.add(shadow, this.bob);
    this.phase = Math.random() * TAU; this.blinkT = rand(1, 4); this.lookT = rand(1, 3);
  }
  setOpacity(o) {
    if (Math.abs(o - this.opacity) < 0.01) return;
    this.opacity = o;
    const tr = o < 0.995;
    for (const m of this.mats) {
      if (m === this.shadowMat) { m.opacity = 0.32 * o; continue; }
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = o;
    }
    this.group.visible = o > 0.02;
  }
  animate(dt, moveAmt) {
    this.phase += dt * (3 + moveAmt * 4);
    this.bob.position.y = 0.06 + Math.sin(this.phase) * 0.045;
    this.bob.rotation.x = lerp(this.bob.rotation.x, moveAmt * 0.18, Math.min(1, dt * 8));
    const sw = Math.sin(this.phase * 1.3) * 0.13 * moveAmt;
    this.handL.position.z = 0.02 + sw; this.handR.position.z = 0.02 - sw;
    const hy = 0.46 + Math.sin(this.phase + 1) * 0.02; this.handL.position.y = hy; this.handR.position.y = hy;
    const f = this.face;
    if (f.mode === 'idle' || f.mode === 'blink') {
      this.blinkT -= dt;
      this.lookT -= dt;
      if (this.lookT <= 0) { this.lookT = rand(1.5, 4); this.look = chance(0.5) ? 0 : rand(-1, 1); }
      if (this.blinkT <= 0) { f.set('blink'); if (this.blinkT < -0.13) { f.set('idle', this.look || 0); this.blinkT = rand(2, 5); } }
      else if (f.mode === 'idle') f.set('idle', this.look || 0);
    }
  }
  dispose() { this.mats.forEach(m => m.dispose()); this.face.dispose(); }
}

function makeLabel(text, hex) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '44px "Saira Stencil One", Impact, "Arial Narrow", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 9; x.lineJoin = 'round'; x.strokeStyle = 'rgba(8,10,14,0.88)'; x.strokeText(text, 128, 35);
  x.fillStyle = hex; x.fillText(text, 128, 35);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false, transparent: true }));
  s.scale.set(1.5, 0.375, 1); s.renderOrder = 10;
  return s;
}

class ProgressSprite {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 64; this.c.height = 64;
    this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, fog: false, transparent: true }));
    this.sprite.scale.set(0.55, 0.55, 1); this.sprite.renderOrder = 11; this.p = -1; this.set(0);
  }
  set(p) {
    if (Math.abs(p - this.p) < 0.02) return;
    this.p = p; const x = this.x;
    x.clearRect(0, 0, 64, 64);
    x.lineWidth = 9; x.strokeStyle = 'rgba(10,12,16,0.8)'; x.beginPath(); x.arc(32, 32, 22, 0, TAU); x.stroke();
    x.strokeStyle = '#FFB31A'; x.lineCap = 'round'; x.beginPath(); x.arc(32, 32, 22, -Math.PI / 2, -Math.PI / 2 + TAU * p); x.stroke();
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.sprite.material.dispose(); }
}

const pops = [];
let checkTex = null;
function popCheck(a) {
  if (!checkTex) checkTex = makeTex(64, 64, (x) => { x.fillStyle = '#3AD7B1'; x.beginPath(); x.arc(32, 32, 26, 0, TAU); x.fill(); x.strokeStyle = '#0B2A22'; x.lineWidth = 8; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(19, 33); x.lineTo(28, 42); x.lineTo(45, 22); x.stroke(); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: checkTex, depthTest: false, fog: false, transparent: true }));
  s.scale.set(0.5, 0.5, 1); s.position.set(a.pos.x, 2.0, a.pos.z); s.renderOrder = 12;
  scene.add(s); pops.push({ s, t: 0 });
}
function updatePops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt; p.s.position.y += dt * 0.8; p.s.material.opacity = 1 - p.t / 1.2;
    if (p.t >= 1.2) { scene.remove(p.s); p.s.material.dispose(); pops.splice(i, 1); }
  }
}

function makeBody(hex) {
  const g = new THREE.Group(); const mats = [];
  const M = m => (mats.push(m), m);
  const bodyMat = M(new THREE.MeshLambertMaterial({ color: tone(hex, -0.12) }));
  const headMat = M(new THREE.MeshLambertMaterial({ color: tone(hex, 0.08) }));
  const dark = M(new THREE.MeshLambertMaterial({ color: '#2A2E37' }));
  const face = new Face(); face.set('dead');
  const scr = M(new THREE.MeshBasicMaterial({ map: face.tex }));
  const torso = new THREE.Mesh(RGEO.torso, bodyMat); torso.rotation.set(0.2, rand(-0.6, 0.6), Math.PI / 2 - 0.12); torso.position.set(-0.08, 0.24, 0);
  const head = new THREE.Group();
  const skull = new THREE.Mesh(RGEO.head, headMat); const screen = new THREE.Mesh(RGEO.screen, scr); screen.position.z = 0.252;
  head.add(skull, screen); head.position.set(0.55, 0.25, 0.32); head.rotation.set(-1.15, 0.35, 0.15);
  const ring = new THREE.Mesh(RGEO.halfRing, dark); ring.rotation.set(Math.PI / 2, 0, rand(0, TAU)); ring.position.set(-0.35, 0.05, -0.25);
  const hand = new THREE.Mesh(RGEO.hand, bodyMat); hand.position.set(-0.62, 0.09, 0.38);
  const shadow = new THREE.Mesh(RGEO.shadow, M(new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.42, depthWrite: false })));
  shadow.scale.set(1.7, 1.25, 1); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  g.add(shadow, torso, head, ring, hand);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(RGEO.bolt, dark); b.position.set(rand(-0.8, 0.8), 0.04, rand(-0.6, 0.7)); b.rotation.y = rand(0, TAU); g.add(b); }
  g.userData = { mats, face };
  return g;
}
function disposeBody(g) { scene.remove(g); g.userData.mats.forEach(m => m.dispose()); g.userData.face.dispose(); }

/* Chispas (partículas aditivas) */
class Sparks {
  constructor(n) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.base = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    for (let k = 0; k < n; k++) this.pos[k * 3 + 1] = -999;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.points.frustumCulled = false; scene.add(this.points); this.active = 0;
  }
  burst(x, y, z, count, hex, spd = 3, up = 2.5, life = 0.7) {
    const c = new THREE.Color(hex);
    for (let k = 0; k < count; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * TAU, s = spd * (0.3 + Math.random());
      this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up * (0.4 + Math.random()); this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6);
      this.base[i * 3] = c.r; this.base[i * 3 + 1] = c.g; this.base[i * 3 + 2] = c.b;
    }
    this.active = 2;
  }
  update(dt) {
    if (!this.active) return;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      any = true;
      const k = i * 3;
      this.vel[k + 1] -= 9 * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.03) { this.pos[k + 1] = 0.03; this.vel[k + 1] *= -0.35; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
      const f = this.life[i] / this.max[i];
      this.col[k] = this.base[k] * f; this.col[k + 1] = this.base[k + 1] * f; this.col[k + 2] = this.base[k + 2] * f;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    if (!any) this.active = Math.max(0, this.active - 1);
  }
  clear() { this.life.fill(0); for (let k = 0; k < this.n; k++) this.pos[k * 3 + 1] = -999; this.geo.attributes.position.needsUpdate = true; this.active = 0; }
}

/* Rayo de desactivación */
class Zap {
  constructor() {
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
    this.line = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color: '#FF5A3D', fog: false, transparent: true }));
    this.line.visible = false; this.line.frustumCulled = false; scene.add(this.line); this.t = 0;
  }
  fire(a, b) { this.a = { ...a }; this.b = { ...b }; this.t = 0.42; this.line.visible = true; }
  update(dt) {
    if (this.t <= 0) return;
    this.t -= dt;
    if (this.t <= 0) { this.line.visible = false; return; }
    const p = this.geo.attributes.position.array;
    for (let k = 0; k < 10; k++) {
      const f = k / 9;
      p[k * 3] = lerp(this.a.x, this.b.x, f) + (k && k < 9 ? rand(-0.18, 0.18) : 0);
      p[k * 3 + 1] = 0.75 + (k && k < 9 ? rand(-0.2, 0.2) : 0);
      p[k * 3 + 2] = lerp(this.a.z, this.b.z, f) + (k && k < 9 ? rand(-0.18, 0.18) : 0);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.line.material.opacity = Math.min(1, this.t * 4);
  }
}

/* Avatar SVG para la interfaz */
function avatarSVG(hex, dead = false) {
  const light = '#' + tone(hex, 0.2).getHexString();
  const eyes = dead
    ? '<path d="M31 37l9 9m0-9l-9 9M52 37l9 9m0-9l-9 9" stroke="#BDF4FF" stroke-width="4" stroke-linecap="round"/>'
    : '<rect x="32" y="34" width="8" height="15" rx="4" fill="#BDF4FF"/><rect x="52" y="34" width="8" height="15" rx="4" fill="#BDF4FF"/>';
  return `<svg class="av" viewBox="0 0 92 92" aria-hidden="true"><line x1="62" y1="7" x2="62" y2="20" stroke="#2A2E37" stroke-width="3"/><circle cx="62" cy="7" r="5" fill="${hex}"/><rect x="20" y="68" width="52" height="22" rx="8" fill="${hex}" stroke="#14161C" stroke-width="3"/><rect x="12" y="19" width="68" height="48" rx="14" fill="${light}" stroke="#14161C" stroke-width="3"/><rect x="21" y="27" width="50" height="31" rx="8" fill="#0A0E13"/>${eyes}</svg>`;
}
