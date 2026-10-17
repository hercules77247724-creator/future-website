/* Future: 3D scene (Three.js r160 via importmap) + request-box demo.
   The demo/labels are plain HTML and work with or without WebGL. All scene colors come from CSS variables (--scene-*). */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const cssVar = (n, d) => (getComputedStyle(root).getPropertyValue(n).trim() || d);
const PALETTE = () => ({
  core: cssVar('--scene-core', '#DDBB55'), glow: cssVar('--scene-glow', '#C9A227'), node: cssVar('--scene-node', '#DDBB55'),
  line: cssVar('--scene-line', '#C9A227'), particle: cssVar('--scene-particle', '#DDBB55'), dim: cssVar('--scene-dim', '#8A6D1B')
});

// name, role, working-status, run order, hero orbit [radius, inclination(rad), tilt(rad), angular speed, phase]
const AGENTS = [
  ['Atlas','Research','Researching',2,[2.6,.5,.2,.22,0]],
  ['Scribe','Drafting','Drafting',4,[3.2,-.7,.1,-.17,1.2]],
  ['Relay','Routing','Routing',0,[2.0,1.0,-.4,.30,2.5]],
  ['Vector','Analysis','Analysing',3,[3.8,.25,.5,.14,3.6]],
  ['Echo','Review','Reviewing',6,[2.9,-1.1,.3,-.20,4.4]],
  ['Forge','Build','Building',5,[3.5,.85,-.6,.16,5.3]],
  ['Sage','Planning','Planning',1,[4.3,-.35,-.2,-.12,.8]]
];

const $ = id => document.getElementById(id);
const list = $('agents'), demo = $('demo'), coreState = $('demo-core-state'), out = $('demo-out');
const form = $('demo-form'), input = $('demo-input'), btn = $('demo-btn');
let scene = null; // set by initScene(): { pulse(i,out,dur), setActive(i,on), setCore(v), invalidate() }

const nodes = AGENTS.map(([name, role, work], i) => {
  const li = document.createElement('li'); li.className = 'agent';
  li.innerHTML = '<span class="agent__dot"></span><span class="agent__txt"><span class="agent__name"></span><span class="agent__role"></span><span class="agent__status">Idle</span></span>';
  li.querySelector('.agent__name').textContent = name; li.querySelector('.agent__role').textContent = role;
  list.appendChild(li);
  return { i, name, role, work, li, st: li.querySelector('.agent__status') };
});
const setStatus = (n, txt, on) => {
  n.st.textContent = txt; n.li.classList.toggle('is-active', on);
  if (scene) scene.setActive(n.i, on);
};
const pulse = (n, o = true, dur = 1.6) => { if (scene && !reduce) scene.pulse(n.i, o, dur); };

