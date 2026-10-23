import mapJson from '../../data/maps.json';
import type { Pt } from '../sim';

/**
 * Real BTD6 map layouts (track paths + area polygons from the owner's install, see data/maps.json source), in BTD6 map units.
 * Play area is 0..width x 0..height; lanes and polygons may extend past it (entries/exits, edge forests).
 * Areas: `track` blocks placement and is drawn as the road; `water` allows only water towers; `land` overrides water
 * (islands, columns); `blocked` is no-build (trees, rocks, buildings). Art is drawn from these, original style.
 */
export interface MapDef {
  id: string; name: string; tier: string; width: number; height: number;
  lanes: Pt[][]; track: Pt[][]; water: Pt[][]; land: Pt[][]; blocked: Pt[][];
}

const pts = (a: number[][]) => a.map(([x, y]) => ({ x, y }));
export const MAPS: Record<string, MapDef> = {};
for (const [id, m] of Object.entries(mapJson.maps)) {
  MAPS[id] = { id, name: m.name, tier: m.tier, width: m.width, height: m.height,
    lanes: m.lanes.map(pts), track: m.track.map(pts), water: m.water.map(pts), land: m.land.map(pts), blocked: m.blocked.map(pts) };
}
export const TIERS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
