// Rendering transforms only: fit the world (the map's play area, BTD6 units) into the screen, letterboxed, never stretched.
export function fitWorld(width: number, height: number, worldW = 960, worldH = 540) {
  const scale = Math.max(0, Math.min(width / worldW, height / worldH));
  return { scale, x: (width - worldW * scale) / 2, y: (height - worldH * scale) / 2 };
}
export function worldPoint(x: number, y: number, width: number, height: number, worldW = 960, worldH = 540) {
  const fit = fitWorld(width, height, worldW, worldH);
  return { x: (x - fit.x) / fit.scale, y: (y - fit.y) / fit.scale };
}
