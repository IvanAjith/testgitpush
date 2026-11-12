import * as THREE from './lib/three.module.js';
import { ROSTER, buildFighter, GRAD } from './characters.js';

// =================================================================================================
//  helpers
// =================================================================================================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const dampAng = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const $ = (id) => document.getElementById(id);
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);

// =================================================================================================
//  audio (tiny synth, no files needed)
// =================================================================================================
let AC = null, muted = false, noiseBuf = null;
function ensureAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f0, dur, type = 'sine', vol = 0.12, f1 = null, delay = 0) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, vol = 0.15, freq = 1500, delay = 0) {
  if (!AC || muted) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = AC.currentTime + delay, s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t + dur + 0.03);
}
const SFX = {
  whoosh: () => noise(0.16, 0.1, 2200),
  hit: () => { noise(0.1, 0.28, 900); tone(190, 0.12, 'square', 0.12, 60); },
  jump: () => tone(320, 0.16, 'sine', 0.1, 760),
  jump2: () => tone(480, 0.16, 'sine', 0.1, 980),
  land: () => noise(0.07, 0.07, 400),
  charge: () => tone(180, 0.45, 'sawtooth', 0.07, 900),
  superHit: () => { noise(0.5, 0.4, 500); tone(120, 0.5, 'square', 0.2, 30); tone(900, 0.3, 'triangle', 0.1, 200); },
  fall: () => tone(800, 1.1, 'sine', 0.1, 70),
  ko: () => { tone(500, 0.25, 'square', 0.1, 120); },
  count: () => tone(520, 0.14, 'square', 0.08),
  go: () => { tone(780, 0.4, 'square', 0.1); tone(1170, 0.4, 'triangle', 0.08); },
  win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.28, 'triangle', 0.16, null, i * 0.13); tone(f / 2, 0.28, 'square', 0.05, null, i * 0.13); }); },
  cheer: () => { noise(1.6, 0.2, 1800); noise(1.2, 0.14, 3200, 0.2); noise(1.0, 0.1, 900, 0.4); },
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, null, i * 0.16)),
};

function speak(text, pitch = 1.25, rate = 1.05) {
  if (muted || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.pitch = pitch; u.rate = rate; u.volume = 1; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
}
// Victory shout. Drop your own sound at sounds/aakupi.mp3 (or .wav/.ogg) and it plays instead of the synthetic voice.
function aakupi() {
  if (muted) return;
  let done = false;
  const fallback = () => { if (!done) { done = true; speak('Aakupi! Victory!', 1.5, 0.95); } };
  const tryFile = (i) => {
    const exts = ['mp3', 'wav', 'ogg'];
    if (i >= exts.length) return fallback();
    const a = new Audio('sounds/aakupi.' + exts[i]); a.volume = 1;
    a.onerror = () => tryFile(i + 1);
    a.play().then(() => { done = true; }).catch(() => { if (a.error) return; fallback(); });
  };
  tryFile(0);
}
const music = { on: false, timer: null, step: 0, next: 0 };
function musicTick() {
  if (!AC || !music.on) return;
  const spb = 60 / 148 / 2, ROOTS = [0, -3, -7, -5], PENT = [0, 2, 4, 7, 9, 12, 14];
  while (music.next < AC.currentTime + 0.3) {
    const t = Math.max(0, music.next - AC.currentTime), s = music.step, root = ROOTS[(s >> 3) & 3];
    if (!muted) {
      if (s % 2 === 0) tone(130.8 * Math.pow(2, root / 12), spb * 1.8, 'triangle', 0.1, null, t);
      if (s % 4 === 0) tone(130, 0.14, 'sine', 0.13, 40, t);
      if (s % 2 === 1) noise(0.05, 0.035, 7000, t);
      if (s % 8 === 4) noise(0.12, 0.05, 3000, t);
      if (Math.random() < 0.8) tone(523.3 * Math.pow(2, (root + pick(PENT)) / 12), spb * 0.9, 'square', 0.028, null, t);
    }
    music.next += spb; music.step++;
  }
}
const musicStart = () => { if (!AC) return; music.on = true; music.next = AC.currentTime + 0.1; if (!music.timer) music.timer = setInterval(musicTick, 80); };
const musicStop = () => { music.on = false; };

// =================================================================================================
//  renderer / scene / lights
// =================================================================================================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x7a4ca8, 1.05));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 90 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(14, 30, 10);

// ---- sky: gradient dome, stars, nebulas, ringed planet ----
const sky = new THREE.Group(); scene.add(sky);
sky.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x140c5c) }, mid: { value: new THREE.Color(0x5a2aa0) }, bot: { value: new THREE.Color(0xff7ac8) } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vP; uniform vec3 top,mid,bot; void main(){ float h=vP.y; vec3 c = h>0. ? mix(mid,top,smoothstep(0.,.8,h)) : mix(mid,bot,smoothstep(0.,-.7,h)); gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}',
})));
{
  const N = 1600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * r * 280, u * 280, Math.sin(a) * r * 280], i * 3);
    c.setHSL(Math.random(), 0.6, 0.85); col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sky.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false })));
}
function glowTex(r, g, b) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${r},${g},${b},.9)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
[[255, 90, 190, 0.5, [-150, 40, -190], 210], [60, 200, 255, 0.4, [170, 90, -120], 190], [170, 90, 255, 0.5, [20, 20, 230], 230], [255, 200, 90, 0.3, [-200, -10, 100], 170]].forEach(([r, g, b, o, p, s]) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(r, g, b), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sp.position.set(...p); sp.scale.setScalar(s); sky.add(sp);
});
{
  const planet = new THREE.Group(); planet.position.set(130, 70, -210); sky.add(planet);
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(32, 32, 24), new THREE.MeshToonMaterial({ color: 0xffb35c, gradientMap: GRAD, fog: false })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(52, 3.5, 6, 64), new THREE.MeshToonMaterial({ color: 0xffe08a, gradientMap: GRAD, fog: false }));
  ring.rotation.set(1.25, 0.2, 0); ring.scale.z = 0.25; planet.add(ring);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 14), new THREE.MeshToonMaterial({ color: 0x9be7ff, gradientMap: GRAD, fog: false }));
  moon.position.set(-150, -40, -150); sky.add(moon);
}
// floating asteroids around the arena
const rocks = [];
{
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xb69bd6, flatShading: true, roughness: 0.9 });
  const crystalMat = [0xff7ac8, 0x6be3ff, 0xffe27a].map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, emissive: c, emissiveIntensity: 0.35 }));
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * TAU, d = rnd(62, 150), s = rnd(1.2, 7);
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), i % 5 === 0 ? pick(crystalMat) : rockMat);
    m.position.set(Math.cos(a) * d, rnd(-45, 30), Math.sin(a) * d);
    m.userData = { rx: rnd(-0.4, 0.4), ry: rnd(-0.4, 0.4), by: m.position.y, ph: rnd(0, 6), sp: rnd(0.2, 0.6) };
    scene.add(m); rocks.push(m);
  }
}

