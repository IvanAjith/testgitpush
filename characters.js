// Character models: built from simple shapes so they stay cute and animate smoothly.
// To add a new fighter: add an entry to ROSTER (colors + optional `extras` function).
import * as THREE from './lib/three.module.js';

const TAU = Math.PI * 2;

export const GRAD = (() => {
  const t = new THREE.DataTexture(new Uint8Array([95, 155, 215, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const gSph = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const gBox = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const gCyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);
const gCone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
const gCap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
const gTor = (R, r, arc = TAU) => new THREE.TorusGeometry(R, r, 8, 24, arc);

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1d0f3d, side: THREE.BackSide });

function starGeo(outer, inner, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer, a = (i / 10) * TAU + Math.PI / 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

// ---------------------------------------------------------------------------------------------
export const ROSTER = [
  {
    id: 'rex', name: 'Rex', icon: '🦖', color: '#6cd35a',
    skin: 0x6fd45b, torso: 0x58bf48, legs: 0x58bf48, shoes: 0xf2a33a, glove: 0x6fd45b,
    extras(h) {
      const orange = h.M(0xf2a33a), cream = h.M(0xf6e7a8);
      const belly = h.add(h.body, gSph(0.27), cream, 0, 0.32, 0.17); belly.scale.set(1, 1.35, 0.55);
      [[0.6, -0.28], [0.34, -0.31], [0.08, -0.27]].forEach(([y, z], i) => {
        const c = h.add(h.body, gCone(0.13 - i * 0.015, 0.3), orange, 0, y, z); c.rotation.x = -1.25;
      });
      [[0, 0.9, -0.02], [0, 0.82, -0.24], [0, 0.66, -0.42]].forEach(([x, y, z], i) => {
        const c = h.add(h.headG, gCone(0.11 - i * 0.02, 0.28), orange, x, y, z); c.rotation.x = -0.35 * i;
      });
      const tail = new THREE.Group(); tail.position.set(0, 0.06, -0.3); h.body.add(tail);
      const t1 = h.add(tail, gCone(0.2, 0.8), h.M(0x58bf48), 0, 0, -0.35); t1.rotation.x = -Math.PI / 2 - 0.35;
      const t2 = h.add(tail, gSph(0.07), orange, 0, 0.12, -0.74);
      return (f, t, sp) => { tail.rotation.y = Math.sin(t * 6) * (0.25 + sp * 0.04); tail.rotation.x = Math.sin(t * 4) * 0.08; };
    },
  },
  {
    id: 'ninja', name: 'Shadow Ninja', icon: '🥷', color: '#e63946', face: 'mask',
    skin: 0x1f1f33, torso: 0x2a2a45, legs: 0x2a2a45, shoes: 0x14141f, glove: 0x2a2a45,
    extras(h) {
      const red = h.M(0xe63946);
      const band = h.add(h.headG, gTor(0.47, 0.065), red, 0, 0.62, 0, { outline: false }); band.rotation.x = Math.PI / 2;
      [-1, 1].forEach((s) => { const k = h.add(h.headG, gBox(0.1, 0.34, 0.05), red, s * 0.1, 0.55, -0.55); k.rotation.set(0.4, 0, s * 0.35); });
      const sash = h.add(h.body, gTor(0.32, 0.075), red, 0, 0.04, 0, { outline: false }); sash.rotation.x = Math.PI / 2;
      const sword = h.add(h.body, gBox(0.07, 1.05, 0.06), h.M(0xcfd6e8), 0.1, 0.5, -0.4); sword.rotation.z = 0.75;
      const hilt = h.add(h.body, gBox(0.1, 0.28, 0.09), red, -0.24, 0.26, -0.4); hilt.rotation.z = 0.75;
    },
  },
  {
    id: 'pixel', name: 'Pixel', icon: '🤖', color: '#36d1ff', face: 'screen', headBox: true, torsoBox: true,
    skin: 0xa9bcd6, torso: 0x7e93b8, legs: 0x5d7298, shoes: 0xff4fa3, glove: 0xffd93d,
    extras(h) {
      const dark = h.M(0x31405f);
      const pole = h.add(h.headG, gCyl(0.035, 0.035, 0.32), dark, 0, 0.92, 0);
      const ball = h.add(h.headG, gSph(0.1), new THREE.MeshBasicMaterial({ color: 0xff4fa3 }), 0, 1.12, 0);
      [-1, 1].forEach((s) => { const e = h.add(h.headG, gCyl(0.11, 0.11, 0.12), dark, s * 0.5, 0.36, 0); e.rotation.z = Math.PI / 2; });
      const panel = h.add(h.body, gBox(0.42, 0.28, 0.06), dark, 0, 0.36, 0.28);
      [0x36d1ff, 0xff4fa3, 0xffd93d].forEach((c, i) => h.add(panel, gSph(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: c }), -0.13 + i * 0.13, 0, 0.04, { outline: false }));
      return (f, t) => { ball.scale.setScalar(1 + Math.sin(t * 8) * 0.18); };
    },
  },
  {
    id: 'liberty', name: 'Captain Liberty', icon: '🛡️', color: '#2a62d6',
    skin: 0xf2c9a2, torso: 0x2a62d6, legs: 0x244fa8, shoes: 0xd62839, glove: 0xd62839,
    extras(h) {
      const blue = h.M(0x2a62d6), white = h.M(0xffffff), red = h.M(0xd62839);
      const cap = h.add(h.headG, new THREE.SphereGeometry(0.53, 22, 12, 0, TAU, 0, Math.PI * 0.56), blue, 0, 0.36, -0.02);
      cap.rotation.x = -0.1;
      [-1, 1].forEach((s) => { const w = h.add(h.headG, gBox(0.05, 0.22, 0.34), white, s * 0.53, 0.5, -0.08); w.rotation.z = s * 0.25; });
      const star = h.add(h.body, starGeo(0.2, 0.09, 0.04), white, 0, 0.37, 0.3, { outline: false });
      const belt = h.add(h.body, gTor(0.31, 0.06), red, 0, 0.0, 0, { outline: false }); belt.rotation.x = Math.PI / 2;
      const shield = new THREE.Group(); shield.position.set(0.16, -0.5, 0.18); h.armL.add(shield);
      [[0.56, red, 0], [0.42, white, 0.012], [0.3, red, 0.024], [0.18, blue, 0.036]].forEach(([r, m, z]) => {
        const d = h.add(shield, gCyl(r, r, 0.07, 24), m, 0, 0, z, { outline: r > 0.5 }); d.rotation.x = Math.PI / 2;
      });
    },
  },
  {
    id: 'ryker', name: 'Rocket Ryker', icon: '🚀', color: '#ff8a3d',
    skin: 0xf0c4a0, torso: 0xf4f6ff, legs: 0xdfe4f5, shoes: 0x555d78, glove: 0x23233a,
    extras(h) {
      const hair = h.add(h.headG, new THREE.SphereGeometry(0.53, 20, 12, 0, TAU, 0, Math.PI * 0.5), h.M(0x4a2f1b), 0, 0.4, -0.05);
      hair.rotation.x = -0.35;
      const q = h.add(h.headG, gBox(0.3, 0.14, 0.34), h.M(0x4a2f1b), 0, 0.88, 0.2); q.rotation.x = 0.4;
      const glasses = h.add(h.headG, gBox(0.76, 0.17, 0.1), h.M(0x15151f), 0, 0.42, 0.45);
      h.add(glasses, gBox(0.12, 0.04, 0.02), h.M(0xffffff), -0.2, 0.03, 0.06, { outline: false });
      const pack = h.add(h.body, gCap(0.16, 0.45), h.M(0xbfc6dc), 0, 0.42, -0.42);
      [-1, 1].forEach((s) => h.add(pack, gCone(0.1, 0.18), h.M(0xff4f4f), s * 0.2, -0.38, 0, { outline: false }));
      const flame = h.add(h.body, gCone(0.14, 0.5), new THREE.MeshBasicMaterial({ color: 0xff9a2e }), 0, -0.02, -0.42, { outline: false });
      flame.rotation.x = Math.PI;
      const stripe = h.add(h.body, gBox(0.62, 0.1, 0.62), h.M(0x23233a), 0, 0.15, 0, { outline: false });
      return (f, t, sp, air) => { const s = 0.7 + Math.sin(t * 40) * 0.2 + (air ? 0.7 : sp * 0.05); flame.scale.set(1, s, 1); flame.position.y = -0.02 - s * 0.12; };
    },
  },
  {
    id: 'sage', name: 'Sage Sam', icon: '🧘', color: '#ff9d3c', face: 'bald',
    skin: 0xc98a5c, torso: 0xfff6e6, legs: 0xc98a5c, shoes: 0x8a5a33, glove: 0xc98a5c,
    extras(h) {
      const ringM = h.M(0x3b2a1a);
      [-1, 1].forEach((s) => { const g = h.add(h.headG, gTor(0.13, 0.025), ringM, s * 0.19, 0.42, 0.47, { outline: false }); const e = h.add(h.headG, gSph(0.1), h.M(0xc98a5c), s * 0.5, 0.36, 0); });
      h.add(h.headG, gBox(0.12, 0.03, 0.03), ringM, 0, 0.45, 0.48, { outline: false });
      const skirt = h.add(h.body, gCyl(0.36, 0.46, 0.5), h.M(0xfff6e6), 0, -0.1, 0);
      const sash = h.add(h.body, gBox(0.14, 0.95, 0.05), h.M(0xff9d3c), 0.08, 0.36, 0.3); sash.rotation.z = 0.55;
      const staff = new THREE.Group(); staff.position.set(0.0, -0.1, 0.14); h.armL.add(staff);
      h.add(staff, gCyl(0.045, 0.045, 2.1), h.M(0x7a4a22), 0, -0.4, 0);
      h.add(staff, gSph(0.12), h.M(0xffd93d), 0, 0.68, 0);
    },
  },
  {
    id: 'blaze', name: 'Blaze', icon: '🦸', color: '#e03a3a', face: 'domino',
    skin: 0xf0c09a, torso: 0xe03a3a, legs: 0xc72f2f, shoes: 0xffd93d, glove: 0xffd93d,
    extras(h) {
      const yellow = h.M(0xffd93d);
      const flame = h.add(h.body, gCone(0.15, 0.34), yellow, 0, 0.4, 0.3); flame.scale.z = 0.3;
      const belt = h.add(h.body, gTor(0.31, 0.06), yellow, 0, 0.0, 0, { outline: false }); belt.rotation.x = Math.PI / 2;
      [-1, 1].forEach((s) => { const e = h.add(h.headG, gCone(0.1, 0.24), h.M(0xe03a3a), s * 0.34, 0.86, 0); e.rotation.z = -s * 0.3; });
      const cape = new THREE.Group(); cape.position.set(0, 0.68, -0.31); h.body.add(cape);
      h.add(cape, gBox(0.86, 1.15, 0.06), h.M(0xff4f6a), 0, -0.58, 0);
      return (f, t, sp, air) => {
        cape.rotation.x = 0.12 + sp * 0.075 + (air ? 0.35 : 0) + Math.sin(t * 7 + sp) * 0.05 * (1 + sp * 0.2);
      };
    },
  },
  {
    id: 'wanda', name: 'Wanda Wiz', icon: '🧙', color: '#a855f7',
    skin: 0xf4cba8, torso: 0x8a3ffc, legs: 0x6d28d9, shoes: 0xffd93d, glove: 0xf4cba8,
    extras(h) {
      const purple = h.M(0x7c3aed), gold = h.M(0xffd93d);
      const hat = new THREE.Group(); hat.position.set(0, 0.78, 0); hat.rotation.x = -0.15; h.headG.add(hat);
      h.add(hat, gCyl(0.72, 0.72, 0.07, 24), purple, 0, 0, 0);
      h.add(hat, gCone(0.44, 0.95), purple, 0, 0.5, 0);
      h.add(hat, gCyl(0.45, 0.47, 0.13), gold, 0, 0.12, 0, { outline: false });
      h.add(hat, gSph(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff29a }), 0, 1.0, 0, { outline: false });
      h.add(h.headG, gBox(0.86, 1.0, 0.2), h.M(0xff7ac8), 0, 0.05, -0.4);
      [-1, 1].forEach((s) => { const b = h.add(h.headG, gSph(0.07, 8, 6), h.M(0xff9ab8), s * 0.3, 0.27, 0.4, { outline: false }); b.scale.z = 0.4; });
      const skirt = h.add(h.body, gCyl(0.35, 0.62, 0.58), h.M(0x8a3ffc), 0, -0.14, 0);
      [[0.2, 0.0, 0.5], [-0.25, -0.1, 0.5]].forEach(([x, y, z]) => h.add(skirt, gSph(0.05, 6, 5), gold, x, y, 0.42, { outline: false }));
      const wand = new THREE.Group(); wand.position.set(0, -0.58, 0.32); h.armR.add(wand);
      const w = h.add(wand, gCyl(0.03, 0.03, 0.7), h.M(0x5a3a1c), 0, 0, 0); w.rotation.x = Math.PI / 2;
      const tip = h.add(wand, gSph(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff29a }), 0, 0, 0.4, { outline: false });
      return (f, t) => { tip.scale.setScalar(1 + Math.sin(t * 9) * 0.25); };
    },
  },
];

