// Fishing Camp: an arcade idle game. One input (move); every action fires by standing on a tile.
// Catch fish -> chef's board -> soup bowls -> serving counter -> cash -> price tiles -> hire/upgrade/open.
// The scenes, the camp's world and simulation, and the loop live here; the rules with no browser in
// them are in game/, the screen and sound in their own modules.
import { tune, SEED } from './config';
import * as THREE from 'three';
import { params, manual, clock, seedFrom, install } from './hook';
import { canvas, ctx, renderer, TOUCH, JOY_R, SAFE_TOP, GEAR, W, H, FONT, CHEAP, clearHud, text, rrect } from './screen';
import { startAudio, setMuted, muted, sfx, musicTick } from './audio';
import { setSeed, rng, rr } from './game/random';
import { fmt, dishValue, payChunk, carryCap, catchTime, visitOutcome, zoneAutomated, playerSpeed, nextCombo, tipFor, vipReward, decorPay, upgradePrice, levelSpeed, offlineEarnings, inTile, walkableAt, inZone3, inZone4, burnFuel, wantsLog, blizzardPay } from './game/rules';
import { QUESTS, questDone, questProgress } from './game/quests';
import { UNLOCKS, ROD_X, ROD_TILE_Z, RICE, HEARTH } from './game/unlocks';
import type { Loose, SaveData } from './game/types';

const STEP = 1 / 60;            // simulation step in seconds; motion is per second, never per frame
const TITLE = 'Fishing Camp';
const CONTROLS = matchMedia('(pointer: coarse)').matches
  ? ['Drag anywhere to move', 'Stand on a tile to act', 'Gear button: pause']
  : ['WASD / Arrows: move', 'or drag anywhere: joystick', 'Stand on a tile to act', 'P: pause   M: mute'];
const events: Loose[] = []; // window.game.events: anything the game wants a run to see

// ---- Input: keys by position (event.code), OS key repeat ignored; a floating joystick ------
const down = new Set(), hit = new Set();
const pressed = (code: Loose) => hit.has(code); // true for one step after the key goes down
addEventListener('keydown', (e: Loose) => {
  startAudio();
  if (!e.repeat) { down.add(e.code); hit.add(e.code); }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e: Loose) => down.delete(e.code));
addEventListener('blur', () => { down.clear(); joy.active = false; });
const joy = { active: false, id: -1, x0: 0, y0: 0, x: 0, y: 0 };
let tapped: Loose = null, touchUsed = false; // a click/tap this step, in HUD coords
function hudXY(e: Loose) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
canvas.addEventListener('pointerdown', (e: Loose) => {
  startAudio(); if (e.pointerType === 'touch') touchUsed = true;
  const [x, y] = hudXY(e); tapped = { x, y };
  if (scene === 'play' && !onGear(x, y)) {
    joy.active = true; joy.id = e.pointerId; joy.x0 = joy.x = x; joy.y0 = joy.y = y;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
});
canvas.addEventListener('pointermove', (e: Loose) => { if (joy.active && e.pointerId === joy.id) { [joy.x, joy.y] = hudXY(e); } });
const endJoy = (e: Loose) => { if (e.pointerId === joy.id) joy.active = false; };
canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);
const onGear = (x: Loose, y: Loose) => Math.hypot(x - GEAR.x, y - GEAR.y) < GEAR.r + 8;
function buzz(ms: number) { try { if (touchUsed && navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }

// ---- 3D toolkit --------------------------------------------------------------------------
const V3 = THREE.Vector3, PI = Math.PI;
const scene3 = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 220);
const MATS: Record<string, Loose> = {};
function mat(c: Loose) { return MATS[c] || (MATS[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true })); }
const VMAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sph: new THREE.SphereGeometry(0.5, 10, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  hemi: new THREE.SphereGeometry(0.5, 10, 6, 0, 2 * PI, 0, PI / 2),
};
function add(parent: Loose, geo: Loose, color: string | THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); parent.add(m); return m;
}
function mx(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
}
function bake(parts: Loose) { // [[geometry, color, matrix]] -> one vertex-coloured geometry
  const pos = [], col = [], c = new THREE.Color();
  for (const [g0, color, m] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m);
    const p = g.attributes.position.array; c.set(color);
    for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); col.push(c.r, c.g, c.b); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals(); return out;
}
function canvasTex(w: number, h: number, draw: Loose) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, c);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, g, t };
}
const BLOB = canvasTex(64, 64, (g: Loose) => {
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(40,20,60,0.55)'); gr.addColorStop(1, 'rgba(40,20,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
}).t;
const BLOB_MAT = new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false });
const PLANE = new THREE.PlaneGeometry(1, 1);
function blob(parent: Loose, r: number) { const m = add(parent, PLANE, BLOB_MAT, 0, 0.02, 0, -PI / 2, 0, 0, r * 2); m.renderOrder = 1; return m; }

// ---- Figures: chibi characters (animated groups) ------------------------------------------
const SKIN = '#f6cfa3';
const ROLES = {
  player:    { tunic: '#2f86e0', pants: '#24345e', hair: '#2b1d16', belt: '#f2c94c' },
  fisher:    { tunic: '#58a84b', pants: '#4a3b2c', hair: '#3a2618', belt: '#8a5a2b' },
  chef:      { tunic: '#f4f2ea', pants: '#6b6b78', hair: '#3a2618', belt: '#d84b3a' },
  grillchef: { tunic: '#b5402e', pants: '#3a2c28', hair: '#20150f', belt: '#f2c94c' },
  potboy:    { tunic: '#e0a33a', pants: '#5a4636', hair: '#2b1d16', belt: '#7a4a26' },
  ricecook:  { tunic: '#f6f0dc', pants: '#5b6b4a', hair: '#2b1d16', belt: '#c8402e' },
  farmer:    { tunic: '#3f5aa8', pants: '#5a4636', hair: '#2b1d16', belt: '#c99a52' },
  carrier:   { tunic: '#c9773a', pants: '#4a3b2c', hair: '#2b1d16', belt: '#f2c94c' },
  cashier:   { tunic: '#2f8a8a', pants: '#3a2c28', hair: '#20150f', belt: '#e1b23a' },
  general:   { tunic: '#8e1f1f', pants: '#2b2b35', hair: '#20150f', belt: '#e1b23a' },
  hearthcook: { tunic: '#6b4a8a', pants: '#3a2c28', hair: '#20150f', belt: '#e1b23a' },
  woodcutter: { tunic: '#7a4a2a', pants: '#3a3a42', hair: '#20150f', belt: '#3a3a42' },
};
const TORSO = new THREE.CylinderGeometry(0.25, 0.33, 0.52, 8);
const HEAD = new THREE.SphereGeometry(0.4, 10, 8);
const HAIR = new THREE.SphereGeometry(0.43, 10, 6, 0, 2 * PI, 0, PI * 0.52);
function makeChar(role: string) {
  const C = (ROLES as Loose)[role], group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const leg = (x: Loose) => { const p = new THREE.Group(); p.position.set(x, 0.42, 0); body.add(p);
    add(p, G.box, C.pants, 0, -0.19, 0, 0, 0, 0, 0.17, 0.38, 0.19); add(p, G.box, '#3b2a20', 0, -0.37, 0.04, 0, 0, 0, 0.19, 0.08, 0.27); return p; };
  const legL = leg(-0.13), legR = leg(0.13);
  add(body, TORSO, C.tunic, 0, 0.67, 0); add(body, G.cyl, C.belt, 0, 0.5, 0, 0, 0, 0, 0.62, 0.07, 0.62);
  const arm = (x: Loose) => { const p = new THREE.Group(); p.position.set(x, 0.88, 0); body.add(p);
    add(p, G.cyl6, C.tunic, 0, -0.16, 0, 0, 0, 0, 0.15, 0.34, 0.15); add(p, G.sph, SKIN, 0, -0.36, 0, 0, 0, 0, 0.17); return p; };
  const armL = arm(-0.34), armR = arm(0.34);
  const head = new THREE.Group(); head.position.set(0, 1.3, 0); body.add(head);
  add(head, HEAD, SKIN); add(head, HAIR, C.hair, 0, 0.02, -0.04, -0.45, 0, 0);
  add(head, G.sph, '#1d1714', -0.14, 0.0, 0.355, 0, 0, 0, 0.1, 0.13, 0.08); add(head, G.sph, '#1d1714', 0.14, 0.0, 0.355, 0, 0, 0, 0.1, 0.13, 0.08);
  add(head, G.sph, '#f49a9a', -0.24, -0.1, 0.3, 0, 0, 0, 0.11, 0.06, 0.04); add(head, G.sph, '#f49a9a', 0.24, -0.1, 0.3, 0, 0, 0, 0.11, 0.06, 0.04);
  if (role === 'player') {
    add(head, new THREE.TorusGeometry(0.41, 0.05, 5, 16), '#e23b2e', 0, 0.1, 0, PI / 2 - 0.15, 0, 0);
    add(head, G.box, '#e23b2e', -0.08, 0.05, -0.48, 0.5, 0, 0.5, 0.08, 0.32, 0.04); add(head, G.box, '#e23b2e', 0.08, 0.02, -0.48, 0.6, 0, -0.4, 0.08, 0.3, 0.04);
    add(head, G.sph, C.hair, 0, 0.32, -0.32, 0, 0, 0, 0.3); // top knot
    add(body, G.box, '#9a6235', 0, 0.72, -0.33, 0, 0, 0, 0.5, 0.56, 0.07); // back frame for the stack
    add(body, G.box, '#7a4a26', 0, 0.45, -0.42, 0, 0, 0, 0.56, 0.06, 0.24);
  } else if (role === 'fisher') {
    add(head, new THREE.ConeGeometry(0.66, 0.34, 10), '#e7c46e', 0, 0.36, 0); add(head, G.cyl, '#b0402e', 0, 0.22, 0, 0, 0, 0, 0.82, 0.05, 0.82);
    add(body, G.box, '#c99a52', 0, 0.62, -0.33, 0, 0, 0, 0.36, 0.3, 0.12); // fish basket
  } else if (role === 'chef') {
    add(head, new THREE.CylinderGeometry(0.27, 0.23, 0.42, 10), '#ffffff', 0, 0.48, 0); add(head, G.sph, '#ffffff', 0, 0.74, 0, 0, 0, 0, 0.62, 0.42, 0.62);
    add(body, G.box, '#e8e2d2', 0, 0.55, 0.27, -0.12, 0, 0, 0.42, 0.42, 0.04);
  } else if (role === 'grillchef') {
    add(head, new THREE.CylinderGeometry(0.15, 0.24, 0.62, 8), '#1d1a1f', 0, 0.55, -0.08, -0.25, 0, 0);
    add(body, new THREE.TorusGeometry(0.27, 0.06, 5, 12), '#f5f1e6', 0, 0.94, 0, PI / 2, 0, 0);
  } else if (role === 'potboy') { // headscarf with a knot, and a long ladle in the right hand
    add(head, new THREE.SphereGeometry(0.45, 10, 6, 0, 2 * PI, 0, PI * 0.45), '#3d7fc4', 0, 0.04, -0.02, -0.3, 0, 0);
    add(head, G.sph, '#3d7fc4', 0, 0.12, -0.46, 0, 0, 0, 0.22); add(head, G.box, '#3d7fc4', 0.1, -0.08, -0.5, 0.3, 0, -0.6, 0.08, 0.28, 0.05);
    add(armR, G.cyl6, '#8a5a2b', 0, -0.7, 0, 0, 0, 0, 0.06, 0.75, 0.06);
    add(armR, new THREE.SphereGeometry(0.14, 8, 4, 0, 2 * PI, PI / 2, PI / 2), '#b9bcc4', 0, -1.05, 0);
  } else if (role === 'ricecook') { // a wide flat cap with a knob, a red apron and a rice paddle
    add(head, G.cyl, '#f6f0dc', 0, 0.36, -0.02, -0.12, 0, 0, 1.05, 0.09, 1.05); add(head, G.sph, '#c8402e', 0, 0.44, -0.02, 0, 0, 0, 0.18);
    add(body, G.box, '#c8402e', 0, 0.55, 0.27, -0.12, 0, 0, 0.44, 0.44, 0.04);
    add(armR, G.box, '#d9b77a', 0, -0.62, 0, 0, 0, 0, 0.05, 0.5, 0.05); add(armR, G.box, '#d9b77a', 0, -0.92, 0, 0, 0, 0, 0.16, 0.2, 0.04);
  } else if (role === 'hearthcook') { // a fur hat with ear flaps and a long ladle
    add(head, G.cyl, '#e9e4d6', 0, 0.3, -0.02, -0.1, 0, 0, 0.92, 0.32, 0.92); add(head, G.sph, '#e9e4d6', -0.38, 0.0, 0, 0, 0, 0, 0.22, 0.42, 0.22); add(head, G.sph, '#e9e4d6', 0.38, 0.0, 0, 0, 0, 0, 0.22, 0.42, 0.22);
    add(armR, G.cyl6, '#8a5a2b', 0, -0.75, 0, 0, 0, 0, 0.06, 0.85, 0.06); add(armR, new THREE.SphereGeometry(0.15, 8, 4, 0, 2 * PI, PI / 2, PI / 2), '#55555f', 0, -1.15, 0);
  } else if (role === 'woodcutter') { // a red knit cap with a bobble and an axe in hand
    add(head, G.hemi, '#c8302a', 0, 0.08, -0.02, -0.25, 0, 0, 0.9, 0.85, 0.9); add(head, G.sph, '#f6f0dc', 0, 0.5, -0.12, 0, 0, 0, 0.2);
    add(armR, G.cyl6, '#8a5a2b', 0, -0.58, 0.05, 0, 0, 0, 0.06, 0.6, 0.06); add(armR, G.box, '#b9bcc4', 0.12, -0.82, 0.05, 0, 0, 0, 0.2, 0.16, 0.04);
  } else if (role === 'general') { // a red cape, gold-trimmed armour and a helmet with tall horns
    add(body, G.box, '#c8302a', 0, 0.72, -0.3, 0.15, 0, 0, 0.7, 0.85, 0.05);
    add(body, G.box, '#e1b23a', -0.34, 0.9, 0, 0, 0, 0.35, 0.26, 0.12, 0.34); add(body, G.box, '#e1b23a', 0.34, 0.9, 0, 0, 0, -0.35, 0.26, 0.12, 0.34);
    add(head, G.hemi, '#2b2b35', 0, 0.06, -0.03, -0.3, 0, 0, 0.9, 0.82, 0.9);
    add(head, new THREE.TorusGeometry(0.42, 0.05, 4, 14, PI), '#e1b23a', 0, 0.46, 0.08, -0.15, 0, 0);
    add(head, G.cone4, '#e1b23a', 0, 0.6, 0.15, 0, 0, 0, 0.18, 0.32, 0.08);
  } else if (role === 'cashier') { // a square merchant's hat and an abacus held in front
    add(head, G.box, '#1d1a1f', 0, 0.36, -0.02, -0.12, 0, 0, 0.62, 0.32, 0.62); add(head, G.box, '#c8302a', 0, 0.54, -0.02, -0.12, 0, 0, 0.66, 0.05, 0.66);
    add(body, G.box, '#8a5a2b', 0, 0.72, 0.36, 0, 0, 0, 0.56, 0.36, 0.05);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(body, G.sph, r === 1 ? '#c8302a' : '#f2d84a', -0.18 + c * 0.12, 0.62 + r * 0.1, 0.39, 0, 0, 0, 0.07);
  } else if (role === 'carrier') { // a shoulder yoke with a basket at each end, and a tied headband
    add(body, G.box, '#8a5a2b', 0, 1.02, -0.05, 0, 0, 0, 1.7, 0.07, 0.07);
    for (const x of [-0.82, 0.82]) { add(body, G.box, '#d9c08a', x, 0.78, -0.05, 0, 0, 0, 0.02, 0.45, 0.02); add(body, new THREE.CylinderGeometry(0.2, 0.15, 0.24, 8), '#c99a52', x, 0.5, -0.05); }
    add(head, new THREE.TorusGeometry(0.41, 0.05, 5, 16), '#f6f0dc', 0, 0.08, 0, PI / 2 - 0.1, 0, 0);
  } else if (role === 'farmer') { // a domed straw hat with a wide brim, and a hoe across the back
    add(head, G.cyl, '#d8b45a', 0, 0.26, 0, -0.1, 0, 0, 1.25, 0.05, 1.25); add(head, G.hemi, '#c9a248', 0, 0.27, 0, -0.1, 0, 0, 0.62, 0.5, 0.62);
    add(body, G.cyl6, '#8a5a2b', 0, 0.9, -0.36, 0, 0, 0.8, 0.06, 1.7, 0.06); add(body, G.box, '#b9bcc4', -0.62, 1.5, -0.36, 0, 0, 0.8, 0.3, 0.1, 0.04);
  }
  return { group, body, legL, legR, armL, armR, head, phase: 0 };
}
function animChar(ch: Loose, speed: number, dt: number, mode: Loose) { // mode: 'carry' | 'pull' | 'chop' | null
  ch.phase += dt * (speed > 0.2 ? 4 + speed * 1.6 : 2);
  const s = Math.sin(ch.phase), run = Math.min(1, speed / 3);
  ch.legL.rotation.x = s * 0.8 * run; ch.legR.rotation.x = -s * 0.8 * run;
  ch.body.position.y = (ch.lift || 0) + (run > 0.05 ? Math.abs(Math.cos(ch.phase)) * 0.07 * run : Math.sin(ch.phase) * 0.012);
  let al = -s * 0.7 * run, ar = s * 0.7 * run;
  if (mode === 'carry') { al = 0.55 + s * 0.15 * run; ar = 0.55 - s * 0.15 * run; }
  if (mode === 'pull') { al = ar = -1.25 + Math.sin(ch.phase * 3) * 0.08; }
  if (mode === 'chop') { al = -0.9; ar = -1.3 + Math.sin(ch.phase * 7) * 0.6; }
  if (mode === 'stir') { al = -0.7; ar = -1.05 + Math.sin(ch.phase * 2.5) * 0.25; ch.body.rotation.y = Math.sin(ch.phase * 2.5) * 0.18; }
  ch.armL.rotation.x += (al - ch.armL.rotation.x) * Math.min(1, dt * 14);
  ch.armR.rotation.x += (ar - ch.armR.rotation.x) * Math.min(1, dt * 14);
}