// =================================================================================================
//  particles + rings
// =================================================================================================
const MAXP = 600;
const pMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP);
pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pMesh.frustumCulled = false; scene.add(pMesh);
const P = Array.from({ length: MAXP }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, g: 0 }));
let pIdx = 0;
const _c = new THREE.Color(), _o = new THREE.Object3D();
pMesh.setColorAt(0, _c.set(0xffffff));
function emit(x, y, z, n, o = {}) {
  for (let k = 0; k < n; k++) {
    const p = P[pIdx], i = pIdx; pIdx = (pIdx + 1) % MAXP;
    const u = rnd(-1, 1), a = rnd(0, TAU), r = Math.sqrt(1 - u * u), sp = (o.speed || 5) * rnd(0.4, 1);
    p.x = x + (o.spread ? rnd(-o.spread, o.spread) : 0); p.y = y; p.z = z + (o.spread ? rnd(-o.spread, o.spread) : 0);
    p.vx = Math.cos(a) * r * sp; p.vy = u * sp * (o.flat ? 0.2 : 1) + (o.up || 0); p.vz = Math.sin(a) * r * sp;
    p.life = p.max = (o.life || 0.5) * rnd(0.7, 1.2); p.s = (o.size || 0.2) * rnd(0.6, 1.2); p.g = o.grav ?? 10;
    pMesh.setColorAt(i, _c.set(Array.isArray(o.color) ? pick(o.color) : (o.color ?? 0xffffff)));
  }
  pMesh.instanceColor.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    const p = P[i];
    if (p.life > 0) {
      p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const s = p.life > 0 ? p.s * (p.life / p.max) : 0;
      _o.position.set(p.x, p.y, p.z); _o.scale.setScalar(s);
    } else { _o.position.set(0, -999, 0); _o.scale.setScalar(0); }
    _o.updateMatrix(); pMesh.setMatrixAt(i, _o.matrix);
  }
  pMesh.instanceMatrix.needsUpdate = true;
}
const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
const rings = [];
function ring(x, y, z, color, maxR = 6, dur = 0.5) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.06, z); scene.add(m);
  rings.push({ m, t: 0, dur, maxR });
}
function updateRings(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; const u = r.t / r.dur;
    if (u >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); continue; }
    r.m.scale.setScalar(Math.max(0.01, r.maxR * (1 - (1 - u) * (1 - u)))); r.m.material.opacity = 0.9 * (1 - u);
  }
}

// =================================================================================================
//  arenas
// =================================================================================================
function disposeObj(o) {
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
  });
}
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD });
const rockStd = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 });

function makeArena(type, n) {
  const A = { type, group: new THREE.Group(), n, R: 0, R0: 0, shrinkT: 0, shrinking: false };
  scene.add(A.group);
  A.dispose = () => { scene.remove(A.group); disposeObj(A.group); };
  A.shrink = (dt) => {
    if (!A.plat) return;
    A.R = Math.max(A.R0 * 0.45, A.R - dt * A.R0 * 0.014);
    A.plat.scale.set(A.R / A.R0, 1, A.R / A.R0);
  };
  if (type === 'crumble') buildCrumble(A); else buildRound(A, type);
  return A;
}

function buildRound(A, type) {
  const spin = type === 'spinner';
  const R = A.R0 = A.R = (spin ? 11 : 12) + A.n * 1.6;
  A.name = spin ? 'Candy Spinner' : 'Grass Island';
  A.omega = spin ? 0.38 : 0;
  A.plat = new THREE.Group(); A.group.add(A.plat);
  const topC = spin ? 0x3a2f6b : 0x8be05a, sideC = spin ? 0x51418f : 0x9a7b5b;
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, 1.4, 64), [toon(sideC), toon(topC), toon(sideC)]);
  slab.position.y = -0.7; slab.receiveShadow = true; A.plat.add(slab);
  const under = new THREE.Mesh(new THREE.ConeGeometry(R * 0.96, R * 1.15, 32), rockStd(spin ? 0x6a56b8 : 0x8a6a4a));
  under.rotation.x = Math.PI; under.position.y = -1.4 - R * 0.575; A.plat.add(under);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.2, 8, 96), new THREE.MeshBasicMaterial({ color: spin ? 0xff4fa3 : 0xfff2a0 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; A.plat.add(rim);
  if (spin) {
    const cols = [0xff4fa3, 0x36d1ff, 0xffd93d, 0xa855f7];
    for (let i = 0; i < 6; i++) {
      const r0 = (R * i) / 6, r1 = (R * (i + 1)) / 6 - 0.15;
      const m = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, r0), r1, 64), new THREE.MeshToonMaterial({ color: cols[i % 4], gradientMap: GRAD }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.012 + i * 0.001; m.receiveShadow = true; A.plat.add(m);
    }
    for (let i = 0; i < 8; i++) { // spokes so rotation is easy to see
      const s = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.02, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
      s.position.y = 0.05; s.rotation.y = (i / 8) * Math.PI; if (i % 2) continue; A.plat.add(s);
    }
  } else {
    const c = new THREE.Mesh(new THREE.CircleGeometry(R * 0.33, 40), toon(0xa6ee74));
    c.rotation.x = -Math.PI / 2; c.position.y = 0.012; A.plat.add(c);
    const rg = new THREE.Mesh(new THREE.RingGeometry(R * 0.33, R * 0.37, 40), toon(0xfff2a0));
    rg.rotation.x = -Math.PI / 2; rg.position.y = 0.013; A.plat.add(rg);
    for (let i = 0; i < 22; i++) { // flowers and mushrooms near the rim
      const a = rnd(0, TAU), d = R * rnd(0.74, 0.93), g = new THREE.Group(); g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      if (i % 2) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), toon(0x3fae3a)); st.position.y = 0.25;
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toon(pick([0xff7ac8, 0xffd93d, 0xffffff]))); fl.position.y = 0.55;
        g.add(st, fl);
      } else {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 8), toon(0xfff2dd)); st.position.y = 0.15;
        const cp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, TAU, 0, Math.PI / 2), toon(0xe63946)); cp.position.y = 0.28;
        g.add(st, cp);
      }
      g.traverse((o) => { o.castShadow = true; }); A.plat.add(g);
    }
  }
  for (let i = 0; i < 14; i++) { // glowing crystals hanging under the rim
    const a = (i / 14) * TAU + rnd(-0.1, 0.1), cm = new THREE.Mesh(new THREE.ConeGeometry(rnd(0.3, 0.6), rnd(1.5, 3.2), 5), new THREE.MeshStandardMaterial({ color: pick([0xff7ac8, 0x6be3ff, 0xffe27a]), flatShading: true, emissive: 0x442266, emissiveIntensity: 0.5 }));
    cm.rotation.x = Math.PI; cm.position.set(Math.cos(a) * R * 0.88, -2.1 - rnd(0, 0.8), Math.sin(a) * R * 0.88); A.plat.add(cm);
  }
  A.groundAt = (x, z) => (x * x + z * z <= A.R * A.R ? 0 : null);
  A.safe = (x, z) => x * x + z * z < (A.R - 1.3) * (A.R - 1.3);
  A.spawn = (i, cnt) => { const a = (i / cnt) * TAU, d = A.R * 0.55; return [Math.sin(a) * d, Math.cos(a) * d]; };
  A.update = (dt, G) => {
    if (G.matchTime > 70) { if (!A.shrinking) { A.shrinking = true; G.banner('⚠ ARENA SHRINKING!', 1.6); } A.shrink(dt); }
    if (spin) {
      A.plat.rotation.y += A.omega * dt;
      const c = Math.cos(A.omega * dt), s = Math.sin(A.omega * dt);
      for (const f of G.fighters) {
        if (!f.alive || !f.grounded) continue;
        const x = f.pos.x, z = f.pos.z;
        f.pos.x = x * c + z * s; f.pos.z = -x * s + z * c; f.yaw += A.omega * dt;
      }
    }
  };
}

