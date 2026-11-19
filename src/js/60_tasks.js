/* ================= Minijuegos de tareas ================= */
const TaskUI = { open: false, st: null, cleanup: null, token: 0, finishing: false };
const MINI = {};

function openTask(st, onDone) {
  if (TaskUI.open) return;
  TaskUI.open = true; TaskUI.st = st; TaskUI.finishing = false;
  const token = ++TaskUI.token;
  input.jx = input.jz = 0; endStick();
  $('#taskRoom').textContent = ROOMS[st.rk].name;
  $('#taskName').textContent = st.name;
  const body = $('#taskBody'); body.innerHTML = '';
  $('#task').hidden = false;
  const done = () => {
    if (!TaskUI.open || TaskUI.finishing || token !== TaskUI.token) return;
    TaskUI.finishing = true;
    body.insertAdjacentHTML('beforeend', '<div class="stamp">Completada</div>');
    if (onDone) onDone();
    setTimeout(() => { if (token === TaskUI.token) closeTask(true); }, 700);
  };
  try { TaskUI.cleanup = MINI[st.type](body, done) || null; } catch (e) { console.error(e); TaskUI.cleanup = null; }
  sfx.open();
  setTimeout(() => { const f = body.querySelector('button, input'); if (f && !isTouch) f.focus({ preventScroll: true }); }, 30);
}

function closeTask() {
  if (!TaskUI.open) return;
  try { if (TaskUI.cleanup) TaskUI.cleanup(); } catch (e) { /* nada */ }
  TaskUI.open = false; TaskUI.st = null; TaskUI.cleanup = null; TaskUI.token++;
  $('#task').hidden = true; $('#taskBody').innerHTML = '';
}

const svgEl = (tag, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const wirePath = (x1, y1, x2, y2) => { const mx = (x1 + x2) / 2; return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; };

MINI.wires = (root, done) => {
  const C = ['#FF4A3D', '#3D7BFF', '#FFC531', '#FF6FB5'];
  const L = shuffle([0, 1, 2, 3]), R = shuffle([0, 1, 2, 3]);
  const y = k => 34 + k * 54;
  root.innerHTML = `<p class="hint">Arrastra (o toca) cada cable hasta el terminal de su color.</p>
  <svg class="wires" viewBox="0 0 300 230" role="img" aria-label="Panel de cables"><rect width="300" height="230" rx="10" fill="#0E1015"/><g class="lines"></g><g class="terms"></g></svg>`;
  const svg = root.querySelector('svg'), gl = svg.querySelector('.lines'), gt = svg.querySelector('.terms');
  for (let k = 0; k < 4; k++) {
    gt.appendChild(svgEl('rect', { x: 6, y: y(k) - 14, width: 36, height: 28, rx: 6, fill: C[L[k]], 'data-side': 'L', 'data-k': k, class: 'term' }));
    gt.appendChild(svgEl('rect', { x: 258, y: y(k) - 14, width: 36, height: 28, rx: 6, fill: C[R[k]], 'data-side': 'R', 'data-k': k, class: 'term' }));
  }
  const fixed = new Set(); let drag = null, sel = null;
  const pt = svg.createSVGPoint();
  const toSvg = e => { pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const hitRight = p => { if (p.x < 215) return -1; let best = -1, bd = 32; for (let k = 0; k < 4; k++) { const d = Math.abs(p.y - y(k)); if (d < bd) { bd = d; best = k; } } return best; };
  const setSel = k => { sel = k; gt.querySelectorAll('.term').forEach(r => r.classList.toggle('sel', r.dataset.side === 'L' && +r.dataset.k === k)); };
  const connect = (lk, rk) => {
    if (L[lk] !== R[rk] || fixed.has(lk)) return false;
    gl.appendChild(svgEl('path', { d: wirePath(42, y(lk), 258, y(rk)), stroke: C[L[lk]], 'stroke-width': 11, fill: 'none', 'stroke-linecap': 'round' }));
    fixed.add(lk); sfx.good();
    if (fixed.size === 4) done();
    return true;
  };
  svg.addEventListener('pointerdown', e => {
    const t = e.target.closest ? e.target.closest('.term') : null;
    if (t && t.dataset.side === 'L') {
      const k = +t.dataset.k; if (fixed.has(k)) return;
      const p = toSvg(e);
      drag = { k, x0: e.clientX, y0: e.clientY, line: svgEl('path', { stroke: C[L[k]], 'stroke-width': 11, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }) };
      drag.line.setAttribute('d', wirePath(42, y(k), p.x, p.y)); gl.appendChild(drag.line);
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
      e.preventDefault(); return;
    }
    if (t && t.dataset.side === 'R' && sel !== null) { if (!connect(sel, +t.dataset.k)) sfx.bad(); setSel(null); }
  });
  svg.addEventListener('pointermove', e => { if (!drag) return; const p = toSvg(e); drag.line.setAttribute('d', wirePath(42, y(drag.k), p.x, p.y)); });
  svg.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null; d.line.remove();
    const moved = Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8;
    const rk = hitRight(toSvg(e));
    if (moved && rk >= 0) { if (!connect(d.k, rk)) sfx.bad(); setSel(null); }
    else if (!moved) setSel(d.k);
  });
  svg.addEventListener('pointercancel', () => { if (drag) { drag.line.remove(); drag = null; } });
};

