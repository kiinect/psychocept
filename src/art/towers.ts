// Tower sprites: 96x96, facing +x (rotate the sprite to aim), centre (48,48).
import { type Ctx, INK, ball, bar, ell, fs, glossy, inkStroke, lin, mix, poly, rr, shine, star } from './draw';

export const TOWER_SIZE = 96;
export const TOWER_IDS = [
  'dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue', 'sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar',
  'dartling', 'wizard_monkey', 'super_monkey', 'ninja_monkey', 'alchemist', 'druid', 'banana_farm',
  'engineer_monkey', 'spike_factory', 'monkey_village', 'mermonkey', 'beast_handler',
] as const;
export const PATH_COLORS = ['#ff5a4a', '#37a8ff', '#4fdc5a'] as const;

export type Hat = 'none' | 'band' | 'helmet' | 'wiz' | 'ninja' | 'goggles' | 'hard' | 'safari' | 'leaf' | 'camo' | 'pirate' | 'cap' | 'crown';
export interface Monk { fur: string; outfit: string; accent: string; hat: Hat; hatCol: string }
const FUR = '#b9722f';
const H = { x: 62, y: 54 }; // hand position the props attach to

function hat(c: Ctx, h: Hat, col: string): void {
  switch (h) {
    case 'band':
      rr(c, 33, 28, 35, 7, 3, col, 2.5); poly(c, [34, 31, 24, 26, 26, 35], col, 2.5); poly(c, [34, 33, 22, 36, 28, 41], col, 2.5); break;
    case 'helmet':
    case 'camo':
      c.beginPath(); c.arc(50, 35, 19, Math.PI, 0); c.closePath(); fs(c, glossy(c, 50, 28, 20, col), 3);
      rr(c, 29, 33, 42, 5, 2.5, mix(col, -0.3), 2.5);
      if (h === 'camo') { ell(c, 42, 25, 5, 3, mix(col, -0.45), 0); ell(c, 57, 28, 6, 3, '#6a5a2a', 0); ell(c, 50, 20, 4, 2.5, '#3c4a24', 0); }
      break;
    case 'wiz':
      ell(c, 50, 29, 24, 6, col, 3);
      c.beginPath(); c.moveTo(35, 29); c.quadraticCurveTo(46, 14, 58, -2); c.quadraticCurveTo(60, 14, 66, 29); c.closePath(); fs(c, lin(c, 40, 0, 60, 29, mix(col, 0.25), mix(col, -0.3)), 3);
      star(c, 52, 20, 4, 1.8, 5, '#ffe04a', 1.5); rr(c, 38, 25, 26, 4, 2, '#ffe04a', 2); break;
    case 'ninja':
      rr(c, 31, 28, 39, 12, 5, col, 3); rr(c, 38, 31, 26, 5, 2.5, '#f4e3c3', 1.5); poly(c, [32, 33, 20, 30, 24, 40], col, 2.5); break;
    case 'goggles':
      rr(c, 31, 26, 38, 6, 3, '#4a3320', 2.5); ball(c, 42, 27, 6.5, '#7fd8ff', 2.5); ball(c, 58, 27, 6.5, '#7fd8ff', 2.5); break;
    case 'hard':
      c.beginPath(); c.arc(50, 33, 18, Math.PI, 0); c.closePath(); fs(c, glossy(c, 50, 26, 20, col), 3);
      rr(c, 28, 31, 44, 5, 2.5, mix(col, -0.2), 2.5); rr(c, 46, 15, 8, 8, 2, mix(col, 0.3), 2); break;
    case 'safari':
      ell(c, 50, 29, 26, 7, col, 3); c.beginPath(); c.arc(50, 29, 15, Math.PI, 0); c.closePath(); fs(c, glossy(c, 50, 22, 16, col), 3);
      rr(c, 35, 24, 30, 4, 2, '#7a4a1a', 2); break;
    case 'leaf':
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55, x = 50 + Math.cos(a) * 18, y = 36 + Math.sin(a) * 17;
        c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); ell(c, 0, -5, 4.5, 9, glossy(c, 0, -5, 9, col), 2.5); c.restore();
      } break;
    case 'pirate':
      c.beginPath(); c.moveTo(28, 33); c.quadraticCurveTo(50, 2, 72, 33); c.quadraticCurveTo(50, 27, 28, 33); fs(c, col, 3);
      ell(c, 50, 24, 3.5, 3.5, '#fff', 1.5); break;
    case 'cap':
      c.beginPath(); c.arc(50, 33, 18, Math.PI, 0); c.closePath(); fs(c, glossy(c, 50, 26, 20, col), 3); ell(c, 70, 34, 12, 4, mix(col, -0.25), 2.5); break;
    case 'crown':
      poly(c, [34, 30, 36, 14, 43, 24, 50, 10, 57, 24, 64, 14, 66, 30], '#ffd23c', 3); ball(c, 50, 22, 3, '#ff4a6a', 1.5); break;
    default:
  }
}