function buildCrumble(A) {
  const S = 2.8, R = A.R0 = A.R = 10 + A.n * 1.5;
  A.name = 'Crumble Tiles';
  const tiles = new Map();
  const cA = [0xff8fb1, 0x7fdcff], span = Math.ceil(R / S);
  for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
    if (Math.hypot(i * S, j * S) > R) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(S - 0.1, 1.1, S - 0.1), new THREE.MeshToonMaterial({ color: cA[(i + j) & 1], gradientMap: GRAD }));
    m.material.userData = { base: new THREE.Color(m.material.color) };
    m.position.set(i * S, -0.55, j * S); m.receiveShadow = true; m.castShadow = true; A.group.add(m);
    tiles.set(i + ',' + j, { i, j, x: i * S, z: j * S, m, state: 'solid', t: 0, vy: 0, rx: rnd(-2, 2), rz: rnd(-2, 2) });
  }
  const under = new THREE.Mesh(new THREE.ConeGeometry(R * 0.7, R * 0.8, 24), rockStd(0x6a56b8));
  under.rotation.x = Math.PI; under.position.y = -1.1 - R * 0.4 - 0.3; A.group.add(under);
  A.tiles = tiles;
  const cell = (x, z) => tiles.get(Math.round(x / S) + ',' + Math.round(z / S));
  A.groundAt = (x, z) => { const t = cell(x, z); return t && (t.state === 'solid' || t.state === 'shaking') ? 0 : null; };
  A.safe = (x, z) => { const t = cell(x, z); return !!t && t.state === 'solid'; };
  A.spawn = (i, cnt) => { const a = (i / cnt) * TAU, d = R * 0.5; return [Math.sin(a) * d, Math.cos(a) * d]; };
  A.update = (dt, G) => {
    if (G.matchTime > 2.5) {
      for (const f of G.fighters) {
        if (!f.alive || !f.grounded) continue;
        const t = cell(f.pos.x, f.pos.z);
        if (t && t.state === 'solid') { t.state = 'shaking'; t.t = 2.6; }
      }
    }
    tiles.forEach((t) => {
      if (t.state === 'shaking') {
        t.t -= dt;
        t.m.position.set(t.x + rnd(-0.05, 0.05), -0.55 + rnd(-0.03, 0.03), t.z + rnd(-0.05, 0.05));
        const k = 1 - clamp(t.t / 2.6, 0, 1);
        t.m.material.color.copy(t.m.material.userData.base).lerp(_c.set(0xff3344), k * 0.85);
        if (t.t <= 0) { t.state = 'falling'; emit(t.x, 0, t.z, 8, { color: 0xffffff, speed: 3, life: 0.5, size: 0.18 }); }
      } else if (t.state === 'falling') {
        t.vy -= 30 * dt; t.m.position.y += t.vy * dt; t.m.rotation.x += t.rx * dt; t.m.rotation.z += t.rz * dt;
        if (t.m.position.y < -45) { t.state = 'gone'; t.m.visible = false; }
      }
    });
  };
}

// =================================================================================================
//  combat data
// =================================================================================================
const POSEKEYS = ['aL', 'aR', 'aLz', 'aRz', 'lL', 'lR', 'lean', 'twist', 'bodyY', 'headX'];
const ATTACKS = [
  { id: 'punch', dur: 0.42, hs: 0.1, he: 0.2, dmg: 6, kb: 6.5, up: 2.5, range: 2.2, arc: 2.2, lunge: 4,
    keys: [[0, {}], [0.22, { aR: 1.0, twist: -0.5, lean: -0.1, aL: -0.4 }], [0.42, { aR: -1.65, twist: 0.55, lean: 0.25, aL: 0.5 }], [0.7, { aR: -1.4, twist: 0.4, lean: 0.2 }], [1, {}]] },
  { id: 'hook', dur: 0.5, hs: 0.15, he: 0.26, dmg: 8, kb: 7.5, up: 3, range: 2.3, arc: 2.5, lunge: 3.5,
    keys: [[0, {}], [0.28, { aLz: 1.8, aL: -0.2, twist: 0.5, lean: -0.1 }], [0.5, { aLz: 0.35, aL: -1.5, twist: -0.65, lean: 0.25 }], [0.75, { aLz: 0.3, aL: -1.2, twist: -0.4 }], [1, {}]] },
  { id: 'kick', dur: 0.56, hs: 0.18, he: 0.3, dmg: 9, kb: 8.5, up: 3.5, range: 2.6, arc: 2.0, lunge: 3,
    keys: [[0, {}], [0.26, { lR: 1.0, lean: 0.12, aL: -0.6, aR: 0.6 }], [0.46, { lR: -1.75, lean: -0.3, aL: -0.9, aR: 0.9, bodyY: 0.02 }], [0.72, { lR: -1.4, lean: -0.2, aL: -0.6, aR: 0.6 }], [1, {}]] },
  { id: 'spin', dur: 0.72, hs: 0.22, he: 0.46, dmg: 10, kb: 8, up: 3, range: 2.7, arc: TAU, lunge: 0, turns: 1,
    keys: [[0, {}], [0.2, { lL: 0.5, aLz: 1.2, aRz: -1.2, lean: 0.1 }], [0.45, { lR: -1.5, aLz: 1.5, aRz: -1.5, lean: -0.1 }], [0.7, { lR: -1.2, aLz: 1.4, aRz: -1.4 }], [1, {}]] },
  { id: 'upper', dur: 0.62, hs: 0.2, he: 0.3, dmg: 9, kb: 4.5, up: 9, range: 2.1, arc: 2.0, lunge: 1.5, hop: 6.5,
    keys: [[0, {}], [0.22, { aR: 1.0, lean: 0.35, bodyY: -0.28, lL: -0.5, lR: 0.5 }], [0.4, { aR: -3.0, lean: -0.35, bodyY: 0.1, twist: 0.3 }], [0.7, { aR: -2.8, lean: -0.3 }], [1, {}]] },
  { id: 'flyer', dur: 0.62, hs: 0.2, he: 0.38, dmg: 10, kb: 9, up: 3.5, range: 2.5, arc: 1.9, lunge: 9, hop: 3.5,
    keys: [[0, {}], [0.22, { lR: 0.6, lL: -0.3, lean: 0.2, aLz: 0.9, aRz: -0.9 }], [0.4, { lR: -1.5, lL: -1.2, lean: -0.8, aL: 0.4, aR: 0.4, aLz: 0.8, aRz: -0.8 }], [0.75, { lR: -1.3, lL: -1.0, lean: -0.7, aLz: 0.7, aRz: -0.7 }], [1, {}]] },
];
const SUPER = { id: 'super', super: true, dur: 0.95, hs: 0.52, he: 0.66, dmg: 14, kb: 30, up: 11, range: 3.6, arc: 2.8, lunge: 5,
  keys: [[0, {}], [0.38, { aR: 2.4, aL: 2.4, twist: -0.8, lean: -0.3, bodyY: -0.15, lL: -0.4, lR: 0.5 }], [0.58, { aR: -1.6, aL: -1.6, twist: 0.7, lean: 0.5 }], [0.82, { aR: -1.5, aL: -1.5, lean: 0.35, twist: 0.4 }], [1, {}]] };

function samplePose(keys, p, out) {
  let i = 0; while (i < keys.length - 1 && p > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], span = b[0] - a[0];
  let u = span > 0 ? clamp((p - a[0]) / span, 0, 1) : 1; u = u * u * (3 - 2 * u);
  for (const k of POSEKEYS) out[k] = lerp(a[1][k] || 0, b[1][k] || 0, u);
}

