/* ================= Flujo de partida y bucle principal ================= */
function clearAgents() {
  for (const a of game.agents) a.dispose();
  game.agents = [];
  for (const b of game.bodies) disposeBody(b.mesh);
  game.bodies = [];
  clearBubbles();
  if (sparks) sparks.clear();
}

function spawnRing(agents) {
  agents.forEach((a, k) => {
    const ang = (k / agents.length) * TAU + 0.35;
    a.pos.x = EMERGENCY.x + Math.cos(ang) * 2.75; a.pos.z = EMERGENCY.z + Math.sin(ang) * 2.75;
    collideCircle(a.pos, AGENT_R);
    a.heading = Math.atan2(a.pos.x - EMERGENCY.x, a.pos.z - EMERGENCY.z);
    a.path = []; a.move = 0;
  });
}

function setupDemo() {
  clearAgents();
  Object.assign(game, { state: 'menu', t: 0, blackout: null, tasksTotal: Infinity, tasksDone: 0, player: null, impostor: null, dying: null });
  fx.look.dark = 0;
  const cols = shuffle(PALETTE.map(p => p[0]));
  shuffle(ROSTER.slice()).slice(0, 7).forEach((r, k) => game.agents.push(new Agent(k, r.name, cols[k], r.pers)));
  for (const a of game.agents) { a.tasks = shuffle(STATIONS.slice()).slice(0, 4).map(st => ({ st, done: false })); a.brain = { state: 'idle', t: rand(0.3, 2) }; a.chatT = rand(2, 14); }
  spawnRing(game.agents);
  refreshMarkers();
}

function newGame() {
  closeTask(); stopScan(); hideAll(); clearAgents(); MT = null;
  const cfg = (game.cfg = DIFF[settings.diff] || DIFF.normal);
  Object.assign(game, { state: 'intro', t: 0, roundStart: 0, tasksDone: 0, tasksTotal: 0, meetings: 0, lastMeetingT: -1, blackout: null, emergencyLeft: 1, emergencyCd: 12, ejectedLog: [], endInfo: null, dying: null, stats: { kills: 0 } });
  fx.look.dark = 0; camState.init = false;
  const n = clamp(settings.crew | 0, 6, 10);
  const colors = shuffle(PALETTE.map(p => p[0]).filter(h => h !== settings.color));
  const P = new Agent(0, sanitizeName(settings.name, true), settings.color, 'lider', true);
  game.agents.push(P); game.player = P;
  shuffle(ROSTER.slice()).slice(0, n - 1).forEach((r, k) => game.agents.push(new Agent(k + 1, r.name, colors[k], r.pers)));
  const npcs = game.agents.slice(1);
  const imp = pick(npcs); imp.isImp = true; game.impostor = imp;
  const assign = (a, count) => { a.tasks = shuffle(STATIONS.slice()).slice(0, count).map(st => ({ st, done: false })); };
  assign(P, cfg.playerTasks);
  for (const a of npcs) assign(a, cfg.npcTasks);
  game.tasksTotal = P.tasks.length + npcs.filter(a => !a.isImp).reduce((s, a) => s + a.tasks.length, 0);
  for (const a of npcs) for (const o of game.agents) if (o !== a) a.trust.set(o.id, 0.55 + Math.random() * 0.15);
  spawnRing(game.agents);
  for (const a of npcs) {
    a.brain = { state: 'idle', t: rand(0.6, 2.6) };
    if (a.isImp) Object.assign(a.brain, { killCd: cfg.firstCd, sabCd: cfg.sabCd * 0.6 });
  }
  updateTaskBar(); refreshMarkers();
  aiGreeting();
  showIntro(() => {
    if (game.state !== 'intro') return;
    game.state = 'play'; game.startedAt = performance.now();
    showHUD(true); playGreeting();
    if (isTouch) showStickHint();
    toast('Haz tus tareas (flechas amarillas) y no te quedes a solas.', 3800);
  });
}

function afterMeeting() {
  MT = null;
  if (checkWin()) return;
  game.lastMeetingT = game.t; game.roundStart = game.t;
  for (const b of game.bodies) disposeBody(b.mesh);
  game.bodies = [];
  const alive = game.agents.filter(a => a.alive);
  spawnRing(alive);
  for (const a of game.agents) {
    a.robot.group.visible = a.alive; a.hideProgress();
    if (!a.alive || a.isPlayer) continue;
    a.brain = a.isImp ? { ...a.brain, state: 'idle', t: rand(0.5, 2), target: null } : { state: 'idle', t: rand(0.5, 2.5) };
  }
  const imp = game.impostor;
  imp.brain.killCd = Math.max(game.cfg.killCd * 0.8, game.cfg.firstCd);
  imp.brain.sabCd = Math.max(imp.brain.sabCd, 20);
  game.emergencyCd = 18; camState.init = false;
  game.state = 'play';
  showHUD(true); refreshMarkers(); updateTaskBar();
}

