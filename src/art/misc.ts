// Heroes, projectiles, pop/explosion bursts, range rings and UI textures.
import { type Ctx, INK, ball, bar, ell, fs, glossy, inkStroke, lin, mix, poly, rr, shine, star } from './draw';
import { type Hat, mk, monkey } from './towers';

export const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ---------------- heroes (96x96) ----------------
type HeroProp = 'bow' | 'flame' | 'cannon' | 'staff' | 'sword' | 'orb' | 'laptop' | 'skull' | 'sun' | 'drone' | 'book' | 'wrench' | 'bag' | 'ice' | 'gun';
const HEROES: Record<string, [string, string, string, Hat, string, HeroProp]> = {
  // id: [fur, outfit, accent, hat, hatColour, prop]
  quincy: ['#b9722f', '#2f6fe0', '#ffd23c', 'cap', '#2f6fe0', 'bow'],
  gwendolin: ['#c88a4a', '#f06a22', '#ffd23c', 'band', '#ff4a22', 'flame'],
  striker_jones: ['#a8793a', '#5a6a3a', '#ffb02e', 'helmet', '#4d5a3c', 'cannon'],
  obyn_greenfoot: ['#9a6a3a', '#3f9a3a', '#c8e060', 'leaf', '#4fc94f', 'staff'],
  captain_churchill: ['#a8793a', '#6a5a3a', '#ffd23c', 'helmet', '#8a6a2a', 'cannon'],
  benjamin: ['#c89a6a', '#32344a', '#6bff7c', 'goggles', '#32344a', 'laptop'],
  ezili: ['#8a5a3a', '#7a2aa0', '#ff4a8a', 'wiz', '#5a1a80', 'skull'],
  pat_fusty: ['#7a5a3a', '#e84545', '#ffd23c', 'crown', '#fff', 'gun'],
  adora: ['#e8b86a', '#ffd23c', '#ff8a22', 'crown', '#fff', 'sun'],
  admiral_brickell: ['#b9722f', '#1f4a8a', '#ffd23c', 'pirate', '#1f3a6a', 'sword'],
  etienne: ['#a8793a', '#2f9a8a', '#ffe04a', 'hard', '#2f9a8a', 'drone'],
  sauda: ['#a8793a', '#3a3a46', '#ff4a4a', 'band', '#d93a3a', 'sword'],
  psi: ['#d8b8f0', '#7a4fd6', '#ffffff', 'none', '#fff', 'orb'],
  geraldo: ['#b9722f', '#c46a2a', '#ffd23c', 'safari', '#8a5a2a', 'bag'],
  corvus: ['#7a6a8a', '#24263a', '#a58bff', 'wiz', '#24263a', 'book'],
  rosalia: ['#b9722f', '#d84a8a', '#ffe04a', 'goggles', '#d84a8a', 'gun'],
  silas: ['#a8c8e8', '#3a8ae0', '#ffffff', 'wiz', '#3a8ae0', 'ice'],
  dan_d_monke: ['#b9722f', '#5a5a6a', '#ff4a4a', 'cap', '#3a3a46', 'wrench'],
};
export const HERO_IDS = Object.keys(HEROES);