MINI.timing = (root, done) => {
  root.innerHTML = `<p class="hint">Pulsa <b>FIJAR</b> cuando la aguja pase por la franja verde. <span class="crt tm-c">0/3</span></p>
  <div class="tm"><div class="tm-zone"></div><div class="tm-needle"></div></div>
  <button class="mg-btn" type="button">FIJAR</button>`;
  const zone = root.querySelector('.tm-zone'), needle = root.querySelector('.tm-needle'), cnt = root.querySelector('.tm-c');
  const btn = root.querySelector('.mg-btn'), track = root.querySelector('.tm');
  let pos = 0, dir = 1, speed = 0.7, hits = 0, z0 = 0, z1 = 0, raf = 0, last = performance.now();
  const newZone = () => { const w = 0.18 - hits * 0.025; z0 = rand(0.08, 0.92 - w); z1 = z0 + w; zone.style.left = z0 * 100 + '%'; zone.style.width = w * 100 + '%'; };
  newZone();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    pos += dir * speed * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
    needle.style.left = pos * 100 + '%'; raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  btn.addEventListener('click', () => {
    track.classList.remove('ok', 'bad'); void track.offsetWidth;
    if (pos >= z0 - 0.01 && pos <= z1 + 0.01) {
      hits++; speed += 0.28; sfx.good(); track.classList.add('ok');
      if (hits >= 3) { cnt.textContent = '3/3'; cancelAnimationFrame(raf); done(); return; }
      newZone();
    } else { hits = Math.max(0, hits - 1); sfx.bad(); track.classList.add('bad'); }
    cnt.textContent = hits + '/3';
  });
  return () => cancelAnimationFrame(raf);
};

MINI.simon = (root, done) => {
  root.innerHTML = `<p class="hint">Mira la secuencia y repítela. <span class="crt sm-r">Ronda 1/2</span></p><div class="simon"></div><p class="crt sm-s">Observa…</p>`;
  const grid = root.querySelector('.simon'), rlab = root.querySelector('.sm-r'), slab = root.querySelector('.sm-s');
  const cells = [];
  for (let k = 0; k < 9; k++) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sm-cell'; b.setAttribute('aria-label', 'Celda ' + (k + 1)); grid.appendChild(b); cells.push(b); }
  const lens = [3, 4], seq = [randi(0, 8), randi(0, 8), randi(0, 8)];
  let round = 0, idx = 0, accepting = false, alive = true;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));
  const flash = (k, ms = 380) => { cells[k].classList.add('on'); later(() => cells[k].classList.remove('on'), ms); };
  const play = () => {
    accepting = false; idx = 0; slab.textContent = 'Observa…'; rlab.textContent = `Ronda ${round + 1}/2`;
    while (seq.length < lens[round]) seq.push(randi(0, 8));
    for (let i = 0; i < lens[round]; i++) later(() => { flash(seq[i]); sfx.blip(seq[i]); }, 650 + i * 560);
    later(() => { accepting = true; slab.textContent = 'Tu turno'; }, 650 + lens[round] * 560);
  };
  cells.forEach((c, k) => c.addEventListener('click', () => {
    if (!accepting) return;
    flash(k, 200); sfx.blip(k);
    if (k === seq[idx]) {
      idx++;
      if (idx >= lens[round]) { accepting = false; round++; if (round >= lens.length) done(); else { sfx.good(); later(play, 450); } }
    } else { accepting = false; sfx.bad(); grid.classList.add('err'); slab.textContent = 'Error, otra vez'; later(() => { grid.classList.remove('err'); play(); }, 750); }
  }));
  play();
  return () => { alive = false; timers.forEach(clearTimeout); };
};