// =================================================================================================
//  fighter
// =================================================================================================
class Fighter {
  constructor(cfg, isPlayer) {
    this.cfg = cfg; this.name = cfg.name; this.isPlayer = isPlayer;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.visYaw = 0;
    Object.assign(this, { alive: true, grounded: true, jumpsLeft: 2, stun: 0, launch: 0, atk: null, atkT: 0, hitSet: null, hopDone: false, atkBuf: 0,
      meter: 0, damage: 0, hits: 0, lastAtk: null, hitFlash: 0, squash: 0, phase: 0, time: rnd(0, 10), tumble: 0, lastHitBy: null, lastHitT: -99,
      hitCd: 0, place: 0, speedMul: 1, cheer: false, falling: false, blinkT: rnd(1, 4), ai: null, tag: null, wasGrounded: true, sfxFall: false });
    this.input = { mx: 0, mz: 0, attack: false, jump: false };
    this.pose = Object.fromEntries(POSEKEYS.map((k) => [k, 0]));
    this.rig = buildFighter(cfg); this.group = this.rig.root; scene.add(this.group);
  }

  startAttack(G) {
    this.atkBuf = 0;
    let a;
    if (this.meter >= 6) { a = SUPER; this.meter = 0; G.sfx('charge'); if (this.isPlayer) { G.banner('SUPER!!', 0.8); speak('Super!', 0.9, 0.95); } }
    else { do { a = pick(ATTACKS); } while (a === this.lastAtk); this.lastAtk = a; }
    this.atk = a; this.atkT = 0; this.hitSet = new Set(); this.hopDone = false;
    // gentle aim assist: face the closest enemy in front
    let best = null, bd = 3.6;
    for (const e of G.fighters) {
      if (e === this || !e.alive) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && (Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) < 1.35 || !this.isPlayer)) { bd = d; best = e; }
    }
    if (best) this.yaw = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
    if (this.grounded && a.lunge) { this.vel.x = Math.sin(this.yaw) * a.lunge * 1.7; this.vel.z = Math.cos(this.yaw) * a.lunge * 1.7; }
    if (!a.super) G.sfx('whoosh');
  }

  jump(G) {
    const first = this.grounded;
    this.vel.y = first ? 11.8 : 10; this.jumpsLeft--; this.grounded = false; this.squash = -0.25;
    G.sfx(first ? 'jump' : 'jump2');
    if (first) emit(this.pos.x, this.pos.y + 0.05, this.pos.z, 7, { color: 0xffffff, speed: 2.6, life: 0.4, size: 0.2, grav: 2, flat: true });
    else { ring(this.pos.x, this.pos.y, this.pos.z, 0xffffff, 1.6, 0.35); emit(this.pos.x, this.pos.y, this.pos.z, 6, { color: [0xffd93d, 0xff4fa3, 0x36d1ff], speed: 3, life: 0.4, size: 0.16 }); }
  }

  update(dt, G) {
    if (!this.alive) return;
    const A = G.arena, inp = this.input;
    this.time += dt; this.stun -= dt; this.launch -= dt; this.hitCd -= dt; this.hitFlash -= dt; this.atkBuf -= dt;
    this.squash = damp(this.squash, 0, 9, dt);
    if (inp.attack) { this.atkBuf = 0.3; inp.attack = false; }
    const hitstunned = this.stun > 0 || this.launch > 0;
    const canAct = !hitstunned && !G.frozen;

    // ----- attack progress & hit detection
    if (this.atk) {
      this.atkT += dt;
      const a = this.atk;
      if (a.hop && !this.hopDone && this.atkT >= a.hs) { this.hopDone = true; if (this.grounded) { this.vel.y = a.hop; this.grounded = false; } }
      if (a.super && this.atkT < a.hs && Math.random() < 0.8) emit(this.pos.x + rnd(-0.8, 0.8), this.pos.y + rnd(0.2, 2), this.pos.z + rnd(-0.8, 0.8), 1, { color: [0xffd93d, 0xffffff, 0xff9a2e], speed: 0.5, life: 0.5, size: 0.22, grav: -3 });
      if (this.atkT >= a.hs && this.atkT <= a.he) {
        for (const e of G.fighters) {
          if (e === this || !e.alive || this.hitSet.has(e) || e.hitCd > 0) continue;
          const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
          if (d > a.range || Math.abs(e.pos.y - this.pos.y) > 1.9) continue;
          if (a.arc < TAU && Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) > a.arc / 2) continue;
          this.hitSet.add(e); G.applyHit(this, e, a);
        }
      }
      if (this.atkT >= a.dur) this.atk = null;
    }
    if (canAct && !this.atk && this.atkBuf > 0) this.startAttack(G);

    // ----- steering
    let dx = canAct ? inp.mx : 0, dz = canAct ? inp.mz : 0;
    const dl = Math.hypot(dx, dz); if (dl > 1) { dx /= dl; dz /= dl; }
    const spd = 6.9 * this.speedMul * (this.atk ? 0.32 : 1);
    if (canAct) {
      if (this.grounded) { const k = this.atk ? 7 : 15; this.vel.x = damp(this.vel.x, dx * spd, k, dt); this.vel.z = damp(this.vel.z, dz * spd, k, dt); }
      else { this.vel.x = damp(this.vel.x, dx * spd * 0.9, 3.2, dt); this.vel.z = damp(this.vel.z, dz * spd * 0.9, 3.2, dt); }
    } else if (this.grounded) {
      const fr = this.launch > 0 ? 0.85 : 3.6; const f = Math.exp(-fr * dt); this.vel.x *= f; this.vel.z *= f;
    }
    if (canAct && !this.atk && dl > 0.1) this.yaw = dampAng(this.yaw, Math.atan2(dx, dz), 15, dt);
    if (inp.jump) { inp.jump = false; if (canAct && this.jumpsLeft > 0) this.jump(G); }

    // ----- physics
    this.vel.y = Math.max(this.vel.y - 34 * dt, -50);
    const prevY = this.pos.y;
    this.pos.addScaledVector(this.vel, dt);
    const h = A.groundAt(this.pos.x, this.pos.z);
    const was = this.grounded;
    if (h !== null && this.vel.y <= 0 && this.pos.y <= h && prevY >= h - 0.3) {
      this.pos.y = h; this.vel.y = 0; this.grounded = true; this.jumpsLeft = 2; this.falling = false;
      if (!was) { this.squash = 0.28; G.sfx('land'); emit(this.pos.x, h + 0.05, this.pos.z, 6, { color: 0xffffff, speed: 2.4, life: 0.35, size: 0.18, grav: 2, flat: true }); }
    } else {
      this.grounded = false;
      if (was && this.vel.y <= 0) this.jumpsLeft = Math.min(this.jumpsLeft, 1);
    }
    this.falling = !this.grounded && h === null && this.pos.y < -1.2;
    if (this.falling && !this.sfxFall) { this.sfxFall = true; if (this.launch > 0 || this.stun > 0 || !this.isPlayer) G.sfx('fall'); }
    if (this.grounded) this.sfxFall = false;
    if (this.pos.y < -24) G.eliminate(this);
  }

  // pure visuals ------------------------------------------------------------------------------
  animate(dt, G) {
    const R = this.rig, Pz = this.pose, T = {}; POSEKEYS.forEach((k) => (T[k] = 0));
    const sp = Math.hypot(this.vel.x, this.vel.z), spN = this.grounded ? Math.min(sp / 6.9, 1.4) : 0;
    let k = 16, spinY = 0;
    const stunned = this.stun > 0 || this.launch > 0;
    if (this.cheer) { T.aLz = 2.7; T.aRz = -2.7; T.bodyY = Math.abs(Math.sin(this.time * 8)) * 0.18; T.lean = Math.sin(this.time * 8) * 0.08; k = 12; }
    else if (stunned) { Object.assign(T, { aLz: 1.4, aRz: -1.4, aL: -0.4, aR: -0.4, lean: -0.35, headX: -0.4, lL: 0.35, lR: -0.35 }); k = 30; }
    else if (this.atk) {
      const a = this.atk; samplePose(a.keys, clamp(this.atkT / a.dur, 0, 1), T); k = 34;
      if (a.turns) { const u = clamp((this.atkT / a.dur - 0.12) / 0.62, 0, 1); spinY = u * u * (3 - 2 * u) * a.turns * TAU; }
      if (a.super) { const c = this.atkT < a.hs ? this.atkT / a.hs : 0; T.bodyY += Math.sin(this.time * 60) * 0.015 * c; }
    } else if (!this.grounded) {
      if (this.falling) { T.aLz = 2.3 + Math.sin(this.time * 18) * 0.5; T.aRz = -2.3 - Math.sin(this.time * 18 + 1) * 0.5; T.lL = Math.sin(this.time * 16) * 0.8; T.lR = -Math.sin(this.time * 16) * 0.8; T.lean = 0.2; }
      else if (this.vel.y > 0) { Object.assign(T, { aLz: 1.5, aRz: -1.5, lL: -0.45, lR: 0.7, lean: 0.12 }); }
      else { Object.assign(T, { aLz: 1.9, aRz: -1.9, lL: 0.15, lR: -0.2, lean: 0.05 }); }
      k = 12;
    } else if (spN > 0.08) {
      this.phase += sp * dt * 1.7;
      const s = Math.sin(this.phase), amt = Math.min(spN, 1);
      T.lR = s * 0.95 * amt; T.lL = -s * 0.95 * amt; T.aL = s * 0.85 * amt; T.aR = -s * 0.85 * amt;
      T.bodyY = Math.abs(Math.cos(this.phase)) * 0.09 * amt - 0.03; T.lean = 0.16 * amt;
    } else {
      const b = Math.sin(this.time * 2.6); T.aLz = 0.12 + b * 0.04; T.aRz = -0.12 - b * 0.04; T.bodyY = b * 0.012; T.headX = b * 0.02;
    }
    for (const key of POSEKEYS) Pz[key] = damp(Pz[key], T[key], k, dt);

    R.armL.rotation.set(Pz.aL, 0, Pz.aLz); R.armR.rotation.set(Pz.aR, 0, Pz.aRz);
    R.legL.rotation.x = Pz.lL; R.legR.rotation.x = Pz.lR;
    R.body.position.y = 0.78 + Pz.bodyY; R.body.rotation.set(Pz.lean, Pz.twist + spinY, 0); R.headG.rotation.x = Pz.headX;
    const sq = this.squash; R.model.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);

    // tumble when launched / falling
    if (this.launch > 0 || this.falling) this.tumble -= dt * (this.launch > 0 ? 15 : 6);
    else this.tumble = damp(this.tumble, Math.round(this.tumble / TAU) * TAU, 14, dt);
    R.pivot.rotation.x = this.tumble;

    // glow: hit flash / super-ready
    let em = 0, er = 1, eg = 1, eb = 1;
    if (this.hitFlash > 0) em = 0.9;
    else if (this.meter >= 6 || (this.atk && this.atk.super)) { em = 0.35 + Math.sin(this.time * 14) * 0.25; er = 1; eg = 0.78; eb = 0.1; }
    for (const m of R.mats) { m.emissive.setRGB(er * em, eg * em, eb * em); }
    if (this.meter >= 6 && Math.random() < dt * 14) emit(this.pos.x + rnd(-0.5, 0.5), this.pos.y + rnd(0, 2), this.pos.z + rnd(-0.5, 0.5), 1, { color: 0xffd93d, speed: 0.4, life: 0.5, size: 0.14, grav: -2 });

    // blink
    this.blinkT -= dt; const bl = this.blinkT < 0.1 && this.blinkT > 0 ? 0.1 : 1; if (this.blinkT < -0.05) this.blinkT = rnd(1.5, 4.5);
    R.blink.forEach((e) => (e.scale.y = bl));
    if (R.anim) R.anim(this, this.time, sp, !this.grounded);

    this.visYaw = dampAng(this.visYaw, this.yaw, 22, dt);
    this.group.position.copy(this.pos); this.group.rotation.y = this.visYaw;
  }

  dispose() { scene.remove(this.group); disposeObj(this.group); }
}

