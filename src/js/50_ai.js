/* ================= IA: tripulación e infiltrado ================= */
const TASK_TIME = { wires: 6, timing: 5, simon: 7, hold: 4.5, download: 6, keypad: 6, tune: 5, switches: 4, scan: 6 };
const taskTime = st => (TASK_TIME[st.type] || 5) * rand(0.85, 1.2);
function faceStation(a, st) { if (st.f) { const [dx, dz] = FACE[st.f]; a.heading = Math.atan2(dx, dz); } }

function pickBuddy(a) {
  const c = game.agents.filter(o => o !== a && o.alive && dist(a.pos, o.pos) < 12);
  return c.length ? pick(c) : null;
}

/* ---------- Tripulación ---------- */
function crewNext(a) {
  const b = a.brain;
  b.task = null; b.buddy = null; b.fixT = undefined;
  const pending = a.tasks.filter(t => !t.done);
  const r = Math.random();
  if (pending.length && r < 0.74) {
    pending.sort((p, q) => dist2(a.pos, p.st.stand) - dist2(a.pos, q.st.stand));
    const t = chance(0.7) ? pending[0] : pick(pending);
    b.state = 'goTask'; b.task = t; b.t = 45; goTo(a, t.st.stand); return;
  }
  if (r < 0.88) {
    const bd = pickBuddy(a);
    if (bd) { b.state = 'follow'; b.buddy = bd; b.t = rand(6, 12); b.repath = 0; return; }
  }
  if (r < 0.96 || !pending.length) { b.state = 'wander'; b.t = 30; goTo(a, randomPointInRoom(pick(ROOMS))); return; }
  b.state = 'idle'; b.t = rand(1.2, 3); a.path = [];
}

function crewThink(a, dt) {
  const b = a.brain; b.t -= dt;
  const bo = game.blackout;
  if (bo && bo.fixer === a && bo.t > bo.fixDelay && b.state !== 'fixLights' && b.state !== 'goReport' && game.state === 'play') {
    a.hideProgress(); b.state = 'fixLights'; b.t = 40; b.fixT = undefined; goTo(a, LIGHTS_PANEL.stand);
  }
  switch (b.state) {
    case 'goTask':
      if (followPath(a, dt)) { b.state = 'doTask'; b.dur = b.t = taskTime(b.task.st); faceStation(a, b.task.st); a.showProgress(0); }
      else if (b.t <= 0) crewNext(a);
      break;
    case 'doTask':
      a.move = lerp(a.move, 0, Math.min(1, dt * 10));
      a.showProgress(1 - b.t / b.dur);
      if (b.t <= 0) { a.hideProgress(); completeTask(a, b.task); crewNext(a); }
      break;
    case 'follow': {
      const bd = b.buddy;
      if (!bd || !bd.alive || b.t <= 0) { crewNext(a); break; }
      b.repath -= dt;
      if (b.repath <= 0) { b.repath = 0.8; if (dist(a.pos, bd.pos) > 2.2) goTo(a, bd.pos); else a.path = []; }
      followPath(a, dt);
      break;
    }
    case 'wander': if (followPath(a, dt) || b.t <= 0) crewNext(a); break;
    case 'idle': a.move = lerp(a.move, 0, Math.min(1, dt * 10)); if (b.t <= 0) crewNext(a); break;
    case 'goReport': {
      const body = b.body;
      if (!body || body.reported || game.state !== 'play') { crewNext(a); break; }
      b.repath -= dt; if (b.repath <= 0) { b.repath = 1; goTo(a, body.pos); }
      followPath(a, dt);
      if (dist(a.pos, body.pos) < 1.9) { startMeeting(a, body); return; }
      if (b.t <= 0) crewNext(a);
      break;
    }
    case 'fixLights':
      if (!game.blackout) { crewNext(a); break; }
      if (followPath(a, dt)) {
        faceStation(a, LIGHTS_PANEL);
        if (b.fixT === undefined) b.fixT = 3.5;
        b.fixT -= dt; a.showProgress(1 - b.fixT / 3.5);
        if (b.fixT <= 0) { a.hideProgress(); endBlackout(a); crewNext(a); }
      } else if (b.t <= 0) crewNext(a);
      break;
    default: crewNext(a);
  }
}