MINI.hold = (root, done) => {
  root.innerHTML = `<p class="hint">Mantén pulsado hasta llenar el indicador.</p>
  <div class="hold"><div class="hold-gauge"><div class="hold-fill"></div></div><button class="hold-btn" type="button">MANTÉN</button></div>`;
  const fillEl = root.querySelector('.hold-fill'), btn = root.querySelector('.hold-btn');
  let p = 0, holding = false, raf = 0, last = performance.now(), fin = false;
  const on = e => { holding = true; btn.classList.add('down'); e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* nada */ } };
  const off = () => { holding = false; btn.classList.remove('down'); };
  btn.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, off));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  const key = e => { if (e.code === 'Space' || e.code === 'Enter') { holding = e.type === 'keydown'; btn.classList.toggle('down', holding); e.preventDefault(); } };
  btn.addEventListener('keydown', key); btn.addEventListener('keyup', key);
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    p = clamp(p + (holding ? dt / 3 : -dt * 0.5), 0, 1);
    fillEl.style.height = p * 100 + '%';
    if (p >= 1 && !fin) { fin = true; done(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
};

MINI.download = (root, done) => {
  root.innerHTML = `<p class="hint">Inicia la transferencia y espera a que termine.</p>
  <div class="dl"><div class="dl-log crt"></div><div class="dl-bar"><div class="dl-fill"></div></div><p class="crt dl-pct">0%</p></div>
  <button class="mg-btn" type="button">INICIAR</button>`;
  const btn = root.querySelector('.mg-btn'), fillEl = root.querySelector('.dl-fill'), pct = root.querySelector('.dl-pct'), log = root.querySelector('.dl-log');
  const FILES = ['bitacora_nav.dat', 'telemetria.bin', 'mapa_estelar.k7', 'soporte_vital.log', 'diagnostico.sys', 'turnos_tripulacion.csv'];
  let raf = 0, t0 = 0, li = -1;
  btn.addEventListener('click', () => {
    btn.disabled = true; btn.textContent = 'TRANSFIRIENDO…'; t0 = performance.now();
    const loop = now => {
      const p = clamp((now - t0) / 5200, 0, 1);
      fillEl.style.width = p * 100 + '%'; pct.textContent = Math.floor(p * 100) + '%';
      const k = Math.min(FILES.length - 1, Math.floor(p * FILES.length));
      if (k !== li) { li = k; const d = document.createElement('div'); d.textContent = '> ' + FILES[k] + ' … ok'; log.appendChild(d); log.scrollTop = log.scrollHeight; }
      if (p >= 1) { done(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
  return () => cancelAnimationFrame(raf);
};

MINI.keypad = (root, done) => {
  const code = Array.from({ length: 5 }, () => randi(0, 9)).join('');
  root.innerHTML = `<div class="kp-note"><span>Código</span><b class="crt">${code}</b></div>
  <div class="kp-screen crt" aria-live="polite">_____</div>
  <div class="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}<button type="button" data-k="del" aria-label="Borrar">⌫</button><button type="button" data-k="0">0</button><button type="button" data-k="ok" class="ok">OK</button></div>`;
  const scr = root.querySelector('.kp-screen'); let entry = '';
  const show = () => { scr.textContent = (entry + '_____').slice(0, 5); };
  root.querySelector('.kp').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k; sfx.click();
    if (k === 'del') entry = entry.slice(0, -1);
    else if (k === 'ok') {
      if (entry === code) { scr.classList.add('ok'); show(); done(); return; }
      sfx.bad(); scr.classList.remove('bad'); void scr.offsetWidth; scr.classList.add('bad'); entry = '';
    } else if (entry.length < 5) entry += k;
    show();
  });
};

MINI.tune = (root, done) => {
  root.innerHTML = `<p class="hint">Mueve el control hasta que tu onda coincida con la señal punteada.</p>
  <canvas class="tune" width="600" height="220"></canvas>
  <input class="tune-range" type="range" min="1" max="8" step="0.01" aria-label="Frecuencia">
  <p class="crt tune-s">SEÑAL: 0%</p>`;
  const cv = root.querySelector('canvas'), x = cv.getContext('2d'), range = root.querySelector('input'), sl = root.querySelector('.tune-s');
  const target = rand(2.4, 6.6);
  range.value = String(target > 4.5 ? rand(1.2, 2.2) : rand(6.4, 7.8));
  let hold = 0, raf = 0, last = performance.now(), ph = 0;
  const wave = (fr, color, w, dash) => { x.setLineDash(dash || []); x.strokeStyle = color; x.lineWidth = w; x.beginPath(); for (let px = 0; px <= 600; px += 4) { const yy = 110 + Math.sin((px / 600) * fr * TAU + ph) * 72; if (px) x.lineTo(px, yy); else x.moveTo(px, yy); } x.stroke(); x.setLineDash([]); };
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; ph += dt * 3;
    const f = parseFloat(range.value), diff = Math.abs(f - target), match = clamp(1 - diff / 3, 0, 1);
    x.fillStyle = '#0B0E12'; x.fillRect(0, 0, 600, 220);
    x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 1;
    for (let gx = 0; gx < 600; gx += 40) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, 220); x.stroke(); }
    wave(target, 'rgba(58,215,177,0.6)', 6, [14, 10]);
    wave(f, '#FFB31A', 4);
    sl.textContent = 'SEÑAL: ' + Math.round(match * 100) + '%';
    if (diff < 0.15) { hold += dt; if (hold > 0.8) { done(); return; } } else hold = 0;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
};

MINI.switches = (root, done) => {
  const st = Array.from({ length: 5 }, () => chance(0.4));
  if (st.filter(v => !v).length < 2) { st[1] = false; st[3] = false; }
  root.innerHTML = `<p class="hint">Activa todos los interruptores.</p><div class="sws"></div>`;
  const wrap = root.querySelector('.sws');
  st.forEach((v, k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'swt' + (v ? ' on' : '');
    b.setAttribute('aria-pressed', String(v)); b.setAttribute('aria-label', 'Interruptor ' + (k + 1)); b.innerHTML = '<span></span>';
    b.addEventListener('click', () => { st[k] = !st[k]; b.classList.toggle('on', st[k]); b.setAttribute('aria-pressed', String(st[k])); sfx.click(); if (st.every(Boolean)) done(); });
    wrap.appendChild(b);
  });
};

/* ---------- Escaneo médico (tarea visual, sin ventana) ---------- */
function startScan(st) { game.scan = { st, t: 0 }; $('#scan').hidden = false; $('#scanFill').style.width = '0%'; sfx.open(); }
function stopScan() { if (!game.scan) return; game.scan = null; $('#scan').hidden = true; }
function updateScan(dt) {
  const s = game.scan; if (!s) return;
  if (dist(game.player.pos, s.st.stand) > 0.8) { stopScan(); toast('Escaneo cancelado: quédate sobre la plataforma.'); return; }
  s.t += dt; $('#scanFill').style.width = clamp(s.t / 5, 0, 1) * 100 + '%';
  if (s.t >= 5) { const task = game.player.tasks.find(t => t.st === s.st && !t.done); stopScan(); completeTask(game.player, task); }
}