function checkWin() {
  if (!['play', 'meeting', 'eject'].includes(game.state)) return false;
  const P = game.player;
  if (!P.alive) { if (P.ejected) { endGame('lose', 'ejectedMe'); return true; } return false; }
  if (game.impostor.ejected) { endGame('win', 'ejected'); return true; }
  if (game.agents.filter(a => a.alive && !a.isImp).length <= 1) { endGame('lose', 'overrun'); return true; }
  if (game.tasksDone >= game.tasksTotal) { endGame('win', 'tasks'); return true; }
  return false;
}

function endGame(result, reason) {
  if (game.state === 'end') return;
  game.state = 'end'; MT = null;
  closeTask(); stopScan(); hideAll(); clearBubbles();
  if (game.blackout) game.blackout = null;
  record[result === 'win' ? 'w' : 'l']++; savePrefs();
  game.endInfo = { result, reason };
  showEnd(result, reason);
  if (result === 'win') sfx.win(); else sfx.lose();
}

function startDeath(killer) {
  game.state = 'dying'; game.dying = { t: 0, killer };
  closeTask(); stopScan(); endStick(); toggleMap(false); showHUD(false); $('#vignette').classList.add('on');
  killer.robot.face.set('evil');
  const fl = $('#flash'); fl.hidden = false; fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  const dm = $('#deathMsg'); dm.hidden = false;
  dm.innerHTML = `<b>Te desactivaron</b><span>Fue <i style="color:${killer.hex}">${esc(killer.name)}</i></span>`;
}
function dyingTick(dt) {
  game.dying.t += dt;
  if (game.dying.t > 3) { $('#deathMsg').hidden = true; $('#flash').hidden = true; endGame('lose', 'killed'); }
}

/* ---------- Simulación ---------- */
function simulate(dt) {
  const steps = Math.max(1, Math.ceil(dt / 0.05)), h = dt / steps;
  for (let s = 0; s < steps; s++) { if (game.state !== 'play' && game.state !== 'menu') break; simStep(h); }
}
function simStep(dt) {
  game.t += dt;
  const play = game.state === 'play', P = game.player;
  if (play && P && P.alive) {
    if (!TaskUI.open && !mapOpen) { const v = moveVector(); stepMove(P, v.x * P.speed, v.z * P.speed, dt); }
    else P.move = lerp(P.move, 0, Math.min(1, dt * 10));
    if (game.scan) updateScan(dt);
  }
  for (const a of game.agents) {
    if (!a.alive || a.isPlayer) continue;
    if (a.isImp) impThink(a, dt); else crewThink(a, dt);
    if (game.state !== 'play' && game.state !== 'menu') return;
    ambientChatter(a, dt);
  }
  for (const a of game.agents) {
    if (!a.alive) continue;
    a.perceiveT -= dt; if (a.perceiveT <= 0) { a.perceiveT = 0.3; if (!a.isPlayer) perceive(a); }
    a.trailT -= dt; if (a.trailT <= 0) { a.trailT = 1; recordTrail(a); }
    if (game.state !== 'play' && game.state !== 'menu') return;
  }
  if (play) {
    if (game.blackout) game.blackout.t += dt;
    if (game.emergencyCd > 0) game.emergencyCd -= dt;
    ghostTasks(dt);
  }
}