/* ---------- Infiltrado ---------- */
function pickFakeStation(a) {
  const crewPos = game.agents.filter(o => o.alive && !o.isImp).map(o => o.pos);
  let best = null, bs = -1e9;
  for (const st of STATIONS) {
    let s = -dist(a.pos, st.stand) * 0.12 + Math.random() * 2.5;
    for (const p of crewPos) if (dist(p, st.stand) < 6) s += 1.2;
    if (a.brain.lastFake === st) s -= 5;
    if (s > bs) { bs = s; best = st; }
  }
  return best;
}

function impNext(a) {
  const b = a.brain;
  b.buddy = null;
  if (b.killCd <= 0 && game.state === 'play') { b.state = 'hunt'; b.t = rand(14, 22); b.retarget = 0; return; }
  if (chance(0.3)) { const bd = pickBuddy(a); if (bd) { b.state = 'blend'; b.buddy = bd; b.t = rand(5, 10); b.repath = 0; return; } }
  const st = pickFakeStation(a);
  b.state = 'fakeGo'; b.station = st; b.lastFake = st; b.t = 35; goTo(a, st.stand);
}

function witnessesFor(imp, victim, factor) {
  const out = [];
  for (const o of game.agents) {
    if (o === imp || o === victim || !o.alive) continue;
    const r = visionOf(o) * factor + (factor > 1 ? 1 : 0);
    if (dist2(o.pos, imp.pos) <= r * r && los(o.pos.x, o.pos.z, imp.pos.x, imp.pos.z)) out.push(o);
  }
  return out;
}

function playerTargetable(a) {
  const b = a.brain, cfg = game.cfg;
  if (game.t < cfg.grace || game.t < (b.sparePlayerUntil || 0)) return false;
  if (b.playerRoll === undefined || game.t > b.playerRollT) { b.playerRoll = chance(cfg.playerKill); b.playerRollT = game.t + 10; if (!b.playerRoll) b.sparePlayerUntil = game.t + 10; }
  return b.playerRoll;
}