// =================================================================================================
//  AI
// =================================================================================================
const DIFFS = [
  { name: 'Easy', speed: 0.82, aggr: 0.55, edge: 0.6, react: 0.5 },
  { name: 'Normal', speed: 0.94, aggr: 1.0, edge: 0.85, react: 0.3 },
  { name: 'Hard', speed: 1.04, aggr: 1.7, edge: 1.0, react: 0.15 },
];
function aiThink(f, dt, G) {
  const ai = f.ai, A = G.arena, inp = f.input;
  inp.mx = inp.mz = 0;
  if (G.frozen) return;
  const centerDir = () => { const l = Math.hypot(f.pos.x, f.pos.z) || 1; return [-f.pos.x / l, -f.pos.z / l]; };
  // falling: fight to get back
  if (!f.grounded && f.pos.y < -0.4 && A.groundAt(f.pos.x, f.pos.z) === null) {
    [inp.mx, inp.mz] = centerDir();
    if (f.jumpsLeft > 0 && f.vel.y < 1 && f.pos.y < -0.9 && f.stun <= 0 && f.launch <= 0 && Math.random() < dt * 8) inp.jump = true;
    return;
  }
  if (f.stun > 0 || f.launch > 0) return;
  ai.retarget -= dt;
  if (ai.retarget <= 0 || !ai.target || !ai.target.alive) {
    ai.retarget = rnd(1, 2.2);
    let best = null, bd = 1e9;
    for (const e of G.fighters) {
      if (e === f || !e.alive) continue;
      const d = Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z) - (e.isPlayer ? 3 * ai.d.aggr : 0) + rnd(0, 3);
      if (d < bd) { bd = d; best = e; }
    }
    ai.target = best;
  }
  const tg = ai.target; if (!tg) return;
  let dx = tg.pos.x - f.pos.x, dz = tg.pos.z - f.pos.z; const dist = Math.hypot(dx, dz) || 1; dx /= dist; dz /= dist;
  let mx = 0, mz = 0;
  const reach = f.meter >= 6 ? 2.7 : 1.9;
  if (dist > reach * 0.85) { mx = dx; mz = dz; }
  else { ai.strafeT -= dt; if (ai.strafeT < 0) { ai.strafeT = rnd(0.5, 1.3); ai.strafe = pick([-1, 0, 1]); } mx = -dz * ai.strafe * 0.5; mz = dx * ai.strafe * 0.5; }
  if (f.atk) { mx *= 0.2; mz *= 0.2; }
  // keep away from the edge / crumbling tiles
  const look = 1.7;
  const safeDir = (x, z) => A.safe(f.pos.x + x * look, f.pos.z + z * look);
  if ((mx || mz) && (!safeDir(mx / (Math.hypot(mx, mz) || 1), mz / (Math.hypot(mx, mz) || 1)) || !A.safe(f.pos.x, f.pos.z)) && Math.random() < ai.d.edge + 0.15) {
    const l = Math.hypot(mx, mz) || 1; let found = false;
    for (const a of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6, Math.PI]) {
      const c = Math.cos(a), s = Math.sin(a), rx = (mx * c - mz * s) / l, rz = (mx * s + mz * c) / l;
      if (safeDir(rx, rz)) { mx = rx; mz = rz; found = true; break; }
    }
    if (!found) [mx, mz] = centerDir();
  } else if (!mx && !mz && !A.safe(f.pos.x, f.pos.z)) [mx, mz] = centerDir();
  inp.mx = mx; inp.mz = mz;
  // attack
  ai.cd -= dt;
  if (!f.atk && ai.cd <= 0 && dist < reach + 0.35 && Math.abs(tg.pos.y - f.pos.y) < 1.6) {
    if (f.meter >= 6 || Math.random() < dt * 6 * ai.d.aggr) { inp.attack = true; ai.cd = rnd(0.3, 0.9) / ai.d.aggr + ai.d.react * rnd(0, 0.5); }
  }
  // sometimes hop around
  if (f.grounded && Math.random() < dt * 0.15) inp.jump = true;
  if (f.grounded && tg.pos.y - f.pos.y > 1.2 && dist < 3 && Math.random() < dt * 3) inp.jump = true;
}