// ---- Figures: soldiers (one baked mesh each, drawn in bulk) and items ----------------------
function soldierGeo(gold: boolean) {
  const A = gold ? '#e1b23a' : '#2b2b35', A2 = gold ? '#a87a22' : '#474756', P = [];
  P.push([G.box, '#3a2c28', mx(-0.12, 0.2, 0, 0, 0, 0, 0.17, 0.4, 0.19)], [G.box, '#3a2c28', mx(0.12, 0.2, 0, 0, 0, 0, 0.17, 0.4, 0.19)]);
  P.push([new THREE.CylinderGeometry(0.27, 0.34, 0.56, 8), A, mx(0, 0.68, 0)]);
  P.push([G.box, A2, mx(-0.34, 0.9, 0, 0, 0, 0.35, 0.24, 0.12, 0.32)], [G.box, A2, mx(0.34, 0.9, 0, 0, 0, -0.35, 0.24, 0.12, 0.32)]);
  P.push([G.cyl6, A2, mx(-0.37, 0.68, 0.02, 0, 0, 0.12, 0.14, 0.34, 0.14)], [G.cyl6, A2, mx(0.37, 0.74, 0.08, -0.5, 0, -0.1, 0.14, 0.34, 0.14)]);
  P.push([G.sph, SKIN, mx(0, 1.3, 0, 0, 0, 0, 0.78)]);
  P.push([G.sph, '#1d1714', mx(-0.14, 1.3, 0.35, 0, 0, 0, 0.1, 0.12, 0.08)], [G.sph, '#1d1714', mx(0.14, 1.3, 0.35, 0, 0, 0, 0.1, 0.12, 0.08)]);
  P.push([G.hemi, A, mx(0, 1.36, -0.03, -0.3, 0, 0, 0.88, 0.8, 0.88)]);
  P.push([G.cyl, A2, mx(0, 1.38, 0.02, -0.3, 0, 0, 1.0, 0.05, 1.0)]);
  P.push([G.cyl6, '#7a5230', mx(0.44, 1.05, 0.12, 0, 0, 0, 0.06, 2.3, 0.06)], [G.cone4, '#dde2e8', mx(0.44, 2.33, 0.12, 0, 0, 0, 0.12, 0.3, 0.12)]);
  if (!gold) P.push([G.box, '#cc3029', mx(0, 1.82, -0.06, -0.3, 0, 0, 0.07, 0.3, 0.42)]);
  else {
    P.push([new THREE.TorusGeometry(0.34, 0.045, 4, 14, PI), '#ffe27a', mx(0, 1.74, 0.12, -0.2, 0, 0)]);
    P.push([G.cyl6, '#5a3a22', mx(0, 1.65, -0.38, 0, 0, 0, 0.05, 2.0, 0.05)], [G.box, '#d8402e', mx(0.2, 2.3, -0.38, 0, 0, 0, 0.36, 0.72, 0.03)]);
    P.push([G.box, '#ffe27a', mx(0.2, 2.3, -0.36, 0, 0, 0, 0.14, 0.14, 0.03)]);
  }
  return bake(P);
}
const SOLDIER_GEO = [soldierGeo(false), soldierGeo(true)];
/** Zone 3's customers: a blue-armoured rider on a brown horse (faces +z like the soldiers). */
/** A saddled horse alone (faces +z): the one you can buy, and the one at the stable. */
function horseGeo() {
  const HC = '#a8743e', H2 = '#7a4a26', P = [];
  P.push([G.box, HC, mx(0, 0.95, 0, 0, 0, 0, 0.62, 0.62, 1.5)]);
  for (const [x, z] of [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]]) P.push([G.box, H2, mx(x, 0.35, z, 0, 0, 0, 0.16, 0.7, 0.16)]);
  P.push([G.box, HC, mx(0, 1.4, 0.82, -0.6, 0, 0, 0.34, 0.8, 0.36)], [G.box, HC, mx(0, 1.72, 1.12, -1.2, 0, 0, 0.3, 0.62, 0.3)]);
  P.push([G.box, '#f4efe0', mx(0, 1.62, 0.66, -0.6, 0, 0, 0.08, 0.7, 0.28)], [G.box, '#f4efe0', mx(0, 1.0, -0.82, 0.5, 0, 0, 0.12, 0.6, 0.12)]);
  P.push([G.box, '#2f86e0', mx(0, 1.29, 0, 0, 0, 0, 0.7, 0.06, 0.9)], [G.box, '#e23b2e', mx(0, 1.33, 0, 0, 0, 0, 0.5, 0.08, 0.5)]);
  return bake(P);
}
const HORSE_GEO = horseGeo();
function cavalryGeo() {
  const HC = '#8a5a35', H2 = '#6b4226', A = '#2f5d8a', A2 = '#24476b', P = [];
  P.push([G.box, HC, mx(0, 0.95, 0, 0, 0, 0, 0.62, 0.62, 1.5)]); // horse body
  for (const [x, z] of [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]]) P.push([G.box, H2, mx(x, 0.35, z, 0, 0, 0, 0.16, 0.7, 0.16)]);
  P.push([G.box, HC, mx(0, 1.4, 0.82, -0.6, 0, 0, 0.34, 0.8, 0.36)], [G.box, HC, mx(0, 1.72, 1.12, -1.2, 0, 0, 0.3, 0.62, 0.3)]); // neck, head
  P.push([G.box, '#2a1a10', mx(0, 1.62, 0.66, -0.6, 0, 0, 0.08, 0.7, 0.28)], [G.box, '#2a1a10', mx(0, 1.0, -0.82, 0.5, 0, 0, 0.12, 0.6, 0.12)]); // mane, tail
  P.push([G.box, '#c8402e', mx(0, 1.29, 0, 0, 0, 0, 0.7, 0.06, 0.9)]); // saddle cloth
  P.push([new THREE.CylinderGeometry(0.24, 0.3, 0.5, 8), A, mx(0, 1.62, 0)], [G.box, A2, mx(-0.3, 1.8, 0, 0, 0, 0.35, 0.22, 0.12, 0.3)], [G.box, A2, mx(0.3, 1.8, 0, 0, 0, -0.35, 0.22, 0.12, 0.3)]);
  P.push([G.box, '#3a2c28', mx(-0.3, 1.32, 0.1, 0, 0, 0.2, 0.14, 0.4, 0.16)], [G.box, '#3a2c28', mx(0.3, 1.32, 0.1, 0, 0, -0.2, 0.14, 0.4, 0.16)]);
  P.push([G.sph, SKIN, mx(0, 2.15, 0, 0, 0, 0, 0.72)]);
  P.push([G.sph, '#1d1714', mx(-0.13, 2.15, 0.32, 0, 0, 0, 0.09, 0.11, 0.07)], [G.sph, '#1d1714', mx(0.13, 2.15, 0.32, 0, 0, 0, 0.09, 0.11, 0.07)]);
  P.push([G.hemi, A, mx(0, 2.2, -0.03, -0.3, 0, 0, 0.82, 0.75, 0.82)], [G.cone, '#f2f2f2', mx(0, 2.62, -0.05, 0, 0, 0, 0.14, 0.35, 0.14)]); // helmet, white plume
  P.push([G.cyl6, '#7a5230', mx(0.42, 2.0, 0.3, 0.35, 0, 0, 0.06, 2.6, 0.06)], [G.box, '#2f5d8a', mx(0.42, 3.1, 0.72, 0.35, 0, 0, 0.03, 0.3, 0.4)]); // lance with pennant
  return bake(P);
}
const CAVALRY_GEO = cavalryGeo();
/** Zone 4's customers: generals in red capes and horned helmets, drawn in bulk (faces +z). */
function generalsGeo() {
  const A = '#8e1f1f', G2 = '#e1b23a', P = [];
  P.push([G.box, '#2b2b35', mx(-0.13, 0.22, 0, 0, 0, 0, 0.19, 0.44, 0.21)], [G.box, '#2b2b35', mx(0.13, 0.22, 0, 0, 0, 0, 0.19, 0.44, 0.21)]);
  P.push([new THREE.CylinderGeometry(0.3, 0.38, 0.62, 8), A, mx(0, 0.74, 0)], [G.box, '#c8302a', mx(0, 0.82, -0.34, 0.15, 0, 0, 0.76, 0.95, 0.05)]);
  P.push([G.box, G2, mx(-0.38, 1.0, 0, 0, 0, 0.35, 0.28, 0.13, 0.36)], [G.box, G2, mx(0.38, 1.0, 0, 0, 0, -0.35, 0.28, 0.13, 0.36)]);
  P.push([G.sph, SKIN, mx(0, 1.42, 0, 0, 0, 0, 0.84)]);
  P.push([G.sph, '#1d1714', mx(-0.15, 1.42, 0.38, 0, 0, 0, 0.1, 0.12, 0.08)], [G.sph, '#1d1714', mx(0.15, 1.42, 0.38, 0, 0, 0, 0.1, 0.12, 0.08)]);
  P.push([G.box, '#20150f', mx(0, 1.28, 0.39, 0, 0, 0, 0.3, 0.06, 0.04)]); // moustache
  P.push([G.hemi, '#2b2b35', mx(0, 1.48, -0.03, -0.3, 0, 0, 0.94, 0.86, 0.94)], [new THREE.TorusGeometry(0.44, 0.05, 4, 14, PI), G2, mx(0, 1.92, 0.08, -0.15, 0, 0)]);
  P.push([G.cone4, G2, mx(0, 2.08, 0.15, 0, 0, 0, 0.2, 0.36, 0.08)]);
  return bake(P);
}
const GENERALS_GEO = generalsGeo();
const BOWL_BODY = new THREE.CylinderGeometry(0.24, 0.14, 0.17, 10);
const RIM = new THREE.TorusGeometry(0.235, 0.025, 4, 14);
function itemGeo(type: string, gold: boolean) {
  const P = [];
  if (type === 'fish') {
    const back = gold ? '#e9b52a' : '#3c6696', belly = gold ? '#fff1a6' : '#e8eef2', fin = gold ? '#d0951a' : '#2b4f7c';
    P.push([G.sph, back, mx(0, 0.14, 0, 0, 0, 0, 0.72, 0.26, 0.3)], [G.sph, belly, mx(0.02, 0.1, 0, 0, 0, 0, 0.6, 0.16, 0.26)]);
    P.push([G.cone4, fin, mx(-0.42, 0.14, 0, 0, 0, -PI / 2, 0.3, 0.2, 0.08)], [G.cone4, fin, mx(-0.02, 0.29, 0, 0, 0, 0, 0.14, 0.14, 0.05)]);
    P.push([G.sph, '#f2d84a', mx(-0.18, 0.06, 0, 0, 0, 0, 0.1, 0.06, 0.05)], [G.sph, '#141414', mx(0.25, 0.17, 0.11, 0, 0, 0, 0.06)], [G.sph, '#141414', mx(0.25, 0.17, -0.11, 0, 0, 0, 0.06)]);
  } else if (type === 'bowl') {
    P.push([BOWL_BODY, '#f4f1e8', mx(0, 0.085, 0)], [RIM, gold ? '#f2c230' : '#3d7fc4', mx(0, 0.165, 0, PI / 2, 0, 0)]);
    P.push([G.cyl, gold ? '#ffd84d' : '#f0a040', mx(0, 0.178, 0, 0, 0, 0, 0.42, 0.012, 0.42)], [G.box, '#5fb64a', mx(0.05, 0.188, 0.03, 0, 0.5, 0, 0.1, 0.02, 0.05)]);
  } else if (type === 'plate') {
    P.push([G.box, '#a96b3a', mx(0, 0.03, 0, 0, 0, 0, 0.5, 0.06, 0.34)]);
    for (let i = -1; i <= 1; i++) P.push([G.box, '#fbfaf3', mx(i * 0.15, 0.1, 0, 0, 0, 0, 0.11, 0.08, 0.18)], [G.box, gold ? '#ffd84d' : '#ff8a5c', mx(i * 0.15, 0.15, 0, 0, 0, 0, 0.13, 0.03, 0.21)]);
  } else if (type === 'rice') { // a tied burlap sack of rice
    P.push([new THREE.CylinderGeometry(0.17, 0.2, 0.22, 8), '#d9c38f', mx(0, 0.11, 0)], [G.cone, '#cbb27a', mx(0, 0.27, 0, 0, 0, 0, 0.22, 0.12, 0.22)]);
    P.push([G.cyl, gold ? '#f2c230' : '#8a5a2b', mx(0, 0.22, 0, 0, 0, 0, 0.26, 0.03, 0.26)], [G.box, '#fbfaf3', mx(0, 0.12, 0.19, 0, 0, 0, 0.12, 0.08, 0.01)]);
  } else if (type === 'riceball') { // two rice-ball triangles on a leaf, wrapped in nori
    P.push([G.box, '#5fae45', mx(0, 0.015, 0, 0, 0, 0, 0.48, 0.03, 0.3)]);
    for (const x of [-0.11, 0.11]) P.push([new THREE.CylinderGeometry(0.13, 0.13, 0.11, 3), gold ? '#ffe9a0' : '#fbfaf3', mx(x, 0.085, 0, 0, PI / 6, 0)], [G.box, '#1f2a22', mx(x, 0.08, 0.06, 0, 0, 0, 0.12, 0.08, 0.02)]);
  } else if (type === 'wood') { // a tied bundle of three logs
    for (const [y, z] of [[0.07, -0.08], [0.07, 0.08], [0.19, 0]]) P.push([G.cyl6, '#8a5a35', mx(0, y, z, 0, 0, PI / 2, 0.14, 0.46, 0.14)], [G.cyl6, '#e2c08a', mx(0.235, y, z, 0, 0, PI / 2, 0.12, 0.01, 0.12)]);
    P.push([G.box, '#c8402e', mx(0, 0.13, 0, 0, 0, 0, 0.05, 0.3, 0.32)]);
  } else if (type === 'hotpot') { // a black clay pot of red broth with a wooden lid ajar
    P.push([new THREE.CylinderGeometry(0.2, 0.16, 0.18, 10), '#2a2626', mx(0, 0.09, 0)], [G.cyl, gold ? '#ffd84d' : '#d8452e', mx(0, 0.18, 0, 0, 0, 0, 0.36, 0.01, 0.36)]);
    P.push([G.cyl, '#a8743e', mx(0.06, 0.21, 0.04, 0.25, 0, 0, 0.3, 0.03, 0.3)], [G.box, '#5fae45', mx(-0.06, 0.19, -0.05, 0, 0.6, 0, 0.12, 0.02, 0.05)]);
  } else if (type === 'cash') {
    P.push([G.box, '#6cc35a', mx(0, 0.05, 0, 0, 0, 0, 0.38, 0.1, 0.22)], [G.box, '#f6d34a', mx(0, 0.05, 0, 0, 0, 0, 0.09, 0.11, 0.23)]);
  }
  return bake(P);
}
const ITEM_H: Record<string, number> = { fish: 0.28, bowl: 0.19, plate: 0.17, cash: 0.1, rice: 0.27, riceball: 0.15, wood: 0.26, hotpot: 0.22 };
const ITEM_GEO: Record<string, Loose> = {};
for (const t of ['fish', 'bowl', 'plate', 'cash', 'rice', 'riceball', 'wood', 'hotpot']) ITEM_GEO[t] = [itemGeo(t, false), itemGeo(t, true)];

// ---- World state ----------------------------------------------------------------------------
let scene: string, state: Loose, world: Loose, player: Loose, rods: Loose[], spots: Loose[], processors: Loose[], piles: Loose, counters: Loose[], tiles: Loose[], workers: Loose[], tweens: Loose[], pops: Loose[], floats: Loose[], belt: Loose, fx: Loose;
const pools: Record<string, Loose> = {};
function newItem(type: string, gold = false) {
  const key = type + (gold ? 1 : 0), pool = pools[key] || (pools[key] = []);
  let mesh = pool.pop();
  if (!mesh) mesh = new THREE.Mesh(ITEM_GEO[type][gold ? 1 : 0], VMAT);
  mesh.visible = true; mesh.scale.setScalar(1); mesh.rotation.set(0, 0, 0); world.add(mesh);
  return { mesh, type, gold, flying: false, value: 0, key };
}
function release(it: Loose) { it.mesh.visible = false; world.remove(it.mesh); (pools[it.key] || (pools[it.key] = [])).push(it.mesh); }
function fly(it: Loose, from: Loose, toFn: Loose, dur: number, h: number, onDone?: Loose, delay = 0) {
  it.flying = true; it.mesh.position.copy(from);
  tweens.push({ it, from: from.clone(), toFn, t: -delay, dur, h, onDone });
}
function updateTweens(dt: number) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt;
    if (w.t < 0) { w.it.mesh.visible = false; continue; }
    w.it.mesh.visible = true;
    const k = Math.min(1, w.t / w.dur), to = w.toFn();
    w.it.mesh.position.lerpVectors(w.from, to, k); w.it.mesh.position.y += Math.sin(PI * k) * w.h;
    w.it.mesh.rotation.y += dt * 6;
    if (k >= 1) { tweens.splice(i, 1); w.it.flying = false; w.it.mesh.position.copy(to); if (w.onDone) w.onDone(); }
  }
}
function pop(obj: Loose, dur = 0.5) { obj.scale.setScalar(0.001); obj.visible = true; pops.push({ obj, t: 0, dur }); }
function updatePops(dt: number) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt; const k = Math.min(1, p.t / p.dur), c1 = 2.2, c3 = c1 + 1;
    p.obj.scale.setScalar(Math.max(0.001, 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)));
    if (k >= 1) { p.obj.scale.setScalar(1); pops.splice(i, 1); }
  }
}
// particles: puffs, splashes, ripples, coins
const PUFF_GEO = new THREE.IcosahedronGeometry(0.25, 0), DROP_GEO = new THREE.TetrahedronGeometry(0.08), RING_GEO = new THREE.RingGeometry(0.35, 0.45, 18);
function particle(kind: string, pos: Loose, vel: Loose, life: number, color = '#ffffff', size = 1) {
  let p = fx.pool.find((q: Loose) => !q.alive && q.kind === kind);
  if (!p) {
    const geo = kind === 'snow' ? DROP_GEO : kind === 'puff' ? PUFF_GEO : kind === 'ring' ? RING_GEO : kind === 'gfish' ? ITEM_GEO.fish[1] : DROP_GEO;
    const m = kind === 'gfish' ? VMAT : new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    p = { kind, mesh: new THREE.Mesh(geo, m), alive: false }; if (kind === 'ring') p.mesh.rotation.x = -PI / 2;
    fx.pool.push(p); world.add(p.mesh);
  }
  p.alive = true; p.mesh.visible = true; p.mesh.position.copy(pos); p.vel = vel.clone(); p.life = 0; p.max = life; p.size = size;
  if (p.mesh.material !== VMAT) { p.mesh.material.color.set(color); p.mesh.material.opacity = 1; }
  return p;
}
function updateParticles(dt: number) {
  for (const p of fx.pool) {
    if (!p.alive) continue; p.life += dt; const k = p.life / p.max;
    if (k >= 1) { p.alive = false; p.mesh.visible = false; continue; }
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.kind === 'drop' || p.kind === 'gfish') p.vel.y -= 14 * dt;
    if (p.kind === 'snow') { p.vel.x = Math.sin(state.t * 2 + p.life * 3) * 1.2 + 2.0; p.mesh.material.opacity = Math.min(1, (1 - k) * 3); }
    if (p.kind === 'puff') { p.mesh.scale.setScalar(p.size * (0.6 + k * 1.4)); p.mesh.material.opacity = 0.9 * (1 - k); }
    if (p.kind === 'ring') { p.mesh.scale.setScalar(p.size * (0.4 + k * 2.2)); p.mesh.material.opacity = 0.8 * (1 - k); }
    if (p.kind === 'drop') p.mesh.material.opacity = 1 - k * k;
    if (p.kind === 'gfish') { p.mesh.rotation.z = Math.atan2(p.vel.y, 3) ; }
  }
}
function puffs(pos: Loose, n = 5, color = '#ffffff', size = 1) {
  for (let i = 0; i < n; i++) particle('puff', pos, new V3(rr(-1, 1), rr(0.6, 1.8), rr(-1, 1)), rr(0.4, 0.7), color, size);
}
function splash(pos: Loose) {
  for (let i = 0; i < 10; i++) particle('drop', pos, new V3(rr(-1.5, 1.5), rr(3, 6), rr(-1.5, 1.5)), 0.6, '#ffffff');
  particle('ring', pos, new V3(), 0.7, '#ffffff', 1.3);
}

// ---- Layout --------------------------------------------------------------------------------
function walkable(x: number, z: number): boolean { return walkableAt(x, z, state.gateOpen, state.gate3Open, state.gate4Open); }