export function monkey(c: Ctx, m: Monk, prop: () => void, scale = 1, handFirst = false): void {
  c.save(); c.translate(52, 50); c.scale(0.88, 0.88); c.translate(-54, -50); // keep long props inside the 96px cell
  // tail
  c.beginPath(); c.moveTo(30, 66); c.bezierCurveTo(10, 70, 12, 44, 24, 48); inkStroke(c, m.fur, 5);
  // feet & body
  ell(c, 34, 76, 9, 5.5, m.fur, 3); ell(c, 54, 76, 9, 5.5, m.fur, 3);
  ell(c, 44, 60, 20, 18, glossy(c, 44, 60, 22, m.outfit), 3);
  rr(c, 28, 64, 32, 5, 2.5, m.accent, 2);
  // head
  ell(c, 33, 38, 7, 7, mix(m.fur, 0.3), 3); ell(c, 67, 38, 7, 7, mix(m.fur, 0.3), 3);
  ball(c, 50, 38, 18, m.fur);
  ell(c, 56, 44, 11, 8.5, glossy(c, 56, 44, 11, '#f2cf9b'), 2.5);
  ell(c, 46, 35, 5, 6, '#fff', 2); ell(c, 59, 35, 5, 6, '#fff', 2);
  ell(c, 48, 36, 2.4, 3, INK, 0); ell(c, 61, 36, 2.4, 3, INK, 0);
  c.beginPath(); c.arc(57, 45, 4, 0.2, Math.PI - 0.2); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  hat(c, m.hat, m.hatCol);
  // arm + prop + hand
  c.beginPath(); c.moveTo(52, 58); c.lineTo(H.x - 2, H.y); inkStroke(c, m.fur, 8);
  c.save(); c.translate(H.x, H.y); c.scale(scale, scale); c.translate(-H.x, -H.y); prop(); c.restore();
  if (!handFirst) ball(c, H.x, H.y, 5.5, mix(m.fur, 0.1), 2.5);
  c.restore();
}

type Prop = (c: Ctx) => void;
export const mk = (outfit: string, accent: string, h: Hat, hatCol: string, fur = FUR): Monk => ({ fur, outfit, accent, hat: h, hatCol });