function pickTarget(a) {
  let best = null, bs = -1e9;
  for (const c of game.agents) {
    if (c === a || !c.alive) continue;
    if (c.isPlayer && !playerTargetable(a)) continue;
    let iso = 0;
    for (const o of game.agents) if (o !== a && o !== c && o.alive && dist2(o.pos, c.pos) < 81 && los(o.pos.x, o.pos.z, c.pos.x, c.pos.z)) iso++;
    let s = -dist(a.pos, c.pos) * 0.32 - iso * 4.5 + Math.random() * 1.5;
    if (c.isPlayer) s += game.cfg.playerBias;
    if (c === a.brain.target) s += 1.5;
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}

function tryKill(a) {
  if (a.brain.killCd > 0 || game.state !== 'play') return false;
  for (const c of game.agents) {
    if (c === a || !c.alive) continue;
    if (dist2(a.pos, c.pos) > 1.2 * 1.2) continue;
    if (c.isPlayer && !playerTargetable(a)) continue;
    if (!los(a.pos.x, a.pos.z, c.pos.x, c.pos.z)) continue;
    if (witnessesFor(a, c, game.cfg.witness).length) continue;
    doKill(a, c); return true;
  }
  return false;
}

function impThink(a, dt) {
  const b = a.brain, cfg = game.cfg;
  b.t -= dt; b.killCd -= dt; b.sabCd -= dt;
  if (game.state !== 'play') { crewLikeIdle(a, dt); return; }
  if (!game.blackout && b.sabCd <= 0 && b.killCd < 8 && chance(dt * 0.3)) { startBlackout(a); b.sabCd = cfg.sabCd; }
  b.killCheck = (b.killCheck || 0) - dt;
  if (b.killCheck <= 0) { b.killCheck = 0.2; if (b.state !== 'flee' && b.state !== 'selfReport' && tryKill(a)) return; }
  switch (b.state) {
    case 'fakeGo':
      if (followPath(a, dt)) { b.state = 'fakeDo'; b.dur = b.t = taskTime(b.station) * rand(0.9, 1.25); faceStation(a, b.station); a.showProgress(0); }
      else if (b.t <= 0) impNext(a);
      break;
    case 'fakeDo':
      a.move = lerp(a.move, 0, Math.min(1, dt * 10));
      a.showProgress(1 - b.t / b.dur);
      if (b.t <= 0 || (b.killCd <= 0 && chance(dt * 0.5))) { a.hideProgress(); if (b.t <= 0) fakeTaskDone(a, b.station); impNext(a); }
      break;
    case 'blend': {
      const bd = b.buddy;
      if (!bd || !bd.alive || b.t <= 0) { impNext(a); break; }
      b.repath -= dt; if (b.repath <= 0) { b.repath = 0.8; if (dist(a.pos, bd.pos) > 2.4) goTo(a, bd.pos); else a.path = []; }
      followPath(a, dt);
      break;
    }
    case 'hunt': {
      b.retarget -= dt;
      if (b.retarget <= 0) { b.retarget = 0.45; b.target = pickTarget(a); if (b.target) goTo(a, b.target.pos); }
      followPath(a, dt);
      if (b.t <= 0 || b.killCd > 0) { b.target = null; impNext(a); }
      break;
    }
    case 'flee': if (followPath(a, dt) || b.t <= 0) impNext(a); break;
    case 'selfReport': {
      const body = b.body;
      if (!body || body.reported) { impNext(a); break; }
      b.wait -= dt;
      if (b.wait > 0) { followPath(a, dt); break; }
      if (!b.going) { b.going = true; goTo(a, body.pos); }
      followPath(a, dt);
      if (dist(a.pos, body.pos) < 1.9) { startMeeting(a, body); return; }
      if (b.t <= 0) impNext(a);
      break;
    }
    default: impNext(a);
  }
}
function crewLikeIdle(a, dt) { if (!followPath(a, dt)) return; }

function doKill(imp, v) {
  v.alive = false; v.deathT = game.t; v.deathPos = { x: v.pos.x, z: v.pos.z };
  if (v.isPlayer) closeTask(true);
  const seenByPlayer = game.player.alive && v !== game.player && canSeePoint(game.player, v.pos);
  imp.pos.x = lerp(imp.pos.x, v.pos.x, 0.6); imp.pos.z = lerp(imp.pos.z, v.pos.z, 0.6);
  collideCircle(imp.pos, AGENT_R);
  const body = spawnBody(v);
  imp.brain.killCd = game.cfg.killCd;
  zapFx.fire(imp.pos, v.pos);
  if (seenByPlayer || v.isPlayer) { sparks.burst(v.pos.x, 0.7, v.pos.z, 40, '#FFB31A', 3.2, 3); sparks.burst(v.pos.x, 0.7, v.pos.z, 18, '#FF5A3D', 2, 2.5); sfx.zap(); }
  imp.robot.face.set('evil'); setTimeout(() => { if (imp.robot.face.mode === 'evil') imp.robot.face.set('idle'); }, 900);
  // testigos reales (visión completa)
  for (const w of witnessesFor(imp, v, 1)) {
    if (w.isPlayer) continue;
    w.evid.push({ type: 'kill', who: imp.id, victim: v.id, t: game.t });
    w.hideProgress(); w.brain.state = 'goReport'; w.brain.body = body; w.brain.repath = 0; w.brain.t = 20;
  }
  game.stats.kills = (game.stats.kills || 0) + 1;
  if (v.isPlayer) { startDeath(imp); return; }
  // huida o autodenuncia
  const b = imp.brain;
  imp.hideProgress();
  if (chance(game.cfg.selfReport)) { b.state = 'selfReport'; b.body = body; b.wait = rand(2.5, 4.5); b.going = false; b.t = 14; const away = randomPointInRoom(ROOMS[Math.max(0, zoneAt(imp.pos))]); goTo(imp, away); }
  else {
    const far = STATIONS.filter(s => dist(s.stand, imp.pos) > 12);
    const st = far.length ? pick(far) : pick(STATIONS);
    b.state = 'flee'; b.t = 25; goTo(imp, st.stand);
  }
  checkWin();
}

function spawnBody(v) {
  const mesh = makeBody(v.hex);
  mesh.position.set(v.pos.x, 0, v.pos.z); scene.add(mesh);
  const b = { agent: v, pos: { x: v.pos.x, z: v.pos.z }, mesh, reported: false, sparkT: rand(0.3, 1) };
  game.bodies.push(b);
  v.robot.group.visible = false; v.hideProgress();
  return b;
}

function fakeTaskDone(imp, st) {
  for (const c of game.agents) {
    if (!c.alive || c.isImp || c.isPlayer) continue;
    if (!canSee(c, imp, 5)) continue;
    if (chance(0.12 + 0.28 * PERS[c.pers].logic)) c.evid.push({ type: 'fake', who: imp.id, zone: st.rk, t: game.t });
  }
}

/* ---------- Sabotaje: apagón ---------- */
function startBlackout(by) {
  if (game.blackout || game.state !== 'play') return;
  const crew = game.agents.filter(a => a.alive && !a.isImp && !a.isPlayer);
  crew.sort((p, q) => dist2(p.pos, LIGHTS_PANEL.stand) - dist2(q.pos, LIGHTS_PANEL.stand));
  game.blackout = { t: 0, fixer: crew[0] || null, fixDelay: rand(9, 16) };
  sfx.blackout();
  showAlert('Apagón: repara las luces en Electricidad');
  refreshMarkers();
}
function endBlackout(by, silent) {
  if (!game.blackout) return;
  game.blackout = null;
  hideAlert(); refreshMarkers();
  if (!silent) { sfx.lights(); toast(by && by.isPlayer ? 'Luces restauradas. Buen trabajo.' : 'Las luces volvieron.'); }
}

/* ---------- Tareas ---------- */
function completeTask(a, task) {
  if (!task || task.done) return;
  task.done = true; game.tasksDone++;
  if (a.alive && (a.isPlayer || canSeePoint(game.player, a.pos))) popCheck(a);
  if (a.isPlayer) { sfx.done(); renderTaskList(); refreshMarkers(); }
  updateTaskBar();
  checkWin();
}
function ghostTasks(dt) {
  for (const a of game.agents) {
    if (a.alive || a.isImp || a.isPlayer || a.ejected) continue;
    a.ghostT = (a.ghostT ?? rand(15, 25)) - dt;
    if (a.ghostT <= 0) { a.ghostT = rand(18, 30); const t = a.tasks.find(x => !x.done); if (t) { t.done = true; game.tasksDone++; updateTaskBar(); checkWin(); } }
  }
}

/* ---------- Charla ambiental ---------- */
const CHATTER = {
  _: ['Voy a mis tareas.', '¿Alguien vio algo raro?', 'Esta estación cruje demasiado.', 'Mejor no separarnos.', '¿Quién dejó tornillos en el pasillo?'],
  calma: ['Todo bajo control. Por ahora.', 'Revisando sistemas, uno por uno.'],
  directa: ['Si veo algo raro, lo digo.', 'Nadie se separa, ¿entendido?'],
  seca: ['Trabajando.', 'Mm.', 'Sigo.'],
  nerviosa: ['¿Escucharon eso? ¿No? ¿Nadie?', 'No me gusta andar a solas aquí…'],
  bromista: ['Si me apago, que sea con estilo.', '¿Un chiste binario? 01… olvídalo.'],
  lider: ['Equipo, terminemos las tareas rápido.', 'Avisen si ven algo.'],
  dramatica: ['¡Siento un mal presagio en mis circuitos!', 'Esta noche huele a traición…'],
  despistada: ['¿Dónde quedaba Navegación?', 'Juraría que ya hice esta tarea…'],
};
function ambientChatter(a, dt) {
  a.chatT -= dt;
  if (a.chatT > 0) return;
  a.chatT = rand(22, 48);
  const P = game.player;
  if (!a.alive || !P || a.vis < 0.5 || dist(a.pos, P.pos) > 10) return;
  const pool = (CHATTER[a.pers] && chance(0.6)) ? CHATTER[a.pers] : CHATTER._;
  bubble(a, pick(pool), 3.2);
}