// ---- Tiles drawn on the ground ----------------------------------------------------------------
const STAND = canvasTex(128, 128, (g: Loose) => {
  g.fillStyle = 'rgba(255,255,255,0.16)'; rrect(g, 8, 8, 112, 112, 20); g.fill();
  g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke();
}).t;
const STAND_MAT = new THREE.MeshBasicMaterial({ map: STAND, transparent: true, depthWrite: false });
function groundPlane(parent: Loose, x: number, z: number, size: number, material: Loose, y = 0.03) {
  const m = new THREE.Mesh(PLANE, material); m.rotation.order = 'YXZ'; m.rotation.set(-PI / 2, PI / 4, 0);
  m.position.set(x, y, z); m.scale.setScalar(size); m.renderOrder = 1; parent.add(m); return m;
}
function standTile(x: number, z: number) { return groundPlane(world, x, z, 1.7, STAND_MAT); }
function drawIcon(g: Loose, kind: string, cx: number, cy: number, s: Loose, col: string) {
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.12; g.lineJoin = 'round'; g.lineCap = 'round';
  if (kind === 'hire') { // person bust
    g.beginPath(); g.arc(cx, cy - s * 0.18, s * 0.22, 0, 2 * PI); g.fill();
    g.beginPath(); g.moveTo(cx - s * 0.42, cy + s * 0.45); g.quadraticCurveTo(cx - s * 0.4, cy + s * 0.05, cx, cy + s * 0.07);
    g.quadraticCurveTo(cx + s * 0.4, cy + s * 0.05, cx + s * 0.42, cy + s * 0.45); g.closePath(); g.fill();
  } else if (kind === 'upgrade') { // fist
    rrect(g, cx - s * 0.36, cy - s * 0.2, s * 0.72, s * 0.5, s * 0.14); g.fill();
    g.strokeStyle = 'rgba(52,36,30,0.9)'; g.lineWidth = s * 0.05;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(cx - s * 0.36 + i * s * 0.18, cy - s * 0.2); g.lineTo(cx - s * 0.36 + i * s * 0.18, cy + s * 0.02); g.stroke(); }
    g.fillStyle = col; rrect(g, cx - s * 0.2, cy + s * 0.25, s * 0.4, s * 0.28, s * 0.06); g.fill();
    g.beginPath(); g.ellipse(cx - s * 0.36, cy + s * 0.12, s * 0.12, s * 0.16, -0.5, 0, 2 * PI); g.fill();
  } else { // padlock
    g.beginPath(); g.arc(cx, cy - s * 0.12, s * 0.22, PI, 0); g.stroke();
    g.beginPath(); g.moveTo(cx - s * 0.22, cy - s * 0.12); g.lineTo(cx - s * 0.22, cy); g.moveTo(cx + s * 0.22, cy - s * 0.12); g.lineTo(cx + s * 0.22, cy); g.stroke();
    rrect(g, cx - s * 0.34, cy, s * 0.68, s * 0.5, s * 0.08); g.fill();
    g.fillStyle = 'rgba(52,36,30,0.95)'; g.beginPath(); g.arc(cx, cy + s * 0.2, s * 0.07, 0, 2 * PI); g.fill(); g.fillRect(cx - s * 0.03, cy + s * 0.2, s * 0.06, s * 0.16);
  }
}
function drawCoin(g: Loose, cx: number, cy: number, r: number) {
  g.fillStyle = '#c98f17'; g.beginPath(); g.arc(cx, cy, r, 0, 2 * PI); g.fill();
  g.fillStyle = '#f7cf47'; g.beginPath(); g.arc(cx, cy, r * 0.8, 0, 2 * PI); g.fill();
  g.fillStyle = '#c98f17'; g.fillRect(cx - r * 0.28, cy - r * 0.28, r * 0.56, r * 0.56);
  g.fillStyle = '#fff3b0'; g.fillRect(cx - r * 0.55, cy - r * 0.6, r * 0.22, r * 0.12);
}
/** An upgrade's level (0 before the first purchase). */
const lv = (id: string): number => (state && state.levels && state.levels[id]) || 0;
/** What a price tile asks now: its fixed price, or for a levelled upgrade the price of its next level. */
function tilePrice(t: Loose): number { return t.def.levels ? upgradePrice(tune[t.def.price], lv(t.def.id), tune.upgrade_growth) : tune[t.def.price]; }
/** Seconds a station takes for one ingredient, made faster by its upgrade. */
const STATION_UP: Record<string, string> = { board: 'up_stove', grill: 'up_grill', rice: 'up_ricecook', hearth: 'up_hearth' };
function cookTime(pr: Loose): number { return tune[pr.timeKey] / levelSpeed(lv(STATION_UP[pr.name]), tune.upgrade_speed_step); }
/** How fast hired workers walk, with the STAFF upgrade. */
function workerSpeed(): number { return tune.worker_speed * levelSpeed(lv('up_staff'), tune.staff_speed_step); }
function drawPriceTile(t: Loose) {
  const g = t.tex.g, price = tilePrice(t), remaining = Math.max(0, price - t.paid);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = t.flash > 0 ? '#fff4b8' : 'rgba(52,36,30,0.92)'; rrect(g, 10, 10, 236, 236, 34); g.fill();
  g.lineWidth = 10; g.strokeStyle = t.def.kind === 'zone' ? '#ffd34d' : '#ffffff'; g.stroke();
  const frac = 1 - remaining / price;
  if (frac > 0) { g.save(); rrect(g, 10, 10, 236, 236, 34); g.clip(); g.fillStyle = 'rgba(108,195,90,0.35)'; g.fillRect(10, 246 - 236 * frac, 236, 236 * frac); g.restore(); }
  drawIcon(g, t.def.kind, 128, 74, 92, t.def.kind === 'zone' ? '#ffd34d' : '#ffffff');
  g.fillStyle = '#ffe9c4'; g.font = `bold 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.def.levels ? `${t.def.label} LV${lv(t.def.id) + 1}` : t.def.label, 128, 146);
  g.font = `bold 52px ${FONT}`; const s = fmt(remaining), w = g.measureText(s).width;
  drawCoin(g, 128 - w / 2 - 6, 202, 20); g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText(s, 128 - w / 2 + 22, 204);
  t.tex.t.needsUpdate = true; t.shown = remaining;
}
const BUBBLES: Record<string, Loose> = {};
function bubbleTex(dish: string, n: number, vip = false) {
  const key = dish + n + (vip ? 'v' : ''); if (BUBBLES[key]) return BUBBLES[key];
  return (BUBBLES[key] = canvasTex(128, 128, (g: Loose) => {
    g.fillStyle = '#ffffff'; rrect(g, 10, 8, 108, 90, 26); g.fill();
    if (vip) { g.lineWidth = 7; g.strokeStyle = '#e1b23a'; g.stroke(); }
    g.beginPath(); g.moveTo(54, 96); g.lineTo(64, 120); g.lineTo(76, 96); g.fill();
    if (dish === 'hotpot') {
      g.fillStyle = '#2a2626'; g.beginPath(); g.moveTo(26, 40); g.lineTo(80, 40); g.lineTo(72, 78); g.lineTo(34, 78); g.closePath(); g.fill();
      g.fillStyle = '#d8452e'; g.fillRect(28, 38, 50, 8); g.fillStyle = '#e9e4d6'; g.fillRect(40, 18, 6, 14); g.fillRect(58, 14, 6, 18);
    } else if (dish === 'riceball') {
      g.fillStyle = '#5fae45'; g.fillRect(16, 66, 74, 10);
      for (const x of [34, 70]) { g.fillStyle = '#fbfaf3'; g.beginPath(); g.moveTo(x, 26); g.lineTo(x + 20, 64); g.lineTo(x - 20, 64); g.closePath(); g.fill(); g.fillStyle = '#1f2a22'; g.fillRect(x - 9, 48, 18, 16); }
    } else if (dish === 'bowl') {
      g.fillStyle = '#3d7fc4'; g.beginPath(); g.ellipse(52, 46, 30, 9, 0, 0, 2 * PI); g.fill();
      g.fillStyle = '#f0a040'; g.beginPath(); g.ellipse(52, 46, 25, 6, 0, 0, 2 * PI); g.fill();
      g.fillStyle = '#e9e4d6'; g.beginPath(); g.moveTo(22, 48); g.quadraticCurveTo(52, 92, 82, 48); g.fill();
    } else {
      g.fillStyle = '#a96b3a'; g.fillRect(18, 60, 70, 12);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#fbfaf3'; g.fillRect(22 + i * 22, 44, 18, 16); g.fillStyle = '#ff8a5c'; g.fillRect(20 + i * 22, 38, 22, 8); }
    }
    g.fillStyle = '#4a2e20'; g.font = `bold ${n >= 10 ? 24 : 30}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x' + n, n >= 10 ? 100 : 104, 52);
  }));
}

// ---- Building the camp ------------------------------------------------------------------------
function buildEnvironment() {
  const deckCols = ['#e8964a', '#df8a3e', '#ef9f55', '#e48f45'];
  for (const [x0, x1, zoneTag] of [[-6, 7, 1], [7, 21.6, 2]]) {
    for (let i = 0; i < 18; i++) {
      const z = -9.5 + i + 0.5;
      add(world, G.box, deckCols[(i + zoneTag) % 4], (x0 + x1) / 2, -0.15, z, 0, 0, 0, x1 - x0, 0.3, 0.97);
    }
  }
  add(world, G.box, '#a85f2a', 7.8, -0.16, -9.5, 0, 0, 0, 27.6, 0.32, 0.12); // deck lip
  for (let x = -5.5; x <= 21; x += 2.5) add(world, G.cyl6, '#7b4a26', x, -0.5, -9.6, 0, 0, 0, 0.28, 0.8, 0.28); // pier posts
  add(world, G.box, '#86c95a', 10, -0.33, 25, 0, 0, 0, 220, 0.3, 69); // near grass
  add(world, G.box, '#7cc052', 10, -0.33, -58, 0, 0, 0, 220, 0.3, 64); // far bank
  fx.river = add(world, G.box, '#3d9be0', 10, -0.55, -17.8, 0, 0, 0, 220, 0.2, 16.6);
  fx.streaks = [];
  const streakMat = new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.8 });
  fx.streakMat = streakMat;
  for (let i = 0; i < 46; i++) {
    const m = add(world, G.box, streakMat, rr(-40, 60), -0.44, rr(-25.5, -10.2), 0, 0, 0, rr(0.8, 2.2), 0.02, 0.08);
    fx.streaks.push({ m, v: rr(0.8, 2.0) });
  }
  // round-post fences
  const post = (x: Loose, z: Loose) => { add(world, G.cyl6, '#9c6634', x, 0.5, z, 0, 0, 0, 0.24, 1.0, 0.24); add(world, G.sph, '#b07440', x, 1.02, z, 0, 0, 0, 0.26); };
  const rail = (x0: Loose, z0: Loose, x1: Loose, z1: Loose) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    for (const y of [0.45, 0.8]) add(world, G.box, '#b07440', (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ang, 0, 0.1, 0.1, len);
  };
  const fence = (x0: Loose, z0: Loose, x1: Loose, z1: Loose) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0))); for (let i = 0; i <= n; i++) post(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n); rail(x0, z0, x1, z1); };
  fence(-6, -9.3, -6, 0.3); fence(-6, 4.7, -6, 8.3); fence(-6, 8.3, 12.4, 8.3); fence(15.6, 8.3, 21.6, 8.3);
  // rice field fences: west (the cavalry counter leaves a gap), south, east
  fence(7, 8.3, 7, 10.8); fence(7, 15.2, 7, 20.6); fence(7, 20.6, 12.4, 20.6); fence(15.6, 20.6, 21.6, 20.6); fence(21.6, 8.3, 21.6, 20.6);
  // the great hearth's fences: west (its counter leaves a gap), south, east
  fence(7, 20.6, 7, 24.2); fence(7, 28.8, 7, 33); fence(7, 33, 21.6, 33); fence(21.6, 20.6, 21.6, 33);
  fence(7, -9.3, 7, -2.1); fence(7, 2.1, 7, 8.3); fence(21.6, -9.3, 21.6, 0.3); fence(21.6, 4.7, 21.6, 8.3);
  // gate doors with a padlock sign
  fx.doors = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(7, 0, s * 2.05); world.add(hinge);
    for (let k = 0; k < 4; k++) add(hinge, G.box, '#8a5a2b', 0, 0.75, -s * (0.25 + k * 0.5), 0, 0, 0, 0.14, 1.5, 0.44);
    add(hinge, G.box, '#6b4220', 0, 0.5, -s * 1.0, 0, 0, 0, 0.2, 0.12, 2.0); add(hinge, G.box, '#6b4220', 0, 1.2, -s * 1.0, 0, 0, 0, 0.2, 0.12, 2.0);
    fx.doors.push({ hinge, s });
  }
  fx.lock = new THREE.Group(); fx.lock.position.set(7.15, 1.0, 0); world.add(fx.lock);
  add(fx.lock, G.box, '#f2c230', 0, 0, 0, 0, 0, 0, 0.18, 0.5, 0.6); add(fx.lock, new THREE.TorusGeometry(0.2, 0.06, 5, 12, PI), '#c9c9cf', 0, 0.25, 0, 0, PI / 2, 0);
  // rice field deck: earthier planks
  const riceCols = ['#d8b26a', '#cfa65e', '#e0bb75', '#d3ab63'];
  for (let i = 0; i < 12; i++) add(world, G.box, riceCols[i % 4], 14.3, -0.15, 8.8 + i + 0.5, 0, 0, 0, 14.6, 0.3, 0.97);
  // rice field gate: a log barrier that lifts, with a padlock
  fx.bar = new THREE.Group(); fx.bar.position.set(12.4, 0.85, 8.3); world.add(fx.bar);
  add(fx.bar, G.cyl6, '#8a5a2b', 1.6, 0, 0, 0, 0, PI / 2, 0.22, 3.2, 0.22);
  for (const x of [0.6, 1.6, 2.6]) add(fx.bar, G.box, '#c8402e', x, 0, 0, 0, 0, 0, 0.18, 0.26, 0.26);
  fx.lock3 = new THREE.Group(); fx.lock3.position.set(14, 0.85, 8.45); world.add(fx.lock3);
  add(fx.lock3, G.box, '#f2c230', 0, 0, 0, 0, 0, 0, 0.6, 0.5, 0.18); add(fx.lock3, new THREE.TorusGeometry(0.2, 0.06, 5, 12, PI), '#c9c9cf', 0, 0.25, 0);
  fx.cover3 = add(world, G.box, new THREE.MeshBasicMaterial({ color: '#2b2340', transparent: true, opacity: 0.42, depthWrite: false }), 14.3, 0.03, 14.45, 0, 0, 0, 14.6, 0.02, 12.3);
  // the great hearth's yard: snowy planks, a lifting barrier with a padlock, and a shade until it opens
  const snowCols = ['#eef2f5', '#e1e8ee', '#f4f7f9', '#e6ecf1'];
  for (let i = 0; i < 12; i++) add(world, G.box, snowCols[i % 4], 14.3, -0.15, 21.1 + i + 0.5, 0, 0, 0, 14.6, 0.3, 0.97);
  fx.bar4 = new THREE.Group(); fx.bar4.position.set(12.4, 0.85, 20.6); world.add(fx.bar4);
  add(fx.bar4, G.cyl6, '#6b4220', 1.6, 0, 0, 0, 0, PI / 2, 0.22, 3.2, 0.22);
  for (const x of [0.6, 1.6, 2.6]) add(fx.bar4, G.box, '#2f5d8a', x, 0, 0, 0, 0, 0, 0.18, 0.26, 0.26);
  fx.lock4 = new THREE.Group(); fx.lock4.position.set(14, 0.85, 20.75); world.add(fx.lock4);
  add(fx.lock4, G.box, '#f2c230', 0, 0, 0, 0, 0, 0, 0.6, 0.5, 0.18); add(fx.lock4, new THREE.TorusGeometry(0.2, 0.06, 5, 12, PI), '#c9c9cf', 0, 0.25, 0);
  fx.cover4 = add(world, G.box, new THREE.MeshBasicMaterial({ color: '#2b2340', transparent: true, opacity: 0.42, depthWrite: false }), 14.3, 0.03, 26.85, 0, 0, 0, 14.6, 0.02, 12.3);
  // snowy pines beyond the hearth
  const pine = (x: number, z: number, sc: number) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(sc); world.add(g);
    add(g, G.cyl6, '#5a3a22', 0, 0.6, 0, 0, 0, 0, 0.3, 1.2, 0.3);
    for (let k = 0; k < 3; k++) { add(g, new THREE.ConeGeometry(1.1 - k * 0.28, 1.2, 7), '#2f6b4a', 0, 1.4 + k * 0.75, 0); add(g, new THREE.ConeGeometry(0.75 - k * 0.2, 0.45, 7), '#f4f7f9', 0, 1.82 + k * 0.75, 0); }
    blob(g, 1.1); };
  for (const [x, z, sc] of [[23.5, 22, 1.1], [24.5, 26, 1.3], [23.2, 30, 1.0], [24.8, 33.5, 1.2], [9, 35, 1.1], [15, 35.5, 1.3], [20, 35, 1.0]]) pine(x, z, sc);
  // locked yard shade
  fx.cover = add(world, G.box, new THREE.MeshBasicMaterial({ color: '#2b2340', transparent: true, opacity: 0.42, depthWrite: false }), 14.3, 0.03, -0.5, 0, 0, 0, 14.6, 0.02, 18.0);
  // blossom trees
  const tree = (x: number, z: number, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); world.add(g);
    add(g, G.cyl6, '#7a4a2a', 0, 1.0, 0, 0, 0, 0.08, 0.36, 2.0, 0.36);
    add(g, G.ico, '#f7a8c6', 0, 2.5, 0, 0, 0, 0, 2.1); add(g, G.ico, '#f490b6', 0.7, 2.2, 0.3, 0.4, 0.2, 0, 1.4);
    add(g, G.ico, '#fbc4d8', -0.6, 2.4, -0.2, 0.2, 0.6, 0, 1.5); add(g, G.ico, '#f7a8c6', 0.1, 3.2, -0.1, 0.3, 0.1, 0.2, 1.2);
    blob(g, 1.4);
  };
  for (let i = 0; i < 14; i++) tree(rr(-20, 4), rr(35, 41), rr(0.85, 1.25));
  for (let i = 0; i < 12; i++) tree(rr(-25, 45), rr(-30, -27), rr(1.0, 1.4));
  tree(-14, -12, 1.2); tree(30, -11.5, 1.1);
  // grass tufts and stones around the deck
  for (let i = 0; i < 40; i++) add(world, G.cone4, i % 3 ? '#5fae45' : '#6fbd52', rr(-30, 45), -0.05, rr(34.5, 40), 0, rr(0, 3), 0, 0.3, rr(0.3, 0.6), 0.3);
}
function buildRods() {
  rods = [];
  const rodGeo = new THREE.CylinderGeometry(0.035, 0.06, 3.4, 5); rodGeo.translate(0, 1.7, 0);
  const lineGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 4); lineGeo.translate(0, 0.5, 0);
  const xs = ROD_X;
  xs.forEach((x: Loose, i: Loose) => {
    const g = new THREE.Group(); world.add(g);
    add(g, G.box, '#7a4a26', x, 0.3, -9.25, 0, 0, 0, 0.3, 0.6, 0.3); add(g, new THREE.TorusGeometry(0.18, 0.05, 4, 10), '#d9c08a', x, 0.35, -9.08, 0, 0, 0);
    const pivot = new THREE.Group(); pivot.position.set(x, 0.5, -9.3); g.add(pivot);
    const rodMesh = add(pivot, rodGeo, '#6fb544');
    for (let k = 1; k < 4; k++) add(pivot, G.cyl, '#4f8a2f', 0, k * 0.85, 0, 0, 0, 0, 0.1, 0.05, 0.1);
    const lineMat = new THREE.MeshLambertMaterial({ color: '#f4efe0', emissive: '#000000' });
    const line = add(g, lineGeo, lineMat);
    const bobber = new THREE.Group(); bobber.position.set(x, -0.42, -12.6); g.add(bobber);
    add(bobber, G.sph, '#e23b2e', 0, 0.05, 0, 0, 0, 0, 0.2); add(bobber, G.sph, '#ffffff', 0, 0.16, 0, 0, 0, 0, 0.14);
    const tile = new V3(x, 0, ROD_TILE_Z);
    const tileMesh = standTile(x, ROD_TILE_Z);
    rods.push({ i, x, g, pivot, rodMesh, line, lineMat, bobber, tile, tileMesh, prog: 0, owner: null, active: i < 3, sndT: 0, ripT: 0 });
    if (i === 3) { g.visible = false; tileMesh.visible = false; }
  });
}
function makePile(type: string, limit: Loose, slotFn: Loose) { const p: Loose = { type, limitKey: limit, items: [], slot: slotFn, extra: 0 };
  p.limit = () => typeof p.limitKey === 'number' ? p.limitKey : tune[p.limitKey]; // top(): the highest item that has landed (items still flying in settle one slot lower when it goes)
  p.top = () => { for (let i = p.items.length - 1; i >= 0; i--) if (!p.items[i].flying) return p.items[i]; return null; };
  p.take = (it: Loose) => { const i = p.items.indexOf(it); if (i >= 0) p.items.splice(i, 1); return it; }; return p; }