// ---- props (all drawn around the hand point, pointing +x) ----
const dartProp: Prop = c => {
  bar(c, 66, 54, 84, 54, '#c8924a', 4); poly(c, [82, 49, 95, 54, 82, 59], '#cfd8e6', 2.5);
  poly(c, [70, 54, 60, 47, 66, 54, 60, 61], '#ff4a4a', 2.5);
};
const boomProp: Prop = c => {
  c.beginPath(); c.arc(68, 52, 17, -1.25, 1.1); inkStroke(c, '#38b6ff', 8);
  c.beginPath(); c.arc(68, 52, 17, -1.05, -0.2); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2.5; c.stroke();
};
const bombProp: Prop = c => {
  ell(c, 56, 70, 11, 11, '#8a5a2b', 3);
  rr(c, 52, 44, 36, 18, 7, lin(c, 0, 44, 0, 62, '#6a748c', '#2e3447'), 3); rr(c, 82, 40, 9, 26, 4, '#3a4157', 3);
  ball(c, 62, 40, 8, '#2a2a36', 2.5); bar(c, 62, 33, 66, 27, '#c89a4a', 2); star(c, 67, 25, 5, 2.5, 5, '#ffdd3a', 1);
};
const sniperProp: Prop = c => {
  rr(c, 50, 50, 44, 7, 3.5, '#39404f', 2.5); rr(c, 58, 43, 16, 6, 3, '#222a38', 2.5); rr(c, 40, 49, 14, 10, 3, '#7a4a22', 2.5);
  ell(c, 90, 53, 2.5, 4, '#222', 1.5); bar(c, 70, 58, 66, 66, '#39404f', 2);
};
const glueProp: Prop = c => {
  rr(c, 58, 40, 20, 26, 7, 'rgba(120,255,160,.9)', 3); rr(c, 62, 32, 12, 9, 3, '#fff', 2.5);
  rr(c, 62, 52, 12, 11, 4, '#e9ffd2', 0); rr(c, 76, 46, 14, 7, 3, '#e4e8f0', 2.5);
  ell(c, 93, 50, 3, 4.5, '#b8ff5a', 2); shine(c, 64, 48, 2.5, 7, 0.1, 0.8);
};
const dartlingProp: Prop = c => {
  [-7, 0, 7].forEach(dy => rr(c, 66, 50 + dy, 28, 6, 3, lin(c, 0, 50 + dy, 0, 56 + dy, '#9aa6bb', '#4a5266'), 2.5));
  rr(c, 62, 44, 8, 24, 4, '#ffc12e', 3); ball(c, 56, 58, 10, '#58637c'); bar(c, 52, 62, 46, 70, '#c8cfe0', 2.5);
};
const wizProp: Prop = c => {
  bar(c, 56, 78, 72, 26, '#8a5a2b', 4); ball(c, 74, 20, 8, '#a58bff', 2.5); shine(c, 71, 17, 2.5, 2, 0, 0.8);
  star(c, 86, 28, 4, 1.6, 4, '#ffe04a', 1); star(c, 62, 14, 3, 1.2, 4, '#ffe04a', 1);
};
const superProp: Prop = c => {
  ball(c, 68, 54, 8, '#ff4a4a', 2.5); bar(c, 76, 54, 94, 54, 'rgba(255,60,60,.9)', 3);
  star(c, 40, 62, 7, 3, 5, '#ffe04a', 2);
};
const ninjaProp: Prop = c => {
  star(c, 74, 52, 14, 5, 4, '#d9e2f2', 2.5, Math.PI / 4); ell(c, 74, 52, 2.5, 2.5, INK, 0);
};
const alchProp: Prop = c => {
  poly(c, [68, 38, 72, 38, 72, 46, 82, 64, 58, 64, 68, 46], 'rgba(190,255,200,.7)', 3);
  poly(c, [64, 56, 76, 56, 82, 64, 58, 64], '#6bff7c', 0); rr(c, 66, 33, 8, 6, 2, '#ba7c3c', 2);
  ell(c, 66, 52, 2.5, 2.5, '#d9ffe0', 1); ell(c, 72, 47, 2, 2, '#d9ffe0', 1); ell(c, 76, 38, 3, 3, '#6bff7c', 1.5);
};
const druidProp: Prop = c => {
  bar(c, 58, 80, 70, 22, '#7a4a22', 4); ell(c, 74, 20, 8, 12, glossy(c, 74, 20, 12, '#4fc94f'), 2.5, 0.5);
  ell(c, 62, 24, 5, 8, glossy(c, 62, 24, 8, '#79e060'), 2.5, -0.5);
};
const engProp: Prop = c => {
  bar(c, 62, 54, 86, 44, '#aab4c8', 5); c.beginPath(); c.arc(90, 41, 7, 0.5, 5.8); inkStroke(c, '#c9d2e4', 4);
};
const mermProp: Prop = c => {
  bar(c, 40, 80, 86, 30, '#e8c14a', 3);
  [[-8, 4], [0, 0], [8, -4]].forEach(([dx, dy]) => bar(c, 86 + dx, 30 + dy, 94 + dx * 1.3, 24 + dy, '#e8c14a', 2.5));
};
const beastProp: Prop = c => {
  ell(c, 70, 44, 8, 10, glossy(c, 70, 44, 10, '#8a5a3a'), 2.5); ball(c, 74, 33, 6, '#8a5a3a', 2.5);
  poly(c, [78, 32, 88, 36, 78, 38], '#ffc03a', 2); ell(c, 75, 31, 1.5, 1.5, INK, 0); poly(c, [62, 46, 54, 38, 64, 54], '#6a3f26', 2.5);
};

