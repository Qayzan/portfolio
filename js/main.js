(() => {
  const data = window.PORTFOLIO;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');

  // ------------------------------------------------------------- level list
  const list = document.getElementById('levels');
  list.innerHTML = data.levels.map((l, i) => `
    <li class="level reveal">
      <button class="level-btn" type="button" data-id="${l.id}" aria-haspopup="dialog">
        <img class="level-thumb${l.pixel ? ' pixel' : ''}" src="${l.cover}" width="${l.coverW}" height="${l.coverH}" alt="" loading="lazy">
        <span class="level-num">LVL ${pad(i + 1)}</span>
        <span class="level-title">${esc(l.title)}</span>
        <span class="level-meta">${esc(l.kind)}, ${esc(l.dates)}</span>
        <span class="level-status" data-status="${esc(l.status)}">${esc(l.status)}</span>
      </button>
    </li>`).join('');

  // ------------------------------------------------------------- side quests
  document.getElementById('quests').innerHTML = data.quests.map(q => `
    <article class="quest reveal">
      <span class="tag">${esc(q.tag)}</span>
      <h3>${esc(q.title)}</h3>
      <p>${esc(q.text)}</p>
      <span class="quest-stack">${esc(q.stack)}</span>
    </article>`).join('');

  // ------------------------------------------------------------- hover preview (mouse only)
  const preview = document.getElementById('hover-preview');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine) {
    let x = innerWidth / 2, y = innerHeight / 2, px = x, py = y, raf = 0;
    const follow = () => {
      px += (x - px) * (reduceMotion ? 1 : 0.18);
      py += (y - py) * (reduceMotion ? 1 : 0.18);
      preview.style.left = px + 'px';
      preview.style.top = py + 'px';
      raf = preview.classList.contains('show') ? requestAnimationFrame(follow) : 0;
    };
    list.addEventListener('pointermove', e => { x = e.clientX + 210; y = e.clientY; });
    list.querySelectorAll('.level-btn').forEach(btn => {
      const level = data.levels.find(l => l.id === btn.dataset.id);
      btn.addEventListener('pointerenter', e => {
        preview.src = level.cover;
        preview.classList.toggle('pixel', !!level.pixel);
        x = px = e.clientX + 210; y = py = e.clientY;
        preview.classList.add('show');
        if (!raf) raf = requestAnimationFrame(follow);
      });
      btn.addEventListener('pointerleave', () => preview.classList.remove('show'));
    });
  }

  // ------------------------------------------------------------- level dialog
  const dialog = document.getElementById('level-dialog');
  const body = document.getElementById('level-dialog-body');
  let current = -1;

  function render(i) {
    const l = data.levels[i];
    const media = l.video
      ? `<div class="dialog-media"><video controls preload="none" playsinline poster="${l.video.poster}" src="${l.video.src}"></video></div>
         <p class="media-caption">${esc(l.video.caption)}</p>`
      : `<div class="dialog-media"><img src="${l.cover}" width="${l.coverW}" height="${l.coverH}" alt="${esc(l.title)} screenshot"></div>`;
    const tall = l.gallery.length && /eduvision|mobile/.test(l.gallery[0][0]);
    body.innerHTML = `
      <div class="dialog-bar">
        <span class="mono">LVL ${pad(i + 1)} / ${pad(data.levels.length)} | ${esc(l.status)}</span>
        <div class="dialog-nav">
          <button class="icon-btn" type="button" data-step="-1" aria-label="Previous project">←</button>
          <button class="icon-btn" type="button" data-step="1" aria-label="Next project">→</button>
          <button class="icon-btn" type="button" data-close aria-label="Close">✕</button>
        </div>
      </div>
      <h2 class="dialog-title" id="level-dialog-title">${esc(l.title)}</h2>
      <p class="dialog-tagline">${esc(l.tagline)}</p>
      <p class="dialog-meta mono"><span>${esc(l.kind)}</span><span>${esc(l.dates)}</span><span>${esc(l.role)}</span></p>
      ${l.links.length ? `<div class="dialog-links">${l.links.map(([label, href, primary]) =>
        `<a class="btn${primary ? ' btn-primary' : ''}" href="${href}" target="_blank" rel="noopener">${esc(label)}</a>`).join('')}</div>` : ''}
      ${l.note ? `<p class="note">${esc(l.note)}</p>` : ''}
      ${media}
      <div class="stats">${l.stats.map(([v, k]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
      <div class="dialog-cols">
        <div><h3>What I built</h3><ul class="built">${l.built.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>
        <div><h3>Toolbox</h3><ul class="tags">${l.stack.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      </div>
      ${l.gallery.length ? `<h3>Screens</h3><div class="gallery${tall ? ' tall' : ''}">${l.gallery.map(([src, cap]) =>
        `<figure><img src="${src}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div>` : ''}
      ${l.credit ? `<p class="credit">${esc(l.credit)}</p>` : ''}`;
    dialog.scrollTop = 0;
  }

  function open(i, push = true) {
    current = (i + data.levels.length) % data.levels.length;
    render(current);
    if (!dialog.open) dialog.showModal();
    if (push) history.replaceState(null, '', '#level-' + data.levels[current].id);
    document.body.style.overflow = 'hidden';
  }

  function close() { if (dialog.open) dialog.close(); }

  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    dialog.querySelectorAll('video').forEach(v => v.pause());
    if (location.hash.startsWith('#level-')) history.replaceState(null, '', '#work');
    const btn = list.querySelector(`[data-id="${data.levels[current]?.id}"]`);
    if (btn) btn.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', e => {
    if (e.target === dialog) return close();               // backdrop
    const step = e.target.closest('[data-step]');
    if (step) { dialog.querySelectorAll('video').forEach(v => v.pause()); open(current + Number(step.dataset.step)); }
    if (e.target.closest('[data-close]')) close();
  });
  dialog.addEventListener('keydown', e => {
    if (e.target.closest('video')) return;
    if (e.key === 'ArrowRight') open(current + 1);
    if (e.key === 'ArrowLeft') open(current - 1);
  });
  list.addEventListener('click', e => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;
    preview.classList.remove('show');
    open(data.levels.findIndex(l => l.id === btn.dataset.id));
  });

  const fromHash = () => {
    const m = location.hash.match(/^#level-(.+)$/);
    if (!m) return;
    const i = data.levels.findIndex(l => l.id === m[1]);
    if (i >= 0) open(i, false);
  };
  addEventListener('hashchange', fromHash);
  fromHash();

  // ------------------------------------------------------------- tagline: words light up one at a time
  const tagline = document.getElementById('tagline');
  if (tagline) {
    const words = tagline.textContent.trim().split(/\s+/);
    tagline.innerHTML = words.map(w => `<span class="w">${esc(w)}</span>`).join(' ');
    const spans = [...tagline.querySelectorAll('.w')];
    if (reduceMotion || !('IntersectionObserver' in window)) spans.forEach(w => w.classList.add('on'));
    else {
      let ticking = false;
      const update = () => {
        ticking = false;
        const line = innerHeight * 0.62;
        for (const w of spans) w.classList.toggle('on', w.getBoundingClientRect().top < line);
      };
      const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting) addEventListener('scroll', onScroll, { passive: true });
        else removeEventListener('scroll', onScroll);
        update();
      }, { rootMargin: '20% 0px 20% 0px' }).observe(tagline);
    }
  }

  // ------------------------------------------------------------- nav: mark the section in view
  const navLinks = [...document.querySelectorAll('.nav .nav-link')];
  if ('IntersectionObserver' in window) {
    const sections = navLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const seen = new Map();
    const nio = new IntersectionObserver(entries => {
      entries.forEach(en => seen.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0));
      let best = null, ratio = 0;
      seen.forEach((r, id) => { if (r > ratio) { ratio = r; best = id; } });
      navLinks.forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + best));
      navLinks.forEach(a => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
    }, { threshold: [0, .15, .3, .5, .7] });
    sections.forEach(sec => nio.observe(sec));
  }

  // ------------------------------------------------------------- reveal on scroll
  const items = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) items.forEach(el => el.classList.add('in'));
  else {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el, i) => { el.style.transitionDelay = (i % 5) * 60 + 'ms'; io.observe(el); });
  }
})();