function buildKitchen() {
  piles = {}; processors = [];
  // chef's board
  const k = new THREE.Group(); world.add(k);
  add(k, G.box, '#9a6235', 0, 0.4, -2, 0, 0, 0, 1.9, 0.8, 1.0); add(k, G.box, '#c98d55', 0, 0.82, -2, 0, 0, 0, 2.0, 0.06, 1.1);
  add(k, G.box, '#efe0bf', -0.35, 0.88, -2, 0, 0, 0, 0.8, 0.07, 0.6); add(k, G.box, '#d9dde2', -0.05, 0.93, -1.82, 0, 0.3, 0, 0.36, 0.02, 0.08);
  blob(k, 1.2).position.set(0, 0.02, -2);
  const pot = (x: Loose) => { const g = new THREE.Group(); g.position.set(x, 0, -2); world.add(g);
    add(g, G.box, '#8f8a86', 0, 0.3, 0, 0, 0, 0, 1.2, 0.6, 1.2); add(g, G.cone4, '#ff9b2f', 0, 0.62, 0, 0, PI / 4, 0, 0.6, 0.3, 0.6);
    add(g, new THREE.CylinderGeometry(0.55, 0.42, 0.62, 12), '#3a3a42', 0, 0.98, 0); add(g, G.cyl, '#f0a040', 0, 1.28, 0, 0, 0, 0, 0.96, 0.02, 0.96);
    add(g, new THREE.TorusGeometry(0.55, 0.06, 4, 14), '#55555f', 0, 1.29, 0, PI / 2, 0, 0); blob(g, 1.0); return g; };
  fx.pot1 = pot(2.3); fx.pot2 = pot(4.3); fx.pot2.visible = false;
  fx.potboy = makeChar('potboy'); fx.potboy.group.position.set(1.15, 0, 0); fx.potboy.group.rotation.y = -PI / 2; fx.pot2.add(fx.potboy.group); blob(fx.potboy.group, 0.5);
  const tbl = new THREE.Group(); world.add(tbl);
  add(tbl, G.box, '#9a6235', 3.3, 0.22, 0, 0, 0, 0, 1.4, 0.44, 1.1); add(tbl, G.box, '#c98d55', 3.3, 0.46, 0, 0, 0, 0, 1.5, 0.05, 1.2);
  standTile(0, -3.6); standTile(3.3, 1.35);
  piles.board = makePile('fish', 'board_limit', (i: Loose) => new V3(0.55 + (i / 5 | 0) * 0.0, 0.88 + (i % 5) * ITEM_H.fish, -2.25 + (i / 5 | 0) * 0.42));
  piles.pot = makePile('bowl', 'pot_limit', (i: Loose) => { const c = i / 7 | 0; return new V3(3.3 + ((c % 3) - 1) * 0.44, 0.5 + (i % 7) * ITEM_H.bowl, ((c / 3 | 0) - 0.5) * 0.5); });
  fx.chef = makeChar('chef'); fx.chef.group.position.set(-1.45, 0, -2); fx.chef.group.rotation.y = PI / 2; world.add(fx.chef.group); blob(fx.chef.group, 0.5);
  processors.push({ name: 'board', active: true, input: piles.board, out: piles.pot, drop: new V3(0, 0, -3.6), work: new V3(-0.35, 0.95, -2),
    pots: () => state.pot2 ? [new V3(2.3, 1.4, -2), new V3(4.3, 1.4, -2)] : [new V3(2.3, 1.4, -2)], timeKey: 'cook_time', perKey: 'bowls_per_fish', outType: 'bowl', chef: fx.chef, slots: [], boardBusy: false });
  // zone 2: grill yard
  fx.z2 = new THREE.Group(); world.add(fx.z2); fx.z2.visible = false;
  const gr = new THREE.Group(); gr.position.set(14.2, 0, -2.4); fx.z2.add(gr);
  add(gr, G.box, '#6e6a68', 0, 0.4, 0, 0, 0, 0, 1.8, 0.8, 1.1); add(gr, G.box, '#2a2626', 0, 0.84, 0, 0, 0, 0, 1.7, 0.08, 1.0);
  add(gr, G.box, '#ff7a1f', 0, 0.86, 0, 0, 0, 0, 1.5, 0.04, 0.85);
  for (let i = -3; i <= 3; i++) add(gr, G.box, '#4a4a52', i * 0.22, 0.92, 0, 0, 0, 0, 0.05, 0.05, 1.0);
  add(gr, G.cyl6, '#55555f', 0.7, 1.4, -0.4, 0, 0, 0, 0.18, 1.2, 0.18); blob(gr, 1.2);
  const st = new THREE.Group(); fx.z2.add(st);
  add(st, G.box, '#9a6235', 16.6, 0.22, -0.6, 0, 0, 0, 1.4, 0.44, 1.1); add(st, G.box, '#c98d55', 16.6, 0.46, -0.6, 0, 0, 0, 1.5, 0.05, 1.2);
  fx.z2tiles = [standTile(14.2, -4.1), standTile(16.6, 0.75)]; fx.z2tiles.forEach((t: Loose) => (t.visible = false));
  piles.grill = makePile('fish', 'board_limit', (i: Loose) => new V3(14.75, 0.9 + (i % 5) * ITEM_H.fish, -2.65 + (i / 5 | 0) * 0.4));
  piles.sushi = makePile('plate', 'sushi_limit', (i: Loose) => { const c = i / 6 | 0; return new V3(16.6 + ((c % 3) - 1) * 0.5, 0.5 + (i % 6) * ITEM_H.plate, -0.6 + ((c / 3 | 0) - 0.5) * 0.45); });
  fx.grillchef = makeChar('grillchef'); fx.grillchef.group.position.set(12.9, 0, -2.4); fx.grillchef.group.rotation.y = PI / 2; fx.z2.add(fx.grillchef.group); blob(fx.grillchef.group, 0.5);
  processors.push({ name: 'grill', active: false, input: piles.grill, out: piles.sushi, drop: new V3(14.2, 0, -4.1), work: new V3(14.0, 1.0, -2.4),
    pots: () => [new V3(14.2, 1.3, -2.4)], timeKey: 'grill_time', perKey: 'plates_per_fish', outType: 'plate', chef: fx.grillchef, slots: [], boardBusy: false });
}
/** Zone 3: the paddy, the pond, the rice cook's station and the rice-ball table (hidden until the gate opens). */
function buildRiceField() {
  spots = [];
  fx.z3 = new THREE.Group(); world.add(fx.z3); fx.z3.visible = false;
  // the paddy: shallow water in a mud bank, rows of rice plants
  const pd = new THREE.Group(); pd.position.set(19.15, 0, 10.7); fx.z3.add(pd);
  add(pd, G.box, '#7a5a34', 0, 0.06, 0, 0, 0, 0, 3.6, 0.12, 3.2); add(pd, G.box, '#6fb3c9', 0, 0.13, 0, 0, 0, 0, 3.2, 0.04, 2.8);
  const plants: Loose[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const pl = new THREE.Group(); pl.position.set(-1.25 + c * 0.62, 0.14, -1.0 + r * 0.66); pd.add(pl);
    for (let k = 0; k < 3; k++) add(pl, G.cone4, k ? '#7cc243' : '#e2c04a', (k - 1) * 0.07, 0.3, 0, 0, k, (k - 1) * 0.25, 0.1, 0.6, 0.1);
    plants.push(pl);
  }
  // the pond: a round pool with lily pads and a net on a pole
  const pn = new THREE.Group(); pn.position.set(19.0, 0, 17.6); fx.z3.add(pn);
  add(pn, new THREE.CylinderGeometry(1.9, 1.9, 0.1, 16), '#8a6a44', 0, 0.05, 0); add(pn, new THREE.CylinderGeometry(1.7, 1.7, 0.08, 16), '#3d9be0', 0, 0.1, 0);
  for (const [x, z] of [[0.6, 0.5], [-0.7, -0.4], [0.2, -0.9]]) add(pn, G.cyl, '#5fae45', x, 0.15, z, 0, 0, 0, 0.42, 0.02, 0.42);
  const net = new THREE.Group(); net.position.set(-1.4, 0, 0.6); pn.add(net);
  add(net, G.cyl6, '#8a5a2b', 0.6, 0.7, -0.3, 0.6, 0, -0.9, 0.06, 1.8, 0.06); add(net, new THREE.TorusGeometry(0.28, 0.03, 4, 12), '#d9c08a', 1.35, 0.25, -0.62, PI / 2, 0, 0);
  const spot = (name: string, item: string, timeKey: string, tile: Loose, from: Loose, mode: string, group: Loose) => {
    const ring = groundPlane(fx.z3, tile.x, tile.z, 1.0, new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.8, depthWrite: false }), 0.035);
    ring.scale.setScalar(0.001);
    spots.push({ name, item, timeKey, tile: new V3(tile.x, 0, tile.z), from, mode, group, plants: name === 'paddy' ? plants : [], ring, prog: 0, owner: null, active: false, hop: 0 });
  };
  spot('paddy', 'rice', 'rice_time', RICE.paddyTile, new V3(19.15, 0.4, 11.4), 'chop', pd);
  spot('pond', 'fish', 'pond_time', RICE.pondTile, new V3(18.2, 0.2, 17.6), 'pull', pn);
  // the stable: a little roof on posts, hay, and the horse you can buy
  const sb = new THREE.Group(); sb.position.set(9.4, 0, 9.7); fx.z3.add(sb);
  for (const [x, z] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]]) add(sb, G.cyl6, '#7a4a26', x, 1.1, z, 0, 0, 0, 0.14, 2.2, 0.14);
  add(sb, G.box, '#b5402e', 0, 2.25, 0, 0, 0, 0, 2.6, 0.12, 1.6); add(sb, G.box, '#e2c04a', 0.8, 0.25, 0.3, 0, 0.3, 0, 0.7, 0.5, 0.5);
  fx.stableHorse = new THREE.Mesh(HORSE_GEO, VMAT); fx.stableHorse.position.set(-0.2, 0, 0); fx.stableHorse.rotation.y = PI / 2; sb.add(fx.stableHorse);
  // the rice cook's station: a table with a big wooden rice tub
  const st = new THREE.Group(); fx.z3.add(st);
  add(st, G.box, '#9a6235', 13.8, 0.4, 14, 0, 0, 0, 1.9, 0.8, 1.0); add(st, G.box, '#c98d55', 13.8, 0.82, 14, 0, 0, 0, 2.0, 0.06, 1.1);
  add(st, new THREE.CylinderGeometry(0.42, 0.36, 0.38, 12), '#b07440', 14.2, 1.04, 14); add(st, G.cyl, '#fbfaf3', 14.2, 1.22, 14, 0, 0, 0, 0.74, 0.02, 0.74);
  add(st, new THREE.TorusGeometry(0.42, 0.04, 4, 14), '#6b4220', 14.2, 1.2, 14, PI / 2, 0, 0); blob(st, 1.2).position.set(13.8, 0.02, 14);
  const ot = new THREE.Group(); fx.z3.add(ot);
  add(ot, G.box, '#9a6235', 13.8, 0.22, 16.3, 0, 0, 0, 1.4, 0.44, 1.1); add(ot, G.box, '#c98d55', 13.8, 0.46, 16.3, 0, 0, 0, 1.5, 0.05, 1.2);
  fx.z3tiles = [standTile(RICE.stationDrop.x, RICE.stationDrop.z), standTile(RICE.pickup.x, RICE.pickup.z), standTile(RICE.paddyTile.x, RICE.paddyTile.z), standTile(RICE.pondTile.x, RICE.pondTile.z)];
  fx.z3tiles.forEach((t: Loose) => (t.visible = false));
  piles.riceFish = makePile('fish', 'board_limit', (i: Loose) => new V3(13.2, 0.88 + (i % 5) * ITEM_H.fish, 13.75 + (i / 5 | 0) * 0.4));
  piles.rice = makePile('rice', 'board_limit', (i: Loose) => new V3(13.65, 0.86 + (i % 5) * ITEM_H.rice, 13.75 + (i / 5 | 0) * 0.4));
  piles.riceballs = makePile('riceball', 'riceball_limit', (i: Loose) => { const c = i / 6 | 0; return new V3(13.8 + ((c % 2) - 0.5) * 0.6, 0.5 + (i % 6) * ITEM_H.riceball, 16.3 + ((c / 2 | 0) - 1) * 0.36); });
  fx.ricecook = makeChar('ricecook'); fx.ricecook.group.position.set(12.4, 0, 14); fx.ricecook.group.rotation.y = PI / 2; fx.z3.add(fx.ricecook.group); blob(fx.ricecook.group, 0.5);
  processors.push({ name: 'rice', active: false, input: piles.riceFish, input2: piles.rice, out: piles.riceballs, drop: new V3(RICE.stationDrop.x, 0, RICE.stationDrop.z), work: new V3(13.6, 0.95, 14),
    pots: () => [new V3(14.2, 1.3, 14)], timeKey: 'riceball_time', perKey: 'riceballs_per_pair', outType: 'riceball', chef: fx.ricecook, slots: [], boardBusy: false });
}
/** Zone 3's harvest spots: stand on one (or a hired worker does) and an item comes out every few seconds. */
function updateSpots(dt: number) {
  for (const sp of spots) {
    if (!sp.active) continue;
    let occ = null;
    if (sp.owner) { const w = sp.owner; if (w.state === 'fish' && inTile(w.pos, sp.tile, 0.3) && w.canTake(sp.item)) occ = w; }
    else if (inTile(player.pos, sp.tile) && player.canTake(sp.item) && !state.welcome) occ = player;
    if (state.blizzardLeft > 0 && sp.name === 'pond') occ = null; // so is the pond; only the ice hole works
    if (occ) {
      occ.mode = sp.mode; sp.prog += dt / (sp.item === 'fish' ? catchTime(tune[sp.timeKey], occ === player, state.fishSpeed, tune.fish_speed_mult) : tune[sp.timeKey]);
      if (sp.prog >= 1) {
        sp.prog = 0;
        const gold = sp.item === 'fish' && state.goldLeft > 0, it = newItem(sp.item, gold);
        occ.stack.push(it); const c = occ;
        fly(it, sp.from, () => c.slot(c.stack.indexOf(it)), 0.45, 1.8);
        if (sp.item === 'fish') splash(sp.from); else puffs(sp.from, 4, sp.puff || '#d9f0a0', 0.8);
        if (occ.isPlayer || occ.pos.distanceTo(player.pos) < 12) { if (sp.item === 'fish') sfx.splash(); else sfx.chop(); }
        if (occ.isPlayer) buzz(20);
        sp.hop = 1;
      }
    } else sp.prog = Math.max(0, sp.prog - dt * 2);
    // look: a ring fills under the worker; the plants sway while being cut, then spring back
    sp.ring.scale.setScalar(0.3 + sp.prog * 1.3 + 0.001); sp.ring.visible = sp.prog > 0.02;
    sp.hop = Math.max(0, sp.hop - dt * 3);
    sp.plants.forEach((pl: Loose, i: number) => { pl.rotation.z = occ ? Math.sin(state.t * 14 + i) * 0.18 : 0; pl.scale.y = 1 - sp.hop * 0.5; });
  }
}
/** Zone 4: the woodpile, the ice hole, the great hearth with its fire and cook, and the hot-pot table. */
function buildHearth() {
  fx.z4 = new THREE.Group(); world.add(fx.z4); fx.z4.visible = false;
  // the woodpile: stacked logs and a chopping stump
  const wp = new THREE.Group(); wp.position.set(19.4, 0, 23.0); fx.z4.add(wp);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) add(wp, G.cyl6, '#8a5a35', -0.6 + c * 0.42 + r * 0.21, 0.2 + r * 0.36, 0, PI / 2, 0, 0, 0.4, 1.6, 0.4);
  add(wp, G.cyl, '#a8743e', -1.2, 0.3, 1.0, 0, 0, 0, 0.7, 0.6, 0.7); add(wp, G.cyl, '#f4f7f9', 0, 1.25, 0, 0, 0, 0, 1.4, 0.08, 1.7);
  // the ice hole: a frozen disc with a dark hole and a little fishing stool
  const ih = new THREE.Group(); ih.position.set(19.2, 0, 29.6); fx.z4.add(ih);
  add(ih, new THREE.CylinderGeometry(1.5, 1.5, 0.06, 16), '#cfe8f3', 0, 0.03, 0); add(ih, new THREE.CylinderGeometry(0.42, 0.42, 0.07, 12), '#1f4e6e', 0, 0.04, 0);
  add(ih, G.box, '#8a5a35', -0.9, 0.2, 0.7, 0, 0, 0, 0.4, 0.4, 0.4);
  spots.push({ name: 'wood', item: 'wood', timeKey: 'wood_time', tile: new V3(HEARTH.woodTile.x, 0, HEARTH.woodTile.z), from: new V3(19.0, 0.6, 23.6), mode: 'chop', group: wp, plants: [],
    ring: hearthRing(HEARTH.woodTile), prog: 0, owner: null, active: false, hop: 0, puff: '#c99a52' });
  spots.push({ name: 'ice', item: 'fish', timeKey: 'ice_time', tile: new V3(HEARTH.iceTile.x, 0, HEARTH.iceTile.z), from: new V3(19.2, 0.2, 29.6), mode: 'pull', group: ih, plants: [],
    ring: hearthRing(HEARTH.iceTile), prog: 0, owner: null, active: false, hop: 0 });
  // the great hearth: a stone ring, a fire, a big cauldron, and a fuel bar above
  const hh = new THREE.Group(); hh.position.set(14, 0, 26.5); fx.z4.add(hh);
  for (let k = 0; k < 10; k++) { const a = k / 10 * 2 * PI; add(hh, G.ico, k % 2 ? '#8f8a86' : '#a19b96', Math.cos(a) * 1.15, 0.25, Math.sin(a) * 1.15, k, k * 0.7, 0, 0.6); }
  fx.flames = new THREE.Group(); hh.add(fx.flames);
  add(fx.flames, G.cone4, '#ff7a1f', 0, 0.55, 0, 0, 0.3, 0, 1.1, 0.9, 1.1); add(fx.flames, G.cone4, '#ffd34d', 0.1, 0.5, -0.1, 0, 1.1, 0, 0.6, 0.7, 0.6);
  add(hh, new THREE.CylinderGeometry(0.75, 0.6, 0.7, 12), '#2a2626', 0, 1.25, 0); add(hh, G.cyl, '#d8452e', 0, 1.58, 0, 0, 0, 0, 1.3, 0.02, 1.3);
  for (const s of [-1, 1]) add(hh, G.cyl6, '#55555f', s * 0.95, 1.0, 0, 0, 0, s * 0.25, 0.08, 1.8, 0.08);
  fx.fuelBg = add(hh, G.box, '#3a2c28', 0, 3.0, 0, 0, PI / 4, 0, 2.0, 0.18, 0.12);
  fx.fuelBar = add(hh, G.box, '#ff9b2f', 0, 3.0, 0.02, 0, PI / 4, 0, 1.9, 0.12, 0.13);
  blob(hh, 1.6);
  const ot = new THREE.Group(); fx.z4.add(ot);
  add(ot, G.box, '#9a6235', 13.8, 0.22, 29.4, 0, 0, 0, 1.4, 0.44, 1.1); add(ot, G.box, '#c98d55', 13.8, 0.46, 29.4, 0, 0, 0, 1.5, 0.05, 1.2);
  fx.z4tiles = [standTile(HEARTH.drop.x, HEARTH.drop.z), standTile(HEARTH.pickup.x, HEARTH.pickup.z), standTile(HEARTH.woodTile.x, HEARTH.woodTile.z), standTile(HEARTH.iceTile.x, HEARTH.iceTile.z)];
  fx.z4tiles.forEach((t: Loose) => (t.visible = false));
  piles.hearthFish = makePile('fish', 'board_limit', (i: Loose) => new V3(12.6, 0.12 + (i % 5) * ITEM_H.fish, 24.9 + (i / 5 | 0) * 0.4));
  piles.firewood = makePile('wood', 'board_limit', (i: Loose) => new V3(15.5 + (i / 5 | 0) * 0.5, 0.12 + (i % 5) * ITEM_H.wood, 25.1));
  piles.hotpots = makePile('hotpot', 'hotpot_limit', (i: Loose) => { const c = i / 6 | 0; return new V3(13.8 + ((c % 2) - 0.5) * 0.6, 0.5 + (i % 6) * ITEM_H.hotpot, 29.4 + ((c / 2 | 0) - 1) * 0.36); });
  fx.hearthcook = makeChar('hearthcook'); fx.hearthcook.group.position.set(12.4, 0, 26.5); fx.hearthcook.group.rotation.y = PI / 2; fx.z4.add(fx.hearthcook.group); blob(fx.hearthcook.group, 0.5);
  processors.push({ name: 'hearth', active: false, input: piles.hearthFish, fuelPile: piles.firewood, out: piles.hotpots, drop: new V3(HEARTH.drop.x, 0, HEARTH.drop.z), work: new V3(13.3, 1.0, 26.5),
    pots: () => [new V3(14, 1.6, 26.5)], timeKey: 'hotpot_time', perKey: 'hotpots_per_fish', outType: 'hotpot', chef: fx.hearthcook, slots: [], boardBusy: false,
    canWork: () => state.fuel > 0 });
}
function hearthRing(tile: Loose) {
  const ring = groundPlane(fx.z4, tile.x, tile.z, 1.0, new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.8, depthWrite: false }), 0.035);
  ring.scale.setScalar(0.001); return ring;
}
/** The hearth's fire: it burns down every second; it takes a bundle of firewood from its pile whenever one fits. */
function updateHearth(dt: number) {
  if (!state.gate4Open) return;
  state.fuel = burnFuel(state.fuel, dt);
  const log = piles.firewood.top();
  if (log && !fx.logFlying && wantsLog(state.fuel, tune.fuel_max, tune.wood_burn)) {
    piles.firewood.take(log); fx.logFlying = true;
    fly(log, log.mesh.position, () => new V3(14, 0.5, 26.5), 0.35, 0.9, () => { release(log); fx.logFlying = false; state.fuel = Math.min(tune.fuel_max, state.fuel + tune.wood_burn); puffs(new V3(14, 1.0, 26.5), 4, '#ffb347', 0.8); });
  }
  // look: flames grow with the fuel and flicker; the bar above shows what is left
  const k = state.fuel / tune.fuel_max, lit = state.fuel > 0;
  fx.flames.visible = lit; fx.flames.scale.set(0.5 + k * 0.7, (0.5 + k * 0.8) * (1 + Math.sin(state.t * 13) * 0.08), 0.5 + k * 0.7);
  fx.fuelBar.scale.x = Math.max(0.001, 1.9 * k); fx.fuelBar.material = mat(k < 0.25 ? '#d8452e' : '#ff9b2f');
  fx.smokeT = (fx.smokeT || 0) - dt;
  if (fx.smokeT <= 0) { fx.smokeT = lit ? 0.5 : 0.9; particle('puff', new V3(14 + rr(-0.3, 0.3), lit ? 2.0 : 0.8, 26.5), new V3(0, 1.0, 0), 1.2, lit ? '#e9e4d6' : '#8a8a8a', 0.8); }
}
function buildCounters() {
  counters = [];
  /** A serving counter on a fence, its cash pile, and the crowd behind it (front-row slots first, then decoration). */
  const mk = (o: Loose) => {
    const { zone, cx, cz, face, dish, priceKey, banner } = o;
    const g = new THREE.Group(); world.add(g);
    add(g, G.box, '#8a5a2b', cx, 0.45, cz, 0, 0, 0, 0.9, 0.9, 4.2); add(g, G.box, '#c98d55', cx, 0.92, cz, 0, 0, 0, 1.05, 0.06, 4.4);
    add(g, G.box, banner, cx, 0.6, cz, 0, 0, 0, 0.92, 0.18, 4.22); // banner cloth
    for (const z of [cz - 2.1, cz + 2.1]) { add(g, G.cyl6, '#7a4a26', cx - face * 0.3, 1.4, z, 0, 0, 0, 0.14, 2.8, 0.14); }
    add(g, G.box, banner, cx - face * 0.3, 2.65, cz, 0, 0, 0, 0.08, 0.5, 4.3);
    const drop = new V3(cx + face * 1.5, 0, cz); standTile(drop.x, drop.z);
    const cashPos = new V3(cx + face * 1.8, 0, cz + 4); standTile(cashPos.x, cashPos.z);
    const pile = makePile(dish, 'counter_limit', (i: Loose) => { const c = i / 10 | 0; return new V3(cx, 0.95 + (i % 10) * ITEM_H[dish], cz - 1.2 + c * 1.2); });
    const cash = makePile('cash', 60, (i: Loose) => { const c = i / 10 | 0; return new V3(cashPos.x + ((c % 3) - 1) * 0.44, 0.04 + (i % 10) * ITEM_H.cash, cashPos.z + ((c / 3 | 0) - 0.5) * 0.3); });
    const { rows, cols, rowGap, colGap, z0, front, slotGap } = o;
    const slotsN = 4, n = slotsN + rows * cols;
    const inst = new THREE.InstancedMesh(o.geo, VMAT, n); inst.frustumCulled = false; world.add(inst);
    const fx0 = cx - face * front, base = [];
    const slots = [];
    for (let s = 0; s < slotsN; s++) { const b = new V3(fx0, 0, cz - 1.5 * slotGap + s * slotGap); base.push({ p: b, ph: rng() * 6 });
      const bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(dish, 1).t, depthTest: false, fog: false })); bub.scale.set(1.25, 1.25, 1); bub.renderOrder = 5; world.add(bub);
      slots.push({ i: s, want: 0, phase: 'in', t: 0, d: 1.2, bub }); }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) base.push({ p: new V3(fx0 - face * (rowGap * 1.2 + r * rowGap + rr(-0.15, 0.15)), 0, z0 + c * colGap + rr(-0.2, 0.2)), ph: rng() * 6 });
    const lanterns: Loose[] = [];
    add(g, G.cyl6, '#5a3a22', cx + face * 0.45, 2.3, cz, PI / 2, 0, 0, 0.03, 4.4, 0.03); // the cord, in front of the banner
    for (let k = 0; k < 5; k++) {
      const l = new THREE.Group(); l.position.set(cx + face * 0.45, 1.98, cz - 1.8 + k * 0.9); l.visible = false; g.add(l);
      add(l, G.cyl6, '#5a3a22', 0, 0.2, 0, 0, 0, 0, 0.02, 0.3, 0.02); add(l, G.sph, '#d8302a', 0, 0, 0, 0, 0, 0, 0.36, 0.42, 0.36);
      add(l, G.cyl, '#e1b23a', 0, 0.2, 0, 0, 0, 0, 0.2, 0.05, 0.2); add(l, G.cyl, '#e1b23a', 0, -0.2, 0, 0, 0, 0, 0.2, 0.05, 0.2);
      add(l, G.box, '#ffe27a', 0, -0.3, 0, 0, 0, 0, 0.03, 0.14, 0.03); lanterns.push(l);
    }
    const counter = { dish, priceKey, face, pile, cash, drop, cashPos, inst, base, slots, cd: 0, rr: 0, active: zone === 1, zone, bubY: o.bubY, lanterns };
    slots.forEach((s: Loose) => { s.want = Math.floor(rr(tune.want_min, tune.want_max + 0.999)); });
    counters.push(counter);
  };
  const foot = { rowGap: 1.0, colGap: 1.0, z0: -8.5, front: 1.25, slotGap: 1.0, cols: 18, bubY: 2.7 };
  mk({ ...foot, zone: 1, cx: -5.4, cz: 2.5, face: 1, dish: 'bowl', priceKey: 'bowl_price', banner: '#cc3029', geo: SOLDIER_GEO[0], rows: 14 });
  mk({ ...foot, zone: 2, cx: 21.0, cz: 2.5, face: -1, dish: 'plate', priceKey: 'plate_price', banner: '#e1b23a', geo: SOLDIER_GEO[1], rows: 11 });
  mk({ zone: 3, cx: 7.4, cz: 13, face: 1, dish: 'riceball', priceKey: 'riceball_price', banner: '#2f5d8a', geo: CAVALRY_GEO,
    rows: 7, cols: 8, rowGap: 2.0, colGap: 1.4, z0: 9.4, front: 1.6, slotGap: 1.3, bubY: 3.6 });
  mk({ zone: 4, cx: 7.4, cz: 26.5, face: 1, dish: 'hotpot', priceKey: 'hotpot_price', banner: '#6b4a8a', geo: GENERALS_GEO,
    rows: 6, cols: 9, rowGap: 1.3, colGap: 1.15, z0: 21.8, front: 1.35, slotGap: 1.1, bubY: 3.0 });
}
function buildBelt() {
  belt = { on: false, items: [], cd: 0, x0: 3.3, x1: -4.6, z: 2.6, y: 0.5 };
  const g = new THREE.Group(); world.add(g); g.visible = false; belt.g = g;
  const bt = canvasTex(64, 32, (x: Loose) => { x.fillStyle = '#3f3d44'; x.fillRect(0, 0, 64, 32); x.fillStyle = '#5c5a63'; x.fillRect(0, 0, 14, 32); x.fillRect(32, 0, 14, 32); });
  bt.t.wrapS = THREE.RepeatWrapping; bt.t.repeat.set(16, 1); belt.tex = bt.t;
  const len = belt.x0 - belt.x1;
  add(g, new THREE.BoxGeometry(len, 0.08, 0.7), new THREE.MeshLambertMaterial({ map: bt.t }), (belt.x0 + belt.x1) / 2, 0.44, belt.z);
  for (const s of [-1, 1]) add(g, G.box, '#c7c3b8', (belt.x0 + belt.x1) / 2, 0.47, belt.z + s * 0.4, 0, 0, 0, len, 0.12, 0.08);
  for (let x = belt.x1 + 0.4; x < belt.x0; x += 1.6) add(g, G.box, '#55555f', x, 0.2, belt.z, 0, 0, 0, 0.12, 0.4, 0.6);
}
function buildWorkersAndPlayer() {
  workers = [];
  player = makeCarrier('player', -2, -4.5, true);
}
function makeCarrier(role: string, x: number, z: number, isPlayer: boolean) {
  const ch = makeChar(role); world.add(ch.group); const sh = blob(world, 0.55);
  const c: Loose = { ch, sh, pos: new V3(x, 0, z), vel: new V3(), facing: 0, stack: [], lean: new V3(), leanV: new V3(), cd: 0, isPlayer, mode: null };
  c.who = isPlayer ? 'player' : 'worker';
  c.cap = (type: Loose) => carryCap(type, c.who, state.carry, tune as Loose, lv('up_staff'));
  c.canTake = (type: Loose) => (c.stack.length === 0 || c.stack[0].type === type) && c.stack.length < c.cap(type);
  c.top = () => { const it = c.stack[c.stack.length - 1]; return it && !it.flying ? it : null; };
  c.slot = (i: Loose) => {
    const h = i * ITEM_H[(c.stack[0] || { type: 'fish' }).type];
    const sf = Math.sin(c.facing), cf = Math.cos(c.facing);
    const p = new V3(c.pos.x - sf * 0.5, 0.48 + c.ch.body.position.y + h, c.pos.z - cf * 0.5);
    const bend = h * 0.9 + h * h * 0.18;
    p.x += c.lean.x * bend; p.z += c.lean.z * bend;
    return p;
  };
  return c;
}
function updateCarrier(c: Loose, dt: number) {
  const sp = Math.hypot(c.vel.x, c.vel.z);
  if (sp > 0.1) { const want = Math.atan2(c.vel.x, c.vel.z); let d = want - c.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); c.facing += d * Math.min(1, dt * 14); }
  c.ch.group.position.copy(c.pos); c.ch.group.rotation.y = c.facing; c.sh.position.set(c.pos.x, 0.02, c.pos.z);
  // the stack trails the motion and springs back
  const tx = -c.vel.x * 0.03, tz = -c.vel.z * 0.03;
  c.leanV.x += ((tx - c.lean.x) * 80 - c.leanV.x * 7) * dt; c.leanV.z += ((tz - c.lean.z) * 80 - c.leanV.z * 7) * dt;
  c.lean.x += c.leanV.x * dt; c.lean.z += c.leanV.z * dt;
  animChar(c.ch, sp, dt, c.mode || (c.stack.length ? 'carry' : null));
  c.stack.forEach((it: Loose, i: Loose) => { if (!it.flying) { it.mesh.position.copy(c.slot(i)); it.mesh.rotation.set(0, c.facing, 0); } });
}

