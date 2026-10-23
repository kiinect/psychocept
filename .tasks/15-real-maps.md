# Task 15-real-maps (split: Opus = data + sim, gpt-6.1-sol = map art + view). User ask: "make all the maps match the actual ones from the game".
Data: data/maps.json now holds the REAL layout of all 12 maps (track paths, track/water/land/no-build polygons) read from the owner's
local install by .re/maps_extract.py (gameplay layout only, allowed by the owner prompt; art stays 100% original, never use game textures).
Units are BTD6 map units: play area 0..300 x 0..230 per map (`width`/`height`). The sim already used BTD6 units (dart range 32, red speed 25),
so the old 960x540 world was 3.2x too big; the world becomes the map's own width x height.

Shared API (Opus, lane/realmaps, src/maps/maps.ts is final):
  interface MapDef { id; name; tier; width; height; lanes: Pt[][]; track: Pt[][]; water: Pt[][]; land: Pt[][]; blocked: Pt[][] }
  Lanes/polygons may extend past the play area. `land` overrides `water`. Sim: createGame builds Sim with these polygons and
  `sim.width/height = map.width/height`; canPlace uses the polygons (track, water/land, blocked) and the bounds.

## 15b (gpt-6.1-sol, lane `maps-art`, branched from lane/realmaps)
Own: src/maps/* except maps.ts, src/viewport.ts, src/render/*, src/main.ts, src/screens/*, src/ui/*, src/hero-ui.ts, style/css. Do not edit src/sim.ts, data/, src/modes/*.
1. Rewrite the map painter (paint.ts, ground.ts, art.ts, deco.ts, util.ts) to draw each map from MapDef: base ground (water where `water` minus `land`),
   the road as the filled `track` polygons (stone/dirt/plank per theme, outline, edge pebbles), water with shoreline + animated shimmer, and
   `blocked` polygons filled with matching original scenery (tree clumps, rocks, buildings, crates/scrap for Scrapyard, corn rows for Cornfield,
   castle stones for Dark Castle, ravine rock for Ravine, columns for Sunken Columns, a big stump top for Tree Stump). Keep the painterly style and
   per-map themes you already have. Draw a margin beyond 0..width x 0..height (the view letterboxes) by extending ground; polygons already extend.
   Cache to a texture at devicePixelRatio. sceneSvg thumbnails for the map cards must show the new layouts.
2. View: world is width x height (300x230), not 960x540. viewport.ts fits the map into the field (letterbox, no stretching); main.ts pointer->world,
   range rings, ghost, all hardcoded 960/540 (main.ts, hero-ui.ts, render/scene.ts) use the map size. Sprites are sized in world units, so towers/bloons
   now render ~2.3x bigger relative to the map like the real game; check they match footprints (dart footprint 6 world units).
3. Tests: painter helpers that are pure (point-in-polygon, ground classification) + a test that every map's thumbnail renders without throwing.
Final message: 5 lines max.