// ---------------------------------------------------------------------------------------------
export function buildFighter(cfg) {
  const mats = [];
  const M = (color) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD }); mats.push(m); return m; };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, o = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = o.cast !== false;
    parent.add(m);
    if (o.outline !== false) { const ol = new THREE.Mesh(geo, outlineMat); ol.scale.setScalar(o.ol || 1.08); m.add(ol); }
    return m;
  };

  const root = new THREE.Group();
  const pivot = new THREE.Group(); pivot.position.y = 1.0; root.add(pivot);
  const model = new THREE.Group(); model.position.y = -1.0; pivot.add(model);

  const skinM = M(cfg.skin), torsoM = M(cfg.torso), legM = M(cfg.legs), shoeM = M(cfg.shoes), gloveM = M(cfg.glove);
  const white = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD });
  const black = new THREE.MeshBasicMaterial({ color: 0x15101f });

  const body = new THREE.Group(); body.position.y = 0.78; model.add(body);
  add(body, cfg.torsoBox ? gBox(0.72, 0.8, 0.52) : gCap(0.31, 0.22), torsoM, 0, 0.32, 0);

  const headG = new THREE.Group(); headG.position.set(0, 0.78, 0); body.add(headG);
  add(headG, cfg.headBox ? gBox(0.95, 0.82, 0.86) : gSph(0.5, 24, 18), skinM, 0, 0.38, 0, { ol: 1.06 });

  const blink = [];
  const eyes = (y = 0.42, z = 0.44, spread = 0.18, s = 1) => {
    [-1, 1].forEach((sx) => {
      const w = add(headG, gSph(0.11 * s, 12, 10), white, sx * spread, y, z, { outline: false });
      add(w, gSph(0.065 * s, 10, 8), black, 0, 0, 0.075 * s, { outline: false });
      add(w, gSph(0.022, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.025, 0.03, 0.12 * s, { outline: false });
      blink.push(w);
    });
  };
  const smile = (y = 0.2, z = 0.47, w = 0.1) => {
    const m = add(headG, gTor(w, 0.025, Math.PI), black, 0, y, z, { outline: false }); m.rotation.z = Math.PI;
  };

  const face = cfg.face || 'normal';
  if (face === 'normal' || face === 'bald') { eyes(); smile(); }
  else if (face === 'mask') { // ninja: skin strip across the eyes
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.508, 0.508, 0.3, 24, 1, true, -0.95, 1.9), new THREE.MeshToonMaterial({ color: 0xf1c9a0, gradientMap: GRAD, side: THREE.DoubleSide }));
    strip.position.y = 0.42; headG.add(strip);
    eyes(0.42, 0.45, 0.17, 0.9);
    [-1, 1].forEach((s) => { const b = add(headG, gBox(0.2, 0.05, 0.04), black, s * 0.17, 0.56, 0.5, { outline: false }); b.rotation.z = s * 0.35; });
  } else if (face === 'domino') {
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.508, 0.508, 0.26, 24, 1, true, -1.05, 2.1), new THREE.MeshToonMaterial({ color: 0x23233a, gradientMap: GRAD, side: THREE.DoubleSide }));
    strip.position.y = 0.42; headG.add(strip);
    eyes(0.42, 0.45, 0.19, 0.95); smile(0.2, 0.47, 0.11);
  } else if (face === 'screen') {
    const scr = add(headG, gBox(0.76, 0.56, 0.06), black, 0, 0.4, 0.43, { outline: false });
    const glow = new THREE.MeshBasicMaterial({ color: 0x5cf2ff });
    [-1, 1].forEach((s) => { const e = add(scr, gBox(0.15, 0.17, 0.02), glow, s * 0.17, 0.07, 0.04, { outline: false }); blink.push(e); });
    [-0.18, -0.06, 0.06, 0.18].forEach((x, i) => add(scr, gBox(0.07, 0.05 + (i === 1 || i === 2 ? 0.02 : 0), 0.02), glow, x, -0.14 - (i === 0 || i === 3 ? -0.03 : 0), 0.04, { outline: false }));
  }

  // limbs --------------------------------------------------------------------
  const mkArm = (sx, gm) => {
    const g = new THREE.Group(); g.position.set(sx * 0.43, 1.4, 0); model.add(g);
    // arm pivots live on the body so they lean/twist with the torso
    body.add(g); g.position.set(sx * 0.43, 0.62, 0);
    add(g, gCap(0.115, 0.22), cfg.sleeves ? M(cfg.sleeves) : torsoM, 0, -0.27, 0);
    add(g, gSph(0.155, 14, 10), gm, 0, -0.56, 0);
    return g;
  };
  const armL = mkArm(1, gloveM), armR = mkArm(-1, gloveM);
  const mkLeg = (sx) => {
    const g = new THREE.Group(); g.position.set(sx * 0.18, 0.78, 0); model.add(g);
    add(g, gCap(0.15, 0.3), legM, 0, -0.33, 0);
    add(g, gBox(0.3, 0.2, 0.44), shoeM, 0, -0.67, 0.07);
    return g;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  const h = { M, add, body, headG, armL, armR, legL, legR, model };
  const anim = cfg.extras ? cfg.extras(h) : null;

  return { root, pivot, model, body, headG, armL, armR, legL, legR, mats, blink, anim };
}