const MONKEYS: Record<string, [Monk, Prop]> = {
  dart: [mk('#e84545', '#ffd23c', 'band', '#e84545'), dartProp],
  boomerang: [mk('#2f8fe8', '#ffd23c', 'cap', '#ffb02e'), boomProp],
  bomb: [mk('#556070', '#ffb02e', 'helmet', '#4d5a3c'), bombProp],
  glue: [mk('#7ad94a', '#ffffff', 'goggles', '#7ad94a'), glueProp],
  sniper: [mk('#5f7a3a', '#3a4a22', 'camo', '#6f8a46'), sniperProp],
  dartling: [mk('#c4902a', '#3a3a46', 'helmet', '#d8a533'), dartlingProp],
  wizard_monkey: [mk('#7a4fd6', '#ffe04a', 'wiz', '#6a3fc6'), wizProp],
  super_monkey: [mk('#2f6fe0', '#ff4a4a', 'none', '#fff'), superProp],
  ninja_monkey: [mk('#32344a', '#d93a3a', 'ninja', '#24263a'), ninjaProp],
  alchemist: [mk('#a05ad0', '#ffd23c', 'goggles', '#a05ad0'), alchProp],
  druid: [mk('#4a9a3a', '#c8e060', 'leaf', '#4fc94f'), druidProp],
  engineer_monkey: [mk('#f08a22', '#3a3a46', 'hard', '#ffd23c'), engProp],
  mermonkey: [mk('#17b7b0', '#ffe9a0', 'none', '#fff'), mermProp],
  beast_handler: [mk('#a8793a', '#5a3a1a', 'safari', '#d9b878'), beastProp],
};

