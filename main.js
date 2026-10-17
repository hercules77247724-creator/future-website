(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const agents = [
    ['Atlas','Navigation & planning'],['Scribe','Writing & documents'],['Relay','Messaging & handoff'],
    ['Vector','Data & analysis'],['Echo','Voice & memory'],['Forge','Build & creation'],['Sage','Research & insight']
  ];
  // orbit radius (% of stage), period (s), start angle (deg)
  const cfg = [[24,50,10],[31,64,150],[38,78,260],[44,92,60],[27,56,200],[35,110,320],[41,120,110]];
  const host = document.getElementById('orbits');
  agents.forEach(([name,role],i) => {
    const [r,t,a] = cfg[i];
    const orbit = document.createElement('div');
    orbit.className = 'orbit';
    orbit.style.cssText = `width:${r*2}%;height:${r*2}%;--t:${t}s;--o:${-(a/360)*t}s`;
    if (i % 2) orbit.style.animationDirection = 'reverse';
    const node = document.createElement('div');
    node.className = 'node';
    node.innerHTML = `<span class="node__dot"></span><span class="node__label">${name}<small>${role}</small></span>`;
    if (i % 2) node.firstElementChild.nextElementSibling.style.animationDirection = 'reverse';
    orbit.appendChild(node);
    host.appendChild(orbit);
  });

  // particles drifting along gold paths
  const cv = document.getElementById('particles');
  const ctx = cv.getContext('2d');
  let W, H, dpr, parts = [], raf, last = 0;
  const N = 60;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function make() {
    // each particle travels along an ellipse centered on screen (a gold path)
    return {
      rx: .15 + Math.random()*.4, ry: .12 + Math.random()*.32,
      tilt: (Math.random()-.5)*1.2, a: Math.random()*Math.PI*2,
      w: (Math.random()*.5+.5) * (Math.random()<.5?-1:1) * (Math.PI*2/ (70+Math.random()*80)),
      s: Math.random()*1.1+.4, al: Math.random()*.5+.2
    };
  }
  function pos(p) {
    const m = Math.min(W,H*1.4), x = Math.cos(p.a)*p.rx*m, y = Math.sin(p.a)*p.ry*m;
    return [W/2 + x*Math.cos(p.tilt) - y*Math.sin(p.tilt), H/2 + x*Math.sin(p.tilt) + y*Math.cos(p.tilt)];
  }
  function draw(dt) {
    ctx.clearRect(0,0,W,H);
    for (const p of parts) {
      p.a += p.w * dt;
      const [x,y] = pos(p);
      ctx.beginPath(); ctx.arc(x,y,p.s,0,6.283);
      ctx.fillStyle = `rgba(240,203,122,${p.al})`;
      ctx.shadowColor = 'rgba(212,166,74,.8)'; ctx.shadowBlur = 6;
      ctx.fill();
    }
  }
  function loop(ts) {
    const dt = Math.min((ts - last)/1000, .1); last = ts;
    draw(dt); raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  size(); parts = Array.from({length:N}, make); draw(0);
  addEventListener('resize', () => { size(); draw(0); });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  start();
})();

// scroll-triggered reveal: gold lines draw, text fades in (adds .is-in once)
(() => {
  const els = document.querySelectorAll('.marketing');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(e => e.classList.add('is-in')); return;
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: 0.25 });
  els.forEach(e => io.observe(e));
})();