// ---- Tiles you pay into --------------------------------------------------------------------
function buildTiles() {
  tiles = UNLOCKS.map((def: Loose) => {
    const tex = canvasTex(256, 256, () => {});
    const m = groundPlane(world, def.x, def.z, def.size || 1.7, new THREE.MeshBasicMaterial({ map: tex.t, transparent: true, depthWrite: false }), 0.04);
    m.visible = false;
    const t = { def, mesh: m, tex, paid: 0, done: false, shown: -1, dwell: 0, cd: 0, flash: 0, hideT: -1, visibleNow: false };
    return t;
  });
}
function tileVisible(t: Loose) { return !t.done && t.def.req.every((id: Loose) => state.done.includes(id)); }
function unlock(t: Loose, instant: boolean) {
  t.done = true; if (!state.done.includes(t.def.id)) state.done.push(t.def.id);
  const id = t.def.id;
  if (!instant) { t.flash = 0.35; t.hideT = 0.35; sfx.bell(); buzz(80); puffs(new V3(t.def.x, 0.4, t.def.z), 8, '#fff4b8', 1.2);
    if (t.def.focus && tune.glide_time > 0) state.glide = { p: new V3(t.def.focus[0], 0, t.def.focus[1]), t: 0 };
    events.push({ type: 'unlock', id }); }
  else t.mesh.visible = false;
  // each hire works one spot and carries what it makes to one station
  const hires: Record<string, Loose> = {
    fisher1: [rods[0], processors[0], 'fish', 'fisher'], fisher2: [rods[1], processors[0], 'fish', 'fisher'], fisher3: [rods[2], processors[0], 'fish', 'fisher'],
    grillfisher: [rods[3], processors[1], 'fish', 'fisher'], farmer: [spots[0], processors[2], 'rice', 'farmer'], pondfisher: [spots[1], processors[2], 'fish', 'fisher'],
    woodcutter: [spots[2], processors[3], 'wood', 'woodcutter'], icefisher: [spots[3], processors[3], 'fish', 'fisher'],
  };
  if (hires[id]) {
    const [spot, proc, item, role] = hires[id];
    const w = makeCarrier(role, t.def.x, t.def.z, false);
    w.rod = spot; w.proc = proc; w.item = item; w.state = 'toRod'; spot.owner = w; workers.push(w);
    if (!instant) pop(w.ch.group);
  }
  const carriers: Record<string, Loose> = {
    carrier2: [piles.sushi, new V3(16.6, 0, 0.75), counters[1]],
    carrier3: [piles.riceballs, new V3(RICE.pickup.x, 0, RICE.pickup.z), counters[2]],
    carrier4: [piles.hotpots, new V3(HEARTH.pickup.x, 0, HEARTH.pickup.z), counters[3]],
  };
  if (carriers[id]) {
    const [pile, at, counter] = carriers[id];
    const w = makeCarrier('carrier', t.def.x, t.def.z, false);
    w.who = 'carrier'; w.pick = { pile, at }; w.counter = counter; w.state = 'toPick'; w.wait = 0; workers.push(w);
    if (!instant) pop(w.ch.group);
  }
  const cashiers: Record<string, number> = { cashier1: 0, cashier2: 1, cashier3: 2, cashier4: 3 };
  if (id in cashiers) {
    const counter = counters[cashiers[id]], cp = counter.cashPos;
    const w = makeCarrier('cashier', t.def.x, t.def.z, false);
    w.who = 'cashier'; w.counter = counter; w.state = 'toStand'; w.stand = new V3(cp.x - counter.face * 1.0, 0, cp.z + 0.9);
    w.face = counter.face > 0 ? Math.PI * 0.75 : -Math.PI * 0.75; workers.push(w);
    if (!instant) pop(w.ch.group);
  }
  if (id === 'carry') state.carry = 1;
  if (id === 'speed') state.speedUp = true;
  if (id === 'horse') { // you mount up: the horse goes under you, your legs tuck in
    state.horse = true; fx.stableHorse.visible = false;
    const h = new THREE.Mesh(HORSE_GEO, VMAT); player.ch.group.add(h); player.ch.lift = 0.82;
    player.ch.legL.visible = false; player.ch.legR.visible = false; player.ch.horse = h;
    if (!instant) { pop(h); puffs(player.pos.clone().add(new V3(0, 0.6, 0)), 8, '#e9e4d6', 1.2); }
  }
  if (id === 'fishspeed') state.fishSpeed = true;
  if (id === 'pot2') { state.pot2 = true; instant ? (fx.pot2.visible = true) : pop(fx.pot2); }
  if (id === 'conveyor') { belt.on = true; instant ? (belt.g.visible = true) : pop(belt.g); }
  if (id === 'gate') {
    state.gateOpen = true; processors[1].active = true; counters[1].active = true; rods[3].active = true;
    rods[3].tileMesh.visible = true; fx.z2tiles.forEach((m: Loose) => (m.visible = true));
    if (instant) { fx.z2.visible = true; rods[3].g.visible = true; state.gateAnim = 1; } else { pop(fx.z2, 0.7); pop(rods[3].g, 0.7); }
  }
  if (id === 'gate4') {
    state.gate4Open = true; if (!instant) state.fuel = tune.fuel_start; state.blizzardNext = state.playTime + tune.blizzard_first; // a loaded camp keeps its saved fire processors[3].active = true; counters[3].active = true; spots[2].active = true; spots[3].active = true;
    fx.z4tiles.forEach((m: Loose) => (m.visible = true));
    if (instant) { fx.z4.visible = true; state.gate4Anim = 1; } else pop(fx.z4, 0.7);
  }
  if (id === 'gate3') {
    state.gate3Open = true; processors[2].active = true; counters[2].active = true; spots.forEach((sp: Loose) => (sp.active = true));
    fx.z3tiles.forEach((m: Loose) => (m.visible = true));
    if (instant) { fx.z3.visible = true; state.gate3Anim = 1; } else pop(fx.z3, 0.7);
  }
  if (!instant) save();
}
/** A price tile is paid: a one-off unlock, or the next level of a levelled upgrade. */
function complete(t: Loose) {
  if (!t.def.levels) { unlock(t, false); return; }
  const id = t.def.id, next = lv(id) + 1;
  state.levels[id] = next; t.paid = 0; t.flash = 0.35;
  sfx.bell(); buzz(60); puffs(new V3(t.def.x, 0.4, t.def.z), 8, '#fff4b8', 1.2);
  floats.push({ p: new V3(t.def.x, 2.2, t.def.z), txt: `${t.def.label} LV${next}!`, t: -0.4, col: '#ffe27a' });
  events.push({ type: 'upgrade', id, level: next });
  if (next >= tune.upgrade_max) { t.done = true; t.hideT = 0.35; if (!state.done.includes(id)) state.done.push(id); }
  drawPriceTile(t); save();
}
function updateTiles(dt: number) {
  for (const t of tiles) {
    if (t.hideT >= 0) { t.hideT -= dt; t.flash -= dt; drawPriceTile(t); const k = Math.max(0, t.hideT / 0.35); t.mesh.scale.setScalar((t.def.size || 1.7) * k + 0.001); if (t.hideT < 0) t.mesh.visible = false; continue; }
    const vis = tileVisible(t);
    if (vis && !t.visibleNow) { t.visibleNow = true; t.mesh.visible = true; drawPriceTile(t); pops.push({ obj: { scale: { setScalar: (v: Loose) => t.mesh.scale.setScalar((t.def.size || 1.7) * v) } }, t: 0, dur: 0.5 }); }
    if (!vis) continue;
    if (t.flash > 0) { t.flash -= dt; drawPriceTile(t); }
    const price = tilePrice(t), remaining = price - t.paid;
    if (remaining <= 0) { complete(t); continue; }
    // cash flows only while you stand still on the tile, so running across one never pays it
    const still = Math.hypot(player.vel.x, player.vel.z) < tune.pay_still_speed;
    if (inTile(player.pos, t.def, (t.def.size || 1.7) / 2) && !state.welcome && still) {
      t.dwell += dt; t.cd -= dt;
      if (t.dwell > tune.pay_dwell && state.wallet > 0 && t.cd <= 0) {
        const amt = payChunk(state.wallet, remaining, price, tune.pay_chunks);
        state.wallet -= amt; t.paid += amt; t.cd = tune.pay_interval; state.payStreak++;
        sfx.pay(state.payStreak);
        const it = newItem('cash'); const from = player.pos.clone(); from.y = 1.2;
        fly(it, from, () => new V3(t.def.x, 0.1, t.def.z), 0.22, 0.8, () => release(it));
        if (t.paid >= price) complete(t);
      }
    } else { t.dwell = 0; }
    if (t.shown !== Math.max(0, price - t.paid)) drawPriceTile(t);
  }
}