// ---- non-monkey / vehicle / device bodies ----
const DEVICES: Record<string, (c: Ctx, s: number) => void> = {
  tack(c) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4; c.save(); c.translate(48, 48); c.rotate(a);
      poly(c, [18, -6, 38, 0, 18, 6], '#d8dfee', 2.5); ell(c, 36, 0, 2, 2, '#ff4a4a', 1); c.restore();
    }
    ball(c, 48, 48, 21, '#e8873a'); ball(c, 48, 48, 11, '#ffd23c', 2.5); ell(c, 48, 48, 4, 4, INK, 0); shine(c, 40, 36, 7, 3);
  },
  ice(c) {
    poly(c, [34, 40, 40, 14, 47, 36], '#bff1ff', 2.5); poly(c, [50, 34, 58, 10, 63, 38], '#9be4ff', 2.5);
    ball(c, 48, 52, 24, '#58c8ff'); ball(c, 48, 52, 15, '#d8f6ff', 2);
    for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; bar(c, 48 - Math.cos(a) * 10, 52 - Math.sin(a) * 10, 48 + Math.cos(a) * 10, 52 + Math.sin(a) * 10, '#4ab0ee', 2); }
    shine(c, 38, 38, 8, 4);
  },
  sub(c, s) {
    ell(c, 44, 54, 38, 17, lin(c, 0, 38, 0, 70, '#8fb0d8', '#3e5f8c'), 3);
    rr(c, 36, 24, 18, 22, 6, lin(c, 0, 24, 0, 46, '#8fb0d8', '#46689a'), 3); bar(c, 46, 25, 46, 14, '#6d7f9a', 3); bar(c, 46, 14, 54, 14, '#6d7f9a', 3);
    ball(c, 30, 56, 5, '#bfeaff', 2); ball(c, 46, 58, 5, '#bfeaff', 2); ball(c, 62, 56, 5, '#bfeaff', 2);
    poly(c, [8, 54, 0, 42, 10, 48], '#46689a', 2.5); poly(c, [8, 54, 0, 66, 10, 60], '#46689a', 2.5);
    rr(c, 78, 50, 14 * s, 8, 4, '#2e3b52', 2.5); ball(c, 46, 36, 6, FUR, 2); hat(c, 'cap', '#2f8fe8');
  },
  buccaneer(c, s) {
    poly(c, [8, 58, 88, 58, 76, 78, 20, 78], lin(c, 0, 58, 0, 78, '#a8683a', '#5e3a1e'), 3);
    bar(c, 12, 63, 84, 63, '#d9a05a', 2); bar(c, 46, 58, 46, 14, '#7a4a22', 4);
    poly(c, [48, 16, 80, 34, 48, 52], '#fff8e6', 3); poly(c, [46, 14, 24, 22, 46, 24], '#ff4a4a', 2.5);
    rr(c, 76, 50, 16 * s, 7, 3, '#2a2f3d', 2.5); ball(c, 32, 52, 6, FUR, 2); hat(c, 'pirate', '#2a2f3d');
  },
  ace(c) {
    poly(c, [40, 46, 12, 12, 24, 10, 54, 44], '#d93a3a', 3); poly(c, [40, 50, 12, 84, 24, 86, 54, 52], '#d93a3a', 3);
    poly(c, [14, 46, 4, 36, 10, 36, 22, 46], '#b82a2a', 2.5); poly(c, [14, 50, 4, 60, 10, 60, 22, 50], '#b82a2a', 2.5);
    ell(c, 46, 48, 38, 9, lin(c, 0, 39, 0, 57, '#f6f8ff', '#9ea8bd'), 3);
    ell(c, 56, 48, 8, 5.5, '#7fd8ff', 2); ball(c, 56, 47, 4, FUR, 1.5); rr(c, 82, 40, 5, 16, 2.5, '#444a5a', 2.5);
    star(c, 30, 48, 4, 1.8, 5, '#fff', 1);
  },
  heli(c) {
    rr(c, 62, 45, 30, 7, 3, '#4a8a3a', 2.5); poly(c, [88, 44, 94, 38, 94, 52], '#4a8a3a', 2.5);
    ell(c, 42, 49, 28, 15, lin(c, 0, 34, 0, 64, '#78c85a', '#3e7a30'), 3); ell(c, 54, 46, 12, 8, '#9fe6ff', 2);
    bar(c, 22, 66, 62, 66, '#3a3f4e', 3); bar(c, 30, 60, 30, 66, '#3a3f4e', 3); bar(c, 54, 60, 54, 66, '#3a3f4e', 3);
    ell(c, 44, 44, 34, 34, 'rgba(255,255,255,.18)', 0);
    c.save(); c.translate(44, 44); c.rotate(0.5); rr(c, -36, -3, 72, 6, 3, '#d8deea', 2.5); rr(c, -3, -36, 6, 72, 3, '#d8deea', 2.5); c.restore();
    ball(c, 44, 44, 5, '#444a5a', 2);
  },
  mortar(c) {
    ell(c, 44, 70, 28, 11, '#6a5a3a', 3); c.save(); c.translate(42, 62); c.rotate(-0.7);
    rr(c, -8, -44, 28, 52, 6, lin(c, -8, 0, 20, 0, '#6a7a52', '#37452a'), 3); rr(c, -11, -48, 34, 10, 4, '#4a5a38', 3); ell(c, 6, -44, 10, 3, INK, 0); c.restore();
    ball(c, 30, 60, 9, '#4a5a38'); star(c, 30, 60, 6, 2.5, 4, '#ffdd3a', 1.5);
    ball(c, 66, 66, 7, FUR, 2); hat(c, 'none', '#000');
  },
  spike_factory(c) {
    rr(c, 10, 28, 56, 44, 6, lin(c, 0, 28, 0, 72, '#aab4c8', '#59627a'), 3); rr(c, 44, 8, 12, 24, 3, '#7a4a3a', 3);
    ell(c, 52, 6, 8, 4, 'rgba(210,210,220,.8)', 0); ball(c, 28, 48, 10, '#ffb02e'); ball(c, 28, 48, 4, INK, 0);
    rr(c, 62, 46, 30, 14, 4, '#3a3f4e', 3);
    [70, 78, 86].forEach(x => poly(c, [x - 4, 46, x, 36, x + 4, 46], '#e6ecf8', 2));
    rr(c, 14, 62, 22, 6, 2, '#ffd23c', 1.5);
  },
  monkey_village(c) {
    rr(c, 14, 46, 60, 34, 5, lin(c, 0, 46, 0, 80, '#c68a4a', '#7a4a22'), 3);
    poly(c, [4, 50, 44, 12, 84, 50], lin(c, 0, 12, 0, 50, '#e8c14a', '#b0832a'), 3);
    rr(c, 36, 58, 16, 22, 8, '#3a2412', 2.5); ball(c, 62, 62, 4, '#ffd23c', 1.5);
    ell(c, 82, 70, 9, 8, '#a8683a', 3); ell(c, 82, 64, 9, 4, '#f2cf9b', 2); star(c, 44, 28, 5, 2, 5, '#ff4a4a', 1.5);
  },
  banana_farm(c) {
    rr(c, 14, 52, 68, 30, 5, lin(c, 0, 52, 0, 82, '#c68a4a', '#7a4a22'), 3); bar(c, 14, 66, 82, 66, '#7a4a22', 2);
    for (let i = 0; i < 4; i++) {
      c.save(); c.translate(26 + i * 15, 48); c.rotate(-0.5 + i * 0.35);
      c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(0, -14, 12, 0); c.quadraticCurveTo(0, -6, -10, 0); fs(c, '#ffe14a', 2.5); c.restore();
    }
    for (let i = 0; i < 3; i++) {
      c.save(); c.translate(48, 36); c.rotate(-1.6 + i * 0.8); ell(c, 0, -12, 5, 14, glossy(c, 0, -12, 14, '#3fc23f'), 2.5); c.restore();
    }
    bar(c, 48, 50, 48, 30, '#7a4a22', 4); ball(c, 48, 30, 3, '#ffd23c', 1);
  },
};

