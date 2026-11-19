/* ================= Agentes (jugador y NPCs) ================= */
const AGENT_R = 0.3;
const VISION = 7.2, VISION_DARK = 3.1, IMP_VISION = 9.5;

class Agent {
  constructor(id, name, hex, pers, isPlayer = false) {
    this.id = id; this.name = name; this.hex = hex; this.pers = pers; this.isPlayer = isPlayer;
    this.isImp = false; this.alive = true; this.ejected = false; this.deathT = -1; this.deathPos = null;
    this.pos = { x: 0, z: 0 }; this.heading = Math.PI; this.move = 0;
    this.speed = isPlayer ? 3.7 : rand(3.05, 3.45);
    this.path = []; this.stuck = 0; this.lastP = { x: 0, z: 0 };
    this.tasks = []; this.trail = []; this.sight = []; this.evid = []; this.lastSeen = new Map();
    this.sus = new Map(); this.trust = new Map();
    this.brain = { state: 'idle', t: 0 };
    this.perceiveT = Math.random() * 0.3; this.trailT = 0; this.chatT = rand(8, 30);
    this.robot = new Robot(hex);
    this.label = makeLabel(name, hex); this.label.position.y = 1.85; this.robot.group.add(this.label);
    this.prog = null; this.vis = 1;
    scene.add(this.robot.group);
  }
  showProgress(p) {
    if (!this.prog) { this.prog = new ProgressSprite(); this.prog.sprite.position.y = 2.25; this.robot.group.add(this.prog.sprite); }
    this.prog.sprite.visible = true; this.prog.set(clamp(p, 0, 1));
  }
  hideProgress() { if (this.prog) this.prog.sprite.visible = false; }
  dispose() {
    scene.remove(this.robot.group);
    this.robot.dispose(); this.label.material.map.dispose(); this.label.material.dispose();
    if (this.prog) this.prog.dispose();
  }
}

const byId = id => game.agents[id];
const aliveNPCs = () => game.agents.filter(a => a.alive && !a.isPlayer);
const aliveAll = () => game.agents.filter(a => a.alive);

function collideCircle(p, r) {
  for (let it = 0; it < 2; it++) {
    const i0 = Math.floor(p.x - r), i1 = Math.floor(p.x + r), j0 = Math.floor(p.z - r), j1 = Math.floor(p.z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (walkable(i, j)) continue;
      const cx = clamp(p.x, i, i + 1), cz = clamp(p.z, j, j + 1);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else {
        const l = p.x - i, rt = i + 1 - p.x, t = p.z - j, b = j + 1 - p.z, m = Math.min(l, rt, t, b);
        if (m === l) p.x = i - r; else if (m === rt) p.x = i + 1 + r; else if (m === t) p.z = j - r; else p.z = j + 1 + r;
      }
    }
  }
}

function stepMove(a, vx, vz, dt) {
  a.pos.x += vx * dt; a.pos.z += vz * dt;
  collideCircle(a.pos, AGENT_R);
  const sp = Math.hypot(vx, vz);
  if (sp > 0.05) a.heading = angLerp(a.heading, Math.atan2(vx, vz), Math.min(1, dt * 12));
  a.move = lerp(a.move, clamp(sp / a.speed, 0, 1), Math.min(1, dt * 10));
}

function goTo(a, p) {
  a.path = findPath(a.pos, p) || [];
  a.stuck = 0; a.lastP.x = a.pos.x; a.lastP.z = a.pos.z;
}

function followPath(a, dt) {
  if (!a.path.length) { a.move = lerp(a.move, 0, Math.min(1, dt * 10)); return true; }
  const p = a.path[0], dx = p.x - a.pos.x, dz = p.z - a.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.12) { a.path.shift(); return a.path.length === 0; }
  const s = Math.min(a.speed, d / Math.max(dt, 1e-4));
  stepMove(a, (dx / d) * s, (dz / d) * s, dt);
  a.stuck += dt;
  if (a.stuck > 0.7) {
    if (dist(a.pos, a.lastP) < 0.15) goTo(a, a.path[a.path.length - 1]);
    a.stuck = 0; a.lastP.x = a.pos.x; a.lastP.z = a.pos.z;
  }
  return false;
}

const visionOf = a => (a.isImp ? IMP_VISION : game.blackout ? VISION_DARK : VISION);
function canSeePoint(a, p, r = visionOf(a)) { return dist2(a.pos, p) <= r * r && los(a.pos.x, a.pos.z, p.x, p.z); }
function canSee(a, b, r = visionOf(a)) { return canSeePoint(a, b.pos, r); }

function perceive(a) {
  const t = game.t;
  for (const o of game.agents) {
    if (o === a || !o.alive || !canSee(a, o)) continue;
    const z = zoneAt(o.pos), last = a.lastSeen.get(o.id);
    if (!last || t - last.t >= 1.5 || last.zone !== z) {
      const s = { t, id: o.id, x: o.pos.x, z: o.pos.z, zone: z };
      a.sight.push(s); a.lastSeen.set(o.id, s);
    }
  }
  if (a.sight.length > 700) a.sight.splice(0, a.sight.length - 560);
  if (game.state !== 'play' || a.isImp || a.isPlayer) return;
  const b = a.brain;
  if (b.state !== 'goReport') {
    for (const body of game.bodies) {
      if (!body.reported && canSeePoint(a, body.pos)) {
        a.hideProgress(); b.state = 'goReport'; b.body = body; b.repath = 0; b.t = 20; break;
      }
    }
  }
}

function recordTrail(a) {
  a.trail.push({ t: game.t, x: a.pos.x, z: a.pos.z, zone: zoneAt(a.pos) });
  if (a.trail.length > 260) a.trail.splice(0, a.trail.length - 240);
}
function trailAt(a, t) {
  const tr = a.trail;
  if (!tr.length) return { x: a.pos.x, z: a.pos.z, zone: zoneAt(a.pos) };
  for (let i = tr.length - 1; i >= 0; i--) if (tr[i].t <= t) return tr[i];
  return tr[0];
}
const zoneAtTime = (a, t) => trailAt(a, t).zone;
