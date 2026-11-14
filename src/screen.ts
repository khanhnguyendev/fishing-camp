// The screen: a 3D world canvas under a 2D HUD canvas, both filling the window. The HUD is drawn
// in logical units (W x H) whose short side is 720, or 540 on touch screens.
import * as THREE from 'three';
import { params } from './hook';

/** A headless shot or check: 3D draws cheap. Players never see it. */
export const CHEAP = params.get('render') === 'cheap';
/** Logical size of the HUD layer; fit() sets it from the window. */
export let W = 1280, H = 720;
/** The HUD's typeface. */
export const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
export const canvas = document.getElementById('game') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
export const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
export const renderer = new THREE.WebGLRenderer({ canvas: worldCanvas, antialias: !CHEAP });
renderer.setPixelRatio(CHEAP ? 0.5 : Math.min(2, devicePixelRatio || 1));
export let viewScale = 1;
// The view fills the window in any orientation. The HUD is laid out in logical units whose short
// side is 720 (540 on touch screens, so phone text and buttons stay big enough to read and hit).
export const TOUCH = matchMedia('(pointer: coarse)').matches;
export function fit(): void {
  const base = TOUCH ? 540 : 720, k = Math.min(innerWidth, innerHeight) / base; viewScale = k;
  W = Math.round(innerWidth / k); H = Math.round(innerHeight / k);
  const r = k * (devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * (devicePixelRatio || 1)); canvas.height = Math.round(innerHeight * (devicePixelRatio || 1));
  for (const el of [canvas, worldCanvas]) { el.style.width = innerWidth + 'px'; el.style.height = innerHeight + 'px'; el.style.left = '0px'; el.style.top = '0px'; }
  renderer.setSize(innerWidth, innerHeight, false);
  ctx.setTransform(r, 0, 0, r, 0, 0);
  GEAR.x = W - 48; GEAR.y = 44 + SAFE_TOP();
}
export const JOY_R = TOUCH ? 70 : 60; // joystick reach in HUD units
export const SAFE_TOP = (): number => (H > W ? 22 : 0); // a little room under a phone's notch in portrait
export const GEAR = { x: W - 48, y: 44, r: 26 };
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 120)); fit();
export function clearHud(): void { ctx.clearRect(0, 0, W, H); }
export function text(s: string, x: number, y: number, size: number, c: string, align: CanvasTextAlign = 'center', stroke = true): void {
  ctx.font = `bold ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = 'rgba(48,28,18,0.9)'; ctx.strokeText(s, x, y, W - 32); }
  ctx.fillStyle = c; ctx.fillText(s, x, y, W - 32); // squeezed to fit a narrow screen
}
export function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
