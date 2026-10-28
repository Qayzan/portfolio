/* Hero: the name assembles from cells, then bugs crawl in and eat it; click them to fix it.
   Everything is drawn on a low-resolution grid, then rendered as dithered square cells
   (ordered Bayer dithering, four grey levels plus four accent levels). */
(() => {
  const root = document.getElementById('top');
  const canvas = document.getElementById('hero-field');
  if (!root || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const low = document.createElement('canvas');
  const lc = low.getContext('2d', { willReadFrequently: true });
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const statusEl = document.getElementById('status');
  const hintEl = document.getElementById('hint');
  const counterLabel = document.getElementById('counter-label');
  const counterValue = document.getElementById('counter-value');

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const COLORS = ['#2E2C26', '#5E5A51', '#A29D92', '#F2EFE8',      // grey levels 1 to 4
                  '#4D1E0D', '#933615', '#E2571F', '#FF9B6B'];     // accent levels 1 to 4
  const buckets = COLORS.map(() => []);

  let W = 0, H = 0, dpr = 1, CELL = 9, cols = 0, rows = 0;
  const pointer = { x: -1e3, y: -1e3, px: -1e3, py: -1e3, inside: false, moved: 0 };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const nw = root.clientWidth, nh = root.clientHeight;
    if (nw === W && nh === H) return;
    W = nw; H = nh;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    CELL = W < 700 ? 7 : 9;
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    low.width = cols; low.height = rows;
    measureAvoid();
    if (typeof scene !== 'undefined' && scene.resize && scene.p) scene.resize();
  }

  // Low-res image -> dithered cells.
  function present() {
    const d = lc.getImageData(0, 0, cols, rows).data;
    for (const b of buckets) b.length = 0;
    for (let y = 0; y < rows; y++) {
      const by = (y & 3) * 4;
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4, a = d[i + 3];
        if (a < 8) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const accent = mx - mn > 70 && r > b + 40;
        const v = (accent ? mx / 255 : (0.299 * r + 0.587 * g + 0.114 * b) / 255) * (a / 255) * 4;
        let lv = Math.floor(v);
        if (v - lv > BAYER[by + (x & 3)]) lv++;
        if (lv <= 0) continue;
        if (lv > 4) lv = 4;
        buckets[(accent ? 4 : 0) + lv - 1].push(x, y);
      }
    }
    ctx.clearRect(0, 0, W, H);
    const s = CELL - 1;
    for (let k = 0; k < buckets.length; k++) {
      const list = buckets[k];
      if (!list.length) continue;
      ctx.fillStyle = COLORS[k];
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 2) ctx.rect(list[j] * CELL, list[j + 1] * CELL, s, s);
      ctx.fill();
    }
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  function turnTowards(a, target, amount) {
    let d = target - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * Math.min(1, amount);
  }
  // The hero copy is a no-go zone so bugs and creatures never crawl over the text.
  let avoid = null;
  function measureAvoid() {
    const r = root.querySelector('.hero-copy').getBoundingClientRect(), o = root.getBoundingClientRect();
    avoid = { x0: (r.left - o.left) / CELL - 4, y0: (r.top - o.top) / CELL - 4, x1: (r.right - o.left) / CELL + 4, y1: (r.bottom - o.top) / CELL + 4 };
  }
  function keepInside(o, margin, dt) {
    if (o.x < margin || o.x > cols - margin || o.y < margin || o.y > rows - margin)
      o.a = turnTowards(o.a, Math.atan2(rows / 2 - o.y, cols / 2 - o.x), dt * 3);
    if (avoid && o.x > avoid.x0 && o.x < avoid.x1 && o.y > avoid.y0 && o.y < avoid.y1) {
      const cx = (avoid.x0 + avoid.x1) / 2, cy = (avoid.y0 + avoid.y1) / 2;
      o.a = turnTowards(o.a, Math.atan2(o.y - cy, o.x - cx), dt * 6);
    }
  }

  // ===================================================================== scene 1: garden
  const garden = {
    status: 'in a garden of small bugs,\nfix a few.',
    hint: 'click a bug to fix it · click the ground to drop a crumb',
    counter: 'bugs fixed',
    init() {
      this.bugs = []; this.crumbs = []; this.rings = []; this.bits = []; this.fixed = 0;
      const wide = cols > rows;
      for (let i = 0; i < 7; i++) this.bugs.push(this.makeBug(rand(cols * (wide ? .4 : .1), cols * .92), rand(rows * .1, rows * (wide ? .9 : .5))));
      setCounter(0);
    },
    makeBug(x, y) {
      const kinds = ['lady', 'lady', 'grey', 'beetle'];
      return { x, y, a: rand(0, Math.PI * 2), speed: rand(3, 5), size: rand(5.2, 7.6), kind: kinds[Math.floor(rand(0, 4))],
        phase: rand(0, 9), pause: 0, turn: 0 };
    },
    update(dt) {
      for (const b of this.bugs) {
        b.phase += dt * b.speed * 1.6;
        let speed = b.speed;
        const food = this.crumbs.filter(c => c.left > 0).sort((p, q) => dist(b.x, b.y, p.x, p.y) - dist(b.x, b.y, q.x, q.y))[0];
        if (food && dist(b.x, b.y, food.x, food.y) < 70) {
          const d = dist(b.x, b.y, food.x, food.y);
          if (d < b.size * 1.2) { food.left -= dt * 0.25; speed = 0; b.phase -= dt * b.speed; }
          else { b.a = turnTowards(b.a, Math.atan2(food.y - b.y, food.x - b.x), dt * 4); speed *= 1.4; }
        } else {
          if (b.pause > 0) { b.pause -= dt; speed = 0; }
          else if (Math.random() < dt * 0.2) b.pause = rand(.4, 1.4);
          b.turn += rand(-1, 1) * dt * 2; b.turn *= 0.97; b.a += b.turn * dt * 2;
        }
        const dp = dist(b.x, b.y, pointer.x, pointer.y);
        if (pointer.inside && dp < 12) { b.a = turnTowards(b.a, Math.atan2(b.y - pointer.y, b.x - pointer.x), dt * 6); speed = Math.max(speed, b.speed * 2.2); b.pause = 0; }
        keepInside(b, 6, dt);
        b.x += Math.cos(b.a) * speed * dt; b.y += Math.sin(b.a) * speed * dt;
      }
      for (const c of this.crumbs) if (c.left <= 0) c.gone = (c.gone || 0) + dt;
      this.crumbs = this.crumbs.filter(c => !(c.gone > 1));
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter(r => r.t < 2.4);
      for (const p of this.bits) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
      this.bits = this.bits.filter(p => p.t < p.life);
    },
    draw(t) {
      for (const r of this.rings) {
        lc.strokeStyle = `rgba(162,157,146,${0.55 * (1 - r.t / 2.4)})`; lc.lineWidth = 0.9;
        for (const k of [0, 0.45]) { const rr = (r.t - k) * 9; if (rr > 0) { lc.beginPath(); lc.arc(r.x, r.y, rr, 0, Math.PI * 2); lc.stroke(); } }
      }
      for (const c of this.crumbs) {
        const s = Math.max(0, c.left) * 2.2 + 0.6;
        lc.fillStyle = c.left > 0 ? '#d8c9a8' : 'rgba(216,201,168,.3)';
        lc.fillRect(c.x - s / 2, c.y - s / 2, s, s);
      }
      for (const b of this.bugs) drawBug(b);
      for (const p of this.bits) { lc.fillStyle = p.c; lc.globalAlpha = 1 - p.t / p.life; lc.fillRect(p.x, p.y, 1, 1); }
      lc.globalAlpha = 1;
    },
    down(x, y) {
      const hit = this.bugs.find(b => dist(b.x, b.y, x, y) < b.size * 1.5 + 1);
      if (hit) {
        for (let i = 0; i < 26; i++) {
          const a = rand(0, Math.PI * 2), v = rand(4, 22);
          this.bits.push({ x: hit.x, y: hit.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(.5, 1.2),
            c: i % 3 ? (hit.kind === 'lady' ? '#ff6a2a' : '#cfc8bb') : '#f2efe8' });
        }
        this.bugs.splice(this.bugs.indexOf(hit), 1);
        setCounter(++this.fixed);
        setTimeout(() => {   // a new bug wanders in from an edge
          const side = Math.floor(rand(0, 4));
          const nb = this.makeBug(side === 0 ? 2 : side === 1 ? cols - 2 : rand(0, cols), side === 2 ? 2 : side === 3 ? rows - 2 : rand(0, rows));
          nb.a = Math.atan2(rows / 2 - nb.y, cols / 2 - nb.x);
          if (scene === garden) this.bugs.push(nb);
        }, 1800);
      } else {
        this.crumbs.push({ x, y, left: 1 });
        this.rings.push({ x, y, t: 0 });
        if (this.crumbs.length > 6) this.crumbs.shift();
      }
    },
  };

  function drawBug(b) {
    const s = b.size;
    lc.save();
    lc.translate(b.x, b.y); lc.rotate(b.a);
    lc.strokeStyle = '#8f8a80'; lc.lineWidth = Math.max(0.7, s * 0.16); lc.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * s * 0.45, swing = Math.sin(b.phase + i * 2.1) * s * 0.25;
      for (const side of [-1, 1]) {
        const k = side * (i % 2 ? -1 : 1);
        lc.beginPath(); lc.moveTo(lx, side * s * 0.4);
        lc.lineTo(lx + swing * k * 0.6, side * s * 0.85);
        lc.lineTo(lx + swing * k + (i - 1) * s * 0.3, side * s * 1.2); lc.stroke();
      }
    }
    lc.beginPath();
    lc.moveTo(s * .8, -s * .15); lc.lineTo(s * 1.35, -s * .55);
    lc.moveTo(s * .8, s * .15); lc.lineTo(s * 1.35, s * .55); lc.stroke();
    lc.fillStyle = '#d7d1c6';
    lc.beginPath(); lc.ellipse(s * .75, 0, s * .32, s * .34, 0, 0, Math.PI * 2); lc.fill();
    lc.fillStyle = b.kind === 'lady' ? '#ff5a1f' : b.kind === 'grey' ? '#bcb6ab' : '#7d786f';
    lc.beginPath(); lc.ellipse(0, 0, s * .8, s * .66, 0, 0, Math.PI * 2); lc.fill();
    lc.fillStyle = '#000';
    lc.fillRect(-s * .75, -s * .05, s * 1.2, s * .1);
    if (b.kind === 'lady') for (const [sx, sy] of [[.2, .32], [-.3, .3]]) for (const side of [-1, 1]) {
      lc.beginPath(); lc.arc(sx * s, side * sy * s, s * .14, 0, Math.PI * 2); lc.fill();
    }
    lc.restore();
  }

  // ===================================================================== scene 3: signal (name made of cells)
  const signal = {
    status: 'fauzan fauzy,\nassembled one cell at a time.',
    hint: 'move through the letters · click to scatter them',
    counter: 'assembled',
    init() { this.build(); },
    resize() { this.build(); },
    build() {
      const off = document.createElement('canvas');
      off.width = cols; off.height = rows;
      const o = off.getContext('2d');
      const wide = cols > rows * 1.1;
      const size = Math.floor(wide ? rows * 0.2 : cols * 0.2);
      o.font = `700 ${size}px Geist, system-ui, sans-serif`;
      o.textBaseline = 'top'; o.fillStyle = '#fff';
      const x0 = wide ? Math.floor(cols * 0.46) : Math.floor(cols * 0.08), y0 = Math.floor(rows * (wide ? 0.12 : 0.2));
      o.fillText('FAUZAN', x0, y0);
      const split = y0 + size * 1.02;
      o.fillText('FAUZY', x0, split);
      const d = o.getImageData(0, 0, cols, rows).data;
      this.p = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (d[(y * cols + x) * 4 + 3] > 120) {
          this.p.push({ hx: x, hy: y, x: x + rand(-60, 60), y: y + rand(-40, 40), vx: 0, vy: 0, acc: y >= split });
        }
      }
      if (reduceMotion) for (const q of this.p) { q.x = q.hx; q.y = q.hy; }
    },
    update(dt) {
      let home = 0;
      for (const q of this.p) {
        let ax = (q.hx - q.x) * 26, ay = (q.hy - q.y) * 26;
        if (pointer.inside) {
          const dx = q.x - pointer.x, dy = q.y - pointer.y, d2 = dx * dx + dy * dy;
          if (d2 < 64) { const f = (64 - d2) * 9 / (Math.sqrt(d2) + 0.5); ax += dx * f; ay += dy * f; }
        }
        q.vx = (q.vx + ax * dt) * Math.pow(0.0025, dt);
        q.vy = (q.vy + ay * dt) * Math.pow(0.0025, dt);
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (Math.abs(q.x - q.hx) < 0.6 && Math.abs(q.y - q.hy) < 0.6) home++;
      }
      setCounter(Math.round(100 * home / Math.max(1, this.p.length)) + '%');
    },
    draw(t) {
      for (const q of this.p) {
        const wave = 0.62 + 0.38 * Math.sin(q.hx * 0.12 - t * 2.2 + q.hy * 0.05);
        const off = Math.min(1, Math.hypot(q.x - q.hx, q.y - q.hy) / 6);
        if (q.acc) lc.fillStyle = `rgba(255,90,31,${0.55 + 0.45 * wave})`;
        else lc.fillStyle = `rgba(242,239,232,${(0.5 + 0.5 * wave) * (1 - off * 0.4)})`;
        lc.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
    },
    down(x, y) {
      for (const q of this.p) {
        const dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy);
        if (d < 26) { const f = (26 - d) * 9; q.vx += dx / (d + .1) * f + rand(-8, 8); q.vy += dy / (d + .1) * f + rand(-8, 8); }
      }
    },
  };

  // ===================================================================== scene 4: garden + signal
  // The name assembles from cells, then bugs crawl in and start eating it. Fixing a bug puts back
  // every cell it ate.
  const combo = {
    status: 'fauzan fauzy,\nassembled one cell at a time.',
    hint: 'click a bug to fix it · click the ground to drop a crumb · move through the letters',
    counter: 'bugs fixed · name intact',
    init() {
      signal.build.call(this);
      this.bugs = []; this.crumbs = []; this.rings = []; this.bits = []; this.fixed = 0; this.t = 0; this.waveAt = 2.8; this.wave = 0;
      this.warned = false;
    },
    resize() { signal.build.call(this); for (const b of this.bugs) b.ate = []; },
    spawnWave() {
      const n = Math.min(7, 3 + this.wave);
      for (let i = 0; i < n; i++) {
        const fromTop = Math.random() < 0.5;          // right or top edge; the hero copy sits bottom left
        const b = garden.makeBug(fromTop ? rand(cols * .35, cols * .95) : cols - 1, fromTop ? 1 : rand(rows * .05, rows * .55));
        b.a = Math.atan2(rows / 2 - b.y, cols / 2 - b.x); b.ate = []; b.eatTimer = rand(0, .3); b.target = null; b.retarget = 0;
        b.delay = i * 0.45;
        this.bugs.push(b);
      }
      this.wave++;
      if (!this.warned) { this.warned = true; typeStatus('uh oh. bugs got in.\nfix them before they eat the name.'); }
    },
    update(dt) {
      this.t += dt;
      if (this.waveAt != null && this.t >= this.waveAt) { this.waveAt = null; this.spawnWave(); }
      if (this.waveAt == null && this.bugs.length === 0) { this.waveAt = this.t + 4; typeStatus('all fixed. name restored.\nthe next wave is on its way.'); }

      for (const b of this.bugs) {
        if (b.delay > 0) { b.delay -= dt; continue; }
        b.phase += dt * b.speed * 1.6;
        let speed = b.speed;
        const food = this.crumbs.filter(c => c.left > 0).sort((p, q) => dist(b.x, b.y, p.x, p.y) - dist(b.x, b.y, q.x, q.y))[0];
        if (food && dist(b.x, b.y, food.x, food.y) < 80) {
          const d = dist(b.x, b.y, food.x, food.y);
          if (d < b.size * 1.2) { food.left -= dt * 0.25; speed = 0; }
          else { b.a = turnTowards(b.a, Math.atan2(food.y - b.y, food.x - b.x), dt * 4); speed *= 1.4; }
        } else {
          // head for a letter they haven't eaten yet
          b.retarget -= dt;
          if (!b.target || b.target.eaten || b.retarget <= 0 || dist(b.x, b.y, b.target.hx, b.target.hy) < 2) {
            const choices = this.p.filter(q => !q.eaten);
            b.target = choices.length ? choices[Math.floor(rand(0, choices.length))] : null;
            b.retarget = rand(3, 6);
          }
          if (b.target) b.a = turnTowards(b.a, Math.atan2(b.target.hy - b.y, b.target.hx - b.x), dt * 1.6);
          b.turn += rand(-1, 1) * dt * 2; b.turn *= 0.97; b.a += b.turn * dt;
        }
        const dp = dist(b.x, b.y, pointer.x, pointer.y);
        if (pointer.inside && dp < 12) { b.a = turnTowards(b.a, Math.atan2(b.y - pointer.y, b.x - pointer.x), dt * 6); speed = Math.max(speed, b.speed * 2.2); }
        keepInside(b, 4, dt);
        b.x += Math.cos(b.a) * speed * dt; b.y += Math.sin(b.a) * speed * dt;

        // munch: one cell at a time from under the bug's head
        b.eatTimer -= dt;
        if (b.eatTimer <= 0 && b.ate.length < 60) {
          b.eatTimer = 0.22;
          const hx = b.x + Math.cos(b.a) * b.size * 0.8, hy = b.y + Math.sin(b.a) * b.size * 0.8;
          for (const q of this.p) {
            if (!q.eaten && Math.abs(q.x - hx) < b.size * 0.7 && Math.abs(q.y - hy) < b.size * 0.7) { q.eaten = true; b.ate.push(q); break; }
          }
        }
      }

      let intact = 0;
      const pull = 26 * Math.min(1, 0.12 + this.t / 2);   // the name assembles slowly at first
      for (const q of this.p) {
        if (q.eaten) continue;
        let ax = (q.hx - q.x) * pull, ay = (q.hy - q.y) * pull;
        if (pointer.inside) {
          const dx = q.x - pointer.x, dy = q.y - pointer.y, d2 = dx * dx + dy * dy;
          if (d2 < 64) { const f = (64 - d2) * 9 / (Math.sqrt(d2) + 0.5); ax += dx * f; ay += dy * f; }
        }
        for (const b of this.bugs) {   // bugs shoulder letters aside as they walk
          if (b.delay > 0) continue;
          const dx = q.x - b.x, dy = q.y - b.y, r = b.size * 1.05, d2 = dx * dx + dy * dy;
          if (d2 < r * r) { const f = (r * r - d2) * 6 / (Math.sqrt(d2) + 0.5); ax += dx * f; ay += dy * f; }
        }
        q.vx = (q.vx + ax * dt) * Math.pow(0.0025, dt);
        q.vy = (q.vy + ay * dt) * Math.pow(0.0025, dt);
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (Math.abs(q.x - q.hx) < 0.8 && Math.abs(q.y - q.hy) < 0.8) intact++;
      }
      setCounter(this.fixed + ' · ' + Math.round(100 * intact / Math.max(1, this.p.length)) + '%');

      for (const c of this.crumbs) if (c.left <= 0) c.gone = (c.gone || 0) + dt;
      this.crumbs = this.crumbs.filter(c => !(c.gone > 1));
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter(r => r.t < 2.4);
      for (const p of this.bits) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
      this.bits = this.bits.filter(p => p.t < p.life);
    },
    draw(t) {
      for (const q of this.p) {
        if (q.eaten) continue;
        const wave = 0.62 + 0.38 * Math.sin(q.hx * 0.12 - t * 2.2 + q.hy * 0.05);
        const off = Math.min(1, Math.hypot(q.x - q.hx, q.y - q.hy) / 6);
        if (q.acc) lc.fillStyle = `rgba(255,90,31,${0.55 + 0.45 * wave})`;
        else lc.fillStyle = `rgba(242,239,232,${(0.5 + 0.5 * wave) * (1 - off * 0.4)})`;
        lc.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
      garden.draw.call({ rings: this.rings, crumbs: this.crumbs, bugs: this.bugs.filter(b => !(b.delay > 0)), bits: this.bits }, t);
    },
    down(x, y) {
      const hit = this.bugs.find(b => !(b.delay > 0) && dist(b.x, b.y, x, y) < b.size * 1.5 + 1);
      if (hit) {
        for (let i = 0; i < 26; i++) {
          const a = rand(0, Math.PI * 2), v = rand(4, 22);
          this.bits.push({ x: hit.x, y: hit.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(.5, 1.2),
            c: i % 3 ? (hit.kind === 'lady' ? '#ff6a2a' : '#cfc8bb') : '#f2efe8' });
        }
        for (const q of hit.ate) {   // everything it ate flies back into the name
          q.eaten = false; q.x = hit.x; q.y = hit.y;
          const a = rand(0, Math.PI * 2), v = rand(10, 40); q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v;
        }
        this.bugs.splice(this.bugs.indexOf(hit), 1);
        this.fixed++;
      } else {
        this.crumbs.push({ x, y, left: 1 });
        this.rings.push({ x, y, t: 0 });
        if (this.crumbs.length > 6) this.crumbs.shift();
        signal.down.call(this, x, y);
      }
    },
  };

  // ===================================================================== shell
  const scene = combo;
  let typeTimer = 0;

  function setCounter(v) { counterValue.textContent = v; }

  function typeStatus(text) {
    clearInterval(typeTimer);
    if (reduceMotion) { statusEl.textContent = text; return; }
    let i = 0;
    statusEl.textContent = '';
    typeTimer = setInterval(() => { statusEl.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typeTimer); }, 38);
  }

  const toCells = e => { const o = root.getBoundingClientRect(); return { x: (e.clientX - o.left) / CELL, y: (e.clientY - o.top) / CELL }; };
  root.addEventListener('pointermove', e => {
    const p = toCells(e);
    if (e.pointerType !== 'mouse') return;
    pointer.x = p.x; pointer.y = p.y; pointer.inside = true;
  });
  root.addEventListener('pointerleave', () => { pointer.inside = false; });
  root.addEventListener('pointerdown', e => {
    if (!ready || e.target.closest('a, button')) return;
    const p = toCells(e);
    scene.down(p.x, p.y);
    if (reduceMotion) frame(performance.now());
  });

  let last = performance.now(), raf = 0, running = false, visible = true, ready = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduceMotion) scene.update(dt);
    lc.clearRect(0, 0, cols, rows);
    scene.draw(now / 1000);
    present();
    raf = running ? requestAnimationFrame(frame) : 0;
  }
  function start() {
    if (!ready || running || reduceMotion || !visible || document.hidden) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  if ('IntersectionObserver' in window)
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); else stop(); }).observe(root);
  addEventListener('resize', () => { if (!ready) return; resize(); measureAvoid(); if (reduceMotion) frame(performance.now()); });

  const go = () => {
    resize();
    counterLabel.textContent = scene.counter;
    if (hintEl) hintEl.textContent = scene.hint;
    typeStatus(scene.status);
    scene.init();
    ready = true;
    if (reduceMotion) { setCounter('0 · 100%'); frame(performance.now()); } else start();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
})();