// ---- Simulation ---------------------------------------------------------------------------
function catchFish(rod: Loose, c: Loose) {
  const gold = state.goldLeft > 0, it = newItem('fish', gold);
  c.stack.push(it); const from = rod.bobber.position.clone(); from.y = 0;
  fly(it, from, () => c.slot(c.stack.indexOf(it)), 0.45, 2.2);
  splash(from);
  if (c.isPlayer || c.pos.distanceTo(player.pos) < 12) sfx.splash();
  if (c.isPlayer) buzz(25);
}
function updateRods(dt: number) {
  for (const rod of rods) {
    if (!rod.active) continue;
    let occ = null;
    if (rod.owner) { const w = rod.owner; if (w.state === 'fish' && inTile(w.pos, rod.tile, 0.3) && w.canTake('fish')) occ = w; }
    else if (inTile(player.pos, rod.tile) && player.canTake('fish') && !state.welcome) occ = player;
    if (state.blizzardLeft > 0) occ = null; // the river is frozen
    if (occ) {
      occ.mode = 'pull';
      rod.prog += dt / (catchTime(tune.fish_time, occ === player, state.fishSpeed, tune.fish_speed_mult) / levelSpeed(lv('up_rods'), tune.upgrade_speed_step));
      rod.ripT -= dt; if (rod.ripT <= 0 && rod.prog > 0.25) { rod.ripT = 0.35; particle('ring', new V3(rod.x, -0.4, -12.6), new V3(), 0.8, state.goldLeft > 0 ? '#ffe27a' : '#ffffff', 0.8); }
      if (occ === player && rod.prog > 0.35) { rod.sndT -= dt; if (rod.sndT <= 0) { rod.sndT = 0.14; sfx.tension(rod.prog); } }
      if (rod.prog >= 1) { rod.prog = 0; catchFish(rod, occ); }
    } else rod.prog = Math.max(0, rod.prog - dt * 2);
    // look: the rod bends, the line glows, the bobber dips
    const p = rod.prog, wob = p > 0.5 ? Math.sin(state.t * 40) * 0.03 * p : 0;
    rod.pivot.rotation.x = -1.05 - p * 0.35 + wob;
    rod.bobber.position.y = -0.42 - (p > 0.3 ? 0.12 + Math.sin(state.t * 18) * 0.05 : Math.sin(state.t * 2 + rod.i) * 0.03);
    const glow = p > 0.5;
    rod.lineMat.color.set(glow ? (state.goldLeft > 0 ? '#ffd34d' : '#ffe14a') : '#f4efe0');
    rod.lineMat.emissive.set(glow ? '#c99a00' : '#000000');
    rod.g.updateMatrixWorld(true);
    const tip = new V3(0, 3.4, 0).applyMatrix4(rod.pivot.matrixWorld), bob = rod.bobber.position.clone().add(new V3(0, 0.1, 0));
    const dir = bob.clone().sub(tip), len = dir.length();
    rod.line.position.copy(tip); rod.line.scale.set(1, len, 1);
    rod.line.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
  }
}
function updateProcessors(dt: number) {
  // The chef cuts one fish at a time on the board, then drops it into a free pot; each pot cooks
  // its own fish and throws its own dishes. A second pot means two fish cooking at once.
  for (const pr of processors) {
    if (!pr.active) continue;
    const pots = pr.pots(), per = tune[pr.perKey], cut = Math.min(tune.cut_time, cookTime(pr) * 0.5);
    const halted = pr.canWork ? !pr.canWork() : false; // the great hearth cooks only while its fire burns
    while (pr.slots.length < pots.length) pr.slots.push({ cur: null, t: 0, phase: null });
    pr.chef.mode = null;
    pr.slots.forEach((sl: Loose, i: Loose) => {
      const pot = pots[i];
      if (!sl.cur) {
        const busy = pr.slots.filter((q: Loose) => q.cur).length, f = pr.input.top();
        const f2 = pr.input2 ? pr.input2.top() : null; // a dish of two ingredients waits for both
        if (f && (!pr.input2 || f2) && !halted && !pr.boardBusy && pr.out.items.length + per * (busy + 1) <= pr.out.limit()) {
          pr.input.take(f); sl.cur = f; sl.t = 0; sl.phase = 'cut'; pr.boardBusy = true; pr.chop = 0;
          fly(f, f.mesh.position, () => pr.work, 0.18, 0.35);
          if (f2) { pr.input2.take(f2); sl.cur2 = f2; fly(f2, f2.mesh.position, () => pr.work.clone().add(new V3(0.3, 0.1, 0)), 0.18, 0.35); }
        }
        return;
      }
      if (sl.cur.flying || halted) return;
      sl.t += dt;
      if (sl.phase === 'cut') {
        pr.chef.mode = 'chop';
        pr.chop -= dt; if (pr.chop <= 0) { pr.chop = 0.22; if (pr.work.distanceTo(player.pos) < 9) sfx.chop(); }
        if (sl.t >= cut) { // into the pot
          sl.phase = 'cook'; sl.t = 0; pr.boardBusy = false;
          const f = sl.cur; fly(f, f.mesh.position, () => pot, 0.3, 0.9, () => { f.mesh.visible = false; });
          const f2 = sl.cur2; if (f2) fly(f2, f2.mesh.position, () => pot, 0.3, 0.9, () => { f2.mesh.visible = false; });
        }
      } else {
        sl.cur.mesh.visible = false; if (sl.cur2) sl.cur2.mesh.visible = false;
        if (sl.t >= Math.max(0.1, cookTime(pr) - cut)) {
          const gold = sl.cur.gold || !!(sl.cur2 && sl.cur2.gold); release(sl.cur); sl.cur = null;
          if (sl.cur2) { release(sl.cur2); sl.cur2 = null; }
          const from = pot.clone(); puffs(from, 4, '#ffffff', 1);
          if (from.distanceTo(player.pos) < 10) sfx.puff();
          for (let k = 0; k < per; k++) {
            const it = newItem(pr.outType, gold); pr.out.items.push(it); const idx = pr.out.items.length - 1;
            fly(it, from, () => pr.out.slot(pr.out.items.indexOf(it) >= 0 ? pr.out.items.indexOf(it) : idx), 0.35, 1.0, null, k * 0.09);
          }
        }
      }
    });
    animChar(pr.chef, 0, dt, pr.chef.mode);
  }
}
function updateCounters(dt: number) {
  for (const c of counters) {
    const face = c.face;
    // front-row soldiers step back when full and the next one steps up
    for (const s of c.slots) {
      if (s.phase === 'out') { s.d += dt * 3.4; if (s.d >= 1.2) { s.phase = 'in'; s.want = Math.floor(rr(tune.want_min, tune.want_max + 0.999)); } }
      else if (s.phase === 'in') { s.d -= dt * 3.4; if (s.d <= 0) { s.d = 0; s.phase = 'ready'; } }
      const b = c.base[s.i].p;
      s.bub.position.set(b.x - face * s.d, c.bubY + Math.sin(state.t * 3 + s.i) * 0.06, b.z);
      s.bub.visible = c.active && s.phase === 'ready' && s.want > 0;
      const shown = s.want + (s.vip ? 1000 : 0);
      if (s.bub.visible && s.shownWant !== shown) { s.bub.material.map = bubbleTex(c.dish, s.want, !!s.vip).t; s.shownWant = shown; }
    }
    if (!c.active) continue;
    if (c.zone === 1 && state.general && state.general.phase === 'eat') continue; // the general eats first
    c.cd -= dt;
    if (c.cd <= 0) {
      const top = c.pile.top();
      if (top) {
        let s = null;
        if (c.slots[0].vip && c.slots[0].phase === 'ready' && c.slots[0].want > 0) s = c.slots[0]; // the VIP is served first
        else for (let k = 0; k < c.slots.length; k++) { const q = c.slots[(c.rr + k) % c.slots.length]; if (q.phase === 'ready' && q.want > 0) { s = q; c.rr = (c.rr + k + 1) % c.slots.length; break; } }
        if (s) {
          c.cd = 1 / tune.eat_rate; c.pile.take(top); s.want--; if (s.vip && state.vip) state.vip.eaten++;
          const head = c.base[s.i].p.clone(); head.y = 1.3; const slot = s;
          fly(top, top.mesh.position, () => head, 0.3, 0.6, () => {
            release(top); puffs(head, 3, '#ffffff', 0.7);
            const value = decorPay(blizzardPay(dishValue(tune[c.priceKey], top.gold, tune.golden_mult), state.blizzardLeft > 0, state.fuel > 0, tune.blizzard_penalty), lv('decor' + c.zone), tune.decor_bonus);
            state.earned += value; state.sold[c.dish] = (state.sold[c.dish] || 0) + 1; if (zoneAutomated(c.zone, state.done)) state.autoWin += value;
            const cash = newItem('cash'); cash.value = value;
            const from = head.clone(); from.x += face * 0.6;
            if (c.cash.items.length < c.cash.limit()) { c.cash.items.push(cash); fly(cash, from, () => c.cash.slot(c.cash.items.indexOf(cash)), 0.5, 1.5); }
            else { c.cash.extra += value; fly(cash, from, () => c.cashPos.clone(), 0.5, 1.5, () => release(cash)); }
            floats.push({ p: head.clone().add(new V3(0, 0.8, 0)), txt: '+' + value, t: 0, col: top.gold ? '#ffe27a' : '#ffffff' });
            if (slot.want <= 0) { slot.phase = 'out'; if (head.distanceTo(player.pos) < 14) sfx.cheer(); }
            if (c.zone === 2 && !state.goalDone) { state.goalDone = true; state.goalTimer = 1.4; state.gained = 'The camp is running!'; state.resultLine = 'Grill yard open, first sushi sold'; events.push({ type: 'goal' }); save(); }
            if (c.zone === 4 && !state.goal4Done) { state.goal4Done = true; state.goalTimer = 1.4; state.gained = 'The great hearth is lit!'; state.resultLine = 'Great hearth open, first hot pot sold'; events.push({ type: 'goal4' }); save(); }
            if (c.zone === 3 && !state.goal3Done) { state.goal3Done = true; state.goalTimer = 1.4; state.gained = 'The rice field is running!'; state.resultLine = 'Rice field open, first rice ball sold'; events.push({ type: 'goal3' }); save(); }
          });
        }
      }
    }
  }
}
/** Pays a dish's coins out at a counter's cash pile, from where it was eaten. */
function payOut(c: Loose, from: Loose, value: number, gold: boolean) {
  state.earned += value; state.sold[c.dish] = (state.sold[c.dish] || 0) + 1; if (zoneAutomated(c.zone, state.done)) state.autoWin += value;
  const cash = newItem('cash'); cash.value = value;
  if (c.cash.items.length < c.cash.limit()) { c.cash.items.push(cash); fly(cash, from, () => c.cash.slot(c.cash.items.indexOf(cash)), 0.5, 1.5); }
  else { c.cash.extra += value; fly(cash, from, () => c.cashPos.clone(), 0.5, 1.5, () => release(cash)); }
  floats.push({ p: from.clone().add(new V3(0, 0.8, 0)), txt: '+' + value, t: 0, col: gold ? '#ffe27a' : '#ffffff' });
}
const GENERAL_AT = new V3(-7.0, 0, 5.9);
/** The general's visit: he walks up beside the soup counter, eats first, and pays a chest if his order is filled in time. */
function updateGeneral(dt: number) {
  const c = counters[0], gch = fx.general;
  if (!state.general) {
    gch.group.visible = false; fx.generalBub.visible = false;
    if (state.done.includes('fisher3') && state.playTime >= state.generalNext && scene === 'play' && !state.welcome) {
      state.general = { phase: 'in', d: 3, t: tune.general_time, eaten: 0, cd: 0 };
      sfx.horn(); buzz(60); events.push({ type: 'general' });
      floats.push({ p: GENERAL_AT.clone().add(new V3(0, 3.2, 0)), txt: "The general arrives!", t: -0.6, col: '#ffe27a' });
    }
    return;
  }
  const g = state.general;
  gch.group.visible = true;
  if (g.phase === 'in') { g.d = Math.max(0, g.d - dt * 3); if (g.d <= 0) g.phase = 'eat'; }
  else if (g.phase === 'out') { g.d += dt * 3; if (g.d >= 3) { state.general = null; state.generalNext = state.playTime + rr(tune.general_min, tune.general_max); return; } }
  else {
    g.t -= dt; g.cd -= dt;
    const top = c.pile.top();
    if (top && g.cd <= 0 && g.eaten < tune.general_bowls) {
      g.cd = 1 / tune.eat_rate; c.pile.take(top); g.eaten++;
      const head = GENERAL_AT.clone(); head.y = 1.9;
      fly(top, top.mesh.position, () => head, 0.3, 0.6, () => { release(top); puffs(head, 3, '#ffffff', 0.8); payOut(c, head, decorPay(blizzardPay(dishValue(tune[c.priceKey], top.gold, tune.golden_mult), state.blizzardLeft > 0, state.fuel > 0, tune.blizzard_penalty), lv('decor1'), tune.decor_bonus), top.gold); });
    }
    const outcome = visitOutcome(g.eaten, tune.general_bowls, g.t);
    if (outcome === 'won') { // a chest bursts open onto the cash pile
      g.phase = 'out'; sfx.bell(); sfx.cheer(); buzz(120); events.push({ type: 'general_won' });
      const from = GENERAL_AT.clone().add(new V3(1.2, 1.6, 0)), n = 10, each = tune.general_reward / n;
      for (let i = 0; i < n; i++) {
        const cash = newItem('cash'); cash.value = each;
        if (c.cash.items.length < c.cash.limit()) { c.cash.items.push(cash); fly(cash, from, () => c.cash.slot(c.cash.items.indexOf(cash)), 0.6, 2.2, undefined, i * 0.05); }
        else { c.cash.extra += each; fly(cash, from, () => c.cashPos.clone(), 0.6, 2.2, () => release(cash), i * 0.05); }
      }
      state.earned += tune.general_reward; puffs(from, 10, '#ffe27a', 1.4);
      floats.push({ p: from.clone().add(new V3(0, 1, 0)), txt: `CHEST +${tune.general_reward}`, t: -0.3, col: '#ffe27a' });
    } else if (outcome === 'lost') {
      g.phase = 'out'; events.push({ type: 'general_lost' });
      floats.push({ p: GENERAL_AT.clone().add(new V3(0, 3, 0)), txt: 'The general leaves...', t: -0.6, col: '#ffc9b0' });
    }
  }
  // look: he steps up from behind the crowd; a bubble counts his bowls
  gch.group.position.set(GENERAL_AT.x - g.d, 0, GENERAL_AT.z); gch.group.rotation.y = PI / 2;
  animChar(gch, g.phase === 'eat' ? 0 : 3, dt, g.phase === 'eat' ? 'chop' : null);
  fx.generalBub.visible = g.phase === 'eat'; fx.generalBub.position.set(GENERAL_AT.x - g.d, 3.4 + Math.sin(state.t * 3) * 0.06, GENERAL_AT.z);
  const left = Math.max(0, tune.general_bowls - g.eaten);
  if (fx.generalBub.visible && fx.generalShown !== left) {
    fx.generalShown = left; const tx = fx.generalTex, x2 = tx.g;
    x2.clearRect(0, 0, 160, 128); x2.drawImage(bubbleTex('bowl', 1).c, 0, 0, 128, 128, 0, 0, 128, 128);
    x2.fillStyle = '#ffffff'; x2.fillRect(84, 30, 72, 44); x2.fillStyle = '#4a2e20'; x2.font = `bold 34px ${FONT}`; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText('x' + left, 118, 52);
    tx.t.needsUpdate = true;
  }
}
/** Shows one lantern over each counter per level of its decoration, swaying a little. */
function updateLanterns() {
  for (const c of counters) {
    const n = lv('decor' + c.zone);
    c.lanterns.forEach((l: Loose, k: number) => { l.visible = k < n; l.rotation.x = Math.sin(state.t * 1.6 + k) * 0.08; });
  }
}
function updateCrowds() {
  const o = fx.dummy;
  for (const c of counters) {
    for (let i = 0; i < c.base.length; i++) {
      const b = c.base[i]; let x = b.p.x, bob;
      if (i < c.slots.length) { const s = c.slots[i]; x -= c.face * s.d; bob = s.phase === 'ready' && s.want > 0 ? Math.abs(Math.sin(state.t * 7 + b.ph)) * 0.12 : Math.abs(Math.sin(state.t * 9)) * 0.08; }
      else bob = Math.abs(Math.sin(state.t * 3 + b.ph)) * 0.05;
      o.position.set(x, bob, b.p.z); o.rotation.set(0, c.face > 0 ? PI / 2 : -PI / 2, 0); o.updateMatrix();
      c.inst.setMatrixAt(i, o.matrix);
    }
    c.inst.instanceMatrix.needsUpdate = true;
  }
}
function updateBelt(dt: number) {
  if (!belt.on) return;
  belt.tex.offset.x += dt * tune.belt_speed / (belt.x0 - belt.x1) * 16;
  belt.cd -= dt;
  const top = piles.pot.top();
  if (belt.cd <= 0 && top && belt.items.length < 24) {
    belt.cd = tune.belt_interval; piles.pot.take(top);
    const it = top; fly(it, it.mesh.position, () => new V3(belt.x0, belt.y, belt.z), 0.3, 0.8, () => { it.bx = belt.x0; belt.items.push(it); });
  }
  const cp = counters[0].pile;
  for (let i = 0; i < belt.items.length; i++) {
    const it = belt.items[i], ahead = belt.items[i - 1];
    let nx = it.bx - tune.belt_speed * dt;
    if (ahead) nx = Math.max(nx, ahead.bx + 0.42);
    nx = Math.max(nx, belt.x1);
    it.bx = nx; it.mesh.position.set(it.bx, belt.y, belt.z); it.mesh.rotation.y = 0;
  }
  const first = belt.items[0];
  if (first && first.bx <= belt.x1 + 0.01 && cp.items.length < cp.limit()) {
    belt.items.shift(); cp.items.push(first);
    fly(first, first.mesh.position, () => cp.slot(cp.items.indexOf(first)), 0.25, 0.6);
  }
}
function moveTo(c: Loose, target: Loose, dt: number, speed: number) {
  const dx = target.x - c.pos.x, dz = target.z - c.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.06) { c.vel.set(0, 0, 0); return true; }
  const s = Math.min(speed, d / dt); c.vel.set(dx / d * s, 0, dz / d * s); c.pos.addScaledVector(c.vel, dt); return false;
}
/** A carrier's round: wait at a table for dishes, take a load, walk it to the counter, unload, go back. */
function updateCarrierWorker(w: Loose, dt: number) {
  const pile = w.pick.pile, cnt = w.counter;
  if (w.state === 'toPick') { if (moveTo(w, w.pick.at, dt, workerSpeed())) { w.state = 'pick'; w.wait = 0; } }
  else if (w.state === 'pick') {
    w.vel.set(0, 0, 0);
    const top = pile.top();
    if (top && w.canTake(pile.type)) { if (w.cd <= 0) { w.cd = tune.pickup_interval * 1.5; takeFrom(w, pile); w.wait = 0; } }
    else w.wait += dt;
    // leave with a full load, or with what there is once the table has stayed empty a moment
    if (w.stack.length && !w.stack.some((i: Loose) => i.flying) && (!w.canTake(pile.type) || w.wait > 0.6)) w.state = 'toDrop';
  } else if (w.state === 'toDrop') { if (moveTo(w, cnt.drop, dt, workerSpeed())) w.state = 'drop'; }
  else if (w.state === 'drop') {
    w.vel.set(0, 0, 0);
    const top = w.top();
    if (top && w.cd <= 0 && cnt.pile.items.length < cnt.pile.limit()) { w.cd = tune.pickup_interval * 1.5; giveTo(w, cnt.pile, top); }
    if (!w.stack.length) w.state = 'toPick';
  }
}
/** A cashier walks to the side of a counter's cash pile and moves its bundles into your wallet, one at a time. */
function updateCashier(w: Loose, dt: number) {
  if (w.state === 'toStand') { if (moveTo(w, w.stand, dt, workerSpeed())) w.state = 'work'; return; }
  w.vel.set(0, 0, 0); w.facing = w.face; w.mode = w.counter.cash.items.length ? 'chop' : null;
  const top = w.counter.cash.top();
  if (top && w.cd <= 0) {
    w.cd = tune.cashier_interval;
    const it = w.counter.cash.take(top), v = it.value + w.counter.cash.extra; w.counter.cash.extra = 0;
    const near = w.pos.distanceTo(player.pos) < 9;
    fly(it, it.mesh.position, () => w.pos.clone().add(new V3(0, 1.0, 0)), 0.25, 0.8, () => { state.wallet += v; release(it); if (near) sfx.coin(state.coinStreak++); state.coinT = 0.6; });
  }
}
function updateWorkers(dt: number) {
  for (const w of workers) {
    w.mode = null; w.cd -= dt;
    if (w.who === 'cashier') { updateCashier(w, dt); continue; }
    if (w.who === 'carrier') { updateCarrierWorker(w, dt); continue; }
    if (w.state === 'toRod') { if (moveTo(w, w.rod.tile, dt, workerSpeed())) w.state = 'fish'; }
    else if (w.state === 'fish') { w.vel.set(0, 0, 0); if (!w.canTake(w.item) && !w.stack.some((i: Loose) => i.flying)) w.state = 'toDrop'; }
    else if (w.state === 'toDrop') { if (moveTo(w, w.proc.drop, dt, workerSpeed())) w.state = 'drop'; }
    else if (w.state === 'drop') {
      w.vel.set(0, 0, 0);
      const top = w.top(), pile = w.item === w.proc.input.type ? w.proc.input : w.item === 'wood' ? w.proc.fuelPile : w.proc.input2;
      if (top && w.cd <= 0 && pile.items.length < pile.limit()) { w.cd = tune.pickup_interval * 2; giveTo(w, pile, top); }
      if (!w.stack.length) w.state = 'toRod';
    }
  }
}
function giveTo(c: Loose, pile: Loose, it: Loose) {
  c.stack.pop(); pile.items.push(it);
  fly(it, it.mesh.position, () => pile.slot(pile.items.indexOf(it)), 0.25, 0.9);
}
function takeFrom(c: Loose, pile: Loose) {
  const it = pile.take(pile.top()); c.stack.push(it);
  fly(it, it.mesh.position, () => c.slot(c.stack.indexOf(it)), 0.22, 0.7);
}
function updatePlayer(dt: number) {
  let ix = 0, iy = 0;
  if (!state.welcome) {
    if (down.has('KeyA') || down.has('ArrowLeft')) ix -= 1; if (down.has('KeyD') || down.has('ArrowRight')) ix += 1;
    if (down.has('KeyW') || down.has('ArrowUp')) iy += 1; if (down.has('KeyS') || down.has('ArrowDown')) iy -= 1;
    if (joy.active) { const dx = joy.x - joy.x0, dy = joy.y - joy.y0, d = Math.hypot(dx, dy); if (d > 6) { const m = Math.min(1, d / JOY_R); ix = dx / d * m; iy = -dy / d * m; } }
  }
  const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
  // screen right = (1,0,-1)/sqrt2, screen up = (-1,0,-1)/sqrt2 for the 45-degree camera
  const s2 = Math.SQRT1_2, speed = playerSpeed(tune.run_speed, state.speedUp, tune.speed_mult, state.horse, tune.horse_speed_mult);
  const tx = (ix - iy) * s2 * speed, tz = (-ix - iy) * s2 * speed, k = Math.min(1, dt * 16);
  player.vel.x += (tx - player.vel.x) * k; player.vel.z += (tz - player.vel.z) * k;
  const nx = player.pos.x + player.vel.x * dt, nz = player.pos.z + player.vel.z * dt;
  if (walkable(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
  else if (walkable(nx, player.pos.z)) { player.pos.x = nx; player.vel.z = 0; }
  else if (walkable(player.pos.x, nz)) { player.pos.z = nz; player.vel.x = 0; }
  else player.vel.set(0, 0, 0);
  for (const o of fx.obstacles()) { // push out of tables and stoves
    const dx = player.pos.x - o[0], dz = player.pos.z - o[1], d = Math.hypot(dx, dz);
    if (d < o[2] && d > 0.0001) { player.pos.x = o[0] + dx / d * o[2]; player.pos.z = o[1] + dz / d * o[2]; }
  }
  player.mode = null;
  // interactions: everything triggers by standing on a tile
  player.cd -= dt; state.streakT -= dt; if (state.streakT <= 0) state.streak = 0;
  state.payT -= dt; if (!tiles.some((t: Loose) => t.dwell > 0)) state.payStreak = 0;
  if (state.welcome || player.cd > 0) return;
  const top = player.top(), P = player.pos;
  for (const pr of processors) {
    if (!pr.active || !top || !inTile(P, pr.drop)) continue;
    const pile = top.type === pr.input.type ? pr.input : pr.input2 && top.type === pr.input2.type ? pr.input2 : pr.fuelPile && top.type === 'wood' ? pr.fuelPile : null;
    if (pile && pile.items.length < pile.limit()) {
      giveTo(player, pile, top); player.cd = tune.pickup_interval * 1.4; sfx.drop(state.streak++); state.streakT = 0.5; return;
    }
  }
  const pick = [[piles.pot, new V3(3.3, 0, 1.35), true], [piles.sushi, new V3(16.6, 0, 0.75), state.gateOpen], [piles.riceballs, new V3(RICE.pickup.x, 0, RICE.pickup.z), state.gate3Open], [piles.hotpots, new V3(HEARTH.pickup.x, 0, HEARTH.pickup.z), state.gate4Open]];
  for (const [pile, at, ok] of pick) {
    if (ok && inTile(P, at) && pile.top() && player.canTake(pile.type)) { takeFrom(player, pile); player.cd = tune.pickup_interval; sfx.clack(state.streak++); state.streakT = 0.5; return; }
  }
  for (const c of counters) {
    if (!c.active) continue;
    if (top && top.type === c.dish && inTile(P, c.drop) && c.pile.items.length < c.pile.limit()) {
      giveTo(player, c.pile, top); player.cd = tune.pickup_interval; sfx.drop(state.streak++); state.streakT = 0.5;
      // serving by hand earns a tip that grows with your combo
      state.combo = nextCombo(state.combo, state.t - state.lastServe, tune.tip_window, tune.tip_combo_max); state.lastServe = state.t;
      const tip = tipFor(tune[c.priceKey], state.combo, tune.tip_rate);
      if (tip > 0) { state.wallet += tip; state.earned += tip; floats.push({ p: c.drop.clone().add(new V3(0, 1.6, 0)), txt: `tip +${tip}`, t: 0, col: '#9fe870' }); }
      return;
    }
    if (inTile(P, c.cashPos) && c.cash.top()) {
      const it = c.cash.take(c.cash.top()); const v = it.value + c.cash.extra; c.cash.extra = 0;
      fly(it, it.mesh.position, () => player.pos.clone().add(new V3(0, 1.1, 0)), 0.22, 1.2, () => { state.wallet += v; release(it); sfx.coin(state.coinStreak++); state.coinT = 0.6; });
      player.cd = 0.025; return;
    }
  }
}
function updateGolden(dt: number) {
  if (state.goldLeft > 0) {
    state.goldLeft -= dt;
    fx.gfT -= dt; if (fx.gfT <= 0) { fx.gfT = 0.5; particle('gfish', new V3(player.pos.x + rr(-8, 8), -0.4, rr(-20, -11)), new V3(rr(-1.5, 1.5), rr(4, 6), 0), 0.8); }
    if (state.goldLeft <= 0) { state.goldNext = state.playTime + rr(tune.golden_min, tune.golden_max); }
  } else if (state.playTime >= state.goldNext) { state.goldLeft = tune.golden_duration; sfx.golden(); buzz(60); events.push({ type: 'golden' }); }
  fx.streakMat.color.set(state.goldLeft > 0 ? '#ffe27a' : '#e8f8ff');
  for (const s of fx.streaks) { s.m.position.x += s.v * dt; if (s.m.position.x > 60) s.m.position.x = -40; }
}
/** Zone 4's blizzard: every few minutes once the great hearth is open, the water freezes for a while. */
function updateBlizzard(dt: number) {
  if (state.blizzardLeft > 0) {
    state.blizzardLeft -= dt;
    fx.snowT -= dt;
    if (fx.snowT <= 0) { fx.snowT = 0.03; particle('snow', new V3(fx.focus.x + rr(-14, 10), 9, fx.focus.z + rr(-12, 12)), new V3(2, -rr(2.5, 4), 0), 3.0, '#ffffff', 1); }
    fx.windT -= dt; if (fx.windT <= 0) { fx.windT = 0.9; sfx.wind(); }
    if (state.blizzardLeft <= 0) { state.blizzardLeft = 0; state.blizzardNext = state.playTime + rr(tune.blizzard_min, tune.blizzard_max); events.push({ type: 'blizzard_end' }); }
  } else if (state.gate4Open && state.playTime >= state.blizzardNext && scene === 'play' && !state.welcome) {
    state.blizzardLeft = tune.blizzard_duration; fx.snowT = 0; fx.windT = 0; buzz(80); events.push({ type: 'blizzard' });
    floats.push({ p: player.pos.clone().add(new V3(0, 3, 0)), txt: 'A blizzard! The river freezes', t: -0.8, col: '#e8f8ff' });
  }
  // look: the water ices over, the fog closes in
  const b = state.blizzardLeft > 0 ? 1 : 0;
  fx.ice += (b - fx.ice) * Math.min(1, dt * 2);
  mat('#3d9be0').color.set('#3d9be0').lerp(new THREE.Color('#d6ecf5'), fx.ice);
  for (const s of fx.streaks) s.m.visible = fx.ice < 0.5;
  const fog = scene3.fog as THREE.Fog; fog.near = 38 - fx.ice * 24; fog.far = 80 - fx.ice * 34;
  fog.color.set('#cdeaf3').lerp(new THREE.Color('#eef4f8'), fx.ice); (scene3.background as THREE.Color).copy(fog.color);
}
/** The quest board: when the current quest's target is reached, pay its reward and give the next. */
function updateQuests() {
  const q = QUESTS[state.quest];
  if (!q || !questDone(q, state)) return;
  state.wallet += q.reward; state.quest++; state.questFlash = 1.2;
  sfx.bell(); buzz(60); events.push({ type: 'quest', id: q.id });
  floats.push({ p: player.pos.clone().add(new V3(0, 2.6, 0)), txt: `Quest done! +${fmt(q.reward)}`, t: -0.6, col: '#ffe27a' });
  save();
}
const ZONE_NAMES = ['soup counter', 'grill yard', 'rice field', 'great hearth'];
/** A chest bursts onto a counter's cash pile: `total` coins in ten bundles. */
function chestBurst(c: Loose, from: Loose, total: number) {
  const n = 10, each = total / n;
  for (let i = 0; i < n; i++) {
    const cash = newItem('cash'); cash.value = each;
    if (c.cash.items.length < c.cash.limit()) { c.cash.items.push(cash); fly(cash, from, () => c.cash.slot(c.cash.items.indexOf(cash)), 0.6, 2.2, undefined, i * 0.05); }
    else { c.cash.extra += each; fly(cash, from, () => c.cashPos.clone(), 0.6, 2.2, () => release(cash), i * 0.05); }
  }
  state.earned += total; puffs(from, 10, '#ffe27a', 1.4);
  floats.push({ p: from.clone().add(new V3(0, 1, 0)), txt: `CHEST +${fmt(total)}`, t: -0.3, col: '#ffe27a' });
}
/** VIP orders: now and then a crowned customer steps up at an open counter, orders a lot, and pays a chest if served in time. */
function updateVip(dt: number) {
  if (!state.vip) {
    fx.crown.visible = false;
    if (state.done.includes('fisher1') && state.playTime >= state.vipNext && scene === 'play' && !state.welcome) {
      const open = counters.filter((c: Loose) => c.active), c = open[Math.floor(rng() * open.length)], s = c.slots[0];
      s.vip = true; s.want = tune.vip_count; s.phase = 'ready'; s.d = 0;
      state.vip = { ci: counters.indexOf(c), need: tune.vip_count, eaten: 0, t: tune.vip_time };
      sfx.golden(); buzz(60); events.push({ type: 'vip', zone: c.zone });
      floats.push({ p: player.pos.clone().add(new V3(0, 3, 0)), txt: `A VIP at the ${ZONE_NAMES[c.zone - 1]}!`, t: -0.8, col: '#ffe27a' });
    }
    return;
  }
  const v = state.vip, c = counters[v.ci], s = c.slots[0];
  v.t -= dt;
  const outcome = visitOutcome(v.eaten, v.need, v.t);
  if (outcome !== 'eating') {
    const head = c.base[0].p.clone(); head.y = c.bubY - 0.4;
    if (outcome === 'won') { chestBurst(c, head, vipReward(tune[c.priceKey], v.need, tune.vip_bonus)); sfx.bell(); sfx.cheer(); events.push({ type: 'vip_won' }); }
    else { s.want = 0; s.phase = 'out'; floats.push({ p: head.clone().add(new V3(0, 1, 0)), txt: 'The VIP leaves...', t: -0.6, col: '#ffc9b0' }); events.push({ type: 'vip_lost' }); }
    s.vip = false; state.vip = null; state.vipNext = state.playTime + rr(tune.vip_min, tune.vip_max);
    return;
  }
  // look: a gold crown floats over the VIP
  const b = c.base[0].p;
  fx.crown.visible = s.phase === 'ready'; fx.crown.position.set(b.x - c.face * s.d, c.bubY - 0.8 + Math.sin(state.t * 4) * 0.05, b.z + 0.35); fx.crown.rotation.y += dt * 2;
}
function updateCamera(dt: number) {
  let target = player.pos, k = tune.cam_lag;
  if (state.glide) { state.glide.t += dt; if (state.glide.t < tune.glide_time * 0.72) { target = state.glide.p; k = 5; } else { k = 7; if (state.glide.t > tune.glide_time) state.glide = null; } }
  fx.focus.x += (target.x - fx.focus.x) * Math.min(1, dt * k); fx.focus.z += (target.z - fx.focus.z) * Math.min(1, dt * k);
  placeCamera();
}
function placeCamera() {
  // a tall screen sees less across, so the camera pulls back a little in portrait
  const aspect = W / H, pull = aspect < 1 ? Math.min(tune.portrait_pull, 0.9 / Math.sqrt(aspect)) : 1;
  const p = tune.cam_pitch * PI / 180, d = tune.cam_distance * Math.max(1, pull), h = d * Math.cos(p);
  camera.fov = tune.cam_fov; camera.aspect = W / H; camera.updateProjectionMatrix();
  camera.position.set(fx.focus.x + h * Math.SQRT1_2, d * Math.sin(p), fx.focus.z + h * Math.SQRT1_2);
  camera.lookAt(fx.focus.x, 0.8, fx.focus.z);
}
function guideTarget() {
  const top = player.stack[0];
  const zone2 = player.pos.x > 7, zone3 = state.gate3Open && inZone3(player.pos.x, player.pos.z);
  if (top && (top.type === 'rice' || (top.type === 'fish' && zone3))) return processors[2].drop;
  if (top && top.type === 'riceball') return counters[2].drop;
  const zone4 = state.gate4Open && inZone4(player.pos.x, player.pos.z);
  if (top && (top.type === 'wood' || (top.type === 'fish' && zone4))) return processors[3].drop;
  if (top && top.type === 'hotpot') return counters[3].drop;
  if (top && top.type === 'fish') return zone2 && state.gateOpen ? processors[1].drop : processors[0].drop;
  if (top && top.type === 'bowl') return belt.on && !zone2 ? null : counters[0].drop;
  if (top && top.type === 'plate') return counters[1].drop;
  if (state.gate4Open && !state.goal4Done) {
    if (piles.hotpots.top()) return new V3(HEARTH.pickup.x, 0, HEARTH.pickup.z);
    if (state.fuel < tune.wood_burn && !piles.firewood.items.length && !spots[2].owner) return spots[2].tile;
    if (!piles.hearthFish.items.length && !spots[3].owner) return spots[3].tile;
  }
  if (state.gate3Open && !state.goal3Done) {
    if (piles.riceballs.top()) return new V3(RICE.pickup.x, 0, RICE.pickup.z);
    if (!piles.rice.items.length && !spots[0].owner) return spots[0].tile;
    if (!piles.riceFish.items.length && !spots[1].owner) return spots[1].tile;
  }
  if (state.gateOpen && !state.goalDone) {
    if (piles.sushi.top()) return new V3(16.6, 0, 0.75);
    if (!rods[3].owner) return rods[3].tile;
  }
  for (const t of tiles) if (tileVisible(t) && t.hideT < 0 && state.wallet >= tilePrice(t) - t.paid) return new V3(t.def.x, 0, t.def.z);
  let best = null, bd = 1e9;
  for (const c of counters) if (c.active && c.cash.items.length) { const d = c.cashPos.distanceTo(P0(player.pos)); if (d < bd) { bd = d; best = c.cashPos; } }
  if (best) return best;
  if (!belt.on && piles.pot.items.length) return new V3(3.3, 0, 1.35);
  for (const r of rods) if (r.active && !r.owner && r.i < 3) return r.tile;
  return null;
}
const P0 = (p: Loose) => new V3(p.x, 0, p.z);
function updateGuide(dt: number) {
  const show = (state.playTime < tune.guide_time || (state.gateOpen && !state.goalDone) || (state.gate3Open && !state.goal3Done) || (state.gate4Open && !state.goal4Done)) && scene === 'play' && !state.welcome;
  const tgt = show ? guideTarget() : null;
  const near = tgt && Math.hypot(tgt.x - player.pos.x, tgt.z - player.pos.z) < 1.0;
  fx.arrow.visible = !!tgt && !near; fx.marker.visible = !!tgt;
  if (tgt) {
    const dx = tgt.x - player.pos.x, dz = tgt.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
    fx.arrow.position.set(player.pos.x + dx / d * 1.1, 0.06, player.pos.z + dz / d * 1.1);
    fx.arrow.rotation.set(-PI / 2, Math.atan2(-dx, -dz), 0);
    const sc = 1 + Math.sin(state.t * 8) * 0.08; fx.arrow.scale.set(sc, sc, sc);
    fx.marker.position.set(tgt.x, 2.0 + Math.abs(Math.sin(state.t * 4)) * 0.4, tgt.z); fx.marker.rotation.y += dt * 3;
  }
}

// ---- Save, offline income ------------------------------------------------------------------
const SAVE_KEY = 'fishing-camp-save-v1';
function save() {
  try {
    const paid: Record<string, number> = {}; for (const t of tiles) if (!t.done && t.paid) paid[t.def.id] = t.paid;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ wallet: state.wallet, done: state.done, paid, at: Date.now(), rate: state.autoRate,
      playTime: state.playTime, goalDone: state.goalDone, goal3Done: state.goal3Done, goal4Done: state.goal4Done, fuel: state.fuel, levels: state.levels, quest: state.quest, sold: state.sold, earned: state.earned, goldNext: state.goldNext }));
  } catch (_) {}
}
function load() {
  if (params.get('fresh') === '1') return;
  let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) {}
  if (!s) return;
  state.wallet = s.wallet | 0; state.playTime = s.playTime || 0; state.goalDone = !!s.goalDone; state.earned = s.earned || 0; state.autoRate = s.rate || 0;
  state.goldNext = s.goldNext || state.goldNext; state.goal3Done = !!s.goal3Done; state.goal4Done = !!s.goal4Done; state.fuel = typeof s.fuel === 'number' ? s.fuel : tune.fuel_start;
  state.generalNext = Math.max(tune.general_first, state.playTime + tune.general_min);
  for (const u of UNLOCKS) if (!u.levels && (s.done || []).includes(u.id)) unlock(tiles.find((t: Loose) => t.def.id === u.id), true);
  for (const u of UNLOCKS) if (u.levels && (s.done || []).includes(u.id) && !state.done.includes(u.id)) state.done.push(u.id);
  state.levels = { ...(s.levels || {}) }; state.sold = { ...(s.sold || {}) }; state.quest = s.quest | 0;
  for (const t of tiles) if (t.def.levels && lv(t.def.id) >= tune.upgrade_max) { t.done = true; t.mesh.visible = false; }
  for (const t of tiles) if (s.paid && s.paid[t.def.id]) t.paid = s.paid[t.def.id];
  const { away, earned } = offlineEarnings(state.autoRate, (Date.now() - (s.at || Date.now())) / 1000, tune.offline_cap, tune.offline_factor);
  if (earned > 0 && away > 30) state.welcome = { earned, away };
}
addEventListener('pagehide', () => { if (state) save(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && state) save(); });