// =================================================================================================
//  game state
// =================================================================================================
const G = {
  state: 'menu', arena: null, fighters: [], player: null, matchTime: 0, countdown: 0, frozen: false, paused: false,
  hitstop: 0, slowT: 0, slowScale: 1, ff: false, shake: 0, fovKick: 0, camYaw: 0, overT: 0, shrinkWarned: false,
  focus: new THREE.Vector3(), cfg: { char: 0, count: 6, arena: 'random', diff: 1 }, showcase: null, placed: 0,
  sfx: (n) => { if (SFX[n]) SFX[n](); },
};
window.__G = G; // handy for debugging
G.step = (dt) => sim(dt);

// ---- settings persistence
try { Object.assign(G.cfg, JSON.parse(localStorage.getItem('voidbrawl') || '{}')); } catch (e) { /* ignore */ }
const saveCfg = () => { try { localStorage.setItem('voidbrawl', JSON.stringify(G.cfg)); } catch (e) { /* ignore */ } };

// ---- HUD helpers
let bannerTimer = 0;
G.banner = (text, secs = 1) => {
  const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth;
  b.style.animationDuration = secs + 's'; b.classList.add('show');
};
function feed(html) {
  const d = document.createElement('div'); d.innerHTML = html; $('feed').appendChild(d);
  while ($('feed').children.length > 5) $('feed').firstChild.remove();
  setTimeout(() => d.remove(), 5000);
}
const _v = new THREE.Vector3();
function popup(x, y, z, text) {
  _v.set(x, y, z).project(camera); if (_v.z > 1) return;
  const d = document.createElement('div'); d.className = 'pop'; d.textContent = text;
  d.style.left = (_v.x * 0.5 + 0.5) * innerWidth + 'px'; d.style.top = (-_v.y * 0.5 + 0.5) * innerHeight + 'px';
  $('popups').appendChild(d); setTimeout(() => d.remove(), 750);
}

G.applyHit = (att, vic, atk) => {
  const sup = !!atk.super;
  let dx = vic.pos.x - att.pos.x, dz = vic.pos.z - att.pos.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const fx = Math.sin(att.yaw), fz = Math.cos(att.yaw);
  let kx = dx * 0.55 + fx * 0.45, kz = dz * 0.55 + fz * 0.45; const kl = Math.hypot(kx, kz) || 1; kx /= kl; kz /= kl;
  const armored = vic.atk && vic.atk.super && vic.atkT < vic.atk.hs; // super wind-up can't be interrupted
  vic.damage += armored ? atk.dmg * 0.4 : atk.dmg; vic.lastHitBy = att; vic.lastHitT = G.matchTime; vic.hitCd = 0.12;
  att.hits++; att.meter = sup ? 0 : Math.min(6, att.meter + 1);
  const cx = (att.pos.x + vic.pos.x) / 2, cy = vic.pos.y + 1.4, cz = (att.pos.z + vic.pos.z) / 2;
  if (!armored) {
    const kbH = sup ? atk.kb : atk.kb + vic.damage * 0.1, kbV = sup ? atk.up : atk.up + vic.damage * 0.03;
    vic.vel.set(kx * kbH, kbV, kz * kbH); vic.grounded = false;
    vic.stun = sup ? 1.0 : 0.26 + Math.min(0.3, vic.damage * 0.003); vic.launch = sup ? 1.6 : 0;
    vic.atk = null; vic.hitFlash = 0.14; vic.yaw = Math.atan2(-kx, -kz); vic.visYaw = vic.yaw; vic.tumble = 0;
  } else vic.hitFlash = 0.08;
  // juice
  emit(cx, cy, cz, sup ? 40 : 14, { color: sup ? [0xffd93d, 0xffffff, 0xff4fa3] : [0xffffff, 0xffd93d], speed: sup ? 12 : 6, life: sup ? 0.8 : 0.4, size: sup ? 0.4 : 0.22, grav: 4 });
  if (sup) { ring(vic.pos.x, vic.pos.y + 1, vic.pos.z, 0xffd93d, 9, 0.6); ring(vic.pos.x, vic.pos.y + 1, vic.pos.z, 0xffffff, 6, 0.4); }
  G.sfx(sup ? 'superHit' : 'hit');
  const involves = att.isPlayer || vic.isPlayer;
  G.hitstop = Math.max(G.hitstop, sup ? 0.2 : involves ? 0.075 : 0.04);
  if (sup) { G.slowT = 0.7; G.slowScale = 0.28; G.fovKick = 14; }
  G.shake = Math.max(G.shake, sup ? 1.0 : involves ? 0.35 : 0.12);
  if (involves) popup(cx, cy + 0.6, cz, sup ? 'K.O.!!' : pick(['POW!', 'BAM!', 'WHAM!', 'BONK!', 'ZAP!', 'SMACK!']));
  if (sup && !vic.isPlayer && att.isPlayer) feed(`⭐ <b>${att.name}</b> launched <b>${vic.name}</b>!`);
};

G.eliminate = (f) => {
  if (!f.alive) return;
  f.alive = false; f.group.visible = false;
  const left = G.fighters.filter((x) => x.alive).length;
  f.place = left + 1;
  if (f.tag) f.tag.el.style.display = 'none';
  const by = f.lastHitBy && G.matchTime - f.lastHitT < 6 ? f.lastHitBy : null;
  feed(by ? `💥 <b>${f.name}</b> was knocked out by <b>${by.name}</b>` : `🌀 <b>${f.name}</b> fell into the void`);
  G.sfx('ko');
  if (f.isPlayer) { $('specHint').classList.remove('hidden'); G.banner('KNOCKED OUT!', 1.4); G.sfx('lose'); speak('Knocked out!', 0.8, 0.95); }
  if (by && by.isPlayer) { by.cheer = false; }
  // little pop in the distance
  const c = G.camTarget; if (c) emit(f.pos.x, Math.max(f.pos.y, c.y - 8), f.pos.z, 20, { color: [0xff4fa3, 0xffd93d, 0x36d1ff], speed: 9, life: 0.8, size: 0.5, grav: 0 });
  updateAliveHud();
  if (G.state === 'playing') {
    if (left <= 1) { const w = G.fighters.find((x) => x.alive); endMatch(w || f); }
  }
};

// ---- match flow ------------------------------------------------------------------------------
function clearWorld() {
  G.fighters.forEach((f) => { f.dispose(); if (f.tag) f.tag.el.remove(); });
  G.fighters = []; G.player = null;
  if (G.arena) { G.arena.dispose(); G.arena = null; }
  $('labels').innerHTML = ''; $('feed').innerHTML = ''; $('popups').innerHTML = '';
}

