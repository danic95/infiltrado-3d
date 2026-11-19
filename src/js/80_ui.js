/* ================= Interfaz, entrada y sonido ================= */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const input = { keys: new Set(), jx: 0, jz: 0, stick: null };
let mapOpen = false;

/* ---------- Sonido sintetizado ---------- */
const sfx = (() => {
  let ctx = null, master = null, noiseBuf = null;
  const init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; }
  };
  const ok = () => ctx && settings.sound && ctx.state === 'running';
  function tone(f, dur, o = {}) {
    if (!ok()) return;
    const { type = 'sine', vol = 0.15, slide = 0, delay = 0 } = o;
    const t0 = ctx.currentTime + delay, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function noise(dur, o = {}) {
    if (!ok()) return;
    const { vol = 0.2, freq = 1200, q = 1, delay = 0 } = o;
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t0 = ctx.currentTime + delay, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  const NOTES = [392, 440, 494, 523, 587, 659, 698, 784, 880];
  return {
    init,
    click: () => tone(700, 0.05, { type: 'square', vol: 0.04 }),
    open: () => tone(420, 0.1, { type: 'triangle', vol: 0.08, slide: 1.6 }),
    good: () => tone(880, 0.09, { type: 'triangle', vol: 0.09 }),
    bad: () => tone(150, 0.2, { type: 'sawtooth', vol: 0.07, slide: 0.7 }),
    blip: k => tone(NOTES[k % NOTES.length], 0.16, { type: 'triangle', vol: 0.08 }),
    done: () => { tone(660, 0.1, { type: 'triangle', vol: 0.1 }); tone(990, 0.18, { type: 'triangle', vol: 0.1, delay: 0.09 }); },
    zap: () => { noise(0.35, { vol: 0.32, freq: 2600, q: 0.8 }); tone(110, 0.4, { type: 'sawtooth', vol: 0.15, slide: 0.35 }); },
    alarm: () => { for (let k = 0; k < 3; k++) { tone(640, 0.2, { type: 'square', vol: 0.08, delay: k * 0.46 }); tone(480, 0.2, { type: 'square', vol: 0.08, delay: k * 0.46 + 0.23 }); } },
    vote: () => tone(520, 0.07, { type: 'square', vol: 0.05 }),
    reveal: () => { tone(330, 0.12, { type: 'triangle', vol: 0.09 }); tone(247, 0.25, { type: 'triangle', vol: 0.09, delay: 0.12 }); },
    eject: () => noise(1.6, { vol: 0.22, freq: 420, q: 0.6 }),
    blackout: () => tone(160, 0.9, { type: 'sawtooth', vol: 0.11, slide: 0.45 }),
    lights: () => tone(320, 0.14, { type: 'triangle', vol: 0.1, slide: 2 }),
    win: () => [523, 659, 784, 1046].forEach((f, k) => tone(f, 0.26, { type: 'triangle', vol: 0.1, delay: k * 0.12 })),
    lose: () => [392, 330, 262, 196].forEach((f, k) => tone(f, 0.34, { type: 'sawtooth', vol: 0.07, delay: k * 0.16 })),
    type: () => tone(1250 + Math.random() * 250, 0.018, { type: 'square', vol: 0.012 }),
  };
})();

function sanitizeName(v, final) {
  let s = String(v || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 10);
  if (final) { s = s.trim(); if (!s) s = 'VEGA'; if (ROSTER.some(r => r.name === s)) s = s.slice(0, 8) + ' 2'; }
  return s;
}

/* ---------- Movimiento ---------- */
function moveVector() {
  let x = input.jx, z = input.jz;
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
  return { x, z };
}
function endStick() { input.stick = null; input.jx = input.jz = 0; const s = $('#stick'); if (s) s.hidden = true; }
function showStickHint() { const h = $('#stickHint'); h.hidden = false; clearTimeout(h._t); h._t = setTimeout(() => { h.hidden = true; }, 7000); }
function hideStickHint() { $('#stickHint').hidden = true; }