function heroProp(c: Ctx, p: HeroProp, acc: string): void {
  switch (p) {
    case 'bow': c.beginPath(); c.arc(66, 54, 20, -1.2, 1.2); inkStroke(c, '#8a5a2b', 5); bar(c, 73, 36, 73, 72, '#ffffff', 1.5); bar(c, 66, 54, 92, 54, '#c8d0e0', 2); break;
    case 'flame': rr(c, 58, 44, 18, 20, 6, '#c4902a', 3); rr(c, 74, 48, 14, 7, 3, '#3a3f4e', 2.5); poly(c, [88, 51, 98, 42, 96, 50, 100, 52, 94, 56], '#ff8a22', 2); break;
    case 'cannon': rr(c, 56, 44, 34, 17, 7, lin(c, 0, 44, 0, 61, '#8a93a8', '#3a4157'), 3); rr(c, 84, 40, 9, 25, 4, '#2e3447', 3); break;
    case 'staff': bar(c, 58, 80, 72, 22, '#7a4a22', 4); ell(c, 74, 18, 8, 12, glossy(c, 74, 18, 12, '#4fc94f'), 2.5, 0.4); break;
    case 'sword': bar(c, 62, 62, 90, 24, '#e6ecf8', 5); bar(c, 56, 62, 68, 56, acc, 4); break;
    case 'orb': ball(c, 74, 40, 12, '#c7a8ff', 2.5); shine(c, 70, 36, 3, 4); star(c, 90, 28, 5, 2, 4, '#fff', 1); break;
    case 'laptop': rr(c, 56, 48, 28, 20, 3, '#4a5266', 3); rr(c, 59, 51, 22, 13, 2, '#7fff9a', 1.5); break;
    case 'skull': bar(c, 60, 80, 72, 24, '#5a3a22', 4); ball(c, 74, 20, 8, '#f2ecd8', 2.5); ell(c, 71, 19, 1.8, 2.4, INK, 0); ell(c, 77, 19, 1.8, 2.4, INK, 0); break;
    case 'sun': ball(c, 76, 40, 12, '#ffd23c', 2.5); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; bar(c, 76 + Math.cos(a) * 15, 40 + Math.sin(a) * 15, 76 + Math.cos(a) * 21, 40 + Math.sin(a) * 21, '#ff8a22', 2); } break;
    case 'drone': ell(c, 74, 34, 14, 5, 'rgba(255,255,255,.4)', 1.5); ell(c, 74, 42, 11, 6, '#4a5266', 3); ball(c, 74, 42, 3, acc, 1); break;
    case 'book': rr(c, 58, 40, 24, 30, 3, '#5a2a8a', 3); rr(c, 62, 44, 16, 22, 2, '#ffe9a0', 1.5); star(c, 70, 55, 5, 2, 5, '#a58bff', 1); break;
    case 'wrench': bar(c, 62, 54, 88, 42, '#aab4c8', 5); c.beginPath(); c.arc(92, 40, 7, 0.5, 5.8); inkStroke(c, '#c9d2e4', 4); break;
    case 'bag': rr(c, 56, 44, 24, 24, 9, '#c8924a', 3); rr(c, 62, 38, 12, 8, 3, '#8a5a2b', 2.5); star(c, 68, 56, 6, 3, 5, '#ffd23c', 1.5); break;
    case 'ice': poly(c, [62, 54, 74, 26, 86, 54, 74, 70], '#bff1ff', 3); poly(c, [74, 26, 80, 54, 74, 70], '#7fd0ff', 0); break;
    case 'gun': rr(c, 58, 46, 32, 12, 5, '#6a748c', 3); rr(c, 60, 56, 9, 12, 3, '#3a4157', 2.5); break;
  }
}
// per-hero silhouette extras, drawn in monkey-local coords (head centre 50,38; eyes 46,35 / 59,35; muzzle 56,44)
type Fx = (c: Ctx, acc?: string) => void;
const shades: Fx = c => { rr(c, 39, 31, 30, 9, 4, '#1b1233', 2); shine(c, 45, 33, 4, 1.2, 0, 0.5); shine(c, 59, 33, 4, 1.2, 0, 0.5); };
const brow = (c: Ctx, l = 2, col = INK): void => { c.beginPath(); c.moveTo(40, 29); c.lineTo(51, 31 - l); c.moveTo(55, 31 - l); c.lineTo(66, 29); c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round'; c.stroke(); };
const stache = (c: Ctx, col: string, w = 8): void => { ell(c, 51, 41, w, 3, col, 2, 0.15); ell(c, 62, 41, w, 3, col, 2, -0.15); };
const beard = (c: Ctx, col: string, len = 11): void => { c.beginPath(); c.moveTo(42, 44); c.quadraticCurveTo(48, 50 + len, 58, 50 + len); c.quadraticCurveTo(68, 48, 68, 42); c.quadraticCurveTo(56, 52, 42, 44); fs(c, col, 2.5); };
const eyepatch = (c: Ctx): void => { bar(c, 36, 30, 64, 38, '#1b1233', 1.5); ell(c, 59, 36, 5, 5.5, '#1b1233', 1.5); };
const cape = (c: Ctx, col: string): void => { c.beginPath(); c.moveTo(34, 52); c.quadraticCurveTo(6, 56, 2, 86); c.quadraticCurveTo(18, 80, 24, 90); c.quadraticCurveTo(30, 78, 50, 78); c.closePath(); fs(c, lin(c, 4, 52, 40, 88, mix(col, 0.2), mix(col, -0.35)), 3); };
const scarf = (c: Ctx, col: string): void => { rr(c, 32, 52, 26, 7, 3.5, col, 2.5); c.beginPath(); c.moveTo(34, 57); c.quadraticCurveTo(18, 58, 12, 70); c.lineTo(20, 72); c.quadraticCurveTo(26, 64, 38, 62); c.closePath(); fs(c, col, 2.5); };
const spikes = (c: Ctx, col: string, n = 5, h = 14): void => { for (let i = 0; i < n; i++) { const x = 36 + i * (28 / (n - 1)); poly(c, [x - 5, 28, x + (i - n / 2) * 1.5, 28 - h - (i % 2) * 5, x + 5, 28], col, 2.5); } };
const medals = (c: Ctx): void => { for (let i = 0; i < 3; i++) { ball(c, 36 + i * 6, 62, 2.6, ['#ffd23c', '#ff4a4a', '#7fd8ff'][i], 1.2); } };
const legs = (c: Ctx, col: string): void => { rr(c, 28, 70, 32, 6, 3, col, 2); };
const HERO_FX: Record<string, { back?: Fx; deco?: Fx; s?: number; float?: boolean }> = {
  quincy: { back: c => { c.save(); c.translate(30, 56); c.rotate(-0.5); rr(c, -5, -16, 11, 30, 4, '#8a5a2b', 2.5); for (let i = 0; i < 3; i++) bar(c, -2 + i * 3, -16, -4 + i * 4, -26, '#fff', 1.5); c.restore(); }, deco: c => { brow(c, 1); poly(c, [58, 20, 78, 6, 66, 22], '#ff4a4a', 2); } },
  gwendolin: { back: (c, a) => scarf(c, '#ff4a22'), deco: c => { spikes(c, '#ff7a22', 5, 16); spikes(c, '#ffd23c', 3, 9); brow(c, 3); ell(c, 42, 44, 3, 2, 'rgba(255,90,60,.6)', 0); } },
  striker_jones: { deco: c => { shades(c); stache(c, '#3a2a1a', 7); medals(c); rr(c, 28, 52, 12, 8, 3, '#4d5a3c', 2.5); rr(c, 50, 52, 12, 8, 3, '#4d5a3c', 2.5); }, s: 1.06 },
  obyn_greenfoot: { deco: c => { beard(c, '#4a9a3a', 12); for (const [x, y] of [[40, 20], [60, 20]]) { bar(c, x, y + 6, x - 3 + (x > 50 ? 8 : -2), y - 12, '#7a4a22', 3); bar(c, x - 1, y - 4, x - 7, y - 10, '#7a4a22', 2); } brow(c, 1); rr(c, 24, 54, 14, 8, 4, '#7a4a22', 2.5); rr(c, 52, 54, 14, 8, 4, '#7a4a22', 2.5); } },
  captain_churchill: { deco: c => { ell(c, 63, 46, 7, 2.2, '#c8924a', 1.5); ell(c, 71, 45, 2, 2, '#ff6a22', 1); ball(c, 62, 34, 6, 'rgba(255,255,255,.25)', 1.8); stache(c, '#d8d0b8', 6); medals(c); rr(c, 24, 52, 10, 7, 2, '#ffd23c', 2); rr(c, 54, 52, 10, 7, 2, '#ffd23c', 2); }, s: 1.12 },
  benjamin: { deco: c => { shades(c); poly(c, [36, 30, 40, 18, 50, 24, 60, 17, 66, 30], '#1b1233', 2); poly(c, [44, 60, 50, 60, 47, 76], '#ff4a4a', 2); rr(c, 32, 56, 8, 14, 2, '#fff', 1.5); rr(c, 52, 56, 8, 14, 2, '#fff', 1.5); ball(c, 31, 38, 4, '#6bff7c', 1.5); ball(c, 69, 38, 4, '#6bff7c', 1.5); bar(c, 31, 34, 69, 34, '#4a5266', 2); } },
  ezili: { deco: c => { for (let i = 0; i < 3; i++) bar(c, 40 + i * 2, 41 + i * 2.5, 48 + i * 2, 41 + i * 2.5, '#fff', 1.4); ball(c, 50, 17, 4, '#f2ecd8', 1.8); poly(c, [44, 24, 40, 6, 52, 14, 60, 4, 62, 24], '#5a1a80', 2.5); for (let i = 0; i < 4; i++) ball(c, 36 + i * 8, 62, 2.6, '#f2ecd8', 1.2); ball(c, 30, 40, 3, '#ff4a8a', 1.5); }, float: true },
  pat_fusty: { back: c => cape(c, '#e84545'), deco: c => { beard(c, '#f4f4f8', 14); ell(c, 51, 41, 8, 3, '#f4f4f8', 2, 0.15); ell(c, 62, 41, 8, 3, '#f4f4f8', 2, -0.15); ell(c, 44, 56, 22, 6, '#f4f4f8', 2.5); brow(c, 3, '#d8d8e8'); }, s: 1.18 },
  adora: { back: (c, a) => { for (let i = 0; i < 10; i++) { const k = i * Math.PI / 5; poly(c, [50 + Math.cos(k - 0.12) * 20, 36 + Math.sin(k - 0.12) * 20, 50 + Math.cos(k) * 34, 36 + Math.sin(k) * 34, 50 + Math.cos(k + 0.12) * 20, 36 + Math.sin(k + 0.12) * 20], '#ffe04a', 2); } ball(c, 50, 36, 22, '#fff6c8', 2); c.beginPath(); c.moveTo(30, 40); c.quadraticCurveTo(22, 80, 36, 86); c.lineTo(66, 84); c.quadraticCurveTo(72, 60, 66, 40); c.closePath(); fs(c, '#c8923a', 3); }, deco: c => { c.beginPath(); c.moveTo(41, 36); c.quadraticCurveTo(46, 40, 51, 36); c.moveTo(54, 36); c.quadraticCurveTo(59, 40, 64, 36); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke(); ell(c, 50, 22, 5, 3, '#ff8a22', 2); ball(c, 50, 54, 4, '#ff8a22', 1.5); } },
  admiral_brickell: { deco: c => { eyepatch(c); beard(c, '#d8d0b8', 8); poly(c, [26, 30, 50, 4, 74, 30, 66, 33, 50, 18, 34, 33], '#1f3a6a', 3); star(c, 50, 22, 4, 1.8, 5, '#ffd23c', 1.2); rr(c, 24, 52, 12, 6, 2, '#ffd23c', 2); rr(c, 54, 52, 12, 6, 2, '#ffd23c', 2); medals(c); }, s: 1.05 },
  etienne: { back: c => { rr(c, 20, 46, 18, 26, 5, '#4a5266', 3); ball(c, 29, 52, 3.5, '#ffe04a', 1.5); bar(c, 29, 70, 29, 80, '#aab4c8', 3); }, deco: c => { rr(c, 40, 31, 14, 10, 4, 'rgba(160,230,255,.7)', 2.5); rr(c, 56, 31, 14, 10, 4, 'rgba(160,230,255,.7)', 2.5); bar(c, 54, 36, 56, 36, INK, 2); ball(c, 50, 54, 3, '#ffe04a', 1.5); } },
  sauda: { back: c => { c.beginPath(); c.moveTo(34, 30); c.quadraticCurveTo(8, 34, 10, 66); c.quadraticCurveTo(18, 50, 34, 46); fs(c, '#24263a', 3); bar(c, 26, 62, 38, 40, '#cfd8e6', 3); }, deco: c => { brow(c, 4); bar(c, 66, 30, 60, 42, '#ff9a8a', 1.6); rr(c, 32, 52, 26, 6, 3, '#ff4a4a', 2); } },
  psi: { back: c => { ell(c, 50, 50, 32, 34, 'rgba(190,150,255,.35)', 0); for (let i = 0; i < 4; i++) star(c, 22 + i * 18, 14 + (i % 2) * 52, 4, 1.8, 4, '#fff', 1); }, deco: c => { ell(c, 46, 35, 3.2, 3.8, '#c7a8ff', 0); ell(c, 59, 35, 3.2, 3.8, '#c7a8ff', 0); ball(c, 52, 20, 4, '#c7a8ff', 1.6); brow(c, 0, '#7a4fd6'); }, float: true, s: 1.04 },
  geraldo: { deco: c => { shades(c); stache(c, '#3a2a1a', 9); poly(c, [30, 54, 36, 52, 62, 76, 56, 78], '#7a4a22', 2.5); for (let i = 0; i < 3; i++) ball(c, 40 + i * 6, 62 + i * 5, 2, '#ffd23c', 1); } },
  corvus: { back: c => cape(c, '#24263a'), deco: c => { c.beginPath(); c.arc(50, 38, 21, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(72, 46); c.quadraticCurveTo(50, 20, 28, 46); c.closePath(); fs(c, '#24263a', 3); ell(c, 46, 35, 3.2, 3.8, '#a58bff', 0); ell(c, 59, 35, 3.2, 3.8, '#a58bff', 0); star(c, 44, 60, 5, 2, 5, '#a58bff', 1.2); } },
  rosalia: { back: c => { rr(c, 22, 48, 12, 26, 5, '#8a93a8', 3); poly(c, [24, 74, 28, 86, 32, 74], '#ff8a22', 2); poly(c, [36, 74, 40, 84, 44, 74], '#ffd23c', 0); }, deco: c => { scarf(c, '#ffe04a'); brow(c, 3); c.beginPath(); c.arc(50, 33, 19, Math.PI, 0); c.closePath(); c.globalAlpha = 0.9; fs(c, '#d84a8a', 3); c.globalAlpha = 1; star(c, 50, 24, 4, 1.8, 5, '#ffe04a', 1.2); } },
  silas: { back: c => cape(c, '#7fd0ff'), deco: c => { beard(c, '#e8fbff', 9); poly(c, [38, 26, 42, 8, 47, 24, 52, 4, 57, 24, 62, 8, 64, 26], '#bff1ff', 2.5); brow(c, 3, '#bff1ff'); for (const x of [46, 52, 58]) poly(c, [x - 2, 56, x, 66, x + 2, 56], '#e8fbff', 1.5); } },
  dan_d_monke: { deco: c => { shades(c); stache(c, '#3a2a1a', 7); rr(c, 38, 56, 12, 4, 2, '#3a3a46', 0); ell(c, 44, 60, 20, 18, 'rgba(255,255,255,.12)', 0); bar(c, 28, 52, 28, 66, '#3a3a46', 3); bar(c, 60, 52, 60, 66, '#3a3a46', 3); } },
};
export function drawHero(c: Ctx, id: string): void {
  const [fur, outfit, acc, hat, hatCol, prop] = HEROES[id], fx = HERO_FX[id] ?? {};
  c.save(); c.beginPath(); c.ellipse(48, 82, 36, 10, 0, 0, 7); c.fillStyle = fx.float ? 'rgba(160,120,255,.55)' : acc; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore();
  const big = fx.s ?? 1, lift = fx.float ? -6 : 0;
  c.save(); c.translate(48, 56 + lift); c.scale(big, big); c.translate(-48, -56);
  const tf = (): void => { c.translate(52, 50); c.scale(0.88, 0.88); c.translate(-54, -50); };
  if (fx.back) { c.save(); tf(); fx.back(c, acc); c.restore(); }
  monkey(c, mk(outfit, acc, hat, hatCol, fur), () => heroProp(c, prop, acc), 1);
  if (fx.deco) { c.save(); tf(); fx.deco(c, acc); c.restore(); }
  c.restore();
  star(c, 14, 14, 9, 4, 5, '#ffd23c', 2.2);
}

// ---------------- projectiles (32x32, pointing +x) ----------------
export const PROJ_IDS = ['dart', 'tack', 'bomb', 'boomerang', 'glue', 'ice', 'shuriken', 'magic', 'plasma', 'missile', 'spike', 'banana', 'potion', 'thorn', 'bullet', 'laser', 'cannonball', 'fireball', 'arrow', 'sawblade'] as const;
export function drawProj(c: Ctx, id: string): void {
  c.save(); c.translate(16, 16);
  { const g = c.createRadialGradient(0, 0, 2, 0, 0, 15); g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill(); } // readability halo
  c.scale(1.08, 1.08);
  switch (id) {
    case 'dart': bar(c, -9, 0, 6, 0, '#c8924a', 2.5); poly(c, [5, -3.5, 14, 0, 5, 3.5], '#d9e2f2', 2); poly(c, [-6, 0, -12, -5, -8, 0, -12, 5], '#ff4a4a', 2); break;
    case 'arrow': bar(c, -11, 0, 8, 0, '#a8723a', 2.2); poly(c, [7, -4, 14, 0, 7, 4], '#d9e2f2', 2); poly(c, [-8, 0, -14, -4, -11, 0, -14, 4], '#fff', 1.8); break;
    case 'tack': poly(c, [-4, -6, 12, 0, -4, 6], '#d9e2f2', 2.5); ell(c, -6, 0, 3, 7, '#ff6a4a', 2.5); break;
    case 'bomb': ball(c, 0, 1, 10, '#2a2a36', 2.8); shine(c, -3, -3, 3, 2, 0, 0.7); bar(c, 4, -8, 8, -13, '#c89a4a', 2); star(c, 10, -14, 4, 2, 5, '#ffdd3a', 1); break;
    case 'cannonball': ball(c, 0, 0, 10, '#3a3f4e', 2.8); shine(c, -3, -4, 3, 2, 0, 0.5); break;
    case 'boomerang': c.beginPath(); c.arc(-4, 0, 11, -1.3, 1.3); inkStroke(c, '#38b6ff', 6); break;
    case 'glue': ell(c, 0, 0, 11, 8, 'rgba(180,255,90,.95)', 2.8); ell(c, 9, -3, 4, 3, 'rgba(180,255,90,.95)', 2); shine(c, -3, -3, 3.5, 2, 0, 0.7); break;
    case 'ice': star(c, 0, 0, 12, 5, 6, '#bff1ff', 2.8); ell(c, 0, 0, 3, 3, '#fff', 1); break;
    case 'shuriken': star(c, 0, 0, 12, 4, 4, '#d9e2f2', 2.5, Math.PI / 4); ell(c, 0, 0, 2.5, 2.5, INK, 0); break;
    case 'magic': ball(c, 0, 0, 9, '#b08bff', 2.8); star(c, 0, 0, 7, 3, 4, '#fff', 0); break;
    case 'plasma': ball(c, 0, 0, 10, '#ff5ad0', 2.5); ell(c, 0, 0, 5, 5, '#fff', 0); break;
    case 'missile': rr(c, -12, -4, 20, 8, 4, lin(c, 0, -4, 0, 4, '#f0f4ff', '#8a93a8'), 2.5); poly(c, [8, -4, 15, 0, 8, 4], '#ff4a4a', 2.5); poly(c, [-10, -4, -14, -8, -6, -4], '#ff4a4a', 2); poly(c, [-10, 4, -14, 8, -6, 4], '#ff4a4a', 2); break;
    case 'spike': star(c, 0, 0, 12, 4, 6, '#e6ecf8', 2.5); break;
    case 'banana': c.beginPath(); c.moveTo(-11, 2); c.quadraticCurveTo(0, -14, 11, 2); c.quadraticCurveTo(0, -4, -11, 2); fs(c, '#ffe14a', 2.8); break;
    case 'potion': ball(c, 0, 3, 8, '#6bff7c', 2.5); rr(c, -3, -9, 6, 8, 2, '#d9ffe0', 2.2); rr(c, -4, -12, 8, 4, 1.5, '#ba7c3c', 2); break;
    case 'thorn': poly(c, [-10, -3, 10, 0, -10, 3], '#4fc94f', 2.5); break;
    case 'bullet': rr(c, -9, -3.5, 18, 7, 3.5, '#ffd23c', 2.5); break;
    case 'laser': rr(c, -13, -3, 26, 6, 3, 'rgba(255,70,90,.95)', 2); rr(c, -11, -1, 22, 2, 1, '#fff', 0); break;
    case 'fireball': ball(c, 2, 0, 9, '#ff8a22', 2.5); poly(c, [-6, 0, -16, -6, -12, 0, -16, 6], '#ffd23c', 2); break;
    default: star(c, 0, 0, 12, 5, 8, '#d9e2f2', 2.5); ell(c, 0, 0, 4, 4, '#8a93a8', 2); // sawblade
  }
  c.restore();
}

// ---------------- bursts ----------------
export const FX_FRAMES: Record<string, number> = { pop: 4, boom: 4, frost: 3, splat: 3 };
export const FX_SIZE: Record<string, number> = { pop: 64, boom: 128, frost: 96, splat: 80 };
export function drawFx(c: Ctx, kind: string, f: number): void {
  const n = FX_FRAMES[kind], S = FX_SIZE[kind], t = (f + 1) / n, cx = S / 2;
  c.save(); c.translate(cx, cx); c.globalAlpha = 1 - f / (n + 0.5) * 0.55;
  if (kind === 'pop') { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2, d = 10 + t * 20; ell(c, Math.cos(a) * d, Math.sin(a) * d, 3.4 - f * 0.5, 3.4 - f * 0.5, ['#ff5a4a', '#ffd23c', '#4aa8ff', '#6bdc4a'][i % 4], 2); } star(c, 0, 0, 8 + t * 20, 5 + t * 8, 9, '#fff6a8', 3.6 - f * 0.4); star(c, 0, 0, 4 + t * 12, 3 + t * 5, 9, '#ffffff', 0); }
  else if (kind === 'boom') {
    star(c, 0, 0, 14 + t * 48, 9 + t * 30, 12, '#ff8a22', 4); star(c, 0, 0, 10 + t * 34, 6 + t * 20, 12, '#ffd23c', 0); ball(c, 0, 0, 6 + t * 14, '#fff6c8', 0);
    ell(c, t * 20, -t * 28, 8 + t * 8, 7 + t * 6, 'rgba(70,60,80,.75)', 2.5);
  } else if (kind === 'frost') {
    star(c, 0, 0, 10 + t * 36, 4 + t * 9, 8, '#bff1ff', 3); ball(c, 0, 0, 5 + t * 10, '#ffffff', 0);
  } else {
    for (let i = 0; i < 7; i++) { const a = i * 0.9; ell(c, Math.cos(a) * t * 26, Math.sin(a) * t * 26, 7 - f, 5 - f * 0.7, 'rgba(180,255,90,.95)', 2.4); }
    ell(c, 0, 0, 12 + t * 6, 9 + t * 4, 'rgba(180,255,90,.95)', 2.8);
  }
  c.restore();
}

// ---------------- range rings (256x256) ----------------
export const RING_IDS = ['ok', 'bad', 'sel'] as const;
export function drawRing(c: Ctx, id: string): void {
  const col = id === 'bad' ? '255,70,70' : id === 'sel' ? '255,226,90' : '255,255,255';
  c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fillStyle = `rgba(${col},.16)`; c.fill();
  c.lineWidth = 6; c.strokeStyle = INK; c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1;
  c.beginPath(); c.arc(128, 128, 120, 0, 7); c.lineWidth = 3; c.strokeStyle = `rgba(${col},.95)`; c.stroke();
}

// ---------------- UI textures ----------------
export const UI_PANELS = ['wood', 'blue', 'parchment'] as const;
export const UI_BUTTONS = ['green', 'red', 'blue', 'wood', 'yellow'] as const;
export const UI_ICONS = ['coin', 'heart', 'play', 'ff', 'pause', 'gear', 'lock', 'star', 'check', 'x', 'home', 'round'] as const;
export const UI_PIPS = ['pip_on', 'pip_off', 'tab', 'tab_sel', 'bar'] as const;
export const PANEL_SLICE = 22; // nine-slice border (panels are 96x96)
const BTN: Record<string, string> = { green: '#4fd43a', red: '#ee3b3b', blue: '#3a8cf0', wood: '#c08040', yellow: '#ffc61f' };

export function drawPanel(c: Ctx, kind: string): void {
  if (kind === 'wood') {
    rr(c, 3, 3, 90, 90, 16, '#4a2a14', 4);
    rr(c, 8, 8, 80, 80, 12, lin(c, 0, 8, 0, 88, '#c68a4a', '#9a6330'), 2.5);
    c.save(); c.beginPath(); c.roundRect(8, 8, 80, 80, 12); c.clip();
    for (const y of [30, 52, 72]) { c.fillStyle = 'rgba(60,30,10,.35)'; c.fillRect(8, y, 80, 2.5); }
    c.fillStyle = 'rgba(255,230,170,.22)'; c.fillRect(8, 8, 80, 6); c.restore();
    for (const [x, y] of [[14, 14], [82, 14], [14, 82], [82, 82]]) ball(c, x, y, 2.4, '#d8deea', 1.2);
  } else if (kind === 'blue') {
    rr(c, 3, 3, 90, 90, 18, '#10285a', 4);
    rr(c, 7, 7, 82, 82, 14, lin(c, 0, 7, 0, 89, '#4aa6ff', '#1f58c0'), 2.5);
    rr(c, 14, 14, 68, 68, 9, lin(c, 0, 14, 0, 82, '#2a6fd8', '#183f94'), 2);
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.roundRect(10, 9, 76, 12, 8); c.fill();
  } else {
    rr(c, 3, 3, 90, 90, 14, '#5a3a1a', 4);
    rr(c, 8, 8, 80, 80, 10, lin(c, 0, 8, 0, 88, '#fff2cc', '#ecd49a'), 2);
  }
}
export function drawButton(c: Ctx, kind: string, pressed: boolean): void {
  const col = BTN[kind], y = pressed ? 5 : 0;
  rr(c, 3, 8, 90, 32, 13, mix(col, -0.55), 3.5);
  rr(c, 3, 3 + y, 90, 32, 13, lin(c, 0, 3 + y, 0, 35 + y, pressed ? mix(col, -0.1) : mix(col, 0.35), pressed ? mix(col, -0.3) : col), 3.5);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.roundRect(10, 6 + y, 76, 8, 5); c.fill();
}
export function drawUiMisc(c: Ctx, id: string): void {
  if (id === 'pip_on') { ball(c, 10, 10, 8, '#ffd23c', 2.5); shine(c, 7, 7, 2.4, 2, 0, 0.8); }
  else if (id === 'pip_off') ell(c, 10, 10, 8, 8, '#3a2f4a', 2.5);
  else if (id === 'tab' || id === 'tab_sel') {
    c.beginPath(); c.moveTo(3, 36); c.lineTo(3, 14); c.quadraticCurveTo(3, 3, 14, 3); c.lineTo(66, 3); c.quadraticCurveTo(77, 3, 77, 14); c.lineTo(77, 36); c.closePath();
    fs(c, id === 'tab_sel' ? lin(c, 0, 3, 0, 36, '#ffe28a', '#e8a02a') : lin(c, 0, 3, 0, 36, '#8a5a30', '#5e3a1e'), 3.5);
  } else { rr(c, 2, 2, 92, 20, 10, '#10285a', 3.5); rr(c, 7, 6, 82, 12, 6, lin(c, 0, 6, 0, 18, '#7fc4ff', '#2a74e0'), 0); } // bar
}
export function drawIcon(c: Ctx, id: string): void {
  c.save(); c.translate(16, 16);
  switch (id) {
    case 'coin': ball(c, 0, 0, 13, '#ffc61f', 3); ell(c, 0, 0, 8, 8, 'rgba(0,0,0,0)', 2); bar(c, 0, -5, 0, 5, '#b8791a', 3); break;
    case 'heart': c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(-18, 0, -12, -14, 0, -6); c.bezierCurveTo(12, -14, 18, 0, 0, 12); fs(c, glossy(c, 0, -2, 14, '#ff3a5a'), 3); shine(c, -6, -5, 3, 2, 0.5, 0.8); break;
    case 'play': poly(c, [-8, -11, 12, 0, -8, 11], '#fff', 3); break;
    case 'ff': poly(c, [-13, -10, 0, 0, -13, 10], '#fff', 3); poly(c, [0, -10, 13, 0, 0, 10], '#fff', 3); break;
    case 'pause': rr(c, -10, -10, 7, 20, 2, '#fff', 3); rr(c, 3, -10, 7, 20, 2, '#fff', 3); break;
    case 'gear': star(c, 0, 0, 14, 10, 8, '#cfd6e6', 3); ell(c, 0, 0, 5, 5, '#5a6278', 2.5); break;
    case 'lock': rr(c, -9, -2, 18, 14, 3, '#ffc61f', 3); c.beginPath(); c.arc(0, -3, 6, Math.PI, 0); inkStroke(c, '#cfd6e6', 3); break;
    case 'star': star(c, 0, 0, 14, 6, 5, '#ffd23c', 3); break;
    case 'check': c.beginPath(); c.moveTo(-9, 1); c.lineTo(-3, 8); c.lineTo(10, -8); inkStroke(c, '#5be05b', 5); break;
    case 'x': c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, 8); c.moveTo(8, -8); c.lineTo(-8, 8); inkStroke(c, '#ff4a4a', 5); break;
    case 'home': poly(c, [-13, 0, 0, -12, 13, 0, 9, 0, 9, 11, -9, 11, -9, 0], '#fff', 3); break;
    default: poly(c, [-12, -12, 12, -6, -12, 0], '#ff4a4a', 3); bar(c, -12, -12, -12, 13, '#cfd6e6', 3); // round flag
  }
  c.restore();
}