/* ---------- Render ---------- */
const camState = { x: 25, z: 9, d: 18, init: false, orbit: 0.4 };
function updateCamera(dt) {
  const aspect = camera.aspect;
  const base = aspect < 0.7 ? 20.5 : aspect < 1.1 ? 18.5 : 16;
  const P = game.player;
  if (game.state === 'menu' || !P) {
    camState.orbit += dt * 0.05;
    const r = base * 0.55;
    camera.position.set(25 + Math.sin(camState.orbit) * r, base * 0.8, 9 + Math.cos(camState.orbit) * r + 3);
    camera.lookAt(25, 0, 8.5);
    scene.fog.near = 30; scene.fog.far = 60;
    return;
  }
  const d = game.state === 'dying' ? base * 0.5 : base;
  if (!camState.init) { camState.x = P.pos.x; camState.z = P.pos.z; camState.d = d; camState.init = true; }
  const k = 1 - Math.exp(-dt * 7);
  camState.x = lerp(camState.x, P.pos.x, k); camState.z = lerp(camState.z, P.pos.z, k);
  camState.d = lerp(camState.d, d, 1 - Math.exp(-dt * 3));
  const pitch = 1.08;
  camera.position.set(camState.x, Math.sin(pitch) * camState.d, camState.z + Math.cos(pitch) * camState.d);
  camera.lookAt(camState.x, 0, camState.z - 0.4);
  const dk = fx.look.dark;
  scene.fog.near = lerp(camState.d + 1, camState.d - 1.5, dk);
  scene.fog.far = lerp(camState.d + 17, camState.d + 6, dk);
}

let frameSkip = 0;
function render(dt) {
  const t = clock3.t, P = game.player, st = game.state;
  if ((st === 'meeting' || st === 'eject' || st === 'end') && (frameSkip = (frameSkip + 1) % 8) !== 0) return;
  const fog = st === 'play' || st === 'dying' || st === 'pause';
  for (const a of game.agents) {
    const g = a.robot.group;
    if (!a.alive) { g.visible = false; continue; }
    g.position.set(a.pos.x, 0, a.pos.z);
    g.rotation.y = a.heading;
    a.robot.animate(dt, a.move);
    let target = 1;
    if (fog && P && a !== P) target = canSeePoint(P, a.pos, visionOf(P) + 0.6) ? 1 : 0;
    a.vis = lerp(a.vis, target, Math.min(1, dt * 9));
    a.robot.setOpacity(a.vis);
    a.label.visible = a.vis > 0.5;
  }
  for (const b of game.bodies) {
    const vis = !P || !fog || canSeePoint(P, b.pos, visionOf(P) + 0.6);
    b.mesh.visible = vis;
    b.sparkT -= dt;
    if (b.sparkT <= 0) { b.sparkT = rand(0.5, 1.6); if (vis) sparks.burst(b.pos.x + rand(-0.3, 0.3), 0.35, b.pos.z + rand(-0.3, 0.3), 5, '#FFC86B', 1.4, 1.6, 0.5); }
  }
  fx.scanBeam.visible = !!game.scan || game.agents.some(a => a.alive && !a.isImp && a.brain.state === 'doTask' && a.brain.task && a.brain.task.st.type === 'scan' && (!P || canSeePoint(P, a.pos, visionOf(P) + 0.6)));
  updateLook(dt); updateWorldFx(dt, t); updatePops(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  updateVignette(); updateBubbles(dt); updateHUDFrame(dt);
}

const clock3 = { t: 0 };
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  if (document.hidden) return;
  clock3.t += dt;
  const st = game.state;
  try {
    if (st === 'play' || st === 'menu') simulate(dt * (game.timeScale || 1));
    else if (st === 'meeting') meetingTick(dt);
    else if (st === 'dying') dyingTick(dt);
    render(dt);
  } catch (e) { console.error(e); }
}

/* ---------- Arranque ---------- */
let booted = false;
async function start(data) {
  if (booted) return; booted = true;
  loadPrefs();
  if (data && data.settings) settings = { ...settings, ...data.settings };
  if (data && data.record) record = { ...record, ...data.record };
  buildMap();
  initRenderer();
  try { await Promise.race([document.fonts.load('40px "Saira Stencil One"'), sleep(1500)]); } catch (e) { /* fuente de reserva */ }
  buildWorld();
  initUI();
  initAI();
  showMenu();
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
}

/* Ganchos de prueba y de recarga en caliente */
window.__INF = {
  game, settings: () => settings, MT: () => MT, AI, newGame, startMeeting, playerAction, playerSay, startVote, castPlayerVote, doKill, startBlackout, showMenu,
  fastForward(sec) { const end = game.t + sec; while (game.t < end && (game.state === 'play' || game.state === 'menu')) simStep(0.05); return game.state; },
  _t: { applyTurn, decideVote, impVote, aliveNPCs, localText },
};
try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ settings, record })); } catch (e) { /* sin recarga en caliente */ }
const HOT = window.claude && window.claude.hot;
if (HOT && typeof HOT.ready === 'function') HOT.ready(start); else start((HOT && HOT.data) || {});