/* ---------- Interacciones ---------- */
function findUseTarget() {
  const P = game.player; if (!P || !P.alive) return null;
  if (game.blackout && dist(P.pos, LIGHTS_PANEL.stand) < 1.4) return { kind: 'lights', label: 'Reparar' };
  for (const t of P.tasks) if (!t.done && dist(P.pos, t.st.stand) < (t.st.type === 'scan' ? 0.8 : 1.4)) return { kind: 'task', task: t, st: t.st, label: t.st.type === 'scan' ? 'Escanear' : 'Usar' };
  if (dist(P.pos, EMERGENCY) < EMERGENCY.r) return { kind: 'button', label: 'Reunión' };
  return null;
}
function findReportTarget() {
  const P = game.player; if (!P || !P.alive) return null;
  for (const b of game.bodies) if (!b.reported && dist(P.pos, b.pos) < 2.3 && los(P.pos.x, P.pos.z, b.pos.x, b.pos.z)) return b;
  return null;
}
function doUse() {
  if (game.state !== 'play' || TaskUI.open || game.scan || mapOpen) return;
  const u = findUseTarget(); if (!u) return;
  sfx.click();
  if (u.kind === 'lights') openTask(LIGHTS_PANEL, () => endBlackout(game.player));
  else if (u.kind === 'task') { if (u.st.type === 'scan') startScan(u.st); else openTask(u.st, () => completeTask(game.player, u.task)); }
  else if (game.emergencyLeft <= 0) toast('Ya usaste tu reunión de emergencia.');
  else if (game.emergencyCd > 0) toast(`El botón se recarga: ${Math.ceil(game.emergencyCd)} s.`);
  else { game.emergencyLeft--; startMeeting(game.player, null); }
}
function doReport() { if (game.state !== 'play' || mapOpen) return; const b = findReportTarget(); if (b) { closeTask(); startMeeting(game.player, b); } }

/* ---------- HUD ---------- */
function showHUD(on) { $('#hud').hidden = !on; $('#vignette').classList.toggle('on', on); }
function updateTaskBar() {
  const p = game.tasksTotal && isFinite(game.tasksTotal) ? clamp(game.tasksDone / game.tasksTotal, 0, 1) : 0;
  $('#tbFill').style.width = (p * 100).toFixed(1) + '%'; $('#tbPct').textContent = Math.round(p * 100) + '%';
}
function renderTaskList() {
  const P = game.player; if (!P) return;
  const done = P.tasks.filter(t => t.done).length;
  $('#tasksCount').textContent = `${done}/${P.tasks.length}`;
  $('#tasksList').innerHTML = (game.blackout ? '<li class="sab"><b>!</b><span>Electricidad: restaurar luces</span></li>' : '') +
    P.tasks.map(t => `<li class="${t.done ? 'done' : ''}"><b>${t.done ? '✓' : '•'}</b><span>${ROOMS[t.st.rk].name}: ${t.st.name}</span></li>`).join('');
}
function refreshMarkers() {
  for (const mk of fx.markers.values()) mk.visible = false;
  const P = game.player;
  if (P && game.state !== 'menu') for (const t of P.tasks) if (!t.done) fx.markers.get(t.st.id).visible = true;
  if (game.blackout) fx.markers.get(LIGHTS_PANEL.id).visible = true;
  renderTaskList();
}
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
function showAlert(msg) { const el = $('#alert'); el.textContent = msg; el.hidden = false; }
function hideAlert() { $('#alert').hidden = true; }

let hudT = 0;
function updateHUDFrame(dt) {
  if (game.state !== 'play') return;
  hudT -= dt; if (hudT > 0) return; hudT = 0.12;
  const P = game.player; if (!P || !P.alive) return;
  const r = roomAt(P.pos), label = r >= 0 ? ROOMS[r].name : 'Pasillo';
  const rl = $('#roomLabel'); if (rl.textContent !== label) rl.textContent = label;
  const u = !TaskUI.open && !game.scan ? findUseTarget() : null;
  $('#btnUse').disabled = !u;
  $('#useLabel').textContent = u ? (u.kind === 'button' ? `Reunión (${game.emergencyLeft})` : u.label) : 'Usar';
  $('#btnReport').disabled = !findReportTarget();
  if (mapOpen) drawMap();
}