// ---- Scenes ----------------------------------------------------------------------------------
function reset() {
  setSeed(seedFrom(SEED));
  while (scene3.children.length) scene3.remove(scene3.children[0]);
  tweens = []; pops = []; floats = []; for (const k in pools) pools[k].length = 0;
  state = { t: 0, score: 0, gained: '', wallet: 0, walletShown: 0, done: [], carry: 0, speedUp: false, fishSpeed: false, horse: false, pot2: false, gateOpen: false, gateAnim: 0,
    goalDone: false, goalTimer: -1, glide: null, playTime: 0, goldLeft: 0, goldNext: tune.golden_first, generalNext: tune.general_first, general: null, earned: 0, autoRate: 0, autoWin: 0, autoT: 0,
    streak: 0, streakT: 0, coinStreak: 0, coinT: 0, payStreak: 0, payT: 0, welcome: null,
    gate3Open: false, gate3Anim: 0, goal3Done: false, resultLine: '',
    gate4Open: false, gate4Anim: 0, goal4Done: false, fuel: 0, blizzardLeft: 0, blizzardNext: 1e9, levels: {}, quest: 0, questFlash: 0, sold: {}, combo: 0, lastServe: -99, vip: null, vipNext: tune.vip_first }; // 1e9 s: no blizzard until the great hearth opens
  world = new THREE.Group(); scene3.add(world);
  scene3.background = new THREE.Color('#cdeaf3'); scene3.fog = new THREE.Fog('#cdeaf3', 38, 80);
  const hemi = new THREE.HemisphereLight('#fff3dc', '#7a6aa8', 1.9); scene3.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b4', 2.2); sun.position.set(-8, 20, 10); scene3.add(sun);
  fx = { pool: [], dummy: new THREE.Object3D(), focus: new V3(-2, 0, -4.5), gfT: 0, ice: 0, snowT: 0, windT: 0 };
  buildEnvironment(); buildRods(); buildKitchen(); buildRiceField(); buildHearth(); buildCounters(); buildBelt(); buildTiles(); buildWorkersAndPlayer();
  fx.crown = new THREE.Group(); fx.crown.visible = false; fx.crown.scale.setScalar(1.4); world.add(fx.crown);
  add(fx.crown, new THREE.CylinderGeometry(0.3, 0.26, 0.16, 10), '#e1b23a', 0, 0, 0);
  for (let k = 0; k < 5; k++) { const a = k / 5 * 2 * PI; add(fx.crown, G.cone4, '#ffd34d', Math.cos(a) * 0.24, 0.16, Math.sin(a) * 0.24, 0, 0, 0, 0.12, 0.2, 0.12); }
  add(fx.crown, G.sph, '#c8302a', 0, 0.02, 0.28, 0, 0, 0, 0.1);
  fx.general = makeChar('general'); fx.general.group.scale.setScalar(1.35); fx.general.group.visible = false; world.add(fx.general.group); blob(fx.general.group, 0.6);
  fx.generalTex = canvasTex(160, 128, () => {}); fx.generalShown = -1;
  fx.generalBub = new THREE.Sprite(new THREE.SpriteMaterial({ map: fx.generalTex.t, depthTest: false, fog: false })); fx.generalBub.scale.set(1.9, 1.5, 1); fx.generalBub.renderOrder = 5; fx.generalBub.visible = false; world.add(fx.generalBub);
  fx.obstacles = () => {
    const o = [[0, -2, 1.1], [-1.45, -2, 0.5], [2.3, -2, 0.85], [3.3, 0, 0.8]];
    if (state.pot2) o.push([4.3, -2, 0.85], [5.45, -2, 0.5]);
    if (state.gateOpen) o.push([14.2, -2.4, 1.1], [12.9, -2.4, 0.5], [16.6, -0.6, 0.8]);
    if (state.gate3Open) o.push([9.4, 9.7, 1.0], [13.8, 14, 1.1], [12.4, 14, 0.5], [13.8, 16.3, 0.8], [19.15, 10.7, 1.6], [19.0, 17.6, 1.9]);
    if (state.gate4Open) o.push([14, 26.5, 1.6], [12.4, 26.5, 0.5], [13.8, 29.4, 0.8], [19.4, 23.0, 1.3], [19.2, 29.6, 1.0]);
    return o;
  };
  const arrowShape = new THREE.Shape([[0, 0.62], [0.48, 0.05], [0.18, 0.05], [0.18, -0.5], [-0.18, -0.5], [-0.18, 0.05], [-0.48, 0.05]].map((p: Loose) => new THREE.Vector2(p[0], p[1])));
  fx.arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.95, depthWrite: false }));
  fx.arrow.rotation.order = 'YXZ'; fx.arrow.renderOrder = 3; world.add(fx.arrow);
  fx.marker = new THREE.Group(); world.add(fx.marker);
  add(fx.marker, G.cone4, '#ffd34d', 0, 0, 0, PI, 0, 0, 0.5, 0.6, 0.5); add(fx.marker, G.box, '#ffd34d', 0, 0.5, 0, 0, 0, 0, 0.2, 0.5, 0.2);
  load();
  fx.focus.copy(P0(player.pos)); placeCamera();
  updateCarrier(player, 0); updateCrowds(); updateRods(0);
}
function tick3D(dt: number) { // the camp keeps running under every overlay
  state.t += dt;
  updatePlayer(dt); updateWorkers(dt); updateRods(dt); updateSpots(dt); updateHearth(dt); updateBlizzard(dt); updateQuests();
  updateCarrier(player, dt); for (const w of workers) updateCarrier(w, dt);
  updateProcessors(dt); updateBelt(dt); updateCounters(dt); updateCrowds();
  if (state.pot2) animChar(fx.potboy, 0, dt, 'stir');
  updateGeneral(dt); updateVip(dt); updateLanterns(); if (state.questFlash > 0) state.questFlash -= dt;
  updateTiles(dt); updateTweens(dt); updatePops(dt); updateParticles(dt); updateGolden(dt); updateGuide(dt); updateCamera(dt);
  // gate swings open
  if (state.gateOpen && state.gateAnim < 1) state.gateAnim = Math.min(1, state.gateAnim + dt * 1.5);
  for (const d of fx.doors) d.hinge.rotation.y = -d.s * state.gateAnim * 1.7; // doors swing out into the grill yard, clear of the pots
  fx.lock.visible = !state.gateOpen; fx.cover.material.opacity = 0.42 * (1 - state.gateAnim); fx.cover.visible = state.gateAnim < 1;
  // the rice field's barrier lifts
  if (state.gate3Open && state.gate3Anim < 1) state.gate3Anim = Math.min(1, state.gate3Anim + dt * 1.5);
  fx.bar.rotation.z = state.gate3Anim * 1.35; fx.lock3.visible = !state.gate3Open;
  fx.cover3.material.opacity = 0.42 * (1 - state.gate3Anim); fx.cover3.visible = state.gate3Anim < 1;
  if (state.gate4Open && state.gate4Anim < 1) state.gate4Anim = Math.min(1, state.gate4Anim + dt * 1.5);
  fx.bar4.rotation.z = state.gate4Anim * 1.35; fx.lock4.visible = !state.gate4Open;
  fx.cover4.material.opacity = 0.42 * (1 - state.gate4Anim); fx.cover4.visible = state.gate4Anim < 1;
  // steam over working pots
  fx.steamT = (fx.steamT || 0) - dt;
  if (fx.steamT <= 0) { fx.steamT = 0.35; // steam only over a pot that is cooking
    for (const pr of processors) { const pots = pr.pots(); pr.slots.forEach((sl: Loose, i: Loose) => { if (sl.phase === 'cook' && sl.cur && pots[i])
      particle('puff', pots[i].clone().add(new V3(rr(-0.2, 0.2), 0, 0)), new V3(0, 1.2, 0), 1.0, pr.name === 'grill' || pr.name === 'hearth' ? '#d8d4cf' : '#ffffff', 0.7); }); } }
  state.coinT -= dt; if (state.coinT <= 0) state.coinStreak = 0;
  for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; floats[i].p.y += dt * 1.2; if (floats[i].t > 0.9) floats.splice(i, 1); }
  // measured automated income, for offline earnings
  state.autoT += dt; if (state.autoT >= 10) { const r = state.autoWin / state.autoT; state.autoRate = state.autoRate ? state.autoRate * 0.6 + r * 0.4 : r; state.autoWin = 0; state.autoT = 0; }
  state.walletShown += (state.wallet - state.walletShown) * Math.min(1, dt * 12); if (Math.abs(state.wallet - state.walletShown) < 0.5) state.walletShown = state.wallet;
  state.score = state.wallet;
}
function collectWelcome() {
  const w = state.welcome; state.welcome = null; state.wallet += w.earned; sfx.bell(); buzz(60);
  for (let i = 0; i < 14; i++) { const it = newItem('cash'); const from = player.pos.clone().add(new V3(rr(-3, 3), 6, rr(-3, 3)));
    fly(it, from, () => player.pos.clone().add(new V3(0, 1.1, 0)), 0.5, 0.5, () => { release(it); sfx.coin(i); }, i * 0.04); }
  save();
}
let figs: Loose = null;
function buildFigures() {
  const s = new THREE.Scene(); s.background = new THREE.Color('#cdeaf3');
  s.add(new THREE.HemisphereLight('#fff3dc', '#7a6aa8', 1.9)); const sun = new THREE.DirectionalLight('#ffe2b4', 2.2); sun.position.set(-4, 10, 8); s.add(sun);
  const g = new THREE.Group(); s.add(g);
  add(g, G.box, '#e8964a', 0, -0.15, -1.4, 0, 0, 0, 27, 0.3, 11.5); // three rows: customers behind, workers, items in front
  const list: Loose[] = [];
  const chars = [['player', 'You'], ['fisher', 'Fisher'], ['chef', 'Soup chef'], ['potboy', 'Pot-boy'], ['grillchef', 'Grill chef'], ['ricecook', 'Rice cook'], ['farmer', 'Farmer'], ['carrier', 'Carrier'], ['hearthcook', 'Hearth cook'], ['woodcutter', 'Woodcutter'], ['cashier', 'Cashier']];
  { const m = new THREE.Mesh(HORSE_GEO, VMAT); m.position.set(9.2, 0, -6.0); m.rotation.y = 0.9; g.add(m); blob(m, 0.9); list.push(['Your horse', m.position.clone().add(new V3(0, 2.4, -0.6))]); }
  chars.forEach(([r, name], i) => { const c = makeChar(r); c.group.position.set(-12 + i * 2.2, 0, 0); c.group.rotation.y = 0.35; g.add(c.group); blob(c.group, 0.5); list.push([name, c.group.position.clone().add(new V3(0, 3.0, -0.6))]); });
  ([['Soldier', 0], ['Gold soldier', 1]] as [string, number][]).forEach(([name, gold], i) => { const m = new THREE.Mesh(SOLDIER_GEO[gold], VMAT); m.position.set(-6.6 + i * 3.0, 0, -6.0); m.rotation.y = 0.35; g.add(m); blob(m, 0.5); list.push([name, m.position.clone().add(new V3(0, 3.3, -0.6))]); });
  { const c = makeChar('general'); c.group.scale.setScalar(1.35); c.group.position.set(-0.6, 0, -6.0); c.group.rotation.y = 0.35; g.add(c.group); blob(c.group, 0.6); list.push(['General', c.group.position.clone().add(new V3(0, 3.6, -0.6))]); }
  { const m = new THREE.Mesh(GENERALS_GEO, VMAT); m.position.set(2.4, 0, -6.0); m.rotation.y = 0.35; g.add(m); blob(m, 0.5); list.push(['Generals', m.position.clone().add(new V3(0, 2.9, -0.6))]); }
  { const m = new THREE.Mesh(CAVALRY_GEO, VMAT); m.position.set(5.8, 0, -6.0); m.rotation.y = 0.9; g.add(m); blob(m, 0.9); list.push(['Cavalry', m.position.clone().add(new V3(0, 4.0, -0.6))]); }
  [['Tuna', 'fish', 0], ['Gold tuna', 'fish', 1], ['Soup bowl', 'bowl', 0], ['Sushi plate', 'plate', 0], ['Rice sack', 'rice', 0], ['Rice balls', 'riceball', 0], ['Firewood', 'wood', 0], ['Hot pot', 'hotpot', 0], ['Cash bundle', 'cash', 0]].forEach(([name, t, gold], i) => {
    const m = new THREE.Mesh(ITEM_GEO[t][gold], VMAT); m.position.set(-9.0 + i * 2.25, 0.02, 2.9); m.scale.setScalar(1.6); m.rotation.y = 0.5; g.add(m); list.push([name, m.position.clone()]); });
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.5, 100); cam.position.set(0, 16, 27); cam.lookAt(0, 1.0, -1.4);
  figs = { s, cam, list };
}
function project(p: Loose, cam: Loose = camera) { const v = p.clone().project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; }

