# Batch 2 — 11 pants sets

Branch `art/batch2-pants` starts from fresh `main` `4c7cbd8`. All 11 leg sets have separate thighs, knee/shin pieces and a raised waist belt. The sets include ring-pattern chainmail, utility pouches, wolf-claw plates, demolition charges, white/gold tassets and split tartan sectors. Cobalt, Wolver, Demo and Seraph match their helmet palettes.

Items: `greaves`, `leggings`, `chausses`, `breeches`, `sapper`, `cargo`, `cobalt`, `wolver`, `demo`, `seraph`, `kilt`.

## Review

- [Front gallery](review-sheet.jpg) and [rear gallery](review-sheet-rear.jpg): 22 native Dojo captures with the game's default lighting, shadows and bloom.
- Each `<id>-motion-sheet.jpg` shows idle, walking, running, dashing, the full three-cut sword combo, gun recoil and Guardian guarding.
- The 99 individual motion frames use the game's low-quality mode for repeatable action capture. An inspection camera changes framing only; movement, aiming, weapon actions and gear changes use the normal controls and the **B** menu.
- `captures-gallery.json` and `captures-motion.json` record the real player state, world joint matrices and SHA-256 hashes of the loaded model files for every frame.

## Validation

- `node tools/art3d-index.mjs`: no errors.
- `npm test`: 94 passed.
- [GLB validation](validation.json): 47 files, 0 errors and 0 warnings. Each authored model has one embedded painted JPEG, exact template roots, no skins or animation clips, and stays under its slot budget and 600 KB.
- This slot ranges from 992–1968 triangles and 138,596–230,964 bytes per file.
- [Joint sweeps](joint-clearance.json): 1342 neighbouring-part checks over the specified joint ranges, 0 intersecting samples.
- [Captured pose clearance](dojo-clearance.json): 1650 neighbouring gear checks across 121 real rendered frames, 0 intersecting pairs.
- Browser capture: 0 errors, 0 warnings; all GLBs loaded before capture.

Approved assets from earlier slots are carried into this fresh branch to review complete robots. Main's generated `knight/body.glb` is byte-for-byte unchanged. No gameplay, source or test files are edited.

No unresolved asset issues were found in these checks.
