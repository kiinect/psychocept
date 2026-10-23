// Contact sheets: ?g=<prefix> (tower/ hero/ bloon/ ...) &s=<scale> &f=<regex filter> &w=<width>
import { renderAtlas } from './index';

const q = new URLSearchParams(location.search);
const { canvas: atlas, frames } = renderAtlas();
const scale = +(q.get('s') ?? 2), prefix = q.get('g') ?? '', sub = q.get('f') ?? '', W = +(q.get('w') ?? 1400);
const keys = Object.keys(frames).filter(k => k.startsWith(prefix) && new RegExp(sub).test(k)).sort();
const cell = Math.max(...keys.map(k => frames[k].w)) * scale + 8, cellH = Math.max(...keys.map(k => frames[k].h)) * scale + 8;
const cols = Math.max(1, Math.floor(W / cell)), rows = Math.ceil(keys.length / cols);
const cv = document.createElement('canvas'); cv.width = cols * cell; cv.height = rows * (cellH + 12);
const c = cv.getContext('2d')!;
for (let y = 0; y < cv.height; y += 32) for (let x = 0; x < cv.width; x += 32) { c.fillStyle = ((x + y) / 32) % 2 ? '#4a8a48' : '#3f7a3e'; c.fillRect(x, y, 32, 32); }
c.font = '10px sans-serif'; c.imageSmoothingEnabled = true;
keys.forEach((k, i) => {
  const f = frames[k], x = (i % cols) * cell + 4, y = Math.floor(i / cols) * (cellH + 12) + 4;
  c.drawImage(atlas, f.x, f.y, f.w, f.h, x, y, f.w * scale, f.h * scale);
  c.fillStyle = '#fff'; c.fillText(k.replace(/^[a-z]+\//, ''), x, y + cellH + 6);
});
document.getElementById('out')!.appendChild(cv);
document.title = 'ready';
