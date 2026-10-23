# Task 09-audio
Repo: this dir (read the existing src/ first: src/sim.ts, src/main.ts, src/towers/*, tests). Original code and art only; never extract/copy/trace game assets. Sim deterministic and DOM-free; data-driven. Wiki tables in data/wiki/*.json (prose; hand-code numbers, mark ambiguity `// uncertain:`), original maps in data/maps.json. `npx tsc && npx vitest run && npx vite build` must be clean. Do not touch .re/ or .tasks/. Add tests for what you build (each tier/feature fires in a headless run). Final message: 5 lines max (files changed, stubs, deviations).

Audio: WebAudio synthesized sfx (pop, ceramic crack, placement, upgrade, sell, ability, round start/end, defeat, victory, per-tower attack sounds) and a generated looping music track for menu and in-game, volume sliders and mute persisted in localStorage. No sampled/copied audio.

Lane note: do NOT edit src/sim.ts. Create src/audio/* only plus one small hook in src/main.ts (a single `initAudio(sim)` call). Derive sound triggers by diffing sim state each frame (bloon count/hp drops = pops, tower count, cash, round number, lives) instead of adding events to the sim.