function drawHud() {
  // cash total, top-left
  ctx.fillStyle = 'rgba(48,28,18,0.72)'; const sy = SAFE_TOP(); rrect(ctx, 18, 16 + sy, 236, 58, 29); ctx.fill();
  drawCoin(ctx, 48, 45 + sy, 19); text(fmt(Math.round(state.walletShown)), 80, 46 + sy, 34, '#ffffff', 'left');
  // combo badge beside the coins while your hand-delivery streak is alive
  if (state.combo > 1 && state.t - state.lastServe <= tune.tip_window) {
    const left = 1 - (state.t - state.lastServe) / tune.tip_window;
    ctx.fillStyle = 'rgba(60,110,30,0.85)'; rrect(ctx, 262, 22 + sy, 118, 46, 23); ctx.fill();
    ctx.fillStyle = '#9fe870'; ctx.fillRect(276, 58 + sy, 90 * left, 4);
    text(`COMBO x${state.combo}`, 321, 42 + sy, 18, '#ffffff');
  }
  // the quest board: the current goal, how far along, and its reward
  const q = QUESTS[state.quest];
  if (q) {
    const qw = Math.min(380, W - 36), qy = 84 + sy, fl = Math.max(0, state.questFlash || 0);
    ctx.fillStyle = fl > 0 ? `rgba(120,90,10,${0.72 + fl * 0.2})` : 'rgba(48,28,18,0.72)'; rrect(ctx, 18, qy, qw, 52, 16); ctx.fill();
    ctx.fillStyle = '#e9d7a8'; ctx.fillRect(30, qy + 12, 22, 28); ctx.fillStyle = '#b07440'; ctx.fillRect(28, qy + 10, 26, 5); ctx.fillRect(28, qy + 37, 26, 5); // a scroll
    ctx.fillStyle = '#6b4220'; for (let i = 0; i < 3; i++) ctx.fillRect(34, qy + 19 + i * 6, 14, 2);
    const p = questProgress(q, state), prog = q.kind === 'unlock' ? '' : `  ${fmt(p)}/${fmt(q.target)}`;
    text(q.text + prog, 64, qy + 18, 18, '#ffffff', 'left');
    drawCoin(ctx, 72, qy + 38, 8); text('+' + fmt(q.reward), 86, qy + 39, 16, '#ffe27a', 'left');
    const bw = qw - 150; ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(140, qy + 34, bw, 8); ctx.fillStyle = '#6cc35a'; ctx.fillRect(140, qy + 34, bw * (p / q.target), 8);
  }
  // settings button, top-right
  ctx.save(); ctx.translate(GEAR.x, GEAR.y);
  ctx.fillStyle = 'rgba(48,28,18,0.72)'; ctx.beginPath(); ctx.arc(0, 0, GEAR.r + 6, 0, 2 * PI); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * PI, r = i % 2 ? 14 : 19; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(48,28,18,1)'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2 * PI); ctx.fill(); ctx.restore();
  // money rising where it was made
  for (const f of floats) { const [x, y, z] = project(f.p); if (z < 1) { ctx.globalAlpha = 1 - f.t / 0.9; text(f.txt, x, y, 22, f.col); ctx.globalAlpha = 1; } }
  // golden school banner
  if (state.goldLeft > 0) {
    const w = Math.min(460, W - 32), gy = H > W ? 150 + SAFE_TOP() : 18; ctx.fillStyle = 'rgba(120,70,0,0.8)'; rrect(ctx, W / 2 - w / 2, gy, w, 54, 27); ctx.fill();
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.stroke();
    text(`GOLDEN SCHOOL   x${tune.golden_mult}   ${Math.ceil(state.goldLeft)}s`, W / 2, gy + 28, 28, '#ffe27a');
  }
  // blizzard banner (under the golden one when both show)
  if (state.blizzardLeft > 0) {
    const w = Math.min(560, W - 32), base = H > W ? 150 + SAFE_TOP() : 18, gy = base + (state.goldLeft > 0 ? 64 : 0), out = state.fuel <= 0;
    ctx.fillStyle = out ? 'rgba(120,24,24,0.85)' : 'rgba(30,60,90,0.85)'; rrect(ctx, W / 2 - w / 2, gy, w, 54, 27); ctx.fill();
    ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 3; ctx.stroke();
    text(out ? `BLIZZARD   fire out: customers pay half   ${Math.ceil(state.blizzardLeft)}s` : `BLIZZARD   keep the fire lit   ${Math.ceil(state.blizzardLeft)}s`, W / 2, gy + 28, 26, '#ffffff');
  }
  // VIP order banner, below the others that are showing
  if (state.vip) {
    const v = state.vip, w = Math.min(520, W - 32), base = H > W ? 150 + SAFE_TOP() : 18;
    const gy = base + (state.goldLeft > 0 ? 64 : 0) + (state.blizzardLeft > 0 ? 64 : 0) + (state.general && state.general.phase === 'eat' ? 64 : 0);
    ctx.fillStyle = 'rgba(90,60,10,0.88)'; rrect(ctx, W / 2 - w / 2, gy, w, 54, 27); ctx.fill();
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.stroke();
    text(`VIP ORDER   ${ZONE_NAMES[counters[v.ci].zone - 1]}   ${v.eaten}/${v.need}   ${Math.ceil(v.t)}s`, W / 2, gy + 28, 24, '#ffe9c4');
  }
  // general's visit banner
  if (state.general && state.general.phase === 'eat') {
    const g = state.general, w = Math.min(520, W - 32), base = H > W ? 150 + SAFE_TOP() : 18, gy = base + (state.goldLeft > 0 ? 64 : 0) + (state.blizzardLeft > 0 ? 64 : 0);
    ctx.fillStyle = 'rgba(110,20,20,0.85)'; rrect(ctx, W / 2 - w / 2, gy, w, 54, 27); ctx.fill();
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.stroke();
    text(`GENERAL'S VISIT   ${g.eaten}/${tune.general_bowls}   ${Math.ceil(g.t)}s`, W / 2, gy + 28, 28, '#ffe9c4');
  }
  // floating joystick
  if (joy.active) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(joy.x0, joy.y0, JOY_R, 0, 2 * PI); ctx.stroke();
    const dx = joy.x - joy.x0, dy = joy.y - joy.y0, d = Math.hypot(dx, dy), m = Math.min(1, JOY_R / (d || 1));
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(joy.x0 + dx * Math.min(1, m), joy.y0 + dy * Math.min(1, m), 26, 0, 2 * PI); ctx.fill();
  }
  if (state.welcome) {
    panel(560, 250);
    text('Welcome back!', W / 2, H / 2 - 70, 44, '#ffe27a');
    const m = Math.floor(state.welcome.away / 60), h = Math.floor(m / 60);
    text(`Your camp cooked while you were away (${h ? h + 'h ' : ''}${m % 60}m)`, W / 2, H / 2 - 18, 22, '#ffffff');
    drawCoin(ctx, W / 2 - 80, H / 2 + 32, 20); text(fmt(state.welcome.earned), W / 2 - 50, H / 2 + 33, 40, '#ffffff', 'left');
    text(TOUCH ? 'Tap or move to collect' : 'Press any key or click to collect', W / 2, H / 2 + 88, 24, '#cfe9ff');
  }
}
function panel(w: number, h: number) { w = Math.min(w, W - 24); ctx.fillStyle = 'rgba(48,28,18,0.86)'; rrect(ctx, W / 2 - w / 2, H / 2 - h / 2, w, h, 26); ctx.fill(); ctx.strokeStyle = '#ffe9c4'; ctx.lineWidth = 4; ctx.stroke(); }

const scenes: Record<string, Loose> = {
  figures: {
    update(dt: number) { state.t += dt; },
    draw() {
      if (!figs) buildFigures();
      figs.cam.aspect = W / H; figs.cam.updateProjectionMatrix(); renderer.render(figs.s, figs.cam); clearHud();
      text('Fishing Camp: figures', W / 2, 40, 30, '#ffffff');
      for (const [name, p] of figs.list) { const [x, y] = project(p.clone().add(new V3(0, -0.35, 0.6)), figs.cam); text(name, x, y + 14, 15, '#ffffff'); }
    },
  },
  title: {
    update(dt: number) {
      fx.focus.x = -2 + Math.sin(state.t * 0.15) * 3; state.t += dt; updateCrowds(); updateParticles(dt);
      for (const s of fx.streaks) { s.m.position.x += s.v * dt; if (s.m.position.x > 60) s.m.position.x = -40; }
      placeCamera();
      if (pressed('Enter') || pressed('Space') || tapped) {
        if (tapped && TOUCH) { try { const el = document.documentElement as Loose; const p = (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); if (p && p.catch) p.catch(() => {}); } catch (_) {} } // Android: play fullscreen; a refusal is fine
        scene = 'play'; tapped = null; }
    },
    draw() {
      renderer.render(scene3, camera); clearHud();
      const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(30,18,10,0.15)'); gr.addColorStop(0.5, 'rgba(30,18,10,0.6)'); gr.addColorStop(1, 'rgba(30,18,10,0.15)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      text(TITLE, W / 2, H / 3 - 10, 84, '#ffe9a8');
      if (W >= 900) text('Catch. Cook. Feed the army. Hire your way out of every job.', W / 2, H / 3 + 56, 24, '#ffffff');
      else { text('Catch. Cook. Feed the army.', W / 2, H / 3 + 50, 24, '#ffffff'); text('Hire your way out of every job.', W / 2, H / 3 + 82, 24, '#ffffff'); }
      CONTROLS.forEach((c: Loose, i: Loose) => text(c, W / 2, H / 2 + 50 + i * 36, 24, '#e8f4ff'));
      text(TOUCH ? 'Tap to start' : 'Press Enter or tap to start', W / 2, H - 60, 30, '#ffffff');
    },
  },
  play: {
    update(dt: number) {
      if (pressed('KeyP') || pressed('Escape') || (tapped && onGear(tapped.x, tapped.y))) { scene = 'pause'; tapped = null; joy.active = false; return; }
      // the welcome-back popup never blocks: any key, click or drag collects it and play goes on
      const moveKey = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k: Loose) => down.has(k));
      if (state.welcome && (pressed('Enter') || pressed('Space') || tapped || moveKey || joy.active)) collectWelcome();
      tapped = null;
      state.playTime += dt;
      tick3D(dt);
      if (state.goalTimer > 0) { state.goalTimer -= dt; if (state.goalTimer <= 0) { scene = 'results'; joy.active = false; } }
    },
    draw() { renderer.render(scene3, camera); clearHud(); drawHud(); },
  },
  pause: {
    update() {
      if (pressed('KeyP') || pressed('Escape') || (tapped && onGear(tapped.x, tapped.y))) scene = 'play';
      else if (pressed('KeyR')) { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} reset(); scene = 'title'; }
      tapped = null;
    },
    draw() {
      scenes.play.draw(); ctx.fillStyle = 'rgba(20,12,8,0.45)'; ctx.fillRect(0, 0, W, H); panel(560, 300);
      text('Paused', W / 2, H / 2 - 100, 48, '#ffe9a8');
      text('P or the gear: resume', W / 2, H / 2 - 30, 26, '#ffffff');
      text(`M: sound ${muted ? 'off' : 'on'}`, W / 2, H / 2 + 14, 26, '#ffffff');
      text('R: reset the camp (erases the save)', W / 2, H / 2 + 58, 24, '#ffc9b0');
      text('Progress saves after every unlock', W / 2, H / 2 + 108, 20, '#cfe9ff');
    },
  },
  results: {
    update(dt: number) {
      tick3D(dt);
      if (pressed('Enter') || pressed('Space') || tapped) { scene = 'play'; }
      tapped = null;
    },
    draw() {
      renderer.render(scene3, camera); clearHud(); drawHud(); panel(600, 330);
      text(state.gained || 'The camp is running!', W / 2, H / 2 - 110, 46, '#ffe27a');
      text(state.resultLine || 'Grill yard open, first sushi sold', W / 2, H / 2 - 56, 24, '#ffffff');
      const m = Math.floor(state.playTime / 60), s = Math.floor(state.playTime % 60);
      text(`Time  ${m}:${String(s).padStart(2, '0')}`, W / 2, H / 2 - 8, 26, '#ffffff');
      text(`Unlocks  ${state.done.length} of ${UNLOCKS.length}`, W / 2, H / 2 + 32, 26, '#ffffff');
      text(`Coins earned  ${fmt(state.earned)}`, W / 2, H / 2 + 72, 26, '#ffffff');
      text('Enter or tap: keep playing', W / 2, H / 2 + 128, 26, '#cfe9ff');
    },
  },
};

// ---- Loop: fixed step, frame time clamped ---------------------------------------------
/** Which zone's music plays: the zone the player stands in (0 dock, 1 grill yard, 2 rice field). */
function musicZone(): number {
  if (!state || !player) return 0;
  if (state.gate4Open && inZone4(player.pos.x, player.pos.z)) return 3;
  if (state.gate3Open && inZone3(player.pos.x, player.pos.z)) return 2;
  return state.gateOpen && player.pos.x > 7 ? 1 : 0;
}
function step() {
  if (pressed('KeyM')) { setMuted(!muted); hit.delete('KeyM'); }
  if (scene !== 'figures') musicTick(musicZone());
  scenes[scene].update(STEP); hit.clear();
}
let last = 0, acc = 0, ALPHA = 1; // ALPHA: how far the frame is between the last two steps
function tick() {
  const now = clock.now();
  acc += Math.min(now - last, 0.25); last = now; // a stall never fast-forwards the game
  while (acc >= STEP) { step(); acc -= STEP; }
  ALPHA = acc / STEP;
  drawFrame();
}
function drawFrame() { scenes[scene].draw(); }
function frame() { tick(); requestAnimationFrame(frame); }
// A headless browser on a time budget runs timers but almost no animation frames: a timer
// ticks when no frame has come for 100 ms on a visible page; a hidden tab stays paused.
function timer() { if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick(); }

// ---- What a check can read and drive (?manual=1 stops the loop; players never see it) ----
install({
  get scene() { return scene; },
  get state() { return state; },
  press(code) { hit.add(code); },
  hold(code, on) { on ? down.add(code) : down.delete(code); },
  get events() { return events; }, // the loop steps; a check empties it
  step(n = 1, draw = true, alpha = 1) {
    for (let i = 0; i < n; i++) step();
    if (draw) { ALPHA = alpha; drawFrame(); }
  },
});

reset();
scene = params.get('scene') || 'title';
last = clock.now();
if (manual) drawFrame();
else { requestAnimationFrame(frame); setInterval(timer, 50); }
