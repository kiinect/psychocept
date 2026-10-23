# Task 12b-ui-sprites (gpt-6.1-sol lane `ui`, after 12a; Opus reviews before merge)
Same rules and file ownership as .tasks/12a-ui-shell.md. You may also add files under src/render/. Final message: 5 lines max.

Replace the flat-shape entity drawing in the Pixi scene with the src/art atlas (`buildTextures(renderer)` once at startup, `spriteFor`/`spriteKey`):
- Towers: sprite by kind and tier triple, rotates to face its current target (read the target/angle from sim state; if the sim exposes no angle, derive it from the nearest bloon the tower would target and mark `// uncertain:`), short recoil/scale punch when it fires. Heroes use hero sprites. Selected tower shows a range ring sprite.
- Bloons: pooled Sprites (create on demand, never destroyed mid-game; hide/return to pool on pop), tinted/overlaid for camo/regrow/fortified per BLOON_OVERLAYS, MOAB-class blimps rotated along the path direction with damage-state if available. One ParticleContainer or batched Container; zero per-frame allocations in the hot loop.
- Projectiles via PROJ_IDS sprites (pooled), pop fx via FX frames (pooled, 6-8 frame flipbook), floating cash/pop numbers (pooled BitmapText or Text cache).
- Perf gate: add tools/ or a vitest that runs a 1000-bloon headless stress through the render adapter's pure update path (mock textures) and asserts the pool size stays bounded and no new sprites are created after warmup. Keep 60fps at 1000+ bloons on a mid laptop.
