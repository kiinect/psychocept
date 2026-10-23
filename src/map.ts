import type { Pt, Rect } from './sim';
export const DEFAULT_MAP: { path: Pt[]; water: Rect[] } = {
  path: [{ x: 0, y: 150 }, { x: 700, y: 150 }, { x: 700, y: 450 }, { x: 200, y: 450 }, { x: 200, y: 300 }, { x: 960, y: 300 }],
  water: [{ x: 400, y: 195, width: 180, height: 65 }],
};
