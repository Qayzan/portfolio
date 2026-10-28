/* FAUZ OS: the power button, POST, BIOS Setup, splash screen and desktop.
   Plain JavaScript, no dependencies. The BIOS, its vendor and its logo are made up; the screens
   follow the text mode BIOS of a late 1990s PC: 80 by 25 characters, 16 VGA colours,
   an 8x16 bitmap font, and keyboard only (here the mouse works too). */
(function () {
  'use strict';
  const D = window.PORTFOLIO;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = () => innerWidth <= 700;
  const T0 = Date.now();
  const short = l => l.title.split(':')[0];
  const ENGINE = { hollows: 'C++20', 'hot-potato': 'JS', eduvision: 'UNITY 6', 'heavy-assault': 'C/C++', 'room-checker': 'PYTHON' };
  let bugsFixed = 0;

  // ------------------------------------------------------------------ settings (kept in localStorage when allowed)
  const DEF = { sound: true, scanlines: true, quickpost: false, dragfull: false, cursors: true, activated: false, wall: 'bugs', saver: 'stars', wait: 2 };
  const BIOS_KEYS = ['sound', 'scanlines', 'quickpost'];
  const S = Object.assign({}, DEF);
  const enc = v => typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  const dec = (k, v) => typeof DEF[k] === 'boolean' ? v === '1' : typeof DEF[k] === 'number' ? (+v || DEF[k]) : v;
  Object.keys(DEF).forEach(k => { try { const v = localStorage.getItem('fauzos.' + k); if (v !== null) S[k] = dec(k, v); } catch (e) { /* private mode */ } });
  function setSetting(k, v) {
    S[k] = typeof DEF[k] === 'boolean' ? !!v : v;
    try { localStorage.setItem('fauzos.' + k, enc(S[k])); } catch (e) { /* private mode */ }
    applySettings();
  }

  // ------------------------------------------------------------------ sound: everything is synthesised, no audio files
  const Snd = (() => {
    let ac = null, out = null, fan = null, noise = null;
    function ctx() {
      if (!S.sound) return null;
      try {
        if (!ac) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return null;
          ac = new C(); out = ac.createGain(); out.gain.value = .55; out.connect(ac.destination);
        }
        if (ac.state === 'suspended') ac.resume();
      } catch (e) { return null; }
      return ac;
    }
    function buf() {
      if (noise) return noise;
      const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return (noise = b);
    }
    function env(g, t, a, peak, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    const api = {
      unlock() { ctx(); },
      // PC speaker: a square wave, as flat as the real thing
      beep(f = 1000, dur = .15) {
        const a = ctx(); if (!a) return;
        const t = a.currentTime + .01, o = a.createOscillator(), g = a.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.045, t + .004);
        g.gain.setValueAtTime(.045, t + dur - .01); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .02);
      },
      // hard disk head seeks: short filtered clicks
      seek(n = 1) {
        const a = ctx(); if (!a) return;
        let t = a.currentTime + .01;
        for (let i = 0; i < n; i++) {
          const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
          s.buffer = buf(); f.type = 'bandpass'; f.frequency.value = 1600 + Math.random() * 2400; f.Q.value = 2.2;
          env(g, t, .001, .3, .014 + Math.random() * .02);
          s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + .05);
          t += .025 + Math.random() * .08;
        }
      },
      // the power switch
      thunk() {
        const a = ctx(); if (!a) return;
        const t = a.currentTime + .01, o = a.createOscillator(), g = a.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .16);
        env(g, t, .002, .45, .24); o.connect(g); g.connect(out); o.start(t); o.stop(t + .26);
        api.seek(1);
      },
      fanOn() {
        const a = ctx(); if (!a || fan) return;
        const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        s.buffer = buf(); s.loop = true; f.type = 'lowpass'; f.frequency.value = 360;
        g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.linearRampToValueAtTime(.05, a.currentTime + 1.4);
        s.connect(f); f.connect(g); g.connect(out); s.start(); fan = { s, g };
      },
      fanOff(sec = 1.2) {
        if (!fan || !ac) return;
        const { s, g } = fan; fan = null;
        const t = ac.currentTime;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(.0001, g.gain.value), t);
        g.gain.linearRampToValueAtTime(0.0001, t + sec); s.stop(t + sec + .05);
      },
      // start up and shut down: an original five note figure over a low fifth
      chime(down) {
        const a = ctx(); if (!a) return;
        const t0 = a.currentTime + .04, dl = a.createDelay(1), fb = a.createGain(), wet = a.createGain();
        dl.delayTime.value = .23; fb.gain.value = .3; wet.gain.value = .3;
        dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(out);
        const notes = [261.63, 392, 523.25, 659.25, 783.99];
        if (down) notes.reverse();
        notes.forEach((f, i) => {
          const t = t0 + i * (down ? .17 : .11), o = a.createOscillator(), g = a.createGain();
          o.type = 'triangle'; o.frequency.value = f; env(g, t, .012, .085, 1.5);
          o.connect(g); g.connect(out); g.connect(dl); o.start(t); o.stop(t + 1.6);
        });
        (down ? [196, 130.81] : [130.81, 196]).forEach(f => {
          const o = a.createOscillator(), g = a.createGain();
          o.type = 'sine'; o.frequency.value = f; env(g, t0, .3, .05, 2.3);
          o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 2.4);
        });
        setTimeout(() => { try { wet.disconnect(); dl.disconnect(); } catch (e) { /* already gone */ } }, 4000);
      },
      // desktop clicks: a mouse button tick plus a small woody body. Opening ends with a short disk seek.
      click(kind) {
        const a = ctx(); if (!a) return;
        const t0 = a.currentTime + .005;
        const tick = (t, freq, peak, dur, body) => {
          const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
          s.buffer = buf(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3.5;
          env(g, t, .0008, peak, dur);
          s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + .02);
          const o = a.createOscillator(), og = a.createGain();
          o.type = 'triangle'; o.frequency.setValueAtTime(body, t); o.frequency.exponentialRampToValueAtTime(body * .6, t + .03);
          env(og, t, .001, peak * .35, .035);
          o.connect(og); og.connect(out); o.start(t); o.stop(t + .05);
        };
        if (kind === 'close') {
          tick(t0, 2400, .26, .014, 520);
          tick(t0 + .055, 1500, .18, .018, 380);
        } else {
          tick(t0, 3400, .28, .011, 900);
          tick(t0 + .07, 2300, .22, .013, 700);
          setTimeout(() => api.seek(2), 120);
        }
      },
      // a tiny tick for game tiles
      tick(f = 2600) {
        const a = ctx(); if (!a) return;
        const t = a.currentTime + .003, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
        s.buffer = buf(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 4;
        env(g, t, .0005, .16, .012); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + .03);
      },
      // error box: two flat square tones
      err() {
        const a = ctx(); if (!a) return;
        const t = a.currentTime + .01;
        [[440, 0], [311, .12]].forEach(([f, d]) => {
          const o = a.createOscillator(), g = a.createGain();
          o.type = 'square'; o.frequency.value = f; env(g, t + d, .004, .035, .24);
          o.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + .27);
        });
      },
      // a bug got you: a low thump with grit
      boom() {
        const a = ctx(); if (!a) return;
        const t = a.currentTime + .01, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        s.buffer = buf(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(120, t + .5);
        env(g, t, .003, .5, .55); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + .6);
        const o = a.createOscillator(), og = a.createGain();
        o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + .4);
        env(og, t, .003, .4, .45); o.connect(og); og.connect(out); o.start(t); o.stop(t + .5);
      },
      // a win: four quick rising notes
      tada() {
        const a = ctx(); if (!a) return;
        const t0 = a.currentTime + .02;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const o = a.createOscillator(), g = a.createGain(), t = t0 + i * .085;
          o.type = 'square'; o.frequency.value = f; env(g, t, .004, .03, i === 3 ? .5 : .14);
          o.connect(g); g.connect(out); o.start(t); o.stop(t + .55);
        });
      },
      hush() { api.fanOff(.1); },
    };
    return api;
  })();

  // ------------------------------------------------------------------ text mode screen
  const crt = $('#crt'), page = $('#page'), scr = $('#screen'), say = $('#crt-say');
  let COLS = 80, ROWS = 25, G = [], hits = [];
  function measure(keepCols) {
    if (!keepCols) COLS = innerWidth < 660 ? 40 : 80;
    const sy = 1.2;   // text mode pixels were taller than wide on a 4:3 tube
    const k0 = Math.min(innerWidth * .96 / (COLS * 8), (innerHeight - (small() ? 64 : 24)) * .96 / (ROWS * 16 * sy));
    const k = COLS === 40 ? Math.min(2, k0) : (k0 >= 1 ? Math.floor(k0 * 2) / 2 : k0);
    crt.style.setProperty('--fs', (16 * k) + 'px');
    crt.style.setProperty('--cols', COLS);
    crt.style.setProperty('--sy', sy);
  }
  function cls() {
    G = [];
    for (let y = 0; y < ROWS; y++) { const r = []; for (let x = 0; x < COLS; x++) r.push([' ', '']); G.push(r); }
    hits = [];
  }
  function put(x, y, s, c) {
    s = String(s);
    if (y < 0 || y >= ROWS) return;
    for (let i = 0; i < s.length; i++) { const xx = x + i; if (xx >= 0 && xx < COLS) G[y][xx] = [s[i], c || '']; }
  }
  const mid = (s, w, x0) => (x0 || 0) + Math.max(0, Math.floor(((w || COLS) - s.length) / 2));
  const center = (y, s, c) => put(mid(s), y, s, c);
  function fill(x, y, w, h, c) { for (let j = 0; j < h; j++) put(x, y + j, ' '.repeat(w), c); }
  function box(x, y, w, h, c, dbl) {
    const k = dbl ? '╔╗╚╝═║' : '┌┐└┘─│';
    put(x, y, k[0] + k[4].repeat(w - 2) + k[1], c);
    for (let j = 1; j < h - 1; j++) { put(x, y + j, k[5], c); put(x + w - 1, y + j, k[5], c); }
    put(x, y + h - 1, k[2] + k[4].repeat(w - 2) + k[3], c);
  }
  const rule = (y, c, x, w) => put(x || 0, y, '├' + '─'.repeat((w || COLS) - 2) + '┤', c);
  const hit = (x, y, w, fn) => hits.push({ x, y, w, fn });
  function wrap(text, w) {
    const out = []; let line = '';
    String(text).split(/\s+/).forEach(word => {
      if (!word) return;
      if ((line + ' ' + word).trim().length > w) { if (line) out.push(line); line = word; } else line = (line + ' ' + word).trim();
    });
    if (line) out.push(line);
    return out;
  }
  function paint() {
    let html = '';
    for (let y = 0; y < ROWS; y++) {
      let cur = null, b = '';
      const flush = () => { if (b) html += cur ? `<span class="${cur}">${esc(b)}</span>` : esc(b); b = ''; };
      for (let x = 0; x < COLS; x++) { const [ch, c] = G[y][x]; if (c !== cur) { flush(); cur = c; } b += ch; }
      flush();
      if (y < ROWS - 1) html += '\n';
    }
    scr.innerHTML = html;
  }
  function cellAt(e) {
    const r = page.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / r.width * COLS), y: Math.floor((e.clientY - r.top) / r.height * ROWS) };
  }
  const hitAt = c => hits.find(h => c.y === h.y && c.x >= h.x && c.x < h.x + h.w);
  page.addEventListener('click', e => { const h = hitAt(cellAt(e)); if (h) h.fn(); });
  page.addEventListener('pointermove', e => { page.style.cursor = hitAt(cellAt(e)) ? 'pointer' : ''; });

  // ------------------------------------------------------------------ boot flow
  let mode = 'power', run = 0, paused = false, wantSetup = false, skipMem = false, allowSetup = false, booted = false;
  const STOP = { stop: 1 }, SETUP = { setup: 1 };
  const speed = () => (S.quickpost ? 3 : 1) * (reduce ? 3 : 1);
  async function wait(ms, my) {
    let t = 0;
    do {
      await sleep(Math.min(30, Math.max(ms, 1)));
      if (my !== run) throw STOP;
      if (allowSetup && wantSetup) throw SETUP;
      if (!paused) t += 30 * speed();
    } while (t < ms);
  }
  function hideAll() {
    ['#power', '#crt', '#splash', '#halt', '#post-skip'].forEach(s => { $(s).hidden = true; });
  }

  const BUG = [' ▀▄▄▀ ', '▀████▀'];
  const FZ = ['█▀▀▀▀ ▀▀▀▀█', '█▀▀▀    ▄▀ ', '█     ▄█▄▄▄'];
  const DRIVES = () => D.levels.map(l => short(l).toUpperCase());

  function badge() {
    if (COLS === 80) {
      const x = 63;
      box(x, 0, 15, 6, 'c-g');
      FZ.forEach((r, i) => put(x + 2, 1 + i, r, 'c-g'));
      put(x + 3, 4, 'GAME READY', 'c-g');
    } else FZ.forEach((r, i) => put(COLS - 11, i, r, 'c-g'));
  }
  function postFooter(memDone) {
    const N = COLS === 40;
    fill(0, 22, COLS, 2, '');
    const del = coarse ? 'Tap here to enter SETUP' : (N ? 'Press DEL to enter SETUP' : 'Press DEL to enter SETUP' + (memDone ? '' : ', ESC to skip memory test'));
    const y = N ? 22 : 23;
    put(0, y, del);
    hit(0, y, del.length, () => { wantSetup = true; });
    if (N && !memDone) {
      const s = coarse ? 'Tap here to skip memory test' : 'ESC to skip memory test';
      put(0, 23, s); hit(0, 23, s.length, () => { skipMem = true; });
    }
    put(0, 24, N ? '10/27/26-FZ26-2A69KF0ZC-00' : '10/27/26-FZ26-PORTFOLIO-2A69KF0ZC-00');
  }

  async function vgaBios(my) {
    cls(); paint(); await wait(450, my);
    put(0, 0, 'FZ Graphics VGA BIOS Version 1.02');
    put(0, 1, 'Copyright (C) 2026 FAUZ Software, Inc.');
    put(0, 2, 'Video Memory : 8192K');
    put(0, 4, '_', 'blink');
    paint(); await wait(900, my);
  }

  async function post(my, autoSetup) {
    const N = COLS === 40, tx = N ? 7 : 8, names = DRIVES();
    say.textContent = 'Power on self test. Press Delete for BIOS Setup, or use Skip to desktop.';
    cls(); badge();
    put(0, 0, BUG[0], 'c-c'); put(0, 1, BUG[1], 'c-c');
    put(tx, 0, N ? 'FAUZ BIOS v4.51FF' : 'FAUZ Modular BIOS v4.51FF, An Energy-Saving Ally');
    put(tx, 1, N ? '(C) 2026 FAUZ Soft' : 'Copyright (C) 2026, FAUZ Software, Inc.');
    let y = N ? 4 : 3;
    put(0, y, N ? 'FZ6 PORTFOLIO BIOS Rev 1026' : 'FZ6 PORTFOLIO ACPI BIOS Revision 1026');
    postFooter(false); paint();
    allowSetup = true;
    await wait(550, my);
    y += 2; put(0, y, N ? 'FZ-26 Engine 3600MHz' : 'FZ-26 Engine 3600MHz Processor'); paint();
    await wait(350, my);
    y += 1;
    const lab = 'Memory Test : ';
    for (let k = 0; k <= 16384; k += 256) {
      if (skipMem || S.quickpost || reduce) k = 16384;
      put(0, y, lab + String(k).padStart(6) + 'K'); put(lab.length + 7, y, '_', 'blink');
      paint(); await wait(16, my);
    }
    put(0, y, lab + ' 16384K OK '); postFooter(true); paint();
    await wait(450, my);

    y += 2;
    put(0, y, N ? 'Plug and Play Extension v1.0A' : 'FAUZ Plug and Play BIOS Extension v1.0A');
    if (!N) put(0, y + 1, 'Copyright (C) 2026, FAUZ Software, Inc.');
    paint(); await wait(400, my);
    y += 2;
    const ch = N ? ['Pri Master : ', 'Pri Slave  : ', 'Sec Master : ', 'Sec Slave  : ', 'USB Device : ']
      : ['  Detecting IDE Primary Master   ... ', '  Detecting IDE Primary Slave    ... ', '  Detecting IDE Secondary Master ... ', '  Detecting IDE Secondary Slave  ... ', '  Detecting USB Mass Storage     ... '];
    for (let i = 0; i < ch.length; i++) {
      put(0, y + i, ch[i]); put(ch[i].length, y + i, '_', 'blink'); paint();
      Snd.seek(3);
      await wait(280 + Math.random() * 160, my);
      put(ch[i].length, y + i, names[i] || 'None'); paint();
    }
    await wait(650, my);
    if (autoSetup) throw SETUP;
    allowSetup = false;
  }

  async function config(my) {
    const N = COLS === 40;
    allowSetup = false;
    say.textContent = 'System configuration. Starting FAUZ OS.';
    cls();
    const L = (s, w) => s.padEnd(w) + ': ';
    const eng = id => ENGINE[id] || '';
    const disk = i => { const l = D.levels[i]; return l ? short(l).toUpperCase() + (N ? '' : ', ' + eng(l.id)) : 'None'; };
    if (!N) {
      center(0, 'FAUZ Software, Inc.'); center(1, 'System Configurations');
      box(0, 2, 80, 12, '');
      const left = [['CPU Type', 'FZ-26 ENGINE'], ['Co-Processor', 'Installed'], ['CPU Clock', '3600MHz'], null,
        ['Diskette Drive A', '1.44M, 3.5 in.'], ['Diskette Drive B', 'None'], ['Pri. Master Disk', disk(0)], ['Pri. Slave  Disk', disk(1)], ['Sec. Master Disk', disk(2)], ['Sec. Slave  Disk', disk(3)]];
      const right = [['Base Memory', '   640K'], ['Extended Memory', ' 15360K'], ['Cache Memory', '   512K'], null,
        ['Display Type', 'EGA/VGA'], ['Serial Port(s)', '3F8 2F8'], ['Parallel Port(s)', '378'], ['DRAM Type', 'SDRAM'], ['SDRAM at Bank', '0 1'], ['Owner', 'FAUZAN FAUZY']];
      left.forEach((r, i) => {
        if (!r) { rule(3 + i, ''); return; }
        put(2, 3 + i, L(r[0], 17) + r[1]);
        put(43, 3 + i, L(right[i][0], 17) + right[i][1]);
      });
    } else {
      center(0, 'System Configurations');
      box(0, 1, 40, 12, '');
      const rows = [['CPU Type', 'FZ-26 ENGINE'], ['CPU Clock', '3600MHz'], ['Memory', '16384K'], ['Display', 'EGA/VGA'], null,
        ['Pri Master', disk(0)], ['Pri Slave', disk(1)], ['Sec Master', disk(2)], ['Sec Slave', disk(3)], ['USB', disk(4)]];
      rows.forEach((r, i) => { if (!r) rule(2 + i, ''); else put(2, 2 + i, L(r[0], 11) + r[1]); });
    }
    paint(); Snd.beep(); await wait(600, my);

    const pci = [[0, 7, 1, 'FA02', '0AD1', 'Multimedia Device', 11], [0, 9, 0, 'FA02', 'C011', 'Collision Controller', 10],
      [0, 11, 0, 'FA02', '5AFE', 'Save Controller', 9], [0, 12, 0, 'FA02', '50C7', 'Network Controller', 5], [1, 0, 0, 'FA02', '0FA0', 'Display Controller', 11]];
    let y = N ? 14 : 15;
    put(0, y, 'PCI device listing.....'); paint(); await wait(300, my);
    if (!N) {
      put(0, y + 1, 'Bus No. Device No. Func No. Vendor ID Device ID Device Class          IRQ');
      put(0, y + 2, '-'.repeat(79));
    } else {
      put(0, y + 1, 'Dev Vend Devi Device Class         IRQ');
      put(0, y + 2, '-'.repeat(39));
    }
    paint();
    for (let i = 0; i < pci.length; i++) {
      const [b, d, f, v, id, cl, irq] = pci[i], ry = y + 3 + i;
      if (!N) { put(3, ry, String(b)); put(12, ry, String(d).padStart(2)); put(22, ry, String(f)); put(30, ry, v); put(40, ry, id); put(49, ry, cl); put(72, ry, String(irq).padStart(3)); }
      else { put(0, ry, String(d).padStart(3)); put(4, ry, v); put(9, ry, id); put(14, ry, cl); put(36, ry, String(irq).padStart(3)); }
      paint(); await wait(110, my);
    }
    const vy = N ? 22 : 23;
    let dots = 'Verifying DMI Pool Data ';
    for (let i = 0; i < 8; i++) { dots += '.'; put(0, vy, dots); paint(); if (i % 3 === 0) Snd.seek(2); await wait(120, my); }
    put(0, 24, 'Starting FAUZ OS...'); put(19, 24, '_', 'blink'); paint();
    Snd.seek(4);
    await wait(800, my);
    cls(); put(0, 0, '_', 'blink'); paint();
    await wait(350, my);
  }

  async function splash(my) {
    mode = 'splash';
    crt.hidden = true;
    const sp = $('#splash'), bar = $('#splash-bar');
    sp.hidden = false;
    say.textContent = '';
    const sig = window.PixelSignature($('#splash-sig'), {
      lines: ['FAUZAN', 'FAUZY'], cell: small() ? 4 : 6, bugs: 1, firstWaveAt: 999, align: 'center', scatter: .18,
      font: '700 {size}px "IBM Plex Mono", monospace',
    });
    bar.innerHTML = '';
    const n = Math.max(8, Math.floor((bar.clientWidth - 6 + 3) / 15));
    const total = 2000;
    try {
      for (let i = 0; i < n; i++) {
        bar.insertAdjacentHTML('beforeend', '<i></i>');
        if (Math.random() < .35) Snd.seek(2);
        await wait(total / n * (0.5 + Math.random()), my);
      }
      await wait(300, my);
    } finally { sig.stop(); }
  }

  async function boot(o) {
    o = o || {};
    const my = ++run;
    mode = 'post'; wantSetup = false; skipMem = false; paused = false; allowSetup = false;
    closeAll(); hideMenus(); hideAll(); $('#os').hidden = true;
    crt.classList.remove('setup');
    measure(); crt.hidden = false;
    if (!reduce) { crt.classList.remove('warm'); void crt.offsetWidth; crt.classList.add('warm'); }
    $('#post-skip').hidden = false;
    Snd.fanOn();
    try {
      if (o.vga !== false) await vgaBios(my);
      await post(my, o.setup);
      await config(my);
      await splash(my);
      desktop(o.open);
    } catch (e) {
      if (e === SETUP) { allowSetup = false; enterSetup(); } else if (e !== STOP) throw e;
    }
  }
  async function resume(openId) {
    const my = ++run;
    mode = 'post'; crt.classList.remove('setup'); clearInterval(setupTimer);
    measure(true);
    try { await config(my); await splash(my); desktop(openId); } catch (e) { if (e !== STOP) throw e; }
  }

  // ------------------------------------------------------------------ BIOS Setup
  const lv = id => D.levels.find(l => l.id === id);
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const dateStr = () => new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Singapore' }).replace(/,/g, '');
  const timeStr = () => new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Singapore' }).split(':').join(' : ');
  const uptime = () => { const s = Math.floor((Date.now() - T0) / 1000); return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`; };
  const MENU = [
    { t: 'STANDARD CMOS SETUP', d: 'Time, Date, Owner, School', go: 'std' },
    { t: 'BIOS FEATURES SETUP', d: 'Boot Sequence, Quick Power On Self Test', go: 'bios' },
    { t: 'CHIPSET FEATURES SETUP', d: 'Languages, Engines, Tools', go: 'chip' },
    { t: 'POWER MANAGEMENT SETUP', d: 'Availability for a Placement', go: 'power' },
    { t: 'PNP/PCI CONFIGURATION', d: 'Email, LinkedIn, GitHub', go: 'pnp' },
    { t: 'LOAD BIOS DEFAULTS', d: 'Load BIOS Defaults except Standard CMOS SETUP', ask: 'Load BIOS Defaults (Y/N)? ', def: 'N', act: 'defaults' },
    { t: 'LOAD SETUP DEFAULTS', d: 'Load SETUP Defaults except Standard CMOS SETUP', ask: 'Load SETUP Defaults (Y/N)? ', def: 'N', act: 'defaults' },
    { t: 'INTEGRATED PERIPHERALS', d: 'Audio, Physics, Saves, Input', go: 'periph' },
    { t: 'PC HEALTH STATUS', d: 'Commits, Projects, Bugs Fixed', go: 'health' },
    { t: 'FREQUENCY/VOLTAGE CONTROL', d: 'Sound, Scanlines', go: 'freq' },
    { t: 'IDE HDD AUTO DETECTION', d: 'Detect Projects on Every Channel', go: 'ide' },
    { t: 'SAVE & EXIT SETUP', d: 'Save Data to CMOS & Exit SETUP', ask: 'SAVE to CMOS and EXIT (Y/N)? ', def: 'Y', act: 'save' },
    { t: 'EXIT WITHOUT SAVING', d: 'Abandon all Data & Exit SETUP', ask: 'Quit Without Saving (Y/N)? ', def: 'N', act: 'quit' },
  ];
  const mail = 'fauzan0410@gmail.com';
  const PAGES = {
    std: { title: 'STANDARD CMOS SETUP', items: () => [
      { l: 'Date (mm:dd:yy)', s: 'Date', v: dateStr, h: 'Today, in Singapore.' },
      { l: 'Time (hh:mm:ss)', s: 'Time', v: timeStr, h: 'Singapore time, UTC+8.' },
      { l: 'Owner', v: 'Fauzan Fauzy', h: 'Game and software programmer.' },
      { l: 'Location', v: 'Singapore' },
      { l: 'School', v: 'DigiPen and SIT', h: 'DigiPen Institute of Technology Singapore, with the Singapore Institute of Technology.' },
      { l: 'Course', v: 'CS (RTIS)', h: 'BSc Computer Science in Real Time Interactive Simulation, 2024 to 2028.' },
      { l: 'Year', v: 'Third' },
      { l: 'Before This', s: 'Before', v: 'SCDF Instructor', h: 'Firefighting instructor with the Singapore Civil Defence Force, 2022 to 2024.' },
      { l: 'Internship', v: 'Beyondsoft, 2021', h: 'Product testing intern on Razer products.' },
      { l: 'Diploma', v: 'NYP, 2019 to 2022', h: 'Diploma in Business and Financial Technology, Nanyang Polytechnic.' },
    ] },
    bios: { title: 'BIOS FEATURES SETUP', items: () => [
      { l: 'Quick Power On Self Test', s: 'Quick POST', k: 'quickpost', h: 'Enabled skips the memory count and starts up about three times faster.' },
      ...D.levels.map((L, i) => ({ l: ORD[i] + ' Boot Device', s: ORD[i] + ' Boot', v: short(L), boot: L.id, h: L.tagline + ' Press Enter to boot straight into it.' })),
      { l: 'Boot Up NumLock Status', s: 'NumLock', v: 'On', h: 'It is always on.' },
    ] },
    chip: { title: 'CHIPSET FEATURES SETUP', items: () => [
      { l: 'C++20', h: 'The Hollows engine, and Heavy Assault alongside C.' },
      { l: 'C#', h: 'EduVision, in Unity 6.' },
      { l: 'JavaScript', h: 'Hot Potato, client and server, and The Wardrobe.' },
      { l: 'Python', h: 'SIT Room Checker, the Song of the Day bot and the Heavy Assault leaderboard helper.' },
      { l: 'Java', h: 'The Android text to speech bridge in EduVision.' },
      { l: 'SQL', h: 'In the toolbox.' },
      { l: 'Unity 6', h: 'EduVision, an Android app for a team of seven.' },
      { l: 'FMOD', h: 'The Hollows audio engine and mixer.' },
      { l: 'ImGui', h: 'Editors for the Hollows audio mixer, cutscenes, bindings and build size.' },
      { l: 'WebSockets', h: 'Live rooms in Hot Potato.' },
      { l: 'Git and Jira', s: 'Git, Jira', h: 'Every team project.' },
    ] },
    power: { title: 'POWER MANAGEMENT SETUP', items: () => [
      { l: 'Power Management', s: 'Power', v: 'User Define' },
      { l: 'IWSP Placement', s: 'IWSP', v: 'Looking', h: 'Looking for an Integrated Work Study Programme placement.' },
      { l: 'Available From', s: 'From', v: '03 May 2027' },
      { l: 'Available To', s: 'To', v: '07 Apr 2028' },
      { l: 'Wake Up On Email', s: 'Wake On Email', v: 'Enabled', href: 'mailto:' + mail, h: 'Press Enter to write to ' + mail + '.' },
    ] },
    pnp: { title: 'PNP/PCI CONFIGURATION', items: () => [
      { l: 'Email', v: mail, href: 'mailto:' + mail, h: 'Press Enter to write an email.' },
      { l: 'LinkedIn', v: 'in/fauz', href: 'https://www.linkedin.com/in/fauz/', h: 'Press Enter to open LinkedIn in a new tab.' },
      { l: 'GitHub', v: 'Qayzan', href: 'https://github.com/Qayzan', h: 'Press Enter to open GitHub in a new tab.' },
      { l: 'Hot Potato', v: 'Play online', href: 'https://hot-potato-browser.onrender.com/', h: 'Free hosting, so the first load can take a few seconds.' },
      { l: 'Hollows Case Study', s: 'Hollows Study', v: 'Read online', href: 'https://qayzan.github.io/hollows-case-study/' },
      { l: 'Plain Version', s: 'Plain Site', v: 'classic.html', href: 'classic.html', self: true, h: 'The same portfolio as a normal web page.' },
    ] },
    periph: { title: 'INTEGRATED PERIPHERALS', items: () => [
      { l: 'Onboard Audio (FMOD)', s: 'Audio (FMOD)', h: 'Hollows: buses, scene crossfades, 3D monster sounds and a chase mix, all driven by JSON.' },
      { l: 'Anti Pop Fades', s: 'Anti Pop', h: 'Hollows: sample accurate 140 ms fades on the audio clock. No more clicks.' },
      { l: 'Collision Grid', s: 'Collision', h: 'Hollows: a broad phase grid of 128 pixel cells.' },
      { l: 'Cloud Saves', h: 'Hollows: Supabase REST called straight from C++ with WinHTTP. No server to run.' },
      { l: 'Gamepad Remap', h: 'Hollows: rebindable controls with unit tests.' },
      { l: 'Text To Speech', s: 'Speech', h: 'EduVision: Android, Windows and editor versions behind one C# interface.' },
      { l: 'Online Leaderboard', s: 'Leaderboard', h: 'Heavy Assault: a Google Apps Script API, called on a background thread.' },
      { l: 'Live Rooms', h: 'Hot Potato: two to four players over WebSockets.' },
    ] },
    health: { title: 'PC HEALTH STATUS', items: () => [
      { l: 'Hollows Commits', s: 'Hollows', v: lv('hollows').stats[0][0], h: 'Commits that are mine.' },
      { l: 'Heavy Assault Commits', s: 'Heavy Assault', v: lv('heavy-assault').stats[0][0], h: 'Commits that are mine.' },
      { l: 'Projects Detected', s: 'Projects', v: String(D.levels.length) },
      { l: 'Side Projects', s: 'Side Projects', v: String(D.quests.length), h: D.quests.map(q => q.title).join(', ') + '.' },
      { l: 'Bugs Fixed', v: () => String(bugsFixed), h: 'Bugs you clicked in BUGS.EXE this session.' },
      { l: 'System Uptime', s: 'Uptime', v: uptime },
    ] },
    freq: { title: 'FREQUENCY/VOLTAGE CONTROL', items: () => [
      { l: 'Sound', k: 'sound', h: 'POST beep, disk clicks and the start up chime.' },
      { l: 'Scanlines', k: 'scanlines', h: 'Dark lines over the text mode screens, like a CRT.' },
      { l: 'CPU Clock', v: '3600MHz', h: 'Locked.' },
      { l: 'Spread Spectrum', s: 'Spread Spec.', v: 'Disabled' },
    ] },
    ide: { title: 'IDE HDD AUTO DETECTION', items: () => {
      const chs = ['Primary Master', 'Primary Slave', 'Secondary Master', 'Secondary Slave', 'USB Storage'];
      return D.levels.map((L, i) => ({
        l: chs[i], s: chs[i].replace('Primary', 'Pri').replace('Secondary', 'Sec'),
        v: i < st.reveal ? short(L) : (i === st.reveal ? 'Detecting...' : ''),
        boot: i < st.reveal ? L.id : null,
        h: i < st.reveal ? `${L.engine}, ${L.year}. ${L.short}. Press Enter to boot it.` : 'Detecting.',
      }));
    } },
  };
  const COLORS = ['#0000AA', '#000000', '#AA00AA', '#005555'];
  let st = { view: 'main', sel: 0, row: 0, dlg: null, color: 0, reveal: 0 }, P = {}, setupTimer = 0, revealTimer = 0;

  function enterSetup() {
    mode = 'setup';
    P = Object.assign({}, S);
    st = { view: 'main', sel: 0, row: 0, dlg: null, color: st.color || 0, reveal: 0 };
    crt.classList.add('setup');
    crt.style.setProperty('--setup-bg', COLORS[st.color]);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    say.textContent = 'BIOS Setup. Arrow keys to move, Enter to open, Escape to go back, F10 to save and exit.';
    drawSetup();
    clearInterval(setupTimer);
    setupTimer = setInterval(() => { if (mode === 'setup' && (st.view === 'std' || st.view === 'health')) drawSetup(); }, 1000);
  }
  function hdr(title) {
    if (COLS === 80) { center(0, 'ROM PCI/ISA BIOS (2A69KF0Z)', 'c-w'); center(1, title, 'c-w'); center(2, 'FAUZ SOFTWARE, INC.', 'c-w'); }
    else { center(0, title, 'c-w'); center(1, 'FAUZ SOFTWARE, INC.', 'c-w'); }
  }
  function key(x, y, label, fn, c) { put(x, y, label, c || 'c-w'); if (fn) hit(x, y, label.length, fn); }
  function drawSetup() {
    cls();
    if (st.view === 'main') drawMain(); else drawPage(PAGES[st.view]);
    if (st.dlg) drawDialog();
    paint();
  }
  function drawMain() {
    const N = COLS === 40;
    hdr('CMOS SETUP UTILITY');
    if (!N) {
      box(0, 3, 80, 22, 'c-w');
      put(39, 3, '┬', 'c-w'); for (let y = 4; y < 19; y++) put(39, y, '│', 'c-w');
      rule(19, 'c-w'); put(39, 19, '┴', 'c-w'); rule(22, 'c-w');
      MENU.forEach((m, i) => {
        const right = i >= 7, x = right ? 41 : 2, y = 5 + (i % 7) * 2, w = 36;
        const on = i === st.sel;
        put(x, y, (' ' + m.t).padEnd(w), on ? 'sel' : 'c-y');
        hit(x, y, w, () => { st.sel = i; activateMenu(); });
      });
      key(2, 20, 'Esc : Quit', () => keySetup({ key: 'Escape' }));
      key(42, 20, '↑ ↓ → ←   : Select Item');
      key(2, 21, 'F10 : Save & Exit Setup', () => keySetup({ key: 'F10' }));
      key(42, 21, '(Shift)F2 : Change Color', cycleColor);
      center(23, MENU[st.sel].d, 'c-w');
    } else {
      box(0, 2, 40, 23, 'c-w');
      MENU.forEach((m, i) => {
        const y = 3 + i, on = i === st.sel;
        put(1, y, (' ' + m.t).padEnd(38), on ? 'sel' : 'c-y');
        hit(1, y, 38, () => { st.sel = i; activateMenu(); });
      });
      rule(17, 'c-w', 0, 40);
      key(2, 18, 'Esc : Quit', () => keySetup({ key: 'Escape' }));
      key(22, 18, 'F10 : Save', () => keySetup({ key: 'F10' }));
      key(2, 19, '↑ ↓ : Select');
      key(22, 19, 'Enter : Open', () => activateMenu());
      key(2, 20, '(Shift)F2 : Change Color', cycleColor);
      rule(21, 'c-w', 0, 40);
      wrap(MENU[st.sel].d, 36).slice(0, 2).forEach((l, i) => put(mid(l, 40), 22 + i, l, 'c-w'));
    }
  }
  function valueOf(it) {
    if (it.k) return P[it.k] ? 'Enabled' : 'Disabled';
    const v = typeof it.v === 'function' ? it.v() : it.v;
    return v === undefined ? 'Enabled' : v;
  }
  function drawPage(pg) {
    const N = COLS === 40, items = pg.items();
    st.row = Math.min(st.row, items.length - 1);
    hdr(pg.title);
    const cur = items[st.row];
    if (!N) {
      box(0, 3, 80, 22, 'c-w');
      put(54, 3, '┬', 'c-w'); for (let y = 4; y < 19; y++) put(54, y, '│', 'c-w');
      rule(19, 'c-w'); put(54, 19, '┴', 'c-w');
      items.forEach((it, i) => {
        const y = 4 + i, on = i === st.row, v = valueOf(it);
        put(2, y, it.l.padEnd(25) + ':', 'c-w');
        put(29, y, (' ' + v + ' ').padEnd(Math.max(v.length + 2, 10)).slice(0, 24), on ? 'sel' : 'c-y');
        hit(1, y, 53, () => { st.row = i; activateItem(it); });
      });
      put(mid('Item Help', 24, 55), 4, 'Item Help', 'c-w');
      put(55, 5, '─'.repeat(24), 'c-w');
      wrap(cur.h || (cur.k ? 'Enter or +/- to change.' : 'Read only.'), 22).slice(0, 12).forEach((l, i) => put(56, 6 + i, l, 'c-w'));
      key(2, 20, 'Esc : Quit', () => keySetup({ key: 'Escape' }));
      key(42, 20, '↑ ↓ → ←   : Select Item');
      key(2, 21, 'F10 : Save & Exit Setup', () => keySetup({ key: 'F10' }));
      key(42, 21, 'PU/PD/+/- : Modify');
      key(2, 22, 'F5  : Old Values', () => keySetup({ key: 'F5' }));
      key(42, 22, '(Shift)F2 : Color', cycleColor);
      key(2, 23, 'F6  : Load BIOS Defaults', () => keySetup({ key: 'F6' }));
      key(42, 23, 'Enter : Open or Boot');
    } else {
      box(0, 2, 40, 23, 'c-w');
      items.forEach((it, i) => {
        const y = 3 + i, on = i === st.row, v = valueOf(it);
        put(1, y, (it.s || it.l).slice(0, 15).padEnd(15) + ':', 'c-w');
        put(17, y, (' ' + v + ' ').slice(0, 22).padEnd(Math.min(22, Math.max(v.length + 2, 8))), on ? 'sel' : 'c-y');
        hit(1, y, 38, () => { st.row = i; activateItem(it); });
      });
      rule(15, 'c-w', 0, 40);
      wrap(cur.h || (cur.k ? 'Enter to change.' : 'Read only.'), 36).slice(0, 5).forEach((l, i) => put(2, 16 + i, l, 'c-w'));
      rule(21, 'c-w', 0, 40);
      key(2, 22, 'Esc : Back', () => keySetup({ key: 'Escape' }));
      key(22, 22, 'F10 : Save', () => keySetup({ key: 'F10' }));
      key(2, 23, 'Enter : Open', () => activateItem(cur));
      key(22, 23, '+/- : Change', () => activateItem(cur));
    }
  }
  function drawDialog() {
    const d = st.dlg, text = d.ask + d.ans, w = text.length + 6, x = mid(' '.repeat(w)), y = COLS === 80 ? 11 : 10;
    const h = coarse ? 5 : 3;
    fill(x, y, w, h, 'bg-r');
    box(x, y, w, h, 'bg-r', true);
    put(x + 3, y + 1, text, 'bg-r');
    put(x + 3 + text.length, y + 1, '_', 'bg-r blink');
    const yi = d.ask.indexOf('(Y/N)');
    if (yi >= 0) {
      hit(x + 3 + yi, y + 1, 2, () => answer('Y'));
      hit(x + 3 + yi + 3, y + 1, 2, () => answer('N'));
    }
    if (coarse) {
      const yes = '[ Yes ]', no = '[ No ]', bx = x + Math.floor((w - yes.length - no.length - 4) / 2);
      put(bx, y + 3, yes, 'bg-r'); hit(bx, y + 3, yes.length, () => answer('Y'));
      put(bx + yes.length + 4, y + 3, no, 'bg-r'); hit(bx + yes.length + 4, y + 3, no.length, () => answer('N'));
    }
  }
  function ask(m) { st.dlg = { ask: m.ask, ans: m.def, act: m.act, arg: m.arg }; drawSetup(); }
  function answer(a) { st.dlg.ans = a; drawSetup(); setTimeout(confirmDlg, 120); }
  function confirmDlg() {
    const d = st.dlg; if (!d) return;
    st.dlg = null;
    if (d.ans !== 'Y') { drawSetup(); return; }
    if (d.act === 'defaults') { BIOS_KEYS.forEach(k => { P[k] = DEF[k]; }); drawSetup(); }
    else if (d.act === 'save') leaveSetup(true);
    else if (d.act === 'quit') leaveSetup(false);
    else if (d.act === 'boot') leaveSetup(true, d.arg);
  }
  function leaveSetup(keep, openId) {
    clearInterval(setupTimer); clearInterval(revealTimer);
    if (keep) BIOS_KEYS.forEach(k => { if (P[k] !== S[k]) setSetting(k, P[k]); });
    resume(openId);
  }
  function cycleColor() { st.color = (st.color + 1) % COLORS.length; crt.style.setProperty('--setup-bg', COLORS[st.color]); }
  function activateMenu() {
    const m = MENU[st.sel];
    if (m.go) {
      st.view = m.go; st.row = 0;
      if (m.go === 'ide') {
        st.reveal = 0; clearInterval(revealTimer);
        Snd.seek(3);
        revealTimer = setInterval(() => {
          if (mode !== 'setup' || st.view !== 'ide' || st.reveal >= D.levels.length) { clearInterval(revealTimer); return; }
          st.reveal++; Snd.seek(3); drawSetup();
        }, reduce ? 60 : 520);
      }
      drawSetup();
    } else if (m.ask) ask(m);
  }
  function activateItem(it) {
    if (!it) return;
    if (it.k) { P[it.k] = !P[it.k]; drawSetup(); return; }
    if (it.href) {
      if (it.self) location.href = it.href;
      else if (/^mailto:/.test(it.href)) location.href = it.href;
      else window.open(it.href, '_blank', 'noopener');
      drawSetup(); return;
    }
    if (it.boot) ask({ ask: `Boot from ${short(lv(it.boot)).toUpperCase()} (Y/N)? `, def: 'Y', act: 'boot', arg: it.boot });
    else drawSetup();
  }
  function keySetup(e) {
    const k = e.key, pd = () => { if (e.preventDefault) e.preventDefault(); };
    if (st.dlg) {
      if (k === 'y' || k === 'Y') { st.dlg.ans = 'Y'; drawSetup(); pd(); }
      else if (k === 'n' || k === 'N') { st.dlg.ans = 'N'; drawSetup(); pd(); }
      else if (k === 'Enter') { pd(); confirmDlg(); }
      else if (k === 'Escape') { pd(); st.dlg = null; drawSetup(); }
      return;
    }
    if (k === 'F2' && e.shiftKey) { pd(); cycleColor(); return; }
    if (k === 'F10') { pd(); ask(MENU[11]); return; }
    if (st.view === 'main') {
      const N = COLS === 40, n = MENU.length;
      if (k === 'ArrowDown') { st.sel = (st.sel + 1) % n; }
      else if (k === 'ArrowUp') { st.sel = (st.sel + n - 1) % n; }
      else if (k === 'ArrowRight' && !N && st.sel < 7) { st.sel = Math.min(n - 1, st.sel + 7); }
      else if (k === 'ArrowLeft' && !N && st.sel >= 7) { st.sel -= 7; }
      else if (k === 'Enter' || k === ' ') { pd(); activateMenu(); return; }
      else if (k === 'Escape') { pd(); ask(MENU[12]); return; }
      else return;
      pd(); drawSetup();
    } else {
      const items = PAGES[st.view].items(), n = items.length, it = items[st.row];
      if (k === 'ArrowDown') st.row = (st.row + 1) % n;
      else if (k === 'ArrowUp') st.row = (st.row + n - 1) % n;
      else if (k === 'Escape') { st.view = 'main'; clearInterval(revealTimer); }
      else if (['PageUp', 'PageDown', '+', '-', ' '].includes(k)) { if (it.k) P[it.k] = !P[it.k]; }
      else if (k === 'Enter') { pd(); activateItem(it); return; }
      else if (k === 'F5') { P = Object.assign({}, S); }
      else if (k === 'F6') { pd(); ask(MENU[5]); return; }
      else return;
      pd(); drawSetup();
    }
  }

  // ------------------------------------------------------------------ pixel art
  const PAL = { K: '#1b1a17', W: '#f4f1ea', O: '#ee7a3c', G: '#aaa69d', D: '#6d6961', B: '#0000AA', C: '#55FFFF', Y: '#FFFF55', N: '#00AA00', L: '#55FF55', R: '#AA0000', T: '#008080' };
  function px(art, pal) {
    const p = Object.assign({}, PAL, pal || {}), h = art.length, w = art[0].length;
    let r = '';
    art.forEach((row, y) => {
      let x = 0;
      while (x < w) {
        const c = row[x];
        if (c === '.') { x++; continue; }
        let n = 1; while (x + n < w && row[x + n] === c) n++;
        r += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${p[c]}"/>`;
        x += n;
      }
    });
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" shape-rendering="crispEdges">${r}</svg>`;
  }
  const ART = {
    sweeper: ['................', '.WWWWWWWWWWWWWD.', '.WGGGGGGGGGGGGD.', '.WGGGGKGGKGGGGD.', '.WGGGGGKKGGGGGD.', '.WGGGKKKKKKGGGD.', '.WGKGKOOKOOKGKD.', '.WGGKKOOKOOKKGD.', '.WGGGKOOKOOKGGD.', '.WGKKKOOKOOKKKD.', '.WGGGKOOKOOKGGD.', '.WGGKGKKKKKGKGD.', '.WGGGGGGGGGGGGD.', '.WGGGGGGGGGGGGD.', '.DDDDDDDDDDDDDD.', '................'],
    display: ['................', '.KKKKKKKKKKKKKK.', '.KGGGGGGGGGGGGK.', '.KGTTTTTTTTTTGK.', '.KGTTTTTTTYYTGK.', '.KGTTTTTTTYYTGK.', '.KGTTTTTTTTTTGK.', '.KGTNNTTTTTTTGK.', '.KGNNNNTTNNTTGK.', '.KGNNNNNNNNNTGK.', '.KGGGGGGGGGGOGK.', '.KKKKKKKKKKKKKK.', '......KKKK......', '....KKKKKKKK....', '...KGGGGGGGGK...', '...KKKKKKKKKK...'],
    key: ['................', '................', '..KKKK..........', '.KYYYYK.........', 'KYYKKYYK........', 'KYK..KYKKKKKKKK.', 'KYK..KYYYYYYYYYK', 'KYYKKYYKKKKYKYK.', '.KYYYYK....K.K..', '..KKKK..........', '................', '................', '................', '................', '................', '................'],
    err: ['.....RRRRRR.....', '...RRRRRRRRRR...', '..RRRRRRRRRRRR..', '.RRRWWRRRRWWRRR.', '.RRRWWWRRWWWRRR.', 'RRRRRWWWWWWRRRRR', 'RRRRRRWWWWRRRRRR', 'RRRRRRWWWWRRRRRR', 'RRRRRWWWWWWRRRRR', '.RRRWWWRRWWWRRR.', '.RRRWWRRRRWWRRR.', '..RRRRRRRRRRRR..', '...RRRRRRRRRR...', '.....RRRRRR.....', '................', '................'],
    info: ['.....BBBBBB.....', '...BBBBBBBBBB...', '..BBBBBWWBBBBB..', '.BBBBBBWWBBBBBB.', '.BBBBBBBBBBBBBB.', 'BBBBBBWWWBBBBBBB', 'BBBBBBBWWBBBBBBB', 'BBBBBBBWWBBBBBBB', 'BBBBBBBWWBBBBBBB', '.BBBBBBWWBBBBBB.', '.BBBBBWWWWBBBBB.', '..BBBBBBBBBBBB..', '...BBBBBBBBBB...', '.....BBBBBB.....', '................', '................'],
    swbug: ['..K......K..', '...K....K...', '....KKKK....', '...KKKKKK...', '.K.KOOKOOK.K', '..KOOOKOOOK.', 'KKKOOOKOOOKK', '..KOOOKOOOK.', '.K.KOOKOOK.K', '...KKKKKK...', '............', '............'],
    flag: ['............', '.....RR.....', '...RRRR.....', '.RRRRRR.....', '...RRRR.....', '.....RR.....', '......K.....', '......K.....', '....KKKK....', '..KKKKKKKK..', '............', '............'],
    faceOk: ['..K..........K..', '...K........K...', '....KKKKKKKK....', '..KKOOOOOOOOKK..', '.KOOOOOOOOOOOOK.', '.KOOKKOOOOKKOOK.', 'KOOOKKOOOOKKOOOK', 'KOOOOOOOOOOOOOOK', 'KOOOOOOOOOOOOOOK', 'KOOOKOOOOOOKOOOK', 'KOOOOKKKKKKOOOOK', '.KOOOOOOOOOOOOK.', '.KOOOOOOOOOOOOK.', '..KKOOOOOOOOKK..', '....KKKKKKKK....', '................'],
    faceOh: ['..K..........K..', '...K........K...', '....KKKKKKKK....', '..KKOOOOOOOOKK..', '.KOOOOOOOOOOOOK.', '.KOOKKOOOOKKOOK.', 'KOOOKKOOOOKKOOOK', 'KOOOOOOOOOOOOOOK', 'KOOOOOOOOOOOOOOK', 'KOOOOOOKKOOOOOOK', 'KOOOOOOKKOOOOOOK', '.KOOOOOOOOOOOOK.', '.KOOOOOOOOOOOOK.', '..KKOOOOOOOOKK..', '....KKKKKKKK....', '................'],
    faceDead: ['..K..........K..', '...K........K...', '....KKKKKKKK....', '..KKOOOOOOOOKK..', '.KOKOKOOOOKOKOK.', '.KOOKOOOOOOKOOK.', 'KOOKOKOOOOKOKOOK', 'KOOOOOOOOOOOOOOK', 'KOOOOOOOOOOOOOOK', 'KOOOOOOOOOOOOOOK', 'KOOOOKKKKKKOOOOK', '.KOOOOOOOOOOOOK.', '.KOOOOOOOOOOOOK.', '..KKOOOOOOOOKK..', '....KKKKKKKK....', '................'],
    faceCool: ['..K..........K..', '...K........K...', '....KKKKKKKK....', '..KKOOOOOOOOKK..', '.KOOOOOOOOOOOOK.', '.KOKKKKKKKKKKOK.', 'KOOKKKOOOOKKKOOK', 'KOOOOOOOOOOOOOOK', 'KOOOOOOOOOOOOOOK', 'KOOOKOOOOOOKOOOK', 'KOOOOKKKKKKOOOOK', '.KOOOOOOOOOOOOK.', '.KOOOOOOOOOOOOK.', '..KKOOOOOOOOKK..', '....KKKKKKKK....', '................'],
    arrow: ['K...........', 'KK..........', 'KWK.........', 'KWWK........', 'KWWWK.......', 'KWWWWK......', 'KWWWWWK.....', 'KWWWWWWK....', 'KWWWWWWWK...', 'KWWWWWWWWK..', 'KWWWWWWWWWK.', 'KWWWWWWKKKKK', 'KWWWKWWK....', 'KWWKKWWK....', 'KWK..KWWK...', 'KK...KWWK...', 'K.....KWWK..', '......KWWK..', '.......KK...'],
    hourglass: ['KKKKKKKKKKK', 'KWWWWWWWWWK', '.KWWWWWWWK.', '.KWOOOOOWK.', '.KWWOOOWWK.', '..KWWOWWK..', '...KWOWK...', '....KOK....', '...KWOWK...', '..KWWOWWK..', '.KWWWOWWWK.', '.KWWOOOWWK.', '.KWOOOOOWK.', '.KWWWWWWWK.', 'KWWWWWWWWWK', 'KKKKKKKKKKK'],
    readme: ['................', '..KKKKKKKKK.....', '..KWWWWWWWKK....', '..KWWWWWWWKWK...', '..KWWWWWWWKKKK..', '..KWKKKKKWWWWK..', '..KWWWWWWWWWWK..', '..KWKKKKKKKWWK..', '..KWWWWWWWWWWK..', '..KWKKKKKKKWWK..', '..KWWWWWWWWWWK..', '..KWKKKKKWWWWK..', '..KWWWWWWWWWWK..', '..KWWWWWWWWWWK..', '..KKKKKKKKKKKK..', '................'],
    about: ['................', '................', '.KKKKKKKKKKKKKK.', '.KOOOOOOOOOOOOK.', '.KWWWWWWWWWWWWK.', '.KWKKKKWWWWWWWK.', '.KWKGGKWKKKKKWK.', '.KWKGGKWWWWWWWK.', '.KWKKKKWKKKKWWK.', '.KWGGGGWWWWWWWK.', '.KWGGGGWKKKWWWK.', '.KWWWWWWWWWWWWK.', '.KKKKKKKKKKKKKK.', '................', '................', '................'],
    contact: ['................', '................', '................', '.KKKKKKKKKKKKKK.', '.KKWWWWWWWWWWKK.', '.KWKWWWWWWWWKWK.', '.KWWKWWWWWWKWWK.', '.KWWWKWWWWKWWWK.', '.KWWWWKOOKWWWWK.', '.KWWWKWKKWKWWWK.', '.KWWKWWWWWWKWWK.', '.KWKWWWWWWWWKWK.', '.KKKKKKKKKKKKKK.', '................', '................', '................'],
    bugs: ['................', '....K......K....', '.....K....K.....', '......KKKK......', '.....KKKKKK.....', '..K..KOOOOK..K..', '...KKOOKKOOKK...', '.....OOOKOOO....', '.KKKOOOOKOOOOKKK', '.....OOOKOOO....', '...KKOKOKOOOKK..', '..K..KOOKOOK..K.', '......KOOKK.....', '.......KK.......', '................', '................'],
    control: ['................', '.KKKKKKKKKKKKKK.', '.KGGGGGGGGGGGGK.', '.KGGGOOGGGGGGGK.', '.KGKKOOKKKKKKGK.', '.KGGGOOGGGGGGGK.', '.KGGGGGGGGGGGGK.', '.KGGGGGGGGOOGGK.', '.KGKKKKKKKOOKGK.', '.KGGGGGGGGOOGGK.', '.KGGGGGGGGGGGGK.', '.KGGGGGOOGGGGGK.', '.KGKKKKOOKKKKGK.', '.KGGGGGOOGGGGGK.', '.KKKKKKKKKKKKKK.', '................'],
    system: ['................', '.KKKKKKKKKKKKKK.', '.KGGGGGGGGGGGGK.', '.KGBBBBBBBBBBGK.', '.KGBCCBBBBBBBGK.', '.KGBBBBBBBBBBGK.', '.KGBCCCCBBBBBGK.', '.KGBBBBBBBBBBGK.', '.KGGGGGGGGGGOGK.', '.KKKKKKKKKKKKKK.', '......KKKK......', '....KKKKKKKK....', '...KGGGGGGGGK...', '...KKKKKKKKKK...', '................', '................'],
    classic: ['.....KKKKKK.....', '...KKCCWCCCKK...', '..KCCWWCCCCCCK..', '.KCCWWWCCCWWCCK.', '.KCCCWWCCWWWWCK.', 'KCCCCCCCCWWWWCCK', 'KCCCCCCCCCWWCCCK', 'KCCCWWCCCCCCCCCK', 'KCCWWWWCCCCCCCCK', 'KCCCWWWWCCCCWCCK', '.KCCCWWWCCCWWCK.', '.KCCCCWWCCCWCCK.', '..KCCCCCCCCCCK..', '...KKCCCCCCKK...', '.....KKKKKK.....', '................'],
    start: ['..K..K..', '...KK...', 'K.KOOK.K', '.KOOKOK.', 'KOOOKOOK', '.KOOKOK.', 'K.KKKK.K', '........'],
    min: ['.......', '.......', '.......', '.......', '.......', 'KKKKKK.', 'KKKKKK.'],
    max: ['KKKKKKK', 'KKKKKKK', 'K.....K', 'K.....K', 'K.....K', 'K.....K', 'KKKKKKK'],
    restore: ['..KKKKK', '..KKKKK', 'KKKKK.K', 'KKKKK.K', 'K...KKK', 'K...K..', 'KKKKK..'],
    close: ['KK...KK', '.KK.KK.', '..KKK..', '...K...', '..KKK..', '.KK.KK.', 'KK...KK'],
    sndOn: ['...K....', '..KK..K.', 'KKKK.K.K', 'KKKK.K.K', 'KKKK.K.K', '..KK..K.', '...K....', '........'],
    sndOff: ['...K....', '..KK....', 'KKKK.K.K', 'KKKK..K.', 'KKKK.K.K', '..KK....', '...K....', '........'],
  };
  const ICO = n => px(ART[n], { K: 'currentColor' });
  const BTN = { min: ICO('min'), max: ICO('max'), restore: ICO('restore'), close: ICO('close') };

  // project icons: the cover, cut down to 24x24 and dithered to a 64 colour palette
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function pixelThumb(src, cv) {
    const img = new Image();
    img.onload = () => {
      const n = 24, c = cv.getContext('2d', { willReadFrequently: true });
      cv.width = cv.height = n;
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      c.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, n, n);
      try {
        const d = c.getImageData(0, 0, n, n), a = d.data;
        for (let i = 0; i < n * n; i++) {
          const x = i % n, y = (i / n) | 0, t = (BAY[(y & 3) * 4 + (x & 3)] / 16 - .47) * 44;
          for (let ch = 0; ch < 3; ch++) a[i * 4 + ch] = Math.max(0, Math.min(3, Math.round((a[i * 4 + ch] + t) / 85))) * 85;
        }
        c.putImageData(d, 0, 0);
      } catch (e) { /* opened from disk: the browser blocks pixel reads, so the plain thumbnail stays */ }
    };
    img.src = src;
  }

  // ------------------------------------------------------------------ desktop and windows
  const desk = $('#desk'), tasks = $('#tasks'), wins = new Map();
  let z = 10, offset = 0;
  const apps = {
    readme: { title: 'README.TXT', icon: 'readme', w: 580, h: 520, body: readme, status: () => [`${D.levels.length} projects`, coarse ? 'Tap an icon to open it' : 'Double click an icon to open it'] },
    about: { title: 'About Fauzan', icon: 'about', w: 620, h: 600, body: about },
    contact: { title: 'Contact', icon: 'contact', w: 480, h: 400, body: contact },
    bugs: { title: 'BUGS.EXE', icon: 'bugs', w: 560, h: 300, body: bugsApp, cls: 'bugs-win', init: bugsInit },
    sweeper: { title: 'Bug Sweeper', icon: 'sweeper', w: 280, h: 400, body: sweeperBody, cls: 'sweeper-win', init: sweeperInit, status: () => ['Beginner', ''] },
    control: { title: 'Control Panel', icon: 'control', w: 520, h: 600, body: control },
    display: { title: 'Display Properties', icon: 'display', w: 440, h: 610, body: displayBody, cls: 'display-win', init: displayInit },
    system: { title: 'System Properties', icon: 'system', w: 540, h: 620, body: system },
    activate: { title: 'Activate FAUZ OS', icon: 'key', w: 540, h: 590, body: activateBody, init: el => { if (!small()) el.style.height = 'auto'; } },
    classic: { title: 'Plain Site', icon: 'classic', href: 'classic.html' },
  };
  D.levels.forEach(l => { apps[l.id] = { title: short(l), cover: l.cover, w: 820, h: 660, body: () => project(l), status: () => [l.kind, l.dates] }; });

  function readme() {
    return `<h1>Hi, I'm Fauzan Fauzy.</h1>
      <p class="lead">Game and software programmer in Singapore. I build the code under games: audio, physics, saves, progression and tools.</p>
      <p>Every icon on this desktop is a project. ${coarse ? 'Tap' : 'Double click'} one to open it, or start here:</p>
      <p>${D.levels.map(l => `<button class="btn" type="button" data-open="${l.id}">${esc(short(l))}</button>`).join('')}</p>
      <p class="small">In a hurry? Hollows has the most engine work. Hot Potato you can play right now. Prefer a normal page? Open the <a href="classic.html">plain version</a>.</p>
      <p class="small">Restart and press DEL to poke around the BIOS. Bored? Try Bug Sweeper.</p>`;
  }
  function about() {
    return `<h1>About</h1>
      <p class="lead">Third year Computer Science in Real Time Interactive Simulation at DigiPen Institute of Technology Singapore and SIT.</p>
      <p>I like the parts of a game you only notice when they break. A footstep that clicks, a frame that drops, a save that is gone the next day.</p>
      <h2>History</h2>
      <dl class="kv"><dt>2024 to 2028</dt><dd>BSc Computer Science (RTIS), DigiPen and SIT</dd><dt>2022 to 2024</dt><dd>Firefighting instructor, Singapore Civil Defence Force</dd><dt>2021</dt><dd>Product testing intern on Razer products, Beyondsoft</dd><dt>2019 to 2022</dt><dd>Diploma in Business and Financial Technology, Nanyang Polytechnic</dd></dl>
      <h2>Tools</h2><p>C++20, C#, Unity 6, FMOD, ImGui, Python, JavaScript, Java, SQL, Git, Jira.</p>
      <h2>Side projects</h2><ul>${D.quests.map(q => `<li><b>${esc(q.title)}.</b> ${esc(q.text)} <span class="small">${esc(q.stack)}</span></li>`).join('')}</ul>`;
  }
  function contact() {
    return `<h1>Contact</h1>
      <p class="lead">Open to an IWSP placement from 3 May 2027 to 7 April 2028.</p>
      <p><a class="btn primary" href="mailto:${mail}">Email ${mail}</a></p>
      <p><a class="btn" href="https://www.linkedin.com/in/fauz/" target="_blank" rel="noopener">LinkedIn</a><a class="btn" href="https://github.com/Qayzan" target="_blank" rel="noopener">GitHub</a></p>`;
  }
  function bugsApp() {
    return `<canvas role="img" aria-label="My name in pixels. Bugs eat it; click them to put it back."></canvas><p class="meter" aria-live="polite">Waiting for bugs. Click them before the program crashes.</p>`;
  }
  function control() {
    const f = (k, label, note) => `<label class="field"><input type="checkbox" data-set="${k}"${S[k] ? ' checked' : ''}> <span>${label}<br><span class="small">${note}</span></span></label>`;
    const ico = (id, label) => `<button type="button" data-open="${id}">${px(ART[apps[id].icon])}<span>${label}</span></button>`;
    return `<h1>Control Panel</h1>
      <div class="cp-icons">${ico('display', 'Display')}${ico('system', 'System')}${ico('activate', 'Activation')}${ico('sweeper', 'Bug Sweeper')}</div>
      <fieldset class="group"><legend>Sound</legend>${f('sound', 'Sound effects', 'POST beep, disk clicks, the start up chime.')}</fieldset>
      <fieldset class="group"><legend>Display</legend>${f('scanlines', 'Scanlines', 'Only on the start up screens, never over text you read.')}</fieldset>
      <fieldset class="group"><legend>Start up</legend>${f('quickpost', 'Quick power on self test', 'Starts up about three times faster.')}
        <p><button class="btn" type="button" data-act="setup">Restart into BIOS Setup</button><button class="btn" type="button" data-act="restart">Restart</button></p></fieldset>
      <p class="small">Settings are kept in this browser only.</p>`;
  }
  function system() {
    return `<h1>FAUZ OS 26</h1>
      <dl class="kv"><dt>Registered to</dt><dd>Fauzan Fauzy</dd><dt>Processor</dt><dd>FZ-26 Engine, 3600MHz</dd><dt>Memory</dt><dd>16384K</dd><dt>Version</dt><dd>26.10, October 2026</dd><dt>Activation</dt><dd>${S.activated ? 'Activated. Genuine bug fixing.' : 'Not activated. <button class="link" type="button" data-open="activate">Activate now</button>'}</dd></dl>
      <h2>About this site</h2>
      <p>Hand written HTML, CSS and JavaScript. No framework, no build step, no tracking. Every sound is generated in your browser.</p>
      <h2>Credits</h2>
      <p>Text mode font: IBM VGA 8x16 from <a href="https://int10h.org/oldschool-pc-fonts/" target="_blank" rel="noopener">The Ultimate Oldschool PC Font Pack</a> by VileR, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>, used unmodified.</p>
      <p>Reading fonts: IBM Plex Sans and IBM Plex Mono, SIL Open Font License.</p>
      <p class="small">The BIOS, its vendor and its logo are made up.</p>`;
  }
  function project(l) {
    const tall = l.gallery.length && /eduvision|mobile/.test(l.gallery[0][0]);
    return `<h1>${esc(l.title)}</h1>
      <p class="small">${esc(l.kind)}, ${esc(l.dates)}. ${esc(l.role)}.</p>
      <p class="lead">${esc(l.tagline)}</p>
      ${l.links.length ? `<p>${l.links.map(([t, h]) => `<a class="btn primary" href="${h}" target="_blank" rel="noopener">${esc(t)}</a>`).join('')}</p>` : ''}
      ${l.note ? `<p class="small">${esc(l.note)}</p>` : ''}
      ${l.video ? `<video controls preload="none" playsinline poster="${l.video.poster}" src="${l.video.src}"></video><p class="small">${esc(l.video.caption)}</p>` : `<img src="${l.cover}" alt="${esc(l.title)}" width="${l.coverW}" height="${l.coverH}">`}
      <div class="props">${l.stats.map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
      <h2>What I built</h2><ul>${l.built.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      <h2>Built with</h2><p>${esc(l.stack.join(', '))}</p>
      ${l.gallery.length ? `<h2>Screens</h2><div class="shots${tall ? ' tall' : ''}">${l.gallery.map(([s, c]) => `<figure><img src="${s}" alt="${esc(c)}" loading="lazy"><figcaption>${esc(c)}</figcaption></figure>`).join('')}</div>` : ''}
      ${l.credit ? `<p class="small" style="margin-top:16px">${esc(l.credit)}</p>` : ''}`;
  }

  function focusWin(id) {
    const w = wins.get(id); if (!w) return;
    w.el.hidden = false; w.el.style.zIndex = ++z;
    wins.forEach((o, k) => { o.el.classList.toggle('active', k === id); o.task.classList.toggle('on', k === id); });
  }
  function topWin() { let best = null; wins.forEach((o, k) => { if (!o.el.hidden && (!best || +o.el.style.zIndex > +wins.get(best).el.style.zIndex)) best = k; }); return best; }
  function zoom(from, to, done) {
    if (reduce || !from || small()) { done(); return; }
    const d = desk.getBoundingClientRect(), r = document.createElement('div');
    r.className = 'zoomrect'; desk.appendChild(r);
    const f = { x: from.left - d.left, y: from.top - d.top, w: from.width, h: from.height };
    let i = 0; const n = 7;
    (function step() {
      i++;
      const k = i / n, L = (a, b) => a + (b - a) * k;
      Object.assign(r.style, { left: L(f.x, to.x) + 'px', top: L(f.y, to.y) + 'px', width: L(f.w, to.w) + 'px', height: L(f.h, to.h) + 'px' });
      if (i < n) setTimeout(step, 22); else { r.remove(); done(); }
    })();
  }
  let busyT = 0;
  function busy(ms) { document.body.classList.add('busy'); clearTimeout(busyT); busyT = setTimeout(() => document.body.classList.remove('busy'), ms); }
  function openApp(id, fromEl, silent) {
    const app = apps[id]; if (!app) return;
    if (app.href) { location.href = app.href; return; }
    if (wins.has(id)) { if (wins.get(id).el.hidden) Snd.click('open'); focusWin(id); return; }
    if (!silent) Snd.click('open');
    const dlg = !!app.dialog;
    if (!dlg) busy(reduce ? 150 : 420);
    const el = document.createElement('section');
    el.className = 'window' + (dlg ? ' dialog' : '') + (app.cls ? ' ' + app.cls : '');
    el.setAttribute('role', dlg ? 'alertdialog' : 'dialog'); el.setAttribute('aria-label', app.title);
    const dw = desk.clientWidth, dh = desk.clientHeight;
    let w = Math.min(app.w, dw - (dlg ? 24 : 130)), h = Math.min(app.h, dh - 32);
    let x = Math.round(Math.max(116, Math.min(dw - w - 16, 140 + (dw - w - 140) * .38 + offset)));
    let y = Math.round(Math.max(12, Math.min(dh - h - 12, 24 + offset)));
    if (!dlg) offset = (offset + 28) % 140;
    Object.assign(el.style, { width: w + 'px', height: dlg ? 'auto' : h + 'px', left: x + 'px', top: y + 'px', visibility: 'hidden' });
    const ctl = dlg ? '' : `<button type="button" data-min aria-label="Minimise">${BTN.min}</button><button type="button" data-max aria-label="Maximise">${BTN.max}</button>`;
    el.innerHTML = `<div class="titlebar"><span class="t">${esc(app.title)}</span>${ctl}<button type="button" data-close aria-label="Close">${BTN.close}</button></div>
      <div class="content">${app.body()}</div>
      ${app.status ? `<div class="statusbar">${app.status().map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      ${dlg ? '' : '<div class="grip" aria-hidden="true"></div>'}`;
    desk.appendChild(el);
    const task = document.createElement('button');
    task.type = 'button'; task.textContent = app.title;
    task.addEventListener('click', () => {
      const o = wins.get(id);
      if (!o.el.hidden && o.el.classList.contains('active')) minimise(id); else { if (o.el.hidden) Snd.click('open'); focusWin(id); }
    });
    tasks.appendChild(task);
    const o = { el, task };
    wins.set(id, o);
    el.addEventListener('pointerdown', () => focusWin(id));
    el.querySelector('[data-close]').addEventListener('click', e => { e.stopPropagation(); closeWin(id); });
    if (!dlg) {
      el.querySelector('[data-min]').addEventListener('click', e => { e.stopPropagation(); minimise(id); });
      el.querySelector('[data-max]').addEventListener('click', e => { e.stopPropagation(); toggleMax(id); });
      el.querySelector('.titlebar').addEventListener('dblclick', e => { if (!e.target.closest('button') && !small()) toggleMax(id); });
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-open]'); if (b) openApp(b.dataset.open, b);
      const a = e.target.closest('[data-act]'); if (a && ACTS[a.dataset.act]) ACTS[a.dataset.act]();
    });
    el.addEventListener('change', e => { const i = e.target.closest('[data-set]'); if (i) setSetting(i.dataset.set, i.checked); });
    drag(el);
    if (app.init) app.init(el, o);
    // size may have changed in init (dialogs grow to fit, Bug Sweeper fits its board)
    w = el.offsetWidth; h = el.offsetHeight;
    if (dlg) { x = Math.round((dw - w) / 2); y = Math.round(Math.max(12, (dh - h) / 2 - 40)); }
    x = Math.max(0, Math.min(x, dw - w)); y = Math.max(0, Math.min(y, dh - h));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    focusWin(id);
    const src = fromEl ? fromEl.getBoundingClientRect() : null;
    zoom(src, { x, y, w, h }, () => {
      el.style.visibility = '';
      const f = el.querySelector(dlg ? '.buttons .btn' : '[data-close]'); if (f) f.focus({ preventScroll: true });
    });
  }
  function minimise(id) { const o = wins.get(id); if (!o) return; Snd.click('close'); o.el.hidden = true; o.task.classList.remove('on'); o.el.querySelectorAll('video').forEach(v => v.pause()); const t = topWin(); if (t) focusWin(t); }
  function toggleMax(id) {
    const o = wins.get(id); if (!o) return;
    const on = o.el.classList.toggle('max');
    const b = o.el.querySelector('[data-max]');
    b.innerHTML = on ? BTN.restore : BTN.max; b.setAttribute('aria-label', on ? 'Restore' : 'Maximise');
  }
  function closeWin(id, silent) {
    const o = wins.get(id); if (!o) return;
    if (!silent) Snd.click('close');
    if (o.sig) o.sig.stop();
    if (o.onClose) o.onClose();
    if (apps[id] && apps[id].onClose) apps[id].onClose();
    o.el.querySelectorAll('video').forEach(v => v.pause());
    o.el.remove(); o.task.remove(); wins.delete(id);
    const t = topWin(); if (t) focusWin(t);
  }
  function closeAll() { [...wins.keys()].forEach(k => closeWin(k, true)); offset = 0; }
  // Moving and resizing. Like the real thing, only a dotted outline moves until you let go,
  // unless "Show window contents while dragging" is on in Display Properties.
  function ghost(x, y, w, h) {
    const g = document.createElement('div');
    g.className = 'ghost'; Object.assign(g.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    desk.appendChild(g); return g;
  }
  function drag(el) {
    const bar = el.querySelector('.titlebar');
    bar.addEventListener('pointerdown', e => {
      if (small() || e.target.closest('button') || el.classList.contains('max') || e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      const g = S.dragfull ? null : ghost(ox, oy, el.offsetWidth, el.offsetHeight);
      let nx = ox, ny = oy;
      bar.setPointerCapture(e.pointerId);
      const move = ev => {
        nx = Math.max(-el.offsetWidth + 80, Math.min(desk.clientWidth - 80, ox + ev.clientX - sx));
        ny = Math.max(0, Math.min(desk.clientHeight - 32, oy + ev.clientY - sy));
        const t = g || el; t.style.left = nx + 'px'; t.style.top = ny + 'px';
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        if (g) { g.remove(); el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up, { once: true });
      bar.addEventListener('pointercancel', up, { once: true });
    });
    const grip = el.querySelector('.grip');
    if (!grip) return;
    grip.addEventListener('pointerdown', e => {
      if (small() || el.classList.contains('max') || e.button !== 0) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, ow = el.offsetWidth, oh = el.offsetHeight;
      const g = S.dragfull ? null : ghost(el.offsetLeft, el.offsetTop, ow, oh);
      let nw = ow, nh = oh;
      grip.setPointerCapture(e.pointerId);
      const move = ev => {
        nw = Math.max(280, Math.min(desk.clientWidth - el.offsetLeft, ow + ev.clientX - sx));
        nh = Math.max(160, Math.min(desk.clientHeight - el.offsetTop, oh + ev.clientY - sy));
        const t = g || el; t.style.width = nw + 'px'; t.style.height = nh + 'px';
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        if (g) { g.remove(); el.style.width = nw + 'px'; el.style.height = nh + 'px'; }
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up, { once: true });
      grip.addEventListener('pointercancel', up, { once: true });
    });
  }

  // ------------------------------------------------------------------ BUGS.EXE, and the error box it ends in
  function bugsInit(el, o) {
    const meter = el.querySelector('.meter'), base = bugsFixed;
    o.sig = window.PixelSignature(el.querySelector('canvas'), {
      lines: ['FAUZAN', 'FAUZY'], cell: 5, bugs: 3, font: '700 {size}px "IBM Plex Mono", monospace', firstWaveAt: 1.2, align: 'center',
      onCount: (f, p) => {
        bugsFixed = base + f;
        meter.textContent = `${f} bugs fixed. Name ${p}% intact.` + (o.crashed ? '' : ' Click them before the program crashes.');
        if (p <= 90 && !o.crashed) { o.crashed = true; bugsCrash(); }
      },
    });
  }
  function bugsCrash() {
    msgBox({
      title: 'BUGS.EXE', icon: 'err',
      html: 'This program has performed an illegal operation and will be shut down.<br><br>If the problem persists, contact the program vendor. He is free for an IWSP placement from May 2027.',
      details: 'BUGS.EXE caused an invalid page fault in\nmodule NAME.DLL at 0026:FA02C011.\n\nRegisters:\nEAX=DEADBEEF CS=0026 EIP=FA02C011\nEBX=0BADF00D SS=002E ESP=00C0FFEE\n\nBytes at CS:EIP:\n46 41 55 5A 41 4E 20 46 41 55 5A 59',
      buttons: [{ label: 'Close', primary: true, fn: () => closeWin('bugs') }],
    });
  }
  let dlgN = 0;
  function msgBox(m) {
    const id = 'dlg' + (++dlgN), buttons = m.buttons || [{ label: 'OK', primary: true }];
    apps[id] = {
      title: m.title, dialog: true, w: m.w || 440, h: 240, cls: 'msgbox',
      body: () => `<div class="msg"><span class="msg-ico">${px(ART[m.icon || 'info'])}</span><div><p>${m.html}</p>${m.details ? `<pre class="details" hidden>${esc(m.details)}</pre>` : ''}</div></div>
        <p class="buttons">${buttons.map((b, i) => `<button class="btn${b.primary ? ' primary' : ''}" type="button" data-b="${i}">${esc(b.label)}</button>`).join('')}${m.details ? '<button class="btn" type="button" data-details aria-expanded="false">Details &gt;&gt;</button>' : ''}</p>`,
      init(el) {
        el.addEventListener('click', e => {
          const b = e.target.closest('[data-b]');
          if (b) { const fn = buttons[+b.dataset.b].fn; closeWin(id, true); if (fn) fn(); return; }
          const d = e.target.closest('[data-details]');
          if (d) { const pre = el.querySelector('.details'); pre.hidden = !pre.hidden; d.setAttribute('aria-expanded', String(!pre.hidden)); d.innerHTML = pre.hidden ? 'Details &gt;&gt;' : '&lt;&lt; Details'; }
        });
      },
      onClose() { setTimeout(() => { delete apps[id]; }, 0); },
    };
    if (m.sound !== false) Snd.err();
    openApp(id, null, true);
  }

  // ------------------------------------------------------------------ wallpapers
  const WALLS = [['warm', 'Warm Desk'], ['bugs', 'Bug Pattern'], ['teal', 'Classic Teal'], ['name', 'My Name']];
  (function bugTile() {
    const bug = ['..K..K..', '...KK...', 'K.KKKK.K', '.KKKKKK.', 'KKKKKKKK', '.KKKKKK.', 'K.KKKK.K'];
    let d = '';
    [[4, 4], [16, 16]].forEach(([ox, oy]) => bug.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'K') d += `M${ox + x} ${oy + y}h1v1h-1z`; })));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" shape-rendering="crispEdges"><path fill="#000" fill-opacity=".17" d="${d}"/></svg>`;
    document.documentElement.style.setProperty('--tile-bugs', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  })();
  function applyWall(id, target, cv) {
    if (!WALLS.some(w => w[0] === id)) id = DEF.wall;
    WALLS.forEach(([k]) => target.classList.remove('wall-' + k));
    target.classList.add('wall-' + id);
    if (cv) { cv.hidden = id !== 'name'; if (id === 'name') nameWall(cv); }
  }
  // Your name, drawn once as faint dithered cells (no animation, so it costs nothing while you read)
  function nameWall(cv) {
    const draw = () => {
      if (cv.hidden) return;
      const r = cv.getBoundingClientRect(); if (r.width < 20) return;
      const cell = Math.max(2, Math.round(r.width / 150)), cols = Math.ceil(r.width / cell), rows = Math.ceil(r.height / cell);
      const m = document.createElement('canvas'); m.width = cols; m.height = rows;
      const mc = m.getContext('2d', { willReadFrequently: true });
      let fs = Math.floor(rows * .26);
      const font = () => { mc.font = `700 ${fs}px "IBM Plex Mono", monospace`; return mc.measureText('FAUZAN').width; };
      while (fs > 6 && font() > cols * .66) fs--;
      mc.textAlign = 'center'; mc.fillStyle = '#fff';
      const y1 = rows * .47; mc.fillText('FAUZAN', cols / 2, y1); mc.fillText('FAUZY', cols / 2, y1 + fs * .98);
      const a = mc.getImageData(0, 0, cols, rows).data;
      const dpr = Math.min(2, window.devicePixelRatio || 1), c = cv.getContext('2d');
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, r.width, r.height);
      const ink = ['#4d4334', '#564b3a', '#605442', '#6b5e4a'], acc = ['#553a27', '#62402a', '#70472c', '#7e4e2e'];
      const split = y1 + fs * .12, top = y1 - fs * .75, bot = y1 + fs * .98;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (a[(y * cols + x) * 4 + 3] < 110) continue;
        const second = y > split, t = second ? (y - split) / (bot - split) : (y - top) / (split - top);
        const lv = Math.max(0, Math.min(3, Math.floor((1 - t) * 3 + BAY[(y & 3) * 4 + (x & 3)] / 16)));
        c.fillStyle = (second ? acc : ink)[lv];
        c.fillRect(x * cell, y * cell, cell - (cell > 3 ? 1 : 0), cell - (cell > 3 ? 1 : 0));
      }
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(draw);
    if (!cv._ro && 'ResizeObserver' in window) { cv._ro = new ResizeObserver(draw); cv._ro.observe(cv); }
  }

  // ------------------------------------------------------------------ Display Properties
  const SAVERS = [['none', '(None)'], ['stars', 'Starfield'], ['bugs', 'Bugs']];
  function displayBody() {
    const ck = (k, label, note) => `<label class="field"><input type="checkbox" data-pend="${k}"> <span>${label}<br><span class="small">${note}</span></span></label>`;
    return `<div class="tabs" role="tablist">
        <button role="tab" type="button" data-tab="bg" aria-selected="true">Background</button>
        <button role="tab" type="button" data-tab="saver" aria-selected="false">Screen Saver</button>
        <button role="tab" type="button" data-tab="look" aria-selected="false">Appearance</button></div>
      <div class="monitor" aria-hidden="true"><div class="screen"><canvas hidden></canvas></div><i></i></div><div class="stand" aria-hidden="true"></div>
      <div data-pane="bg"><fieldset class="group"><legend>Wallpaper</legend>
        <div class="listbox" role="listbox" aria-label="Wallpaper" tabindex="0">${WALLS.map(([k, n]) => `<div role="option" data-wall="${k}" aria-selected="false">${n}</div>`).join('')}</div>
      </fieldset></div>
      <div data-pane="saver" hidden><fieldset class="group"><legend>Screen Saver</legend>
        <p class="row"><select class="win-select" data-pref="saver" aria-label="Screen saver">${SAVERS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><button class="btn" type="button" data-preview>Preview</button></p>
        <p class="row"><label>Wait <select class="win-select" data-pref="wait">${[1, 2, 5, 10].map(m => `<option value="${m}">${m}</option>`).join('')}</select> minutes</label></p>
        <p class="small">Starts when you leave the desktop alone. Move the mouse or press a key to come back.</p>
      </fieldset></div>
      <div data-pane="look" hidden><fieldset class="group"><legend>Effects</legend>
        ${ck('dragfull', 'Show window contents while dragging', 'Off moves a dotted outline, like the real thing.')}
        ${ck('cursors', 'Pixel mouse pointers', 'Arrow and hourglass in pixels.')}
        ${ck('scanlines', 'Scanlines on start up screens', 'The dark CRT lines over the BIOS.')}
      </fieldset></div>
      <p class="buttons"><button class="btn primary" type="button" data-ok>OK</button><button class="btn" type="button" data-cancel>Cancel</button><button class="btn" type="button" data-apply>Apply</button></p>`;
  }
  function displayInit(el, o) {
    const pend = { wall: S.wall, saver: S.saver, wait: S.wait, dragfull: S.dragfull, cursors: S.cursors, scanlines: S.scanlines };
    const scr = el.querySelector('.screen'), cv = scr.querySelector('canvas'), list = el.querySelector('.listbox');
    let tab = 'bg', mini = null, miniCv = null;
    function preview() {
      if (mini) { mini.stop(); mini = null; }
      if (miniCv) { miniCv.remove(); miniCv = null; }
      if (tab === 'saver') {
        WALLS.forEach(([k]) => scr.classList.remove('wall-' + k)); cv.hidden = true; scr.classList.add('off');
        if (pend.saver !== 'none') { miniCv = document.createElement('canvas'); scr.appendChild(miniCv); mini = Saver.on(miniCv, pend.saver, true); }
      } else { scr.classList.remove('off'); applyWall(pend.wall, scr, cv); }
    }
    function sync() {
      $$('[data-wall]', el).forEach(w => w.setAttribute('aria-selected', String(w.dataset.wall === pend.wall)));
      $$('[data-pref]', el).forEach(s => { s.value = String(pend[s.dataset.pref]); });
      $$('[data-pend]', el).forEach(c => { c.checked = !!pend[c.dataset.pend]; });
    }
    const commit = () => Object.keys(pend).forEach(k => { if (pend[k] !== S[k]) setSetting(k, pend[k]); });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (t) {
        tab = t.dataset.tab;
        $$('[data-tab]', el).forEach(b => b.setAttribute('aria-selected', String(b === t)));
        $$('[data-pane]', el).forEach(p => { p.hidden = p.dataset.pane !== tab; });
        preview();
      }
      const w = e.target.closest('[data-wall]'); if (w) { pend.wall = w.dataset.wall; Snd.tick(); sync(); preview(); }
      if (e.target.closest('[data-preview]') && pend.saver !== 'none') Saver.start(pend.saver, true);
      if (e.target.closest('[data-ok]')) { commit(); closeWin('display'); }
      if (e.target.closest('[data-cancel]')) closeWin('display');
      if (e.target.closest('[data-apply]')) commit();
    });
    el.addEventListener('change', e => {
      const s = e.target.closest('[data-pref]'); if (s) { pend[s.dataset.pref] = s.dataset.pref === 'wait' ? +s.value : s.value; preview(); }
      const c = e.target.closest('[data-pend]'); if (c) pend[c.dataset.pend] = c.checked;
    });
    list.addEventListener('keydown', e => {
      const i = WALLS.findIndex(w => w[0] === pend.wall), d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault(); pend.wall = WALLS[(i + d + WALLS.length) % WALLS.length][0]; sync(); preview();
    });
    o.onClose = () => { if (mini) mini.stop(); };
    if (!small()) el.style.height = 'auto';
    sync(); preview();
  }

  // ------------------------------------------------------------------ screen saver
  const Saver = (() => {
    let el = null, run1 = null, last = Date.now(), armed = 0, p0 = null;
    function stars(cv, mini) {
      const c = cv.getContext('2d'); let W = 1, H = 1, raf = 0, prev = performance.now();
      const size = () => { const r = cv.getBoundingClientRect(); W = cv.width = Math.max(1, Math.round(r.width)); H = cv.height = Math.max(1, Math.round(r.height)); };
      const spawn = far => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: far ? 1 : Math.random() * .95 + .05 });
      const st = Array.from({ length: mini ? 70 : 340 }, () => spawn(false));
      size();
      const ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null; if (ro) ro.observe(cv);
      (function frame(t) {
        const dt = Math.min(.05, (t - prev) / 1000); prev = t;
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        const sc = Math.max(W, H) * .5;
        for (const p of st) {
          p.z -= dt * .32;
          const sx = W / 2 + p.x / p.z * sc * .5, sy = H / 2 + p.y / p.z * sc * .5;
          if (p.z <= .03 || sx < 0 || sx >= W || sy < 0 || sy >= H) { Object.assign(p, spawn(true)); continue; }
          const k = 1 - p.z, sz = Math.max(1, Math.round(k * (mini ? 2 : 4))), g = Math.round(80 + 175 * k);
          c.fillStyle = `rgb(${g},${g},${g})`; c.fillRect(sx | 0, sy | 0, sz, sz);
        }
        raf = requestAnimationFrame(frame);
      })(prev);
      return { stop() { cancelAnimationFrame(raf); if (ro) ro.disconnect(); } };
    }
    function bugs(cv, mini) {
      const sig = window.PixelSignature(cv, { lines: ['FAUZAN', 'FAUZY'], cell: mini ? 3 : 10, bugs: mini ? 2 : 6, firstWaveAt: .4, align: 'center', font: '700 {size}px "IBM Plex Mono", monospace' });
      return { stop: sig.stop };
    }
    const on = (cv, kind, mini) => kind === 'stars' ? stars(cv, mini) : kind === 'bugs' ? bugs(cv, mini) : null;
    function start(kind, preview) {
      if (el || kind === 'none') return;
      hideMenus();
      el = document.createElement('div'); el.className = 'saver'; el.innerHTML = '<canvas aria-hidden="true"></canvas>';
      document.body.appendChild(el);
      armed = Date.now() + (preview ? 800 : 300); p0 = null;
      run1 = on(el.firstChild, kind, false);
    }
    function stop() { if (!el) return; if (run1) run1.stop(); el.remove(); el = null; run1 = null; last = Date.now(); }
    const wake = e => {
      last = Date.now();
      if (!el || Date.now() < armed) return;
      if (e.type === 'pointermove') {
        if (!p0) { p0 = [e.clientX, e.clientY]; return; }
        if (Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) < 8) return;
      }
      stop();
      if (e.type !== 'pointermove') { e.preventDefault(); e.stopPropagation(); }
    };
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => addEventListener(t, wake, { capture: true, passive: false }));
    addEventListener('scroll', () => { last = Date.now(); }, { capture: true, passive: true });
    setInterval(() => {
      const playing = $$('video').some(v => !v.paused);
      if (!el && mode === 'desk' && S.saver !== 'none' && !reduce && !playing && document.visibilityState === 'visible' && Date.now() - last > S.wait * 60000) start(S.saver);
    }, 5000);
    return { on, start, stop, bump: () => { last = Date.now(); } };
  })();

  // ------------------------------------------------------------------ Bug Sweeper
  const LEVELS = { b: { w: 9, h: 9, n: 10, name: 'Beginner' }, i: { w: 16, h: 16, n: 40, name: 'Intermediate' } };
  function sweeperBody() {
    return `<div class="menubar sw-menu"><button type="button" data-lvl="b">Beginner</button><button type="button" data-lvl="i">Intermediate</button>${coarse ? '<button type="button" data-flagmode aria-pressed="false">Flag mode: off</button>' : ''}</div>
      <div class="sweeper">
        <div class="sw-head"><span class="led" data-left aria-label="Bugs left">010</span><button type="button" class="face" data-face aria-label="New game"></button><span class="led" data-time aria-label="Seconds">000</span></div>
        <div class="sw-board" role="grid" tabindex="0" aria-label="Bug Sweeper. Arrow keys to move, Space to open, F to flag."></div>
        <p class="sw-hint small">${coarse ? 'Tap to open. Long press, or Flag mode, to flag a bug.' : 'Click to open. Right click to flag a bug. Click a number to open around it.'}</p>
      </div>`;
  }
  function sweeperInit(el, o) {
    const board = el.querySelector('.sw-board'), face = el.querySelector('[data-face]'), left = el.querySelector('[data-left]'), time = el.querySelector('[data-time]'), status = el.querySelector('.statusbar');
    let lk = 'b', L, cells, state, flags, opened, t0, timer = 0, cur = 0, kbd = false, flagMode = false, pressT = 0, longP = false;
    o.sweep = { activation: false, reset };
    o.onClose = () => clearInterval(timer);
    const best = k => { try { return +localStorage.getItem('fauzos.best.' + k) || 0; } catch (e) { return 0; } };
    const led = n => n < 0 ? '-' + String(Math.min(99, -n)).padStart(2, '0') : String(Math.min(999, n)).padStart(3, '0');
    const setFace = f => { face.innerHTML = px(ART['face' + f]); face.dataset.state = f; };
    const size = () => small() ? Math.max(18, Math.min(32, Math.floor((innerWidth - 44) / L.w))) : 24;
    const nb = i => { const x = i % L.w, y = (i / L.w) | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if ((dx || dy) && xx >= 0 && yy >= 0 && xx < L.w && yy < L.h) r.push(yy * L.w + xx); } return r; };
    function showStatus() { const b = best(lk); status.innerHTML = `<span>${o.sweep.activation ? 'Activation round' : L.name}</span><span>Best: ${b ? b + ' s' : 'none yet'}</span>`; }
    function reset(k) {
      if (k) lk = k; L = LEVELS[lk];
      cells = Array.from({ length: L.w * L.h }, () => ({ bug: false, open: false, flag: false, n: 0 }));
      state = 'ready'; flags = 0; opened = 0; clearInterval(timer); cur = Math.min(cur, cells.length - 1);
      board.style.setProperty('--c', size() + 'px'); board.style.gridTemplateColumns = `repeat(${L.w}, var(--c))`;
      board.innerHTML = cells.map((_, i) => `<div class="sw-cell" data-i="${i}"></div>`).join('');
      left.textContent = led(L.n); time.textContent = '000'; setFace('Ok');
      $$('[data-lvl]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lvl === lk)));
      showStatus();
      if (!small() && !el.classList.contains('max')) { el.style.width = Math.max(280, L.w * size() + 46) + 'px'; el.style.height = 'auto'; }
      if (kbd) paint(cur);
    }
    function plant(safe) {
      const ban = new Set([safe, ...nb(safe)]); let n = 0;
      while (n < L.n) { const i = Math.floor(Math.random() * cells.length); if (ban.has(i) || cells[i].bug) continue; cells[i].bug = true; n++; }
      cells.forEach((c, i) => { c.n = nb(i).filter(j => cells[j].bug).length; });
    }
    function paint(i) {
      const c = cells[i], d = board.children[i];
      d.className = 'sw-cell' + (c.open ? ' open' : '') + (c.boom ? ' boom' : '') + (c.wrong ? ' wrong' : '') + (kbd && i === cur ? ' cur' : '');
      d.innerHTML = c.open ? (c.bug ? px(ART.swbug) : c.n ? `<b class="n${c.n}">${c.n}</b>` : '') : (c.flag || c.wrong) ? (c.wrong ? px(ART.swbug) : px(ART.flag)) : '';
    }
    function open(i) {
      const c = cells[i]; if (c.open || c.flag || state === 'over' || state === 'won') return;
      if (state === 'ready') {
        plant(i); state = 'play'; t0 = Date.now();
        timer = setInterval(() => { time.textContent = led(Math.floor((Date.now() - t0) / 1000)); }, 250);
      }
      if (c.bug) { c.boom = true; lose(); return; }
      const stack = [i];
      while (stack.length) {
        const j = stack.pop(), q = cells[j];
        if (q.open || q.flag) continue;
        q.open = true; opened++; paint(j);
        if (!q.n) nb(j).forEach(k => { if (!cells[k].open && !cells[k].bug) stack.push(k); });
      }
      if (opened === cells.length - L.n) win();
    }
    function chord(i) {
      const c = cells[i]; if (!c.open || !c.n) return;
      const ns = nb(i); if (ns.filter(j => cells[j].flag).length !== c.n) return;
      ns.forEach(j => open(j));
    }
    function flag(i) {
      const c = cells[i]; if (c.open || state === 'over' || state === 'won') return;
      c.flag = !c.flag; flags += c.flag ? 1 : -1; left.textContent = led(L.n - flags); paint(i); Snd.tick(c.flag ? 1800 : 1300);
    }
    function lose() {
      state = 'over'; clearInterval(timer);
      cells.forEach((c, i) => { if (c.bug && !c.flag) c.open = true; if (c.flag && !c.bug) c.wrong = true; paint(i); });
      setFace('Dead'); Snd.boom();
      if (o.sweep.activation) setTimeout(() => msgBox({
        title: 'FAUZ OS Activation', icon: 'err',
        html: 'Activation failed.<br><br>Error 0xB06: a bug was found but not fixed. Fauzan would have fixed it.',
        buttons: [{ label: 'Try again', primary: true, fn: () => reset() }, { label: 'Cancel' }],
      }), 700);
    }
    function win() {
      state = 'won'; clearInterval(timer);
      const s = Math.max(1, Math.round((Date.now() - t0) / 1000));
      cells.forEach((c, i) => { if (c.bug && !c.flag) { c.flag = true; paint(i); } });
      left.textContent = '000'; setFace('Cool'); Snd.tada();
      const b = best(lk); if (!b || s < b) { try { localStorage.setItem('fauzos.best.' + lk, String(s)); } catch (e) { /* private mode */ } }
      if (o.sweep.activation) { o.sweep.activation = false; setTimeout(activated, 900); }
      showStatus();
    }
    board.addEventListener('contextmenu', e => { e.preventDefault(); const d = e.target.closest('.sw-cell'); if (d && e.pointerType !== 'touch') flag(+d.dataset.i); });
    board.addEventListener('pointerdown', e => {
      const d = e.target.closest('.sw-cell'); if (!d || state === 'over' || state === 'won' || e.button === 2) return;
      if (e.button === 1) { e.preventDefault(); chord(+d.dataset.i); return; }
      kbd = false; setFace('Oh'); longP = false;
      if (e.pointerType !== 'mouse') pressT = setTimeout(() => { longP = true; flag(+d.dataset.i); setFace('Ok'); if (navigator.vibrate) navigator.vibrate(15); }, 420);
    });
    board.addEventListener('pointerup', e => {
      clearTimeout(pressT);
      if (state === 'over' || state === 'won') return;
      if (face.dataset.state === 'Oh') setFace('Ok');
      const d = e.target.closest('.sw-cell'); if (!d || e.button !== 0 || longP) return;
      const i = +d.dataset.i;
      if (flagMode) { flag(i); return; }
      if (cells[i].open) chord(i); else { Snd.tick(); open(i); }
    });
    board.addEventListener('pointerleave', () => { clearTimeout(pressT); if (face.dataset.state === 'Oh') setFace('Ok'); });
    board.addEventListener('keydown', e => {
      const x = cur % L.w, y = (cur / L.w) | 0, mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      const prev = cur;
      if (mv) { cur = Math.max(0, Math.min(L.h - 1, y + mv[1])) * L.w + Math.max(0, Math.min(L.w - 1, x + mv[0])); }
      else if (e.key === ' ' || e.key === 'Enter') { if (cells[cur].open) chord(cur); else open(cur); }
      else if (e.key === 'f' || e.key === 'F') flag(cur);
      else return;
      e.preventDefault(); kbd = true; paint(prev); paint(cur);
    });
    el.querySelector('.sw-menu').addEventListener('click', e => {
      const b = e.target.closest('[data-lvl]'); if (b) { o.sweep.activation = false; reset(b.dataset.lvl); }
      const f = e.target.closest('[data-flagmode]'); if (f) { flagMode = !flagMode; f.setAttribute('aria-pressed', String(flagMode)); f.textContent = 'Flag mode: ' + (flagMode ? 'on' : 'off'); }
    });
    face.addEventListener('click', () => reset());
    reset('b');
  }
  function openSweeper(act) {
    openApp('sweeper', null);
    const o = wins.get('sweeper');
    if (o && o.sweep) { o.sweep.activation = !!act; o.sweep.reset('b'); }
  }

  // ------------------------------------------------------------------ activation, the joke
  function activateBody() {
    if (S.activated) return `<h1>FAUZ OS is activated</h1>
      <p class="lead">Thank you. This copy of FAUZ OS is genuine.</p>
      <p>You proved you are not a bug. If you would like the programmer as well, the enterprise licence is still open.</p>
      <p><a class="btn primary" href="mailto:${mail}?subject=${encodeURIComponent('FAUZ OS enterprise licence (IWSP)')}">Request the enterprise licence</a></p>`;
    return `<h1>Activate FAUZ OS</h1>
      <p class="lead">This copy of FAUZ OS has not been activated.</p>
      <p>Everything still works. The watermark stays, and the bugs can tell.</p>
      <fieldset class="group"><legend>Option 1: Prove you are not a bug</legend>
        <p>Clear one round of Bug Sweeper on Beginner. No product key needed.</p>
        <p><button class="btn primary" type="button" data-act="sweep-activate">Start Bug Sweeper</button></p></fieldset>
      <fieldset class="group"><legend>Option 2: Enterprise licence</legend>
        <p>Includes one (1) programmer, full time, from 3 May 2027 to 7 April 2028. Payable in IWSP.</p>
        <p><a class="btn" href="mailto:${mail}?subject=${encodeURIComponent('FAUZ OS enterprise licence (IWSP)')}">Request a licence</a></p></fieldset>`;
  }
  function activated() {
    setSetting('activated', true);
    Snd.chime();
    const a = wins.get('activate'); if (a) a.el.querySelector('.content').innerHTML = activateBody();
    msgBox({ title: 'FAUZ OS Activation', icon: 'info', sound: false, html: 'FAUZ OS is now activated.<br><br>Thank you for choosing genuine bug fixing. The watermark is gone, and the bugs have been told.' });
  }
  const balloon = $('#balloon');
  let balloonDone = false;
  function nag() {
    if (balloonDone || S.activated || mode !== 'desk') return;
    balloonDone = true; balloon.hidden = false;
    setTimeout(() => { balloon.hidden = true; }, 14000);
  }
  balloon.addEventListener('click', e => { balloon.hidden = true; if (!e.target.closest('[data-x]')) openApp('activate', balloon); });
  $('#activate-mark').addEventListener('click', e => openApp('activate', e.currentTarget));
  const ACTS = { setup: () => boot({ setup: true }), restart: () => boot({}), shutdown: () => shutdown(), readme: () => openApp('readme'), 'sweep-activate': () => openSweeper(true) };

  // pixel mouse pointers
  function curUrl(art, hx, hy, fallback) {
    const pal = { K: '#000', W: '#fff', O: '#ee7a3c' }, h = art.length, w = art[0].length;
    let r = '';
    art.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`; }));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, ${fallback}`;
  }
  const CUR = { arrow: curUrl(ART.arrow, 0, 0, 'default'), wait: curUrl(ART.hourglass, 5, 8, 'wait') };
  document.documentElement.style.setProperty('--cur-arrow', CUR.arrow);

  // icons
  const icons = $('#icons');
  function buildIcons() {
    const order = [...D.levels.map(l => l.id), 'readme', 'about', 'contact', 'bugs', 'sweeper', 'control', 'display', 'classic'];
    icons.innerHTML = order.map(id => {
      const a = apps[id];
      const pic = a.cover ? `<canvas width="24" height="24"></canvas>` : px(ART[a.icon]);
      return `<button class="icon" type="button" role="option" aria-selected="false" data-id="${id}"><span class="pic">${pic}</span><span class="label">${esc(a.title)}</span></button>`;
    }).join('');
    $$('.icon', icons).forEach(b => { const a = apps[b.dataset.id]; if (a.cover) pixelThumb(a.cover, $('canvas', b)); });
  }
  const selectIcon = b => $$('.icon', icons).forEach(i => i.setAttribute('aria-selected', String(i === b)));
  icons.addEventListener('click', e => {
    const b = e.target.closest('.icon'); if (!b) return;
    selectIcon(b);
    if (coarse || small() || e.detail === 0) openApp(b.dataset.id, b);   // tap, or keyboard Enter/Space
  });
  icons.addEventListener('dblclick', e => { const b = e.target.closest('.icon'); if (b && !coarse && !small()) openApp(b.dataset.id, b); });
  icons.addEventListener('keydown', e => {
    const list = $$('.icon', icons), i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: small() ? 1 : 0, ArrowLeft: small() ? -1 : 0 }[e.key];
    if (step) { e.preventDefault(); const n = list[(i + step + list.length) % list.length]; n.focus(); selectIcon(n); }
  });
  desk.addEventListener('pointerdown', e => { if (e.target === desk || e.target === icons) selectIcon(null); });

  // start menu
  const startMenu = $('#start-menu'), startBtn = $('#start'), ctxMenu = $('#ctx');
  $('#start-ico').innerHTML = px(ART.start);
  $('#start-list').innerHTML = `<p class="sub">Programs</p>
    ${D.levels.map(l => `<button type="button" role="menuitem" data-open="${l.id}">${esc(short(l))}</button>`).join('')}
    <hr><p class="sub">Documents</p>
    <button type="button" role="menuitem" data-open="readme">README.TXT</button>
    <button type="button" role="menuitem" data-open="about">About Fauzan</button>
    <button type="button" role="menuitem" data-open="contact">Contact</button>
    <hr><p class="sub">Games</p>
    <button type="button" role="menuitem" data-open="sweeper">Bug Sweeper</button>
    <button type="button" role="menuitem" data-open="bugs">BUGS.EXE</button>
    <hr><p class="sub">Settings</p>
    <button type="button" role="menuitem" data-open="control">Control Panel</button>
    <button type="button" role="menuitem" data-open="display">Display Properties</button>
    <button type="button" role="menuitem" data-open="system">System Properties</button>
    <button type="button" role="menuitem" data-open="activate">Activate FAUZ OS</button>
    <button type="button" role="menuitem" data-act="setup">BIOS Setup</button>
    <a role="menuitem" href="classic.html">Plain version</a>
    <hr>
    <button type="button" role="menuitem" data-act="restart">Restart</button>
    <button type="button" role="menuitem" data-act="shutdown">Shut Down</button>`;
  function hideMenus() { startMenu.hidden = true; ctxMenu.hidden = true; startBtn.setAttribute('aria-expanded', 'false'); }
  function toggleStart(show) {
    ctxMenu.hidden = true;
    startMenu.hidden = !show; startBtn.setAttribute('aria-expanded', String(show));
    if (show) { const f = $('button, a', startMenu); if (f) f.focus({ preventScroll: true }); }
  }
  startBtn.addEventListener('click', e => { e.stopPropagation(); toggleStart(startMenu.hidden); });
  function menuAction(t) {
    const o = t.closest('[data-open]'), a = t.closest('[data-act]');
    if (!o && !a) return false;
    hideMenus();
    if (o) openApp(o.dataset.open, startBtn);
    else if (ACTS[a.dataset.act]) ACTS[a.dataset.act]();
    return true;
  }
  startMenu.addEventListener('click', e => menuAction(e.target));
  ctxMenu.addEventListener('click', e => menuAction(e.target));
  [startMenu, ctxMenu].forEach(m => m.addEventListener('keydown', e => {
    const items = $$('button, a', m), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
  }));
  document.addEventListener('pointerdown', e => {
    if (!startMenu.hidden && !e.target.closest('#start-menu, #start')) hideMenus();
    if (!ctxMenu.hidden && !e.target.closest('#ctx')) ctxMenu.hidden = true;
  });
  desk.addEventListener('contextmenu', e => {
    if (e.target.closest('.window')) return;
    e.preventDefault();
    const icon = e.target.closest('.icon');
    if (icon) {
      selectIcon(icon);
      ctxMenu.innerHTML = `<button type="button" role="menuitem" data-open="${icon.dataset.id}"><b>Open</b></button>`;
    } else {
      ctxMenu.innerHTML = `<button type="button" role="menuitem" data-open="readme">Open README.TXT</button>
        <button type="button" role="menuitem" data-open="sweeper">Bug Sweeper</button>
        <button type="button" role="menuitem" data-open="control">Control Panel</button>
        <hr>
        <button type="button" role="menuitem" data-open="display">Properties</button>
        <hr>
        <button type="button" role="menuitem" data-act="restart">Restart</button>
        <button type="button" role="menuitem" data-act="shutdown">Shut Down</button>`;
    }
    startMenu.hidden = true; startBtn.setAttribute('aria-expanded', 'false');
    ctxMenu.hidden = false;
    const w = ctxMenu.offsetWidth, h = ctxMenu.offsetHeight;
    ctxMenu.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px';
    ctxMenu.style.top = Math.min(e.clientY, innerHeight - h - 48) + 'px';
    const f = $('button', ctxMenu); if (f) f.focus({ preventScroll: true });
  });

  // tray, clock
  const tray = $('#tray-sound'), clock = $('#clock');
  function trayIcon() {
    tray.innerHTML = ICO(S.sound ? 'sndOn' : 'sndOff');
    tray.setAttribute('aria-pressed', String(S.sound));
    tray.setAttribute('aria-label', S.sound ? 'Sound is on. Turn it off' : 'Sound is off. Turn it on');
    const ps = $('#power-sound'); ps.textContent = S.sound ? 'Sound on' : 'Sound off'; ps.setAttribute('aria-pressed', String(S.sound));
  }
  tray.addEventListener('click', () => { setSetting('sound', !S.sound); if (S.sound) Snd.beep(1200, .06); });
  const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' }) + ' SGT'; };
  tick(); setInterval(tick, 15000);
  function applySettings() {
    crt.classList.toggle('scan', S.scanlines);
    trayIcon();
    if (!S.sound) Snd.hush();
    $$('[data-set]').forEach(i => { i.checked = !!S[i.dataset.set]; });
    applyWall(S.wall, desk, $('#wall-canvas'));
    document.body.classList.toggle('px-cursor', S.cursors);
    document.documentElement.style.setProperty('--cur-wait', S.cursors ? CUR.wait : 'wait');
    $('#activate-mark').hidden = S.activated;
    $('#wallmark').hidden = !S.activated;
    if (S.activated) balloon.hidden = true;
  }

  function desktop(openId) {
    run++; mode = 'desk'; allowSetup = false;
    clearInterval(setupTimer); clearInterval(revealTimer);
    hideAll(); $('#os').hidden = false;
    Snd.fanOff(2.5); Snd.chime();
    if (!booted) { booted = true; buildIcons(); }
    openApp(openId || 'readme', null, true);
    Saver.bump();
    if (!S.activated) setTimeout(nag, 45000);
  }

  async function shutdown() {
    const my = ++run; mode = 'halt';
    hideMenus(); closeAll();
    $('#os').hidden = true;
    const h = $('#halt'), msg = $('#halt-msg');
    h.hidden = false; h.classList.add('wait');
    msg.textContent = 'FAUZ OS is shutting down...';
    Snd.chime(true);
    await sleep(reduce ? 200 : 1600);
    if (my !== run) return;
    h.classList.remove('wait');
    msg.textContent = 'It is now safe to close this tab.';
    $('#halt-restart').focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ keys, power, start
  addEventListener('keydown', e => {
    if (mode === 'post') {
      if (paused && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) { paused = false; e.preventDefault(); return; }
      if (e.key === 'Delete' || e.key === 'Del' || e.key === 'Backspace') { wantSetup = true; e.preventDefault(); }
      else if (e.key === 'Escape') { skipMem = true; e.preventDefault(); }
      else if (e.key === 'Pause') { paused = true; e.preventDefault(); }
      return;
    }
    if (mode === 'setup') { if (e.target.closest && e.target.closest('#post-skip')) { if (e.key === 'Enter' || e.key === ' ') return; } keySetup(e); return; }
    if (mode === 'desk' && e.key === 'Escape') {
      if (!ctxMenu.hidden || !startMenu.hidden) { hideMenus(); startBtn.focus(); return; }
      const t = topWin(); if (t) closeWin(t);
    }
  });
  addEventListener('resize', () => {
    if (mode === 'setup') { measure(); drawSetup(); }
    else if (mode === 'post') measure(true);
  });

  $('#post-skip').addEventListener('click', () => desktop());
  $('#halt-restart').addEventListener('click', () => boot({}));
  $('#power-skip').addEventListener('click', () => { Snd.unlock(); desktop(); });
  $('#power-sound').addEventListener('click', () => setSetting('sound', !S.sound));
  $('#power-btn').addEventListener('click', () => {
    if (mode !== 'power') return;
    Snd.unlock(); Snd.thunk();
    $('#power').classList.add('on');
    setTimeout(() => boot({}), reduce ? 0 : 380);
  });

  applySettings();
  if (location.hash === '#desktop') desktop();
  else if (location.hash === '#setup' || location.hash === '#bios') { $('#power').hidden = false; $('#power').classList.add('on'); boot({ setup: true }); }
  else { $('#power').hidden = false; $('#power-btn').focus({ preventScroll: true }); }
})();
