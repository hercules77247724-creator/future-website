/* Aurora: slow gold nebula. WebGL fragment shader (no libs), ~0.55 res scale, DPR capped.
   Falls back to the CSS gradient on #aurora if WebGL is unavailable. Gold only as light. */
(() => {
  const cv = document.getElementById('aurora');
  if (!cv) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = cv.getContext('webgl', { antialias:false, alpha:false, powerPreference:'low-power' });
  if (!gl) return; // CSS gradient fallback stays visible
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;
uniform vec2 R;uniform float T;uniform float S;uniform vec3 CL;uniform vec3 CD;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
void main(){
  vec2 uv=gl_FragCoord.xy/R;
  vec2 p=(gl_FragCoord.xy-.5*R)/R.y;
  p.y+=S*.25;                              // scroll parallax
  float t=T;
  vec2 q=vec2(fbm(p*1.3+vec2(t*.011,-t*.007)),fbm(p*1.3+vec2(5.2-t*.009,1.3+t*.012)));
  float f=fbm(p*1.6+2.2*q+vec2(0.,t*.008));
  float b1=.5+.5*sin(t*6.2832/37.);        // breathing ~37s
  float b2=.5+.5*sin(t*6.2832/53.+1.7);    // ~53s
  float band=smoothstep(.3,.8,f);
  float a=band*(.35+.65*b1);
  float c=smoothstep(.45,.95,fbm(p*.9-q*1.5+vec2(t*.005,3.))) * (.25+.75*b2);
  float I=.27*a+.18*c;                      // peak ~0.45 (was .36)
  vec3 gold=CL, deep=CD;
  vec3 col=vec3(.039,.035,.027)+I*mix(deep,gold,a);
  // vignette/scrim
  float v=smoothstep(1.25,.25,length((uv-.5)*vec2(1.1,1.)));
  col=mix(vec3(.039,.035,.027),col,.55+.45*v);
  col+=(h(gl_FragCoord.xy+fract(t))-.5)/255.; // dither
  gl_FragColor=vec4(col,1.);
}`;
  // palette: colors come from CSS custom properties (--aurora-light / --aurora-deep) so a palette swap is one CSS change
  const hex = (name, dflt) => { const v = (getComputedStyle(document.documentElement).getPropertyValue(name) || dflt).trim().replace('#','');
    const n = parseInt(v.length === 3 ? v.replace(/./g, '$&$&') : v, 16); return isNaN(n) ? hex(name, dflt === '#000' ? '#B08A1E' : dflt) : [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255]; };
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform3fv(gl.getUniformLocation(pr, 'CL'), hex('--aurora-light', '#B08A1E'));
  gl.uniform3fv(gl.getUniformLocation(pr, 'CD'), hex('--aurora-deep', '#7A5A12'));
  const uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'), uS = gl.getUniformLocation(pr, 'S');
  const SCALES = [0.55, 0.4, 0.3];       // render-scale steps (floor 0.3)
  let si = 0, SCALE = SCALES[0];
  function size() {
    const d = Math.min(devicePixelRatio || 1, 1.5) * SCALE;
    cv.width = Math.max(2, Math.round(innerWidth * d)); cv.height = Math.max(2, Math.round(innerHeight * d));
    gl.viewport(0, 0, cv.width, cv.height);
    cv.dataset.scale = SCALE;
  }
  // Animation clock: accumulated from per-frame deltas (clamped), so hidden time never counts
  // and resume continues the phase without a jump.
  const T_START = 40, DT_MAX = 0.1;
  let animT = T_START, last = 0, raf = 0, frames = 0, cost = 0;
  // Frame-rate monitor
  const WIN = 90, ivals = [];
  let slowSince = 0, fastSince = 0, lastChange = 0, ignoreUntil = 0, downs = 0, ups = 0;
  const SLOW_MS = 33, FAST_MS = 20, SLOW_HOLD = 3000, FAST_HOLD = 8000, COOLDOWN = 4000, WARMUP = 1000;
  const median = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  function resetMonitor(now) { ivals.length = 0; slowSince = fastSince = 0; ignoreUntil = now + WARMUP; }
  function draw(T) {
    const sc = Math.min(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 1);
    gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, T); gl.uniform1f(uS, sc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function setStep(n, now) {
    si = n; SCALE = SCALES[si]; size(); lastChange = now; resetMonitor(now);
  }
  function monitor(now, iv) {
    if (now < ignoreUntil) return;
    ivals.push(iv); if (ivals.length > WIN) ivals.shift();
    if (ivals.length < 20) return;
    const m = median(ivals);
    if (m > SLOW_MS) { slowSince = slowSince || now; fastSince = 0; }
    else if (m < FAST_MS) { fastSince = fastSince || now; slowSince = 0; }
    else { slowSince = fastSince = 0; }
    if (now - lastChange < COOLDOWN) return;
    if (slowSince && now - slowSince >= SLOW_HOLD && si < SCALES.length - 1) { downs++; setStep(si + 1, now); }
    else if (fastSince && now - fastSince >= FAST_HOLD && si > 0) { ups++; setStep(si - 1, now); }
  }
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (last) {
      const iv = ts - last;
      animT += Math.min(iv / 1000, DT_MAX);
      monitor(ts, iv);
    }
    last = ts;
    const s = performance.now(); draw(animT); cost += performance.now() - s; frames++;
    window.__auroraStats = { frames, avgCpuMs: cost / frames, T: animT, scale: SCALE, step: si, downs, ups,
      medianMs: ivals.length ? median(ivals) : 0 };
  }
  size();
  addEventListener('resize', () => { size(); resetMonitor(performance.now()); if (reduce) draw(T_START); });
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); cv.style.opacity = 0; });
  if (reduce) { draw(T_START); return; }   // single static frame, no loop, no monitor
  resetMonitor(performance.now());
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = 0; resetMonitor(performance.now()); raf = requestAnimationFrame(loop); } // keep animT
  });
})();