function startMatch() {
  ensureAudio(); musicStart();
  clearWorld();
  const c = G.cfg, n = clamp(c.count, 4, 8);
  const type = c.arena === 'random' ? pick(['island', 'spinner', 'crumble']) : c.arena;
  G.arena = makeArena(type, n);
  const pc = ROSTER[c.char], others = ROSTER.filter((r) => r !== pc).sort(() => Math.random() - 0.5).slice(0, n - 1);
  const list = [pc, ...others], diff = DIFFS[c.diff];
  list.forEach((cfg, i) => {
    const f = new Fighter(cfg, i === 0);
    const [x, z] = G.arena.spawn(i, n); f.pos.set(x, 0, z); f.yaw = f.visYaw = Math.atan2(-x, -z);
    if (i > 0) { f.speedMul = diff.speed * rnd(0.96, 1.04); f.ai = { target: null, retarget: rnd(0, 1), cd: rnd(0.5, 1.5), strafe: 0, strafeT: 0, d: diff }; }
    const el = document.createElement('div'); el.className = 'tag' + (f.isPlayer ? ' me' : '');
    el.innerHTML = `<span class="nm" style="color:${f.isPlayer ? '#fff' : cfg.color}">${f.isPlayer ? 'YOU' : cfg.name}</span><span class="pc">0%</span>`;
    $('labels').appendChild(el); f.tag = { el, pc: el.querySelector('.pc'), last: -1 };
    G.fighters.push(f);
  });
  G.player = G.fighters[0];
  // order of fighters matters for spawn spacing only; shuffle player's slot
  G.state = 'countdown'; G.countdown = 3.4; G.frozen = true; G.matchTime = 0; G.over = false; G.ff = false; G.shrinkWarned = false;
  G.camYaw = Math.atan2(-G.player.pos.x, -G.player.pos.z) + Math.PI; // behind the player, looking at the arena centre
  G.focus.copy(G.player.pos); G.lastCount = 4;
  G.camTarget = G.focus;
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); $('specHint').classList.add('hidden'); $('pause').classList.add('hidden');
  G.paused = false; updateAliveHud(); updateMeterHud(true);
  G.banner(G.arena.name, 1.4);
}

function endMatch(winner) {
  G.state = 'over'; G.over = true; G.frozen = true; G.overT = 0; G.winner = winner;
  winner.cheer = true; winner.vel.set(0, 0, 0);
  G.banner(winner.isPlayer ? 'VICTORY!' : `${winner.name} wins!`, 2.2);
  musicStop();
  if (winner.isPlayer) { G.sfx('win'); G.sfx('cheer'); setTimeout(aakupi, 450); } else { G.sfx('lose'); setTimeout(() => speak(winner.name + ' wins!', 1, 1), 400); }
  if (winner.isPlayer) for (let i = 0; i < 4; i++) setTimeout(() => emit(winner.pos.x, 3, winner.pos.z, 40, { color: [0xff4fa3, 0xffd93d, 0x36d1ff, 0x7bff6a], speed: 11, life: 1.4, size: 0.3, grav: 7 }), i * 250);
}

function confetti() {
  const box = $('end'); box.querySelectorAll('.confetti').forEach((e) => e.remove());
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = pick(['#ff4fa3', '#ffd93d', '#36d1ff', '#7bff6a', '#a855f7']);
    c.style.animationDuration = 2.2 + Math.random() * 2.5 + 's'; c.style.animationDelay = Math.random() * 1.2 + 's';
    box.appendChild(c);
  }
}
function showEnd() {
  const w = G.winner, p = G.player;
  if (w === p) { confetti(); $('endTitle').textContent = '🏆 VICTORY! 🏆'; $('endSub').textContent = `You knocked out all ${G.fighters.length - 1} opponents. Hits landed: ${p.hits}.`; }
  else { $('endTitle').textContent = 'KNOCKED OUT'; $('endSub').textContent = `${w.name} wins. You placed ${ordinal(p.place)} of ${G.fighters.length}. Hits landed: ${p.hits}.`; }
  $('end').classList.remove('hidden'); $('specHint').classList.add('hidden');
}

function showMenu() {
  musicStop(); try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  clearWorld(); G.state = 'menu'; G.frozen = false; G.paused = false;
  $('hud').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden'); $('menu').classList.remove('hidden');
  buildShowcase();
}

function buildShowcase() {
  clearWorld();
  G.arena = makeArena('island', 0); G.arena.update = () => {};
  const f = new Fighter(ROSTER[G.cfg.char], false); f.pos.set(0, 0, 0); G.fighters = [f]; G.showcase = { f, t: 0, ang: 0 };
  G.frozen = false;
}

function updateAliveHud() {
  const n = G.fighters.filter((f) => f.alive).length;
  $('aliveInfo').textContent = `${n} left`;
}
function updateMeterHud(force) {
  const p = G.player; if (!p) return;
  const m = p.meter | 0;
  if (force || G._m !== m) {
    G._m = m;
    $('meterPips').innerHTML = Array.from({ length: 6 }, (_, i) => `<i class="${i < m ? 'on' : ''}"></i>`).join('');
    $('meterWrap').classList.toggle('full', m >= 6);
    $('meterText').textContent = m >= 6 ? '⭐ SUPER READY — CLICK! ⭐' : `${6 - m} more hit${6 - m === 1 ? '' : 's'} for a SUPER`;
  }
  const d = Math.round(p.damage); $('dmgInfo').textContent = d + '%';
  $('dmgInfo').style.color = d < 40 ? '#fff' : d < 80 ? '#ffe27a' : d < 120 ? '#ff9a3d' : '#ff4f4f';
}

// =================================================================================================
//  input
// =================================================================================================
const keys = new Set(); const pend = { attack: false, jump: false };
const inGame = () => G.state === 'countdown' || G.state === 'playing';
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space' && inGame()) pend.jump = true;
  if (e.code === 'Escape' && inGame()) { G.paused = !G.paused; $('pause').classList.toggle('hidden', !G.paused); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyF' && G.state === 'playing' && !G.player.alive) G.ff = !G.ff;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('mousedown', (e) => {
  ensureAudio();
  if (!inGame() || G.paused) return;
  if (e.button === 0) pend.attack = true; else if (e.button === 2) pend.jump = true;
  e.preventDefault();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

function toggleMute() { muted = !muted; if (muted) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } $('muteBtn').textContent = muted ? '🔇' : '🔊'; }
$('muteBtn').onclick = () => { ensureAudio(); toggleMute(); };

// =================================================================================================
//  menu UI
// =================================================================================================
function buildMenu() {
  const grid = $('charGrid'); grid.innerHTML = '';
  ROSTER.forEach((r, i) => {
    const b = document.createElement('button'); b.className = 'card' + (i === G.cfg.char ? ' sel' : '');
    b.innerHTML = `<div class="ic">${r.icon}</div><div class="nm">${r.name}</div>`;
    b.onclick = () => { G.cfg.char = i; saveCfg(); [...grid.children].forEach((c, j) => c.classList.toggle('sel', j === i)); buildShowcase(); };
    grid.appendChild(b);
  });
  const seg = (id, items, key) => {
    const el = $(id); el.innerHTML = '';
    items.forEach(([val, label]) => {
      const b = document.createElement('button'); b.textContent = label; b.className = G.cfg[key] === val ? 'sel' : '';
      b.onclick = () => { G.cfg[key] = val; saveCfg(); [...el.children].forEach((c) => c.classList.remove('sel')); b.classList.add('sel'); };
      el.appendChild(b);
    });
  };
  seg('arenaBtns', [['random', '🎲 Random'], ['island', '🏝 Island'], ['spinner', '🌀 Spinner'], ['crumble', '🧱 Crumble']], 'arena');
  seg('diffBtns', DIFFS.map((d, i) => [i, d.name]), 'diff');
  const setCount = (v) => { G.cfg.count = clamp(v, 4, 8); $('fCount').textContent = G.cfg.count; saveCfg(); };
  $('fMinus').onclick = () => setCount(G.cfg.count - 1); $('fPlus').onclick = () => setCount(G.cfg.count + 1); setCount(G.cfg.count);
}
G.cfg.char = clamp(G.cfg.char | 0, 0, ROSTER.length - 1); G.cfg.diff = clamp(G.cfg.diff | 0, 0, 2);
buildMenu();
$('startBtn').onclick = startMatch; $('againBtn').onclick = startMatch; $('menuBtn').onclick = showMenu;
$('quitBtn').onclick = showMenu;

