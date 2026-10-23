# Synthesized audio

`initAudio(sim)` runs after simulation stepping each rendered frame. It compares copied state without mutating the simulation. Tower identity, spending, shots and ability cooldowns distinguish placement, sale, upgrade, attack and ability use. Bloon IDs/HP and pop income detect damage; lives help distinguish leaked bloons. Cues are deduplicated per frame and voices are rate limited.

All patches and both 16-second looping tracks are original oscillator/PCM synthesis, with no samples or downloaded assets. The pre-round screen uses menu music; starting a round switches to gameplay music. Defeat and completion of the last round in the data stop music and play their respective cues. Audio starts after a pointer or keyboard gesture and suspends while the page is hidden.

The Audio fieldset has separate sound-effect and music volumes and a mute checkbox. Preferences use localStorage key `monkey-pop-audio-v1`; unavailable storage or WebAudio does not interrupt gameplay.

State polling cannot reconstruct actions that completely cancel one another within a frame, or identify ceramic hits when a ceramic is both spawned and destroyed within that frame. Pop income still supplies the generic cue. A simultaneous leak and pop without positive net income can also be ambiguous. No simulation event hooks are added.

Run `npx tsc && npx vitest run && npx vite build`. Tests include real headless simulation attacks for every tower upgrade tier, cue transitions, settings parsing, WebAudio scheduling through a boundary fake, and generated PCM validation. Browser listening/UI verification requires a connected browser.