// portfolio: staggered glow-in, category filter, tap-to-expand
(() => {
  const sec = document.getElementById('work'); if (!sec) return;
  const items = [...sec.querySelectorAll('.work__item')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lit = e => { e.classList.add('is-lit'); };
  const reveal = e => { e.classList.add('is-in'); };
  if (!('IntersectionObserver' in window) || reduce) {
    sec.querySelectorAll('.reveal').forEach(reveal); items.forEach(lit);
  } else {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const t = e.target; io.unobserve(t);
      const idx = items.indexOf(t);
      const delay = idx < 0 ? 0 : (idx % 3) * 180;
      setTimeout(() => { reveal(t); if (idx >= 0) setTimeout(() => lit(t), 700); }, delay);
    }), { threshold: 0.15 });
    sec.querySelectorAll('.reveal').forEach(e => io.observe(e));
  }
  const btns = [...sec.querySelectorAll('.filter')];
  const count = document.getElementById('work-count');
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.filter; let n = 0;
    items.forEach(it => { const show = f === 'ALL' || it.dataset.cat === f; it.hidden = !show; if (show) { n++; it.classList.add('is-in'); } });
    count.textContent = String(n).padStart(2, '0') + (n === 1 ? ' ITEM' : ' ITEMS') + (f === 'ALL' ? '' : ' · ' + f);
  }));
  // tap toggles expanded state on touch devices
  sec.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => {
    const on = c.classList.toggle('is-active');
    sec.querySelectorAll('.card.is-active').forEach(o => { if (o !== c) o.classList.remove('is-active'); });
    if (!on) c.blur();
  }));
})();