const _pv = new THREE.Vector3(), _pv2 = new THREE.Vector3();
function updateVignette() {
  const P = game.player;
  if (!P || (game.state !== 'play' && game.state !== 'dying' && game.state !== 'pause')) return;
  const el = $('#vignette');
  _pv.set(P.pos.x, 0.6, P.pos.z).project(camera);
  _pv2.set(P.pos.x + lerp(VISION, VISION_DARK, fx.look.dark), 0.6, P.pos.z).project(camera);
  const W = innerWidth, H = innerHeight;
  const x = ((_pv.x + 1) / 2) * W, y = ((1 - _pv.y) / 2) * H, r = Math.abs(((_pv2.x - _pv.x) / 2) * W) * 1.08;
  el.style.setProperty('--vx', x.toFixed(1) + 'px'); el.style.setProperty('--vy', y.toFixed(1) + 'px'); el.style.setProperty('--vr', r.toFixed(1) + 'px');
}

/* ---------- Bocadillos ---------- */
const bubbles = [];
function bubble(a, text, dur = 3) {
  const old = bubbles.findIndex(b => b.a === a);
  if (old >= 0) { bubbles[old].el.remove(); bubbles.splice(old, 1); }
  const el = document.createElement('div'); el.className = 'bubble'; el.textContent = text;
  $('#bubbles').appendChild(el); bubbles.push({ a, el, t: dur });
}
const _bv = new THREE.Vector3();
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    if (b.t <= 0 || !b.a.alive || (game.state !== 'play' && game.state !== 'menu')) { b.el.remove(); bubbles.splice(i, 1); continue; }
    _bv.set(b.a.pos.x, 2.3, b.a.pos.z).project(camera);
    const vis = b.a.vis > 0.5 && _bv.z < 1 && Math.abs(_bv.x) < 1.1 && Math.abs(_bv.y) < 1.1;
    b.el.style.opacity = vis ? (b.t < 0.4 ? String(b.t / 0.4) : '1') : '0';
    b.el.style.transform = `translate(${(((_bv.x + 1) / 2) * innerWidth).toFixed(1)}px, ${(((1 - _bv.y) / 2) * innerHeight).toFixed(1)}px) translate(-50%, -100%)`;
  }
}
function clearBubbles() { bubbles.forEach(b => b.el.remove()); bubbles.length = 0; }

