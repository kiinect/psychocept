// Tower sprites: 96x96, facing +x (rotate the sprite to aim), centre (48,48).
import { type Ctx, INK, ball, bar, ell, fs, glossy, inkStroke, lin, mix, poly, rr, shine, star } from './draw';

export const TOWER_SIZE = 96;
export const TOWER_IDS = [
  'dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue', 'sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar',
  'dartling', 'wizard_monkey', 'super_monkey', 'ninja_monkey', 'alchemist', 'druid', 'banana_farm',
  'engineer_monkey', 'spike_factory', 'monkey_village', 'mermonkey', 'beast_handler',
] as const;
export const PATH_COLORS = ['#ff5a4a', '#37a8ff', '#4fdc5a'] as const;

export type Hat = 'none' | 'band' | 'helmet' | 'wiz' | 'ninja' | 'goggles' | 'hard' | 'safari' | 'leaf' | 'camo' | 'pirate' | 'cap' | 'crown' | 'hood';
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
    case 'hood':
      c.beginPath(); c.arc(50, 37, 20, Math.PI, 0); c.closePath(); fs(c, glossy(c, 50, 28, 22, col), 3);
      c.beginPath(); c.arc(50, 38, 19, Math.PI * 0.92, Math.PI * 2.08); inkStroke(c, '#f4f8ff', 6);
      ell(c, 50, 17, 5, 5, '#f4f8ff', 2.5); break;
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
  ice(c) {
    // glacier base with crystals + frosty monkey in a parka
    poly(c, [14, 82, 20, 66, 34, 72, 40, 60, 54, 70, 64, 62, 78, 82], lin(c, 0, 60, 0, 84, '#e6fbff', '#7fcaf0'), 3);
    poly(c, [16, 70, 22, 44, 30, 70], '#bff1ff', 2.5); poly(c, [70, 74, 78, 50, 84, 74], '#9be4ff', 2.5);
    shine(c, 22, 60, 1.6, 6, 0.1, 0.8);
    monkey(c, mk('#3a8ad8', '#ffffff', 'hood', '#3a8ad8', '#c9a074'), () => {
      bar(c, 64, 58, 76, 40, '#cfe8f6', 3); star(c, 80, 36, 13, 5, 6, '#e8fbff', 2.5); ball(c, 80, 36, 3.5, '#7fd0ff', 1.5);
      shine(c, 76, 31, 2.5, 4, 0.4, 0.85);
    }, 1);
    for (const [x, y, r] of [[18, 30, 3], [86, 22, 2.4], [10, 50, 2]]) star(c, x, y, r * 2, r * 0.8, 4, '#fff', 1.2);
  },
  sub(c, s) {
    c.save(); c.translate(0, 4);
    // propeller + tail fins
    poly(c, [12, 54, 2, 38, 14, 46], '#2f5a96', 2.5); poly(c, [12, 54, 2, 70, 14, 62], '#2f5a96', 2.5);
    ell(c, 4, 54, 3, 11, '#c8d8ee', 2); ell(c, 4, 54, 3.5, 3.5, '#4a5266', 1.5);
    // hull
    ell(c, 46, 54, 40, 18, lin(c, 0, 36, 0, 72, '#9fc0e8', '#355a8c'), 3.5);
    c.save(); c.beginPath(); c.ellipse(46, 54, 40, 18, 0, 0, 7); c.clip();
    c.fillStyle = '#ff6a4a'; c.fillRect(0, 56, 96, 5); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(0, 40, 96, 4);
    for (const x of [24, 66]) { c.fillStyle = 'rgba(20,30,60,.35)'; c.fillRect(x, 34, 2.5, 40); }
    c.restore();
    shine(c, 34, 43, 10, 2.5, -0.05, 0.6);
    // conning tower + periscope + monkey
    rr(c, 36, 24, 22, 20, 7, lin(c, 0, 24, 0, 44, '#aac8ee', '#46689a'), 3);
    bar(c, 54, 26, 54, 12, '#6d7f9a', 3); bar(c, 54, 12, 62, 12, '#6d7f9a', 3); ell(c, 63, 12, 2.5, 3.5, '#bfeaff', 1.5);
    ball(c, 46, 26, 8.5, FUR, 2.5); ell(c, 50, 29, 4.5, 3.5, '#f2cf9b', 1.5);
    ell(c, 47, 24, 2.6, 3, '#fff', 1.5); ell(c, 54, 24, 2.6, 3, '#fff', 1.5); ell(c, 48, 25, 1.2, 1.5, INK, 0); ell(c, 55, 25, 1.2, 1.5, INK, 0);
    hat(c, 'cap', '#2f8fe8');
    // portholes, torpedo tubes
    for (const x of [30, 46, 62]) { ball(c, x, 56, 5.5, '#bfeaff', 2.5); shine(c, x - 1.5, 54, 1.6, 1.2, 0, 0.9); }
    rr(c, 80, 46, 14 * s, 6, 3, '#2e3b52', 2.5); rr(c, 80, 56, 14 * s, 6, 3, '#2e3b52', 2.5);
    c.restore();
    // bubbles + waterline foam
    for (const [x, y, r] of [[8, 34, 3], [14, 26, 2], [4, 22, 1.6]]) ell(c, x, y, r, r, 'rgba(210,245,255,.8)', 1.4);
    c.beginPath(); c.moveTo(16, 70); c.quadraticCurveTo(26, 64, 36, 70); c.quadraticCurveTo(46, 64, 56, 70); c.quadraticCurveTo(66, 64, 76, 70);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
  },
  banana_farm(c) {
    ell(c, 48, 82, 40, 9, lin(c, 0, 74, 0, 90, '#7ac04a', '#3f7a2e'), 3);
    // palm tree
    c.beginPath(); c.moveTo(20, 76); c.quadraticCurveTo(14, 46, 26, 20); inkStroke(c, '#a8723a', 6);
    for (let i = 0; i < 5; i++) { c.save(); c.translate(26, 20); c.rotate(-2.4 + i * 0.75); ell(c, 0, -10, 4.5, 12, glossy(c, 0, -10, 12, '#3fc23f'), 2.5); c.restore(); }
    ball(c, 24, 24, 3, '#ffe14a', 1.5); ball(c, 29, 26, 3, '#ffe14a', 1.5);
    // stall
    rr(c, 30, 54, 54, 26, 4, lin(c, 0, 54, 0, 80, '#d49a58', '#7a4a22'), 3);
    for (const y of [62, 70]) bar(c, 31, y, 83, y, '#6a3c18', 1.5);
    for (let i = 0; i < 4; i++) { c.save(); c.translate(38 + i * 12, 54); c.rotate(-0.5 + i * 0.3);
      c.beginPath(); c.moveTo(-9, 0); c.quadraticCurveTo(0, -13, 11, 0); c.quadraticCurveTo(0, -5, -9, 0); fs(c, '#ffe14a', 2.5); c.restore(); }
    // striped awning
    for (let i = 0; i < 6; i++) poly(c, [28 + i * 10, 34, 38 + i * 10, 34, 40 + i * 10, 46, 30 + i * 10, 46], i % 2 ? '#fff6e0' : '#ee4a3a', 2);
    bar(c, 28, 32, 88, 32, '#7a4a22', 3);
    // monkey shopkeeper peeking over the counter
    ball(c, 60, 44, 8, FUR, 2.5); ell(c, 63, 47, 4.5, 3.5, '#f2cf9b', 1.5);
    ell(c, 58, 42, 2.4, 2.8, '#fff', 1.5); ell(c, 65, 42, 2.4, 2.8, '#fff', 1.5); ell(c, 59, 43, 1.1, 1.5, INK, 0); ell(c, 66, 43, 1.1, 1.5, INK, 0);
    // coin sign
    ball(c, 80, 20, 8, '#ffc61f', 2.5); bar(c, 80, 15, 80, 25, '#b8791a', 2.5); star(c, 91, 10, 4, 1.6, 4, '#fff', 1);
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
  const col = PATH_COLORS[path] ?? PATH_COLORS[0], gold = '#ffd23c', acc = tier === 5 ? gold : col;
  c.save();
  if (tier > 0) {
    ell(c, 48, 82, 34, 10, mix(col, -0.2), 3);
    if (tier >= 3) { // soft radial aura fully inside the 96x96 cell (no clipped square)
      const g = c.createRadialGradient(48, 52, 4, 48, 52, 47);
      g.addColorStop(0, acc + (tier === 5 ? 'cc' : '88')); g.addColorStop(0.55, acc + '44'); g.addColorStop(1, acc + '00');
      c.fillStyle = g; c.beginPath(); c.arc(48, 52, 47, 0, 7); c.fill();
    }
    if (tier === 5) for (let i = 0; i < 12; i++) { // god-rays
      const a = i * Math.PI / 6; c.beginPath(); c.moveTo(48 + Math.cos(a) * 20, 52 + Math.sin(a) * 20);
      c.lineTo(48 + Math.cos(a - 0.1) * 46, 52 + Math.sin(a - 0.1) * 46); c.lineTo(48 + Math.cos(a + 0.1) * 46, 52 + Math.sin(a + 0.1) * 46); c.closePath();
      c.fillStyle = 'rgba(255,230,120,.35)'; c.fill();
    }
    if (tier >= 3) { // fluttering cape behind the body, in the path colour
      c.beginPath(); c.moveTo(34, 56); c.quadraticCurveTo(14, 58, 8, 80); c.quadraticCurveTo(22, 72, 26, 84); c.quadraticCurveTo(32, 72, 46, 76); c.closePath();
      fs(c, lin(c, 8, 56, 40, 84, mix(acc, 0.25), mix(acc, -0.35)), 3);
    }
  }
  const sc = tier > 0 ? 0.94 + tier * 0.012 : 1;
  c.translate(48, 56); c.scale(sc, sc); c.translate(-48, -56);
  drawBody(c, id, 1 + tier * 0.04);
  c.restore();
  if (tier > 0) {
    for (let i = 0; i < tier; i++) ball(c, 30 + i * 9, 91, 3.6, acc, 1.8);
    if (tier >= 4) for (let i = 0; i < (tier === 5 ? 4 : 2); i++) { // orbiting power gems
      const a = -0.7 + i * (Math.PI / 2) * (tier === 5 ? 1 : 2), x = 48 + Math.cos(a) * 41, y = 52 + Math.sin(a) * 36;
      poly(c, [x, y - 6, x + 4.5, y, x, y + 6, x - 4.5, y], mix(acc, 0.35), 2); shine(c, x - 1, y - 2, 1.2, 2, 0.3, 0.9);
    }
    if (tier === 5) { star(c, 82, 14, 12, 5.5, 5, gold, 2.5); star(c, 14, 20, 6, 2.6, 4, '#fff', 1.4); }
    else if (tier >= 3) star(c, 82, 14, 8, 3.6, 5, col, 2);
  }
}