// product demo: simulated agent team (no backend). Idle status cycling, prompt -> routed run -> canned response
(() => {
  const root = document.getElementById('demo'); if (!root) return;
  const sec = document.getElementById('product');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  // name, role, working-status, orbit radius (% of stage), start angle (deg), run order
  const A = [
    ['Atlas','Research','Researching',38,-90,2],['Scribe','Drafting','Drafting',30,-38.6,4],
    ['Relay','Routing','Routing',38,12.9,0],['Vector','Analysis','Analysing',30,64.3,3],
    ['Echo','Review','Reviewing',38,115.7,6],['Forge','Build','Building',30,167.1,5],
    ['Sage','Planning','Planning',38,218.6,1]
  ];
  const lines = document.getElementById('demo-lines'), pulses = document.getElementById('demo-pulses');
  const list = document.getElementById('demo-agents'), coreState = document.getElementById('demo-core-state');
  const out = document.getElementById('demo-out'), form = document.getElementById('demo-form');
  const input = document.getElementById('demo-input'), btn = document.getElementById('demo-btn');
  const nodes = A.map(([name,role,work,r,a0],i) => {
    const ln = document.createElementNS(NS,'line'); ln.setAttribute('class','demo__line'); lines.appendChild(ln);
    const li = document.createElement('li'); li.className = 'agent';
    li.innerHTML = `<span class="agent__dot"></span><span class="agent__txt"><span class="agent__name">${name}</span><span class="agent__role">${role}</span><span class="agent__status">Idle</span></span>`;
    list.appendChild(li);
    return { name, role, work, r, a0:a0*Math.PI/180, li, ln, st:li.querySelector('.agent__status'), x:50, y:50, active:false, hold:0 };
  });
  const setStatus = (n, txt, on) => { n.st.textContent = txt; n.active = on; n.li.classList.toggle('is-active', on); n.ln.classList.toggle('is-on', on); };
  const place = t => {
    const rot = reduce ? 0 : t * (Math.PI*2/110);   // one slow turn per 110s, rigid so labels never collide
    nodes.forEach(n => {
      const a = n.a0 + rot;
      n.x = 50 + Math.cos(a)*n.r; n.y = 50 + Math.sin(a)*n.r*.97;
      n.li.style.left = n.x + '%'; n.li.style.top = n.y + '%';
      n.ln.setAttribute('x1',50); n.ln.setAttribute('y1',50); n.ln.setAttribute('x2',n.x); n.ln.setAttribute('y2',n.y);
    });
  };
  // pulses: light travelling along a core<->node line
  let P = [];
  const pulse = (n, out_ = true, dur = 1.6) => {
    if (reduce) return;
    const c = document.createElementNS(NS,'circle'); c.setAttribute('r',.9); c.setAttribute('class','demo__pulse');
    pulses.appendChild(c); P.push({ c, n, out:out_, t0:performance.now(), dur:dur*1000 });
  };
  let T = 0, raf = 0, last = 0, visible = false;
  function frame(ts) {
    const dt = Math.min((ts-last)/1000,.1); last = ts; T += dt; place(T);
    P = P.filter(p => {
      const k = (ts - p.t0)/p.dur; if (k >= 1) { p.c.remove(); return false; }
      const e = k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2, f = p.out ? e : 1-e;
      p.c.setAttribute('cx', 50+(p.n.x-50)*f); p.c.setAttribute('cy', 50+(p.n.y-50)*f);
      p.c.style.opacity = Math.sin(Math.PI*k).toFixed(2); return true;
    });
    raf = requestAnimationFrame(frame);
  }
  const runAnim = () => { if (!raf && !reduce && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stopAnim = () => { cancelAnimationFrame(raf); raf = 0; };
  place(0);

  // timers that pause with visibility
  let idleT = 0, busy = false;
  const rnd = (a,b) => a + Math.random()*(b-a);
  const idleTick = () => {
    idleT = 0; if (busy || !visible || document.hidden) return schedIdle();
    const n = nodes[Math.floor(Math.random()*nodes.length)];
    setStatus(n, n.work, true); pulse(n, true, 2.2);
    setTimeout(() => { if (!busy) setStatus(n,'Idle',false); }, 3500);
    schedIdle();
  };
  const schedIdle = () => { clearTimeout(idleT); idleT = setTimeout(idleTick, rnd(6000,10000)); };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const say = (label, text, hint) => { out.classList.remove('is-new'); void out.offsetWidth; out.innerHTML = ''; const s = document.createElement('span'); s.className = 'readout'; s.textContent = label; out.append(s, document.createTextNode(text)); out.classList.add('is-new'); };
  async function run(req) {
    busy = true; btn.disabled = true; input.readOnly = true; root.setAttribute('aria-busy','true'); root.dataset.state = 'run';
    nodes.forEach(n => setStatus(n,'Idle',false));
    coreState.textContent = 'ROUTING';
    say('ROUTING','Request received. The core is routing it to the team…');
    await wait(reduce ? 300 : 900);
    const order = [...nodes].sort((a,b) => A[nodes.indexOf(a)][5] - A[nodes.indexOf(b)][5]);
    const loops = [];
    for (const n of order) {
      setStatus(n, n.work, true); pulse(n,true,1.4);
      loops.push(setInterval(() => pulse(n, Math.random()<.5, 1.8), 1900));
      await wait(reduce ? 250 : rnd(600,1200));
    }
    coreState.textContent = 'WORKING';
    await wait(reduce ? 400 : 1800);
    loops.forEach(clearInterval);
    const topic = req.length > 70 ? req.slice(0,67).trim() + '…' : req;
    coreState.textContent = 'DELIVERING';
    order.forEach(n => pulse(n,false,1.2));
    say('SIMULATED RESPONSE', `Sage planned it, Atlas gathered context, Scribe drafted a first pass and Echo reviewed it for “${topic}”. This is a demo: no real model was called.`);
    await wait(reduce ? 400 : 2400);
    for (const n of order) { setStatus(n,'Idle',false); await wait(reduce ? 0 : 150); }
    coreState.textContent = 'IDLE'; root.dataset.state = 'idle';
    root.removeAttribute('aria-busy'); btn.disabled = false; input.readOnly = false; busy = false;
    input.value = ''; schedIdle();
  }
  form.addEventListener('submit', e => {
    e.preventDefault(); if (busy) return;
    const v = input.value.trim();
    if (!v) { input.setAttribute('aria-invalid','true'); say('HINT','Type a request first, for example “a poster for a lantern festival”.'); input.focus(); return; }
    input.removeAttribute('aria-invalid'); clearTimeout(idleT); run(v);
  });
  input.addEventListener('input', () => input.removeAttribute('aria-invalid'));

  // pause when offscreen or tab hidden
  const vis = () => { if (visible && !document.hidden) { runAnim(); if (!idleT && !busy) schedIdle(); } else stopAnim(); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; vis(); }), { threshold: 0.05 }).observe(root);
    new IntersectionObserver((es,io) => es.forEach(e => { if (e.isIntersecting) { sec.classList.add('is-in'); io.disconnect(); } }), { threshold: 0.15 }).observe(sec);
  } else { visible = true; sec.classList.add('is-in'); vis(); }
  if (reduce) sec.classList.add('is-in');
  document.addEventListener('visibilitychange', vis);
})();