/* ---------- Mapa ---------- */
function toggleMap(force) {
  mapOpen = force === undefined ? !mapOpen : !!force;
  $('#map').hidden = !mapOpen;
  if (mapOpen) { endStick(); drawMap(); }
}
function drawMap() {
  const cv = $('#mapCanvas'), S = 16;
  if (cv.width !== MW * S) { cv.width = MW * S; cv.height = MH * S; }
  const x = cv.getContext('2d');
  x.fillStyle = '#0B0D12'; x.fillRect(0, 0, cv.width, cv.height);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const t = tileAt(i, j); if (t === 1) continue;
    const rk = roomGrid[TI(i, j)];
    x.fillStyle = rk >= 0 ? ROOMS[rk].tint : '#6E7582';
    x.fillRect(i * S, j * S, S + 0.5, S + 0.5);
    if (t === 2) { x.fillStyle = 'rgba(20,22,28,0.5)'; x.fillRect(i * S + 3, j * S + 3, S - 6, S - 6); }
  }
  x.font = `700 ${S}px "Atkinson Hyperlegible", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const r of ROOMS) { x.fillStyle = 'rgba(14,16,21,0.85)'; x.fillText(r.name, r.cx * S, (r.r[1] + 1.2) * S, (r.r[2] - r.r[0]) * S); }
  const diamond = (px, py, s, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(px, py - s); x.lineTo(px + s, py); x.lineTo(px, py + s); x.lineTo(px - s, py); x.closePath(); x.fill(); x.strokeStyle = '#14161C'; x.lineWidth = 2; x.stroke(); };
  const dot = (px, py, s, c, ring) => { x.fillStyle = c; x.beginPath(); x.arc(px, py, s, 0, TAU); x.fill(); if (ring) { x.strokeStyle = ring; x.lineWidth = 3; x.stroke(); } };
  dot(EMERGENCY.x * S, EMERGENCY.z * S, S * 0.5, '#FF3B2F', '#14161C');
  const P = game.player;
  if (P) for (const t of P.tasks) if (!t.done) diamond(t.st.con.x * S, t.st.con.z * S, S * 0.55, '#FFB31A');
  if (game.blackout) diamond(LIGHTS_PANEL.con.x * S, LIGHTS_PANEL.con.z * S, S * 0.75, Math.sin(performance.now() / 150) > 0 ? '#FF4A1C' : '#FFC21A');
  if (P && P.alive) dot(P.pos.x * S, P.pos.z * S, S * 0.6, P.hex, '#FFFFFF');
}

/* ---------- Reunión: interfaz ---------- */
function openMeeting() {
  game.state = 'meeting'; MT.phase = 'talk'; MT.openedAt = performance.now();
  showHUD(false); clearBubbles(); toggleMap(false);
  $('#mtChat').innerHTML = ''; $('#mtInput').value = '';
  $('#mtTitle').textContent = MT.victim ? 'Cuerpo reportado' : 'Reunión de emergencia';
  $('#mtReason').textContent = MT.victim ? `${MT.caller.name} encontró el cuerpo de ${MT.victim.name} en ${zn(MT.bodyZone)}` : `${MT.caller.name} pulsó el botón de emergencia`;
  $('#mtAI').textContent = aiUsable() ? 'Voces: Claude' : 'Voces: locales';
  $('#meeting').hidden = false;
  renderCards(); refreshMeetingControls();
  processQueue();
}
function hideMeeting() { $('#meeting').hidden = true; removeTyping(); showThinking(false); }

function renderCards(showVotes) {
  if (!MT) return;
  const show = showVotes || MT.phase === 'reveal';
  const crew = aliveNPCs().filter(c => !c.isImp);
  const susOf = a => { let s = 0; for (const c of crew) if (c !== a) s += Math.max(0, (MT.K.get(c.id) && MT.K.get(c.id).score.get(a.id)) || 0); return clamp(s / Math.max(1, crew.length * 7), 0, 1); };
  let html = game.agents.map(a => {
    const dead = !a.alive, sel = MT.selected === a.id, voted = MT.phase === 'vote' && MT.votedIds.has(a.id);
    let tokens = '';
    if (show && MT.result) for (const [voter, v] of MT.result.votes) if (v === a.id) tokens += `<i class="tok" style="--c:${byId(voter).hex}"></i>`;
    const sus = dead ? 0 : susOf(a);
    return `<button type="button" class="card${dead ? ' dead' : ''}${a.isPlayer ? ' me' : ''}${sel ? ' sel' : ''}${MT.talking === a.id ? ' talking' : ''}" data-id="${a.id}" style="--c:${a.hex}"${dead || a.isPlayer ? ' aria-disabled="true"' : ''} aria-label="${esc(a.name)}${dead ? ', fuera de servicio' : ''}">${avatarSVG(a.hex, dead)}<span class="nm">${esc(a.name)}</span>${voted ? '<span class="badge">Votó</span>' : ''}${tokens ? `<span class="tokens">${tokens}</span>` : ''}${dead ? '' : `<span class="susbar" title="Sospecha del grupo"><i style="width:${Math.round(sus * 100)}%"></i></span>`}</button>`;
  }).join('');
  if (show && MT.result) {
    const sk = [...MT.result.votes].filter(([, v]) => v === 'skip');
    html += `<div class="skipbox"><span>Saltaron</span><span class="tokens">${sk.map(([voter]) => `<i class="tok" style="--c:${byId(voter).hex}"></i>`).join('') || '—'}</span></div>`;
  }
  $('#mtCrew').innerHTML = html;
}
const refreshSuspectHints = () => renderCards();

function refreshMeetingControls() {
  if (!MT) return;
  const q = $('#mtQuick'), form = $('#mtForm'), vote = $('#mtVote'), alibi = $('#mtAlibi'), skip = $('#mtSkip');
  const busy = MT.queue.length >= 2;
  const sel = MT.selected !== null ? byId(MT.selected) : null;
  if (MT.phase === 'talk') {
    form.hidden = false; alibi.hidden = false; vote.hidden = false; skip.hidden = true;
    vote.disabled = !MT.voteReady; $('#mtInput').disabled = busy; $('#mtSend').disabled = busy;
    alibi.setAttribute('aria-expanded', String(!!MT.alibiOpen));
    if (MT.alibiOpen) q.innerHTML = '<span class="q-label">¿Dónde estabas tú?</span>' + ROOMS.map(r => `<button type="button" class="chip" data-act="claim" data-z="${r.k}"${busy ? ' disabled' : ''}>${r.name}</button>`).join('');
    else if (sel) q.innerHTML = `<span class="q-label" style="color:${sel.hex}">${esc(sel.name)}</span><button type="button" class="chip" data-act="ask"${busy ? ' disabled' : ''}>¿Dónde estabas?</button><button type="button" class="chip hot" data-act="accuse"${busy ? ' disabled' : ''}>Acusar</button><button type="button" class="chip" data-act="defend"${busy ? ' disabled' : ''}>Defender</button>`;
    else q.innerHTML = '<span class="q-hint">Toca un robot para preguntarle, acusarlo o defenderlo. También puedes escribir.</span>';
  } else if (MT.phase === 'vote') {
    form.hidden = true; alibi.hidden = true; vote.hidden = true; skip.hidden = false;
    skip.disabled = MT.playerVote !== undefined;
    if (MT.playerVote !== undefined) q.innerHTML = '<span class="q-hint">Voto enviado. Esperando al resto…</span>';
    else if (sel) q.innerHTML = `<button type="button" class="chip go" data-act="vote">Votar a ${esc(sel.name)}</button><button type="button" class="chip" data-act="cancel">Cancelar</button>`;
    else q.innerHTML = '<span class="q-hint">Toca a quien quieras expulsar, o salta el voto.</span>';
  } else {
    form.hidden = true; alibi.hidden = true; vote.hidden = true; skip.hidden = true;
    q.innerHTML = '<span class="q-hint">Recuento de votos…</span>';
  }
}

function chatScroll() { const c = $('#mtChat'); c.scrollTop = c.scrollHeight; }
function markTalking(who) { if (!MT) return; MT.talking = who ? who.id : null; $$('#mtCrew .card').forEach(c => c.classList.toggle('talking', who && +c.dataset.id === who.id)); }
function addLine(who, text) {
  if (!MT) return;
  removeTyping();
  const el = document.createElement('div');
  el.className = 'line' + (who.isPlayer ? ' me' : '');
  el.style.setProperty('--c', who.hex);
  el.innerHTML = `${avatarSVG(who.hex)}<div><b>${esc(who.name)}${who.isPlayer ? ' · tú' : ''}</b><p></p></div>`;
  el.querySelector('p').textContent = text;
  const think = $('#thinkLine');
  $('#mtChat').insertBefore(el, think || null); chatScroll();
  MT.lines.push({ who, text }); markTalking(who);
}
function addSys(text) {
  if (!MT) return;
  const el = document.createElement('div'); el.className = 'line sys';
  const p = document.createElement('p'); p.textContent = text; el.appendChild(p);
  $('#mtChat').appendChild(el); chatScroll();
  MT.lines.push({ who: null, text });
}
function typing(who, text) {
  return new Promise(res => {
    removeTyping();
    const el = document.createElement('div'); el.className = 'line typing'; el.id = 'typingLine'; el.style.setProperty('--c', who.hex);
    el.innerHTML = `${avatarSVG(who.hex)}<div><b>${esc(who.name)}</b><p class="dots" aria-label="escribiendo"><i></i><i></i><i></i></p></div>`;
    $('#mtChat').appendChild(el); chatScroll(); markTalking(who);
    setTimeout(res, reduceMotion ? 300 : clamp(420 + text.length * 15, 650, 1900));
  });
}
function removeTyping() { const t = $('#typingLine'); if (t) t.remove(); }
function showThinking(on) {
  let el = $('#thinkLine');
  if (on && !el) {
    el = document.createElement('div'); el.id = 'thinkLine'; el.className = 'line sys think';
    el.innerHTML = '<p>Los robots están pensando <span class="dots"><i></i><i></i><i></i></span></p>';
    $('#mtChat').appendChild(el); chatScroll();
  } else if (!on && el) el.remove();
  const chip = $('#mtAI'); if (chip) chip.classList.toggle('busy', !!on);
}

function showSplash(word, sub) {
  const el = $('#splash');
  $('#splashWord').textContent = word; $('#splashSub').textContent = sub || '';
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  showHUD(false); clearBubbles(); toggleMap(false);
}
function hideSplash() { $('#splash').hidden = true; }

let starsRaf = 0;
function startStars() {
  const cv = $('#ejCanvas'), x = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
  const stars = Array.from({ length: 170 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: rand(0.2, 1) }));
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    x.fillStyle = '#04050A'; x.fillRect(0, 0, W, H);
    for (const s of stars) { s.x -= s.z * 300 * dt * dpr; if (s.x < 0) { s.x = W; s.y = Math.random() * H; } x.fillStyle = `rgba(220,230,255,${0.3 + s.z * 0.7})`; x.fillRect(s.x, s.y, (2 + s.z * 4) * dpr, 1.5 * dpr); }
    starsRaf = requestAnimationFrame(loop);
  };
  starsRaf = requestAnimationFrame(loop);
}
function stopStars() { cancelAnimationFrame(starsRaf); }
function typeInto(el, text, cb) {
  el.textContent = '';
  if (reduceMotion) { el.textContent = text; if (cb) cb(); return; }
  let i = 0;
  const iv = setInterval(() => { i++; el.textContent = text.slice(0, i); if (i % 2) sfx.type(); if (i >= text.length) { clearInterval(iv); if (cb) cb(); } }, 34);
}
function showEject(ej, tie, cb) {
  game.state = 'eject';
  const el = $('#eject'); el.hidden = false;
  const bot = $('#ejBot');
  bot.innerHTML = ej ? avatarSVG(ej.hex) : ''; bot.classList.remove('go'); void bot.offsetWidth; if (ej) bot.classList.add('go');
  const line = ej ? `${ej.name} salió por la esclusa.` : tie ? 'Empate. Nadie salió por la esclusa.' : 'Se saltó la votación. Nadie salió por la esclusa.';
  const sub = ej ? (ej.isImp ? `${ej.name} era la IA infiltrada.` : `${ej.name} no era la IA infiltrada. Quedan ${aliveAll().length} robots a bordo.`) : 'La IA sigue a bordo.';
  $('#ejSub').textContent = '';
  typeInto($('#ejLine'), line, () => setTimeout(() => typeInto($('#ejSub'), sub), 350));
  sfx.eject(); startStars();
  setTimeout(() => { el.hidden = true; stopStars(); cb(); }, 5600);
}

/* ---------- Pantallas ---------- */
function hideAll() {
  ['#menu', '#intro', '#hud', '#task', '#splash', '#meeting', '#eject', '#end', '#pause', '#map', '#deathMsg', '#flash'].forEach(s => { $(s).hidden = true; });
  $('#vignette').classList.remove('on'); mapOpen = false; clearBubbles(); hideAlert();
}
function showMenu() {
  closeTask(); stopScan(); hideAll(); MT = null;
  setupDemo();
  $('#menu').hidden = false; renderRecord(); updateAIStatus();
}
const recordText = () => `${record.w} ${record.w === 1 ? 'victoria' : 'victorias'} · ${record.l} ${record.l === 1 ? 'derrota' : 'derrotas'}`;
function renderRecord() { $('#record').textContent = record.w + record.l ? `Tu récord: ${recordText()}` : ''; }
function showIntro(cb) {
  const el = $('#intro'); el.hidden = false;
  $('#introCrew').innerHTML = game.agents.map(a => `<span class="${a.isPlayer ? 'me' : ''}">${avatarSVG(a.hex)}</span>`).join('');
  $('#introText').textContent = `Una IA hostil se esconde dentro de uno de los ${game.agents.length - 1} robots que te acompañan. Haz tus tareas, no te quedes a solas y descúbrela.`;
  let done = false;
  const go = () => { if (done) return; done = true; el.hidden = true; cb(); };
  el.onclick = go; setTimeout(go, 4200);
}
const END_TEXT = {
  ejected: 'Expulsaron a la IA infiltrada. La estación está a salvo.',
  tasks: 'Completaron todas las tareas. La IA quedó aislada y sin poder.',
  killed: 'La IA te desactivó mientras estabas a solas.',
  ejectedMe: 'La tripulación te expulsó por error. La IA se salió con la suya.',
  overrun: 'La IA desactivó a casi toda la tripulación.',
};
function showEnd(result, reason) {
  const el = $('#end'); el.hidden = false;
  el.classList.toggle('win', result === 'win'); el.classList.toggle('lose', result !== 'win');
  $('#endTitle').textContent = result === 'win' ? '¡Victoria!' : 'Derrota';
  $('#endReason').textContent = END_TEXT[reason] || '';
  const imp = game.impostor;
  $('#endReveal').innerHTML = `${avatarSVG(imp.hex)}<div><span>La IA infiltrada era</span><b style="color:${imp.hex}">${esc(imp.name)}</b></div>`;
  $('#endStats').innerHTML = `<span>Tiempo ${fmtTime(game.t)}</span><span>Tareas ${game.tasksDone}/${game.tasksTotal}</span><span>Reuniones ${game.meetings}</span>`;
  $('#endRecord').textContent = `Tu récord: ${recordText()}`;
  setTimeout(() => { const b = $('#endAgain'); if (b && !isTouch) b.focus({ preventScroll: true }); }, 50);
}
function openPause() {
  if (game.state !== 'play') return;
  game.state = 'pause'; closeTask(); stopScan(); endStick(); toggleMap(false);
  $('#pause').hidden = false; syncSoundBtn();
}
function closePause() { $('#pause').hidden = true; if (game.state === 'pause') game.state = 'play'; }
function syncSoundBtn() { $('#btnSound').textContent = settings.sound ? 'Sonido: sí' : 'Sonido: no'; }

function updateAIStatus() {
  const s = $('#aiStatus'); if (!s) return;
  const cb = $('#optVoice button[data-v="claude"]');
  const lb = $('#optVoice button[data-v="local"]');
  let eff = settings.voice;
  if (AI.status === 'checking') s.textContent = 'Comprobando si Claude está disponible aquí…';
  else if (AI.status === 'on') s.textContent = settings.voice === 'claude' ? 'Los NPC opinan, mienten y responden con Claude. Si algo falla, usan el diálogo local.' : 'Los NPC usan frases locales, sin conexión.';
  else if (AI.status === 'denied') { s.textContent = 'Permiso de Claude denegado: los NPC usan el diálogo local.'; eff = 'local'; }
  else { s.textContent = 'Claude no está disponible en esta vista: los NPC usan el diálogo local.'; eff = 'local'; }
  cb.disabled = AI.status === 'off' || AI.status === 'denied';
  cb.setAttribute('aria-checked', String(eff === 'claude')); lb.setAttribute('aria-checked', String(eff === 'local'));
}

function segmented(sel, key, conv = v => v) {
  const el = $(sel);
  const sync = () => $$('button', el).forEach(b => b.setAttribute('aria-checked', String(String(settings[key]) === b.dataset.v)));
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    settings[key] = conv(b.dataset.v); sync(); savePrefs(); sfx.init(); sfx.click();
    if (key === 'voice') updateAIStatus();
  });
  sync();
}

function initUI() {
  /* teclado */
  addEventListener('keydown', e => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    input.keys.add(e.code);
    if (game.state === 'play') {
      if (e.code === 'KeyE' || e.code === 'Space') { if (!TaskUI.open) { e.preventDefault(); doUse(); } }
      else if (e.code === 'KeyR') doReport();
      else if (e.code === 'KeyM') toggleMap();
      else if (e.code === 'Escape') { if (TaskUI.open) closeTask(); else if (mapOpen) toggleMap(false); else openPause(); }
    } else if (game.state === 'pause' && e.code === 'Escape') closePause();
  });
  addEventListener('keyup', e => input.keys.delete(e.code));
  addEventListener('blur', () => { input.keys.clear(); endStick(); });

  /* joystick táctil dinámico */
  const tz = $('#touch');
  tz.addEventListener('pointerdown', e => {
    if (game.state !== 'play' || TaskUI.open || mapOpen || input.stick) return;
    input.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { tz.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    const s = $('#stick'); s.hidden = false; s.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    $('#stickKnob').style.transform = 'translate(0px, 0px)';
    hideStickHint();
  });
  tz.addEventListener('pointermove', e => {
    const st = input.stick; if (!st || e.pointerId !== st.id) return;
    let dx = e.clientX - st.x, dy = e.clientY - st.y;
    const R = 54, l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    input.jx = dx / R; input.jz = dy / R;
    if (Math.hypot(input.jx, input.jz) < 0.12) { input.jx = 0; input.jz = 0; }
    $('#stickKnob').style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const end = e => { const st = input.stick; if (st && e.pointerId === st.id) endStick(); };
  tz.addEventListener('pointerup', end); tz.addEventListener('pointercancel', end);

  /* HUD */
  $('#btnUse').addEventListener('click', () => { sfx.init(); doUse(); });
  $('#btnReport').addEventListener('click', () => { sfx.init(); doReport(); });
  $('#btnMap').addEventListener('click', () => { sfx.click(); toggleMap(); });
  $('#btnPause').addEventListener('click', () => { sfx.click(); openPause(); });
  $('#tasksToggle').addEventListener('click', () => { const t = $('#tasks'); t.classList.toggle('collapsed'); $('#tasksToggle').setAttribute('aria-expanded', String(!t.classList.contains('collapsed'))); });
  if (innerWidth < 640) { $('#tasks').classList.add('collapsed'); $('#tasksToggle').setAttribute('aria-expanded', 'false'); }
  $('#taskClose').addEventListener('click', () => { sfx.click(); closeTask(); });
  $('#task').addEventListener('pointerdown', e => { if (e.target.id === 'task') closeTask(); });
  $('#mapClose').addEventListener('click', () => toggleMap(false));
  $('#map').addEventListener('click', e => { if (e.target.id === 'map') toggleMap(false); });

  /* pausa y final */
  $('#btnResume').addEventListener('click', () => { sfx.click(); closePause(); });
  $('#btnSound').addEventListener('click', () => { settings.sound = !settings.sound; savePrefs(); sfx.init(); syncSoundBtn(); sfx.click(); });
  $('#btnQuit').addEventListener('click', () => { sfx.click(); showMenu(); });
  $('#endAgain').addEventListener('click', () => { sfx.init(); sfx.click(); hideAll(); newGame(); });
  $('#endMenu').addEventListener('click', () => { sfx.click(); showMenu(); });

  /* reunión */
  $('#mtCrew').addEventListener('click', e => {
    const c = e.target.closest('.card'); if (!c || !MT) return;
    const a = byId(+c.dataset.id);
    if (!a || !a.alive || a.isPlayer) return;
    if (MT.phase === 'talk' || (MT.phase === 'vote' && MT.playerVote === undefined)) {
      MT.selected = MT.selected === a.id ? null : a.id; MT.alibiOpen = false;
      renderCards(); refreshMeetingControls(); sfx.click();
    }
  });
  $('#mtQuick').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || !MT || b.disabled) return;
    const act = b.dataset.act, sel = MT.selected !== null ? byId(MT.selected) : null;
    sfx.click();
    if (act === 'claim') playerAction('claim', null, +b.dataset.z);
    else if (act === 'ask' || act === 'accuse' || act === 'defend') { if (sel) playerAction(act, sel, -1); }
    else if (act === 'vote') { if (sel) castPlayerVote(sel.id); }
    else if (act === 'cancel') { MT.selected = null; renderCards(); refreshMeetingControls(); }
  });
  $('#mtAlibi').addEventListener('click', () => { if (!MT || MT.phase !== 'talk') return; sfx.click(); MT.alibiOpen = !MT.alibiOpen; MT.selected = null; renderCards(); refreshMeetingControls(); });
  $('#mtVote').addEventListener('click', () => { sfx.click(); startVote(); });
  $('#mtSkip').addEventListener('click', () => { sfx.click(); castPlayerVote('skip'); });
  $('#mtForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#mtInput'); const v = i.value; i.value = ''; playerSay(v); });

  /* menú */
  const nm = $('#optName'); nm.value = settings.name;
  nm.addEventListener('input', () => { const v = sanitizeName(nm.value, false); if (v !== nm.value) nm.value = v; });
  nm.addEventListener('change', () => { settings.name = sanitizeName(nm.value, true); nm.value = settings.name; savePrefs(); });
  $('#optColor').innerHTML = PALETTE.map(([hex, n]) => `<button type="button" class="sw" role="radio" style="--c:${hex}" data-hex="${hex}" aria-label="${n}" aria-checked="${hex === settings.color}"></button>`).join('');
  $('#optColor').addEventListener('click', e => {
    const b = e.target.closest('.sw'); if (!b) return;
    settings.color = b.dataset.hex; $$('#optColor .sw').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    savePrefs(); sfx.init(); sfx.click();
  });
  segmented('#optDiff', 'diff'); segmented('#optCrew', 'crew', v => +v); segmented('#optVoice', 'voice');
  $('#btnPlay').addEventListener('click', () => {
    sfx.init(); sfx.click();
    settings.name = sanitizeName($('#optName').value, true); $('#optName').value = settings.name; savePrefs();
    newGame();
  });
  updateAIStatus();
}