// =================================================================================================
//  per-frame simulation
// =================================================================================================
function separate() {
  const fs = G.fighters;
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    const a = fs[i], b = fs[j]; if (!a.alive || !b.alive) continue;
    if (Math.abs(a.pos.y - b.pos.y) > 1.8) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = 1.15;
    if (d < m && d > 1e-4) { const push = (m - d) * 0.5, nx = dx / d, nz = dz / d; a.pos.x -= nx * push; a.pos.z -= nz * push; b.pos.x += nx * push; b.pos.z += nz * push; }
  }
}

function readPlayerInput() {
  const p = G.player; if (!p) return;
  let up = 0, rt = 0;
  if (keys.has('ArrowUp') || keys.has('KeyW')) up += 1; if (keys.has('ArrowDown') || keys.has('KeyS')) up -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) rt += 1; if (keys.has('ArrowLeft') || keys.has('KeyA')) rt -= 1;
  const cy = G.camYaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
  p.input.mx = fx * up + rx * rt; p.input.mz = fz * up + rz * rt;
  if (pend.attack) p.input.attack = true; if (pend.jump) p.input.jump = true;
  pend.attack = pend.jump = false;
}

function sim(dt) {
  const st = G.state;
  if (st === 'menu') {
    const s = G.showcase; if (!s) return;
    s.t += dt; s.f.input.mx = s.f.input.mz = 0;
    if (s.t > 2.2) { s.t = 0; s.f.input.attack = true; }
    s.f.update(dt, G); s.f.animate(dt, G); s.f.yaw += dt * 0.5;
    return;
  }
  if (st === 'countdown') {
    G.countdown -= dt;
    const c = Math.ceil(G.countdown - 0.4);
    if (c !== G.lastCount && c <= 3) { G.lastCount = c; if (c > 0) { G.banner(String(c), 0.8); G.sfx('count'); } }
    if (G.countdown <= 0.4 && G.lastCount !== 0) { G.lastCount = 0; G.banner('FIGHT!', 0.9); G.sfx('go'); speak('Fight!'); G.state = 'playing'; G.frozen = false; }
    readPlayerInput();
  }
  if (G.state === 'playing') {
    G.matchTime += dt;
    readPlayerInput();
    for (const f of G.fighters) if (f.ai && f.alive) aiThink(f, dt, G);
  }
  if (G.state === 'over') { G.overT += dt; if (G.overT > (G.winner === G.player ? 3.4 : 2.2) && $('end').classList.contains('hidden')) showEnd(); }
  for (const f of G.fighters) f.update(dt, G);
  separate();
  G.arena.update(dt, G);
  for (const f of G.fighters) f.animate(dt, G);
}

// camera ----------------------------------------------------------------------------------------
const CAM_D = 12.5, CAM_H = 7.8;
function updateCamera(dt, rdt) {
  let subject = G.player;
  if (G.state === 'menu') {
    const s = G.showcase; G.camYaw += rdt * 0.35;
    const x = Math.sin(G.camYaw) * 9.5, z = Math.cos(G.camYaw) * 9.5;
    camera.position.set(x - Math.cos(G.camYaw) * 3.4, 3.6, z + Math.sin(G.camYaw) * 3.4);
    camera.lookAt(0, 1.5, 0); camera.fov = 50;
    if (innerWidth > 900) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.2, 0, innerWidth, innerHeight); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    return;
  }
  if (!subject) return;
  if (camera.view && camera.view.enabled) { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  if (!subject.alive) subject = G.fighters.find((f) => f.alive) || subject;
  if (keys.has('KeyQ')) G.camYaw += 1.9 * rdt; if (keys.has('KeyE')) G.camYaw -= 1.9 * rdt;
  const tx = subject.pos.x, tz = subject.pos.z, ty = Math.max(subject.pos.y, -7);
  G.focus.x = damp(G.focus.x, tx, 7, rdt); G.focus.z = damp(G.focus.z, tz, 7, rdt); G.focus.y = damp(G.focus.y, ty, 5, rdt);
  const sh = G.shake; G.shake = Math.max(0, sh - rdt * 2.4);
  const cx = G.focus.x + Math.sin(G.camYaw) * CAM_D + rnd(-sh, sh) * 0.4, cy = G.focus.y + CAM_H + rnd(-sh, sh) * 0.3, cz = G.focus.z + Math.cos(G.camYaw) * CAM_D + rnd(-sh, sh) * 0.4;
  camera.position.set(cx, cy, cz);
  camera.lookAt(G.focus.x, G.focus.y + 1.4, G.focus.z);
  G.fovKick = damp(G.fovKick, 0, 4, rdt);
  const fov = 52 + G.fovKick; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

function updateLabels() {
  const W = innerWidth, H = innerHeight;
  for (const f of G.fighters) {
    const t = f.tag; if (!t) continue;
    if (!f.alive || f.pos.y < -3) { t.el.style.display = 'none'; continue; }
    _v.set(f.pos.x, f.pos.y + 2.95, f.pos.z).project(camera);
    if (_v.z > 1) { t.el.style.display = 'none'; continue; }
    t.el.style.display = '';
    t.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * W}px,${(-_v.y * 0.5 + 0.5) * H}px) translate(-50%,-100%)`;
    const d = Math.round(f.damage); if (d !== t.last) { t.last = d; t.pc.textContent = d + '%'; t.pc.style.color = d < 40 ? '#fff' : d < 80 ? '#ffe27a' : d < 120 ? '#ff9a3d' : '#ff6b6b'; }
  }
}

// =================================================================================================
//  main loop
// =================================================================================================
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const rdt = Math.min(clock.getDelta(), 0.05);
  if (!G.paused) {
    let ts = 1;
    if (G.hitstop > 0) { ts = 0.04; G.hitstop -= rdt; } else if (G.slowT > 0) { ts = G.slowScale; G.slowT -= rdt; }
    if (G.ff && G.state === 'playing') ts *= 3;
    let rem = rdt * ts;
    while (rem > 1e-6) { const s = Math.min(rem, 1 / 50); sim(s); rem -= s; }
    updateParticles(rdt * ts); updateRings(rdt * ts);
    updateCamera(rdt * ts, rdt);
    if (G.state !== 'menu') {
      updateLabels(); updateMeterHud();
      const m = Math.floor(G.matchTime); $('timerInfo').textContent = Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
    }
  }
  const t = performance.now() / 1000;
  rocks.forEach((r) => { r.rotation.x += r.userData.rx * rdt; r.rotation.y += r.userData.ry * rdt; r.position.y = r.userData.by + Math.sin(t * r.userData.sp + r.userData.ph) * 1.5; });
  sky.position.copy(camera.position);
  const fx = G.state === 'menu' ? 0 : G.focus.x, fz = G.state === 'menu' ? 0 : G.focus.z;
  sun.position.set(fx + SUN_OFF.x, SUN_OFF.y, fz + SUN_OFF.z); sun.target.position.set(fx, 0, fz); sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
}

showMenu();
frame();