function drawBody(c: Ctx, id: string, scale: number): void {
  const dev = DEVICES[id];
  if (dev) { dev(c, scale); return; }
  const [m, prop] = MONKEYS[id] ?? MONKEYS.dart;
  if (id === 'mermonkey') { // fish tail replaces feet
    c.beginPath(); c.moveTo(34, 70); c.bezierCurveTo(8, 80, 4, 56, 12, 60); c.bezierCurveTo(8, 68, 18, 86, 34, 78); fs(c, '#17b7b0', 3);
    monkey(c, m, () => prop(c), scale); return;
  }
  monkey(c, m, () => prop(c), scale);
}

/** Draw one tower sprite. path in 0..2 and tier in 1..5 (tier 0 = base look). */
export function drawTower(c: Ctx, id: string, path = 0, tier = 0): void {
  const col = PATH_COLORS[path] ?? PATH_COLORS[0];
  c.save();
  if (tier > 0) {
    // platform ring in the path colour; glow for upper tiers
    ell(c, 48, 80, 34, 10, mix(col, -0.2), 3);
    if (tier >= 3) { const g = c.createRadialGradient(48, 48, 12, 48, 48, 48); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, tier === 5 ? 'rgba(255,214,60,.7)' : col + '88'); c.fillStyle = g; c.fillRect(0, 0, 96, 96); }
  }
  drawBody(c, id, 1 + tier * 0.04);
  if (tier > 0) {
    for (let i = 0; i < tier; i++) ball(c, 30 + i * 9, 90, 3.6, tier === 5 ? '#ffd23c' : col, 1.8);
    if (tier === 5) star(c, 82, 14, 11, 5, 5, '#ffd23c', 2.5);
    else if (tier >= 3) star(c, 82, 14, 8, 3.6, 5, col, 2);
  }
  c.restore();
}
