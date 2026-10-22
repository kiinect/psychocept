# Data tables
JSON gameplay tables, cited per file via a top-level `"source"` field (wiki page URLs, or "RE" once decoded values override).
`data/wiki/*.json` = wiki-sourced baseline. Original code/assets only; no extracted game files.

`data/maps.json` = original hand-authored layouts (world 960x540): `lanes` are polylines `[x,y]`, `water` rects `[x,y,w,h]`. Not traced from the game; only names/tiers follow the wiki list. A map-select + multi-lane sim pass is still to do (batch after Support towers).
