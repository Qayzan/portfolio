/* Pixel signature: a name drawn as dithered square cells. Bugs walk in and eat cells;
   clicking a bug puts back what it ate. Self-contained, no dependencies.

   PixelSignature(canvas, {
     lines: ['FAUZAN', 'FAUZY'],    // one or two lines; the last line uses the accent colour
     cell: 6,                        // px per cell
     ink: [...4 colours], accent: [...4 colours],   // dark to bright (or light to dark on paper)
     font: '700 {size}px Switzer, sans-serif',
     bugs: 3,                        // bugs per wave
     align: 'left',                  // or 'center'
     onCount: (fixed, intactPct) => {}, onStatus: text => {}
   }) */
(function () {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  function turn(a, target, k) {
    let d = target - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * Math.min(1, k);
  }

  window.PixelSignature = function (canvas, opts) {
    const o = Object.assign({
      lines: ['FAUZAN', 'FAUZY'], cell: 6, bugs: 3, gap: 1,
      ink: ['#2E2C26', '#5E5A51', '#A29D92', '#F2EFE8'],
      accent: ['#4D1E0D', '#933615', '#E2571F', '#FF9B6B'],
      bugInk: '#8f8a80', bugHead: '#d7d1c6', bugShell: ['#ff5a1f', '#bcb6ab', '#7d786f'],
      font: '700 {size}px sans-serif', firstWaveAt: 2.4, scatter: 1, align: 'left', onCount: null, onStatus: null,
    }, opts || {});
    const ctx = canvas.getContext('2d');
    const low = document.createElement('canvas');
    const lc = low.getContext('2d', { willReadFrequently: true });
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COLORS = o.ink.concat(o.accent);
    const buckets = COLORS.map(() => []);
    let W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
    let p = [], bugs = [], bits = [], fixed = 0, t = 0, waveAt = o.firstWaveAt, wave = 0, warned = false;
    let running = false, visible = true, raf = 0, last = 0;
    const pointer = { x: -999, y: -999, inside: false };

    function size() {
      const r = canvas.getBoundingClientRect();
      if (Math.round(r.width) === W && Math.round(r.height) === H) return false;
      W = Math.round(r.width); H = Math.round(r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(8, Math.ceil(W / o.cell)); rows = Math.max(6, Math.ceil(H / o.cell));
      low.width = cols; low.height = rows;
      return true;
    }

    // Rasterise the name at grid resolution; every lit pixel becomes a particle with a home.
    function build() {
      const off = document.createElement('canvas');
      off.width = cols; off.height = rows;
      const c = off.getContext('2d');
      const n = o.lines.length;
      let fs = Math.floor(rows / (n * 1.08));
      c.textBaseline = 'alphabetic'; c.fillStyle = '#fff';
      const fit = () => { c.font = o.font.replace('{size}', fs); return Math.max(...o.lines.map(l => c.measureText(l).width)); };
      while (fs > 6 && fit() > cols - 2) fs--;
      const asc = fs * 0.74, lh = fs * 0.98;
      const top = Math.max(0, Math.floor((rows - (asc + lh * (n - 1))) / 2));
      const splits = [];
      o.lines.forEach((l, i) => { const y = top + asc + lh * i, x = o.align === 'center' ? Math.max(1, Math.round((cols - c.measureText(l).width) / 2)) : 1; c.fillText(l, x, y); splits.push(y); });
      const accentFrom = n > 1 ? splits[n - 2] + fs * 0.12 : Infinity;
      const d = c.getImageData(0, 0, cols, rows).data;
      p = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
        if (d[(y * cols + x) * 4 + 3] > 120)
          p.push({ hx: x, hy: y, x: reduce ? x : x + rand(-cols * .5, cols * .5) * o.scatter, y: reduce ? y : y + rand(-rows, rows) * o.scatter, vx: 0, vy: 0, acc: y > accentFrom, eaten: false });
      bugs = []; bits = [];
    }

    function makeBug() {
      const kinds = ['lady', 'lady', 'grey', 'dark'];
      const s = rand(2.6, 3.6) * Math.max(1, Math.min(1.6, rows / 30));
      const side = Math.floor(rand(0, 4));
      const x = side === 0 ? -s : side === 1 ? cols + s : rand(0, cols);
      const y = side === 2 ? -s : side === 3 ? rows + s : rand(0, rows);
      return { x, y, a: Math.atan2(rows / 2 - y, cols / 2 - x), speed: rand(3, 4.5), size: s, kind: kinds[Math.floor(rand(0, 4))],
        phase: rand(0, 9), ate: [], eat: rand(0, .3), target: null, retarget: 0, delay: 0, wob: 0 };
    }

    function status(text) { if (o.onStatus) o.onStatus(text); }

    function update(dt) {
      t += dt;
      if (waveAt != null && t >= waveAt) {
        waveAt = null;
        const n = Math.min(o.bugs + wave, o.bugs + 3);
        for (let i = 0; i < n; i++) { const b = makeBug(); b.delay = i * 0.5; bugs.push(b); }
        wave++;
        status(warned ? 'more bugs.' : 'bugs got in. click them.');
        warned = true;
      }
      if (waveAt == null && bugs.length === 0) { waveAt = t + 5; status('fixed. name restored.'); }

      for (const b of bugs) {
        if (b.delay > 0) { b.delay -= dt; continue; }
        b.phase += dt * b.speed * 1.6;
        let speed = b.speed;
        b.retarget -= dt;
        if (!b.target || b.target.eaten || b.retarget <= 0 || dist(b.x, b.y, b.target.hx, b.target.hy) < 1.5) {
          const free = p.filter(q => !q.eaten);
          b.target = free.length ? free[Math.floor(rand(0, free.length))] : null;
          b.retarget = rand(2, 5);
        }
        if (b.target) b.a = turn(b.a, Math.atan2(b.target.hy - b.y, b.target.hx - b.x), dt * 1.8);
        b.wob += rand(-1, 1) * dt * 2; b.wob *= 0.97; b.a += b.wob * dt;
        if (pointer.inside && dist(b.x, b.y, pointer.x, pointer.y) < 8) { b.a = turn(b.a, Math.atan2(b.y - pointer.y, b.x - pointer.x), dt * 6); speed *= 2.2; }
        b.x += Math.cos(b.a) * speed * dt; b.y += Math.sin(b.a) * speed * dt;
        b.eat -= dt;
        if (b.eat <= 0 && b.ate.length < 40) {
          b.eat = 0.24;
          const hx = b.x + Math.cos(b.a) * b.size * .8, hy = b.y + Math.sin(b.a) * b.size * .8;
          for (const q of p) if (!q.eaten && Math.abs(q.x - hx) < b.size * .7 && Math.abs(q.y - hy) < b.size * .7) { q.eaten = true; b.ate.push(q); break; }
        }
      }

      const pull = 26 * Math.min(1, 0.15 + t / 1.6);
      let intact = 0;
      for (const q of p) {
        if (q.eaten) continue;
        let ax = (q.hx - q.x) * pull, ay = (q.hy - q.y) * pull;
        if (pointer.inside) {
          const dx = q.x - pointer.x, dy = q.y - pointer.y, d2 = dx * dx + dy * dy;
          if (d2 < 36) { const f = (36 - d2) * 9 / (Math.sqrt(d2) + .5); ax += dx * f; ay += dy * f; }
        }
        for (const b of bugs) {
          if (b.delay > 0) continue;
          const dx = q.x - b.x, dy = q.y - b.y, r = b.size * 1.05, d2 = dx * dx + dy * dy;
          if (d2 < r * r) { const f = (r * r - d2) * 6 / (Math.sqrt(d2) + .5); ax += dx * f; ay += dy * f; }
        }
        q.vx = (q.vx + ax * dt) * Math.pow(0.0025, dt);
        q.vy = (q.vy + ay * dt) * Math.pow(0.0025, dt);
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (Math.abs(q.x - q.hx) < .8 && Math.abs(q.y - q.hy) < .8) intact++;
      }
      for (const s of bits) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .95; s.vy *= .95; }
      bits = bits.filter(s => s.t < s.life);
      if (o.onCount) o.onCount(fixed, Math.round(100 * intact / Math.max(1, p.length)));
    }

    function drawBug(b) {
      const s = b.size;
      lc.save(); lc.translate(b.x, b.y); lc.rotate(b.a);
      lc.strokeStyle = o.bugInk; lc.lineWidth = Math.max(.6, s * .16); lc.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const lx = (i - 1) * s * .45, sw = Math.sin(b.phase + i * 2.1) * s * .25;
        for (const side of [-1, 1]) {
          const k = side * (i % 2 ? -1 : 1);
          lc.beginPath(); lc.moveTo(lx, side * s * .4); lc.lineTo(lx + sw * k * .6, side * s * .85); lc.lineTo(lx + sw * k + (i - 1) * s * .3, side * s * 1.2); lc.stroke();
        }
      }
      lc.fillStyle = o.bugHead; lc.beginPath(); lc.ellipse(s * .75, 0, s * .32, s * .34, 0, 0, Math.PI * 2); lc.fill();
      lc.fillStyle = b.kind === 'lady' ? o.bugShell[0] : b.kind === 'grey' ? o.bugShell[1] : o.bugShell[2];
      lc.beginPath(); lc.ellipse(0, 0, s * .8, s * .66, 0, 0, Math.PI * 2); lc.fill();
      lc.globalCompositeOperation = 'destination-out';
      lc.fillRect(-s * .75, -s * .05, s * 1.2, s * .1);
      if (b.kind === 'lady') for (const [sx, sy] of [[.2, .32], [-.3, .3]]) for (const side of [-1, 1]) { lc.beginPath(); lc.arc(sx * s, side * sy * s, s * .14, 0, Math.PI * 2); lc.fill(); }
      lc.globalCompositeOperation = 'source-over';
      lc.restore();
    }

    function draw(time) {
      lc.clearRect(0, 0, cols, rows);
      for (const q of p) {
        if (q.eaten) continue;
        const w = 0.62 + 0.38 * Math.sin(q.hx * .14 - time * 2.2 + q.hy * .05);
        lc.fillStyle = q.acc ? `rgba(255,90,31,${.55 + .45 * w})` : `rgba(242,239,232,${.5 + .5 * w})`;
        lc.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
      for (const b of bugs) if (!(b.delay > 0)) drawBug(b);
      for (const s of bits) { lc.globalAlpha = 1 - s.t / s.life; lc.fillStyle = s.c; lc.fillRect(s.x, s.y, 1, 1); }
      lc.globalAlpha = 1;
      present();
    }

    // Low-res image to dithered cells. Colour comes from the palette, never from the source pixel.
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
          const acc = mx - mn > 70 && r > b + 40;
          const v = (acc ? mx / 255 : (0.299 * r + 0.587 * g + 0.114 * b) / 255) * (a / 255) * 4;
          let lv = Math.floor(v);
          if (v - lv > BAYER[by + (x & 3)]) lv++;
          if (lv <= 0) continue;
          buckets[(acc ? 4 : 0) + Math.min(4, lv) - 1].push(x, y);
        }
      }
      ctx.clearRect(0, 0, W, H);
      const s = o.cell - o.gap;
      for (let k = 0; k < buckets.length; k++) {
        const list = buckets[k];
        if (!list.length) continue;
        ctx.fillStyle = COLORS[k];
        ctx.beginPath();
        for (let j = 0; j < list.length; j += 2) ctx.rect(list[j] * o.cell, list[j + 1] * o.cell, s, s);
        ctx.fill();
      }
    }

    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      update(dt); draw(now / 1000);
      raf = running ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }

    const cellAt = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / o.cell, y: (e.clientY - r.top) / o.cell }; };
    canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; Object.assign(pointer, cellAt(e), { inside: true }); });
    canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
    canvas.addEventListener('pointerdown', e => {
      const c = cellAt(e);
      const hit = bugs.find(b => !(b.delay > 0) && dist(b.x, b.y, c.x, c.y) < b.size * 1.6 + 1.5);
      if (hit) {
        for (let i = 0; i < 18; i++) { const a = rand(0, 6.28), v = rand(4, 18); bits.push({ x: hit.x, y: hit.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(.4, 1), c: i % 2 ? '#ff6a2a' : '#f2efe8' }); }
        for (const q of hit.ate) { q.eaten = false; q.x = hit.x; q.y = hit.y; const a = rand(0, 6.28), v = rand(8, 30); q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v; }
        bugs.splice(bugs.indexOf(hit), 1); fixed++;
      } else {
        for (const q of p) { const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy); if (d < 14) { const f = (14 - d) * 8; q.vx += dx / (d + .1) * f; q.vy += dy / (d + .1) * f; } }
      }
      if (reduce) draw(performance.now() / 1000);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (size()) { build(); if (reduce) draw(0); } }).observe(canvas);

    const go = () => { size(); build(); if (reduce) { draw(0); if (o.onCount) o.onCount(0, 100); } else start(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    return { stop, start };
  };
})();