/* ---------- demo ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const wait = ms => new Promise(r => setTimeout(r, ms));
let busy = false, idleT = 0;
function idleTick() {
  idleT = 0;
  if (busy || document.hidden) return schedIdle();
  const n = nodes[Math.floor(Math.random() * nodes.length)];
  setStatus(n, n.work, true); pulse(n, true, 2.2);
  setTimeout(() => { if (!busy) setStatus(n, 'Idle', false); }, 3500);
  schedIdle();
}
const schedIdle = () => { clearTimeout(idleT); idleT = setTimeout(idleTick, rnd(6000, 10000)); };
function say(label, text) {
  out.classList.remove('is-new'); void out.offsetWidth; out.textContent = '';
  const s = document.createElement('span'); s.className = 'readout'; s.textContent = label;
  out.append(s, document.createTextNode(text)); out.classList.add('is-new');
}
const setCore = (txt, lvl) => { coreState.textContent = txt; if (scene) scene.setCore(lvl); };
async function run(req) {
  busy = true; btn.disabled = true; input.readOnly = true; demo.setAttribute('aria-busy', 'true'); demo.dataset.state = 'run';
  nodes.forEach(n => setStatus(n, 'Idle', false));
  setCore('ROUTING', 1);
  say('ROUTING', 'Request received. The core is routing it to the team…');
  await wait(reduce ? 300 : 900);
  const order = [...nodes].sort((a, b) => AGENTS[a.i][3] - AGENTS[b.i][3]);
  const loops = [];
  for (const n of order) {
    setStatus(n, n.work, true); pulse(n, true, 1.4);
    loops.push(setInterval(() => pulse(n, Math.random() < .5, 1.8), 1900));
    await wait(reduce ? 250 : rnd(600, 1200));
  }
  setCore('WORKING', 1);
  await wait(reduce ? 400 : 1800);
  loops.forEach(clearInterval);
  const topic = req.length > 70 ? req.slice(0, 67).trim() + '…' : req;
  setCore('DELIVERING', 1);
  order.forEach(n => pulse(n, false, 1.2));
  say('SIMULATED RESPONSE', `Sage planned it, Atlas gathered context, Scribe drafted a first pass and Echo reviewed it for “${topic}”. This is a demo: no real model was called.`);
  await wait(reduce ? 400 : 2400);
  for (const n of order) { setStatus(n, 'Idle', false); await wait(reduce ? 0 : 150); }
  setCore('IDLE', 0); demo.dataset.state = 'idle';
  demo.removeAttribute('aria-busy'); btn.disabled = false; input.readOnly = false; busy = false;
  input.value = ''; schedIdle();
}
form.addEventListener('submit', e => {
  e.preventDefault(); if (busy) return;
  const v = input.value.trim();
  if (!v) { input.setAttribute('aria-invalid', 'true'); say('HINT', 'Type a request first, for example “a poster for a lantern festival”.'); input.focus(); return; }
  input.removeAttribute('aria-invalid'); clearTimeout(idleT); run(v);
});
input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
document.addEventListener('visibilitychange', () => { if (!document.hidden && !idleT && !busy) schedIdle(); });
$('request-access')?.addEventListener('click', () => setTimeout(() => input.focus({ preventScroll: true }), reduce ? 50 : 900));
schedIdle();

/* ---------- 3D scene ---------- */
async function initScene() {
  const probe = document.createElement('canvas');
  const pgl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!pgl) throw new Error('no webgl');
  pgl.getExtension('WEBGL_lose_context')?.loseContext();
  const THREE = await import('three'); // CDN (pinned r160) via importmap; rejects if blocked
  let RoomEnv = null; try { RoomEnv = (await import('three/addons/environments/RoomEnvironment.js')).RoomEnvironment; } catch (e) { console.info('env map unavailable:', e && e.message); }
  const weak = innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(pointer:coarse)').matches;
  const BASE_DPR = Math.min(devicePixelRatio || 1, 1.5);
  const renderer = new THREE.WebGLRenderer({ antialias: !weak && BASE_DPR < 2, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; // PBR meshes only: every other material sets toneMapped=false so glow/lines keep their exact colours
  const cv = renderer.domElement; cv.id = 'scene'; cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.querySelector('.vignette'));

  const P = PALETTE();
  const C = k => new THREE.Color(P[k]);
  const sc = new THREE.Scene();
  sc.fog = new THREE.FogExp2(0x000000, 0.032);
  const cam = new THREE.PerspectiveCamera(45, 1, .1, 120);
  const G = new THREE.Group(); sc.add(G);

  // soft glow texture (shared by halos, pulses, particles)
  const gt = document.createElement('canvas'); gt.width = gt.height = 128;
  const gx = gt.getContext('2d'), gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(.18, 'rgba(255,255,255,.45)'); gg.addColorStop(.5, 'rgba(255,255,255,.08)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(gt);
  const sprite = (color, opacity) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const addMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  // ---- procedural surface detail (no image downloads; own seeded PRNG so Math.random sequences are untouched) ----
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hexRGB = c => [c.r, c.g, c.b].map(v => Math.round(Math.pow(v, 1 / 2.2) * 255));
  // mode: 'color' (blotchy dark gold plates, bright gold panel lines), 'bump' (grey: grooves + grain), 'rough' (grey roughness), 'emis' (bright plates, dark seams)
  function surfaceTex(mode, w, h, seed, panels) {
    const r = mulberry(seed), cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
    const x = cvs.getContext('2d'), base = { color: '#6b5420', bump: '#b0b0b0', rough: '#8c8c8c', emis: '#e0e0e0' }[mode];
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    // soft blotches: random low-res noise scaled up with smoothing, two octaves
    for (const [n, a] of [[8, .5], [24, .3]]) {
      const sm = document.createElement('canvas'); sm.width = n * 2; sm.height = n; const sx = sm.getContext('2d'), id = sx.createImageData(n * 2, n);
      for (let k = 0; k < id.data.length; k += 4) { const v = r() * 255; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
      sx.putImageData(id, 0, 0); x.globalAlpha = a * (mode === 'color' ? .55 : mode === 'emis' ? .35 : .8); x.globalCompositeOperation = mode === 'color' ? 'overlay' : 'soft-light';
      x.imageSmoothingQuality = 'high'; x.drawImage(sm, 0, 0, w, h);
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // fine grain
    const gid = x.getImageData(0, 0, w, h), gd = gid.data, ga = mode === 'color' ? 10 : 18;
    for (let k = 0; k < gd.length; k += 4) { const v = (r() - .5) * ga; gd[k] += v; gd[k + 1] += v; gd[k + 2] += v; }
    x.putImageData(gid, 0, 0);
    // panel seams: latitude bands + meridian splits, rivets
    const line = { color: ['#E8C766', 2], bump: ['#101010', 2.2], rough: ['#303030', 2], emis: ['#161616', 2] }[mode];
    x.strokeStyle = line[0]; x.lineWidth = line[1] * w / 256; x.lineCap = 'round';
    const bands = panels[0], cols = panels[1];
    for (let b = 1; b < bands; b++) { const y = b / bands * h; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    for (let b = 0; b < bands; b++) { const off = (b % 2) * .5; for (let c = 0; c < cols; c++) { const xx = (c + off) / cols * w; x.beginPath(); x.moveTo(xx, b / bands * h); x.lineTo(xx, (b + 1) / bands * h); x.stroke(); } }
    x.fillStyle = mode === 'color' ? '#F0D488' : mode === 'bump' ? '#f2f2f2' : mode === 'rough' ? '#404040' : '#bdbdbd';
    for (let b = 0; b < bands; b++) for (let c = 0; c < cols; c++) { const xx = ((c + (b % 2) * .5) / cols + .5 / cols * .18) * w, yy = (b / bands + .035) * h; x.beginPath(); x.arc(xx, yy, w / 256 * 1.3, 0, 6.283); x.fill(); }
    const t = new THREE.CanvasTexture(cvs); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
    if (mode === 'color' || mode === 'emis') t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const coreTex = { map: surfaceTex('color', 512, 256, 11, [6, 12]), bump: surfaceTex('bump', 512, 256, 11, [6, 12]), rough: surfaceTex('rough', 512, 256, 11, [6, 12]), emis: surfaceTex('emis', 512, 256, 11, [6, 12]) };
  const nodeTex = { map: surfaceTex('color', 256, 128, 23, [4, 8]), bump: surfaceTex('bump', 256, 128, 23, [4, 8]), rough: surfaceTex('rough', 256, 128, 23, [4, 8]), emis: surfaceTex('emis', 256, 128, 23, [4, 8]) };
  const physical = (T, o) => new (o.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)(Object.assign({ map: T.map, bumpMap: T.bump, bumpScale: 1.6, roughnessMap: T.rough, emissiveMap: T.emis }, o));
  const glass = (color, op) => new THREE.MeshPhongMaterial({ color, specular: 0xfff0d0, shininess: 140, transparent: true, opacity: op, depthWrite: false }); // cheap glossy shell (Phong ignores the env map: big transparent overdraw stays cheap)
  const goldBand = color => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: .28, envMapIntensity: 1 });

  // environment map: procedural room (PMREM), reflections only; falls back to none if the addon is blocked
  let envTex = null; if (RoomEnv) { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnv(), .04).texture; pm.dispose(); sc.environment = envTex; }

  // lights: dim cool/warm hemisphere + ambient, directional key and cool rim, warm point light from the core
  sc.add(new THREE.AmbientLight(0xffffff, .12));
  sc.add(new THREE.HemisphereLight(0xaab8d8, 0x3a2a10, .45));
  const key = new THREE.DirectionalLight(0xfff0d6, 1.7); key.position.set(-5, 6, 8); sc.add(key);
  const rim = new THREE.DirectionalLight(0x8fa6d8, .6); rim.position.set(6, -2, -6); sc.add(rim);
  const coreLight = new THREE.PointLight(C('glow'), 6, 18, 1.6); G.add(coreLight);
  // (no shadow maps: nodes are small, floating and additive-lit; shadows would cost fill-rate on weak GPUs for no visible gain)

  // core: PBR sphere (inner emissive + glass clearcoat shell + metal band), wire shell, gimbal rings, two halo sprites
  const core = new THREE.Group(); G.add(core);
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(.34, 48, 32), physical(coreTex, { color: 0xffffff, emissive: C('core'), emissiveIntensity: 1.8, metalness: .4, roughness: 1, clearcoat: .25, clearcoatRoughness: .35, envMapIntensity: .3 })); core.add(coreMesh);
  const coreGlass = new THREE.Mesh(new THREE.SphereGeometry(.415, 40, 24), glass(C('core'), .16)); coreMesh.add(coreGlass);
  const coreBand = new THREE.Mesh(new THREE.TorusGeometry(.47, .011, 10, 96), goldBand(C('line'))); coreBand.rotation.x = Math.PI / 2; coreMesh.add(coreBand);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(.62, 1), new THREE.MeshBasicMaterial({ color: C('line'), wireframe: true, transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false })); core.add(shell);
  const rings = [[.95, 0, 0], [1.3, 1.1, .4], [1.7, -.8, 1.2]].map(([r, rx, rz], k) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, .006, 6, 128), addMat(C('line'), .5 - k * .1)); m.rotation.set(Math.PI / 2 + rx, 0, rz); core.add(m); return m;
  });
  const haloA = sprite(C('core'), .9), haloB = sprite(C('glow'), .35); core.add(haloA, haloB);

  // agents
  const agents = AGENTS.map(([, , , , [r, inc, tilt, w, ph]], i) => {
    const g = new THREE.Group(); G.add(g);
    const mat = physical(nodeTex, { color: 0xffffff, emissive: C('node'), emissiveIntensity: .8, metalness: .7, roughness: 1, envMapIntensity: .8 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.14, 32, 20), mat); mesh.rotation.set(.3 + i * .5, i * .9, 0); g.add(mesh);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.158, .009, 8, 48), goldBand(C('line'))); band.rotation.x = Math.PI / 2; mesh.add(band); 
    const halo = sprite(C('glow'), .55); halo.userData.b = 1; g.add(halo);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.25, .004, 6, 48), addMat(C('line'), .5)); ring.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(ring);
    // orbit path (hero)
    const pts = []; for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C('line'), transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false }));
    orbit.rotation.set(inc, 0, tilt); orbit.userData.base = .16; orbit.updateMatrix(); G.add(orbit);
    // connection curve core -> node
    const N = 28, arr = new Float32Array(N * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const lmat = new THREE.LineBasicMaterial({ color: C('line'), transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, lmat); line.frustumCulled = false; G.add(line);
    return { g, mesh, mat, band, halo, ring, orbit, line, arr, lmat, N, r, inc, tilt, w, ph, glow: 0, tgt: 0, pos: new THREE.Vector3(), ctl: new THREE.Vector3(), scale: 1 };
  });
  // team ring (faint ellipse shown in team layout)
  const ep = []; for (let k = 0; k < 128; k++) { const a = k / 128 * Math.PI * 2; ep.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
  const teamRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ep), new THREE.LineBasicMaterial({ color: C('line'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); G.add(teamRing);

  // pulses: sprites travelling along the core<->node curves
  const pool = Array.from({ length: 28 }, () => { const s = sprite(C('core'), 0); s.visible = false; s.scale.setScalar(.4); G.add(s); return { s, live: false, i: 0, k: 0, dur: 1, out: true }; });
  const spawn = (i, o, dur) => { const p = pool.find(q => !q.live); if (!p) return; Object.assign(p, { live: true, i, k: 0, dur, out: o }); p.s.visible = true; };

  // particle field: three depth layers with different parallax + big soft bokeh near the camera
  const layers = [];
  const mkPoints = (n, size, opacity, zMin, zMax, spread, color) => {
    const a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { a[k * 3] = (Math.random() - .5) * spread * 2; a[k * 3 + 1] = (Math.random() - .5) * spread * 1.1; a[k * 3 + 2] = zMin + Math.random() * (zMax - zMin); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, color, size, sizeAttenuation: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    sc.add(pts); layers.push(pts); return pts;
  };
  const NP = weak ? 220 : 520;
  mkPoints(NP, .16, .55, -26, -10, 22, C('particle'));
  mkPoints(NP, .13, .75, -10, 0, 14, C('particle'));
  mkPoints(Math.round(NP * .5), .1, .9, 0, 7, 9, C('particle'));
  mkPoints(weak ? 8 : 18, 1.6, .09, 4, 8.5, 7, C('glow')); // bokeh

  // ---- realistic backdrop: baked nebula (equirect fbm on a back-faced sphere, zero per-frame cost) + layered starfield ----
  const bg = new THREE.Group(); sc.add(bg);
  const nebula = (() => { // flat baked fbm image on a CSS layer between aurora and scene: no WebGL fill cost, screen-blended
    const w = weak ? 320 : 480, h = Math.round(w * 9 / 16), cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
    const x = cvs.getContext('2d'), img = x.createImageData(w, h), rr = mulberry(77), perm = new Float32Array(4096); for (let k = 0; k < 4096; k++) perm[k] = rr();
    const hs = (i, j, k) => perm[((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) & 4095];
    const fade = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
    const vn = (px, py, pz) => { const i = Math.floor(px), j = Math.floor(py), k = Math.floor(pz), u = fade(px - i), v = fade(py - j), t = fade(pz - k);
      return lerp(lerp(lerp(hs(i, j, k), hs(i + 1, j, k), u), lerp(hs(i, j + 1, k), hs(i + 1, j + 1, k), u), v), lerp(lerp(hs(i, j, k + 1), hs(i + 1, j, k + 1), u), lerp(hs(i, j + 1, k + 1), hs(i + 1, j + 1, k + 1), u), v), t); };
    const fbm = (a, b, c) => { let f = 0, amp = .5, q = 1.6; for (let o = 0; o < 4; o++) { f += amp * vn(a * q, b * q, c * q); q *= 2.05; amp *= .5; } return f; };
    const warm = hexRGB(C('dim')), warm2 = hexRGB(C('glow')), cool = [38, 56, 104];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const u = px / w, v = py / h;
      const n = fbm(u * 2.8 + 3, v * 2.8 + 3, 1.7), m = fbm(u * 2.1 + 9, v * 2.1 + 9, 4.1);
      const d = Math.max(0, n - .44) * 2.3, d2 = Math.max(0, m - .5) * 2.4, lane = Math.exp(-Math.pow((v - .5 - .2 * Math.sin(u * 4.2 + 1)) * 3.2, 2));
      const a = Math.min(1, d * (.45 + 1.0 * lane)), b = Math.min(1, d2 * .7);
      const k = (py * w + px) * 4, I = .3;
      id_set(img.data, k, (warm[0] * a * .8 + warm2[0] * a * a * .5 + cool[0] * b) * I, (warm[1] * a * .8 + warm2[1] * a * a * .5 + cool[1] * b) * I, (warm[2] * a * .8 + warm2[2] * a * a * .5 + cool[2] * b) * I);
    }
    function id_set(d, k, r, g, b) { d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; }
    x.putImageData(img, 0, 0);
    const el = document.createElement('div'); el.id = 'nebula'; el.setAttribute('aria-hidden', 'true');
    el.style.backgroundImage = 'url(' + cvs.toDataURL('image/jpeg', .85) + ')';
    document.body.insertBefore(el, cv); return el;
  })();
  const STAR_N = 1600, starU = { uPx: { value: 1 } };
  const stars = (() => {
    const r = mulberry(5), pos = new Float32Array(STAR_N * 3), col = new Float32Array(STAR_N * 3), siz = new Float32Array(STAR_N);
    const tints = [[1, .96, .88], [.82, .9, 1], [1, .84, .6], [.95, .95, 1]];
    for (let k = 0; k < STAR_N; k++) {
      const u = r() * 2 - 1, a = r() * 6.2832, q = Math.sqrt(1 - u * u), R = 70 + r() * 20;
      pos.set([q * Math.cos(a) * R, u * R, q * Math.sin(a) * R], k * 3);
      const m = Math.pow(r(), 5), t = tints[Math.floor(r() * tints.length)], br = .08 + .17 * m; // power-law magnitude; peak pixel <= .25 so a star behind text keeps contrast
      col.set([t[0] * br, t[1] * br, t[2] * br], k * 3); siz[k] = 1 + 2.4 * m + r() * .4;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    const m = new THREE.ShaderMaterial({ uniforms: starU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute vec3 aColor; attribute float aSize; uniform float uPx; varying vec3 vC; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = aSize * uPx; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - .5; float f = smoothstep(.5, 0., length(d)); gl_FragColor = vec4(vC * f * f, 1.); }' });
    const p = new THREE.Points(g, m); p.renderOrder = -10; p.frustumCulled = false; bg.add(p); return p;
  })();
  // quality tier: 2 = full, 1 = fewer stars, keeps nebula/env/core glass (weak devices / first fallback step), 0 = minimal (second step): no nebula, no env map, no glass shell, few stars
  const baseTier = weak ? 1 : 2; let tier = baseTier;
  function applyTier(t) {
    tier = t; stars.geometry.setDrawRange(0, [350, 800, STAR_N][t]); nebula.style.display = t > 0 ? '' : 'none';
    coreGlass.visible = t > 0; coreBand.visible = t > 0; agents.forEach(a => { a.band.visible = t > 0; }); sc.environment = t > 0 ? envTex : null; cv.dataset.tier = t;
  }
  sc.traverse(o => { const mm = o.material; if (mm && !mm.isMeshStandardMaterial) mm.toneMapped = false; });

  // ---- state ----
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  const sm = x => x * x * (3 - 2 * x), clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const secEl = $('product'), stage = $('stage');
  let pT = 0, ps = 0, mx = 0, my = 0, mxs = 0, mys = 0, clock = 0, coreT = 0, coreV = 0, secTop = 0, W = 1, H = 1;
  const labelEls = nodes.map(n => n.li);
  const hz = (() => { const hh = 10 * Math.tan(THREE.MathUtils.degToRad(22.5)); return hh; })();

  function onScroll() {
    const d = Math.max(1, secEl.offsetTop - 88);
    pT = clamp(scrollY / d, 0, 1);
    if (reduce) pT = pT > .5 ? 1 : 0; // reduced motion: only two static states
    if (reduce) invalidate();
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  let scale = 1;
  const SCALES = [1, .75, .55];
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setPixelRatio(BASE_DPR * scale);
    renderer.setSize(W, H, false);
    starU.uPx.value = renderer.getPixelRatio();
    cam.aspect = W / H; cam.updateProjectionMatrix();
    cv.dataset.scale = scale;
    if (reduce) invalidate();
  }

  function update(dt) {
    clock += dt;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
    ps += (pT - ps) * k; if (Math.abs(pT - ps) < 1e-4) ps = pT;
    mxs += (mx - mxs) * (reduce ? 0 : 1 - Math.exp(-dt * 2.5)); mys += (my - mys) * (reduce ? 0 : 1 - Math.exp(-dt * 2.5));
    const e = sm(ps), arc = Math.sin(e * Math.PI);
    root.style.setProperty('--p', ps.toFixed(4));
    // label opacity for role/status: appears with the team layout
    root.style.setProperty('--lp', clamp((ps - .55) * 2.5, 0, 1).toFixed(3));

    // camera path: hero (0.8, 12.5) -> arcing flight -> team (0,10) straight on
    const aspect = W / H, fit = Math.min(1.05, aspect * 1.2);
    const dH = 12.5;
    cam.position.set(-arc * 2.4 + mxs * .8 * (1 - .5 * e), (1 - e) * .9 + arc * .8 - mys * .5 * (1 - .5 * e), THREE.MathUtils.lerp(dH, 10, e) - arc * 1.6);
    cam.lookAt(-arc * 0.6, arc * 0.1, 0);
    cam.rotation.z += (reduce ? 0 : arc * .05);

    // stage rect -> world layout at z=0 for camera at (0,0,10)
    const hh = hz, hw = hh * aspect, r = stage.getBoundingClientRect();
    const cxn = ((r.left + r.width / 2) / W) * 2 - 1, cyn = -(((r.top + r.height / 2) / H) * 2 - 1);
    const tcx = cxn * hw, tcy = cyn * hh;
    const ry = Math.max(.4, .64 * (r.height / H) * hh), rx = Math.min(.74 * (r.width / W) * hw, ry * 2.1);
    const ns = clamp(Math.min(rx / 3.2, ry / 1.6), .5, 1);

    G.position.set(tcx * e, tcy * e, 0);
    G.rotation.y = mxs * .3 * (1 - .55 * e) + (reduce ? 0 : Math.sin(clock * .1) * .12 * (1 - e));
    G.rotation.x = mys * .16 * (1 - .4 * e);
    const cs = THREE.MathUtils.lerp(1, clamp(ns * 1.1, .55, 1), e);
    core.scale.setScalar(cs);
    coreV += (coreT - coreV) * (reduce ? 1 : 1 - Math.exp(-dt * 3));
    const pulseB = reduce ? 0 : Math.sin(clock * 1.2) * .06;
    const lvl = 1 + coreV * .55 + pulseB;
    coreMesh.scale.setScalar(lvl);
    const haloS = THREE.MathUtils.lerp(10, 4.6, e) * cs * (1 + coreV * .5);
    haloA.scale.setScalar(THREE.MathUtils.lerp(2.8, 2.0, e) * cs * (1 + coreV * .6));
    haloB.scale.setScalar(haloS);
    haloA.material.opacity = (1 - .25 * e) + coreV * .15; haloB.material.opacity = (.45 - .12 * e) + coreV * .25;
    coreLight.intensity = 5 + coreV * 7;
    if (!reduce) { shell.rotation.y += dt * .25; shell.rotation.x += dt * .12; rings.forEach((m, i) => { m.rotation.z += dt * (.1 + i * .06) * (i % 2 ? -1 : 1); m.rotation.x += dt * .03; }); }
    teamRing.scale.set(rx, ry, 1); teamRing.material.opacity = e * .14;

    const projOpacity = [];
    agents.forEach((a, i) => {
      a.glow += (a.tgt - a.glow) * (reduce ? 1 : 1 - Math.exp(-dt * 4));
      // hero position: 3D orbit (orbit plane rotation from orbit.matrix)
      const ang = a.ph + (reduce ? 0 : clock * a.w);
      V.set(Math.cos(ang) * a.r, 0, Math.sin(ang) * a.r).applyMatrix4(a.orbit.matrix).multiplyScalar(fit);
      // team position: heptagon ellipse facing the camera, with slight depth wobble
      const ta = -Math.PI / 2 + i * Math.PI * 2 / 7;
      V2.set(Math.cos(ta) * rx, Math.sin(ta) * ry, reduce ? 0 : Math.sin(clock * .5 + i * 1.7) * .35);
      a.pos.lerpVectors(V, V2, e);
      a.g.position.copy(a.pos);
      const s = THREE.MathUtils.lerp(1, ns, e) * (1 + a.glow * .5);
      a.mesh.scale.setScalar(s); a.ring.scale.setScalar(s * (1 + a.glow * .3));
      if (!reduce) { a.ring.rotation.x += dt * .5; a.ring.rotation.y += dt * .3; }
      a.mat.emissiveIntensity = .55 + a.glow * 2.2;
      a.halo.scale.setScalar((1.2 + a.glow * 2.4) * THREE.MathUtils.lerp(1, ns, e));
      a.halo.material.opacity = .42 + a.glow * .55;
      a.orbit.scale.setScalar(fit); a.orbit.material.opacity = a.orbit.userData.base * (1 - e) * (1 + a.glow);
      // curve
      a.ctl.set(a.pos.x * .5 - a.pos.y * .22, a.pos.y * .5 + a.pos.x * .22, a.pos.z * .5 + (i % 2 ? .6 : -.6));
      for (let j = 0; j < a.N; j++) {
        const t = j / (a.N - 1), u = 1 - t;
        a.arr[j * 3] = 2 * u * t * a.ctl.x + t * t * a.pos.x;
        a.arr[j * 3 + 1] = 2 * u * t * a.ctl.y + t * t * a.pos.y;
        a.arr[j * 3 + 2] = 2 * u * t * a.ctl.z + t * t * a.pos.z;
      }
      a.line.geometry.attributes.position.needsUpdate = true;
      a.lmat.opacity = (.12 + .1 * e) + a.glow * .8;
    });
    // pulses
    pool.forEach(p => {
      if (!p.live) return;
      p.k += dt / p.dur; if (p.k >= 1) { p.live = false; p.s.visible = false; return; }
      const a = agents[p.i], t0 = p.k < .5 ? 2 * p.k * p.k : 1 - Math.pow(-2 * p.k + 2, 2) / 2, t = p.out ? t0 : 1 - t0, u = 1 - t;
      p.s.position.set(2 * u * t * a.ctl.x + t * t * a.pos.x, 2 * u * t * a.ctl.y + t * t * a.pos.y, 2 * u * t * a.ctl.z + t * t * a.pos.z);
      p.s.material.opacity = Math.sin(Math.PI * p.k) * .95; p.s.scale.setScalar(.35 + .15 * Math.sin(Math.PI * p.k));
    });
    // particles: slow drift per layer + parallax by depth
    layers.forEach((l, i) => {
      if (!reduce) { l.rotation.y = clock * (.004 + i * .004); l.rotation.z = Math.sin(clock * .03 + i) * .03; }
      l.position.x = -mxs * (.3 + i * .35); l.position.y = mys * (.2 + i * .25) + ps * (1.2 + i * .8);
    });
    if (!reduce) bg.rotation.y = clock * .004;
    cam.updateMatrixWorld(); G.updateMatrixWorld(true);
    // labels: project node positions into the HTML overlay
    const hdist = 11;
    agents.forEach((a, i) => {
      V.setFromMatrixPosition(a.g.matrixWorld);
      const dist = V.distanceTo(cam.position);
      V.project(cam);
      const x = (V.x * .5 + .5) * W, y = (-V.y * .5 + .5) * H, el = labelEls[i];
      const near = clamp(1 - (dist - hdist) / 14, .35, 1);
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      el.style.opacity = (reduce ? 1 : near).toFixed(2);
      el.style.setProperty('--off', (10 + 18 * (a.mesh.scale.x)) .toFixed(0) + 'px');
    });
  }

  // ---- render loop, adaptive resolution (same thresholds as aurora.js), hidden-tab pause ----
  const WIN = 90, ivals = [];
  const SLOW_MS = 33, FAST_MS = 20, SLOW_HOLD = 3000, FAST_HOLD = 8000, COOLDOWN = 4000, WARMUP = 1000;
  let slowSince = 0, fastSince = 0, lastChange = 0, ignoreUntil = 0, si = 0, downs = 0, ups = 0, frames = 0, cost = 0, raf = 0, last = 0;
  const median = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  const resetMon = now => { ivals.length = 0; slowSince = fastSince = 0; ignoreUntil = now + WARMUP; };
  function monitor(now, iv) {
    if (now < ignoreUntil) return;
    ivals.push(iv); if (ivals.length > WIN) ivals.shift();
    if (ivals.length < 20) return;
    const m = median(ivals);
    if (m > SLOW_MS) { slowSince = slowSince || now; fastSince = 0; } else if (m < FAST_MS) { fastSince = fastSince || now; slowSince = 0; } else slowSince = fastSince = 0;
    if (now - lastChange < COOLDOWN) return;
    if (slowSince && now - slowSince >= SLOW_HOLD && si < SCALES.length - 1) { downs++; setStep(si + 1, now); }
    else if (fastSince && now - fastSince >= FAST_HOLD && si > 0) { ups++; setStep(si - 1, now); }
  }
  function setStep(n, now) { si = n; scale = SCALES[si]; applyTier(Math.min(baseTier, 2 - si)); resize(); lastChange = now; resetMon(now); }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    let dt = 1 / 60;
    if (last) { const iv = ts - last; dt = Math.min(iv / 1000, .1); monitor(ts, iv); }
    last = ts;
    const s = performance.now(); update(dt); renderer.render(sc, cam); cost += performance.now() - s; frames++;
    window.__sceneStats = { tier, frames, avgCpuMs: cost / frames, T: clock, p: ps, scale, step: si, downs, ups, medianMs: ivals.length ? median(ivals) : 0, running: !!raf };
  }
  let pending = false;
  function invalidate() { // reduced motion: render on demand, one frame
    if (!reduce || pending) return; pending = true;
    requestAnimationFrame(() => { pending = false; update(1 / 60); renderer.render(sc, cam); window.__sceneStats = { frames: ++frames, reduced: true, p: ps, scale }; });
  }
  function fail() { cancelAnimationFrame(raf); raf = 0; cv.remove(); nebula.remove(); root.classList.remove('has3d'); root.classList.add('no3d'); scene = null; labelEls.forEach(el => { el.style.transform = ''; el.style.opacity = ''; }); }
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
  addEventListener('resize', () => { resize(); resetMon(performance.now()); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf); raf = 0;
    if (!document.hidden && !reduce && !DET) { last = 0; resetMon(performance.now()); raf = requestAnimationFrame(frame); } // clock keeps its value
  });

  // deterministic test hook (only with ?det in the URL): manual stepping, no rAF loop
  const DET = new URLSearchParams(location.search).has('det');
  if (DET) window.__det = {
    stopIdle: () => { clearTimeout(idleT); idleT = 0; },
    onScroll, setMouse: (x, y) => { mx = x; my = y; mxs = x; mys = y; },
    step: (dt, n = 1) => { for (let q = 0; q < n; q++) update(dt); renderer.render(sc, cam); },
    pulse: (i, o, d) => spawn(i, o, d), setActive: (i, on) => { agents[i].tgt = on ? 1 : 0; }, setCore: v => { coreT = v; },
    sample: () => {
      const f = v => [v.x, v.y, v.z].map(n => +n.toFixed(6));
      return { cam: f(cam.position), camq: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w].map(n => +n.toFixed(6)),
        G: f(G.position).concat(f(G.rotation.toVector3 ? new THREE.Vector3(G.rotation.x, G.rotation.y, G.rotation.z) : G.position)),
        cs: +core.scale.x.toFixed(6), coreMesh: +coreMesh.scale.x.toFixed(6), coreLight: +coreLight.intensity.toFixed(6),
        haloA: [haloA.scale.x, haloA.material.opacity].map(n => +n.toFixed(6)), haloB: [haloB.scale.x, haloB.material.opacity].map(n => +n.toFixed(6)),
        agents: agents.map(a => { V.setFromMatrixPosition(a.g.matrixWorld); return { w: f(V), s: +a.mesh.scale.x.toFixed(6), h: +a.halo.material.opacity.toFixed(6), l: +a.lmat.opacity.toFixed(6), line: [...a.arr].slice(0, 9).map(n => +n.toFixed(5)) }; }),
        pulses: pool.filter(p => p.live).map(p => f(p.s.position).concat([+p.s.material.opacity.toFixed(5), +p.s.scale.x.toFixed(5)])),
        layers: layers.map(l => f(l.position).concat([+l.rotation.y.toFixed(6), +l.rotation.z.toFixed(6)])),
        labels: labelEls.map(e => e.style.transform + '|' + e.style.opacity), lp: root.style.getPropertyValue('--lp'), p: root.style.getPropertyValue('--p'), T: +clock.toFixed(6) };
    }
  };
  scene = {
    pulse: (i, o, dur) => spawn(i, o, dur),
    setActive: (i, on) => { agents[i].tgt = on ? 1 : 0; invalidate(); },
    setCore: v => { coreT = v; invalidate(); }, invalidate
  };
  root.classList.remove('no3d'); root.classList.add('has3d');
  applyTier(baseTier); resize(); onScroll();
  if (reduce) { ps = pT; update(1 / 60); renderer.render(sc, cam); window.__sceneStats = { frames: 1, reduced: true }; }
  else { resetMon(performance.now()); if (!DET) raf = requestAnimationFrame(frame); }
  if (document.fonts?.ready) document.fonts.ready.then(() => reduce && invalidate());
}
initScene().catch(err => { console.info('3D scene unavailable, using HTML fallback:', err && err.message); root.classList.remove('has3d'); root.classList.add('no3d'); });
