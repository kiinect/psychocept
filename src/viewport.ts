// Rendering transforms only: simulation coordinates always remain 960 × 540.
export function fitWorld(width: number, height: number) {
  const scale = Math.max(0, Math.min(width / 960, height / 540));
  return { scale, x: (width - 960 * scale) / 2, y: (height - 540 * scale) / 2 };
}
export function worldPoint(x: number, y: number, width: number, height: number) {
  const fit = fitWorld(width, height);
  return { x: (x - fit.x) / fit.scale, y: (y - fit.y) / fit.scale };
}
