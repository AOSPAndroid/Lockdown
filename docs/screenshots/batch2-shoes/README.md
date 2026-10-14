# Batch 2 — 11 shoe sets

Branch `art/batch2-shoes` starts from fresh `main` `f62b01e`. All 11 feet use independent ankle roots, beveled soles and painted surfaces. The set includes blue dash fins, gold rowels, black tread blocks, visible spring stacks, strap plates, ember cracks, cyan thruster lenses and polished silver streaks. Sabatons retain the approved segmented Cobalt design.

Items: `sneakers`, `sabatons`, `dashboots`, `spurs`, `treads`, `clogs`, `sandals`, `striders`, `magma`, `hover`, `quicksilver`.

## Review

- [Front gallery](review-sheet.jpg) and [rear gallery](review-sheet-rear.jpg): 22 native Dojo captures with the game's default lighting, shadows and bloom.
- Each `<id>-motion-sheet.jpg` shows idle, walking, running, dashing, the full three-cut sword combo, gun recoil and Guardian guarding.
- The 99 individual motion frames use the game's low-quality mode for repeatable action capture. An inspection camera changes framing only; movement, aiming, weapon actions and gear changes use the normal controls and the **B** menu.
- `captures-gallery.json` and `captures-motion.json` record the real player state, world joint matrices and SHA-256 hashes of the loaded model files for every frame.

## Validation

- `node tools/art3d-index.mjs`: no errors.
- `npm test`: 94 passed.
- [GLB validation](validation.json): 57 files, 0 errors and 0 warnings. Each authored model has one embedded painted JPEG, exact template roots, no skins or animation clips, and stays under its slot budget and 600 KB.
- This slot ranges from 328–1000 triangles and 63,720–126,868 bytes per file.
- [Joint sweeps](joint-clearance.json): 2178 neighbouring-part checks over the specified joint ranges, 0 intersecting samples.
- [Captured pose clearance](dojo-clearance.json): 1606 neighbouring gear checks across 121 real rendered frames, 0 intersecting pairs.
- Browser capture: 0 errors, 0 warnings; all GLBs loaded before capture.

Approved assets from earlier slots are carried into this fresh branch to review complete robots. Main's generated `knight/body.glb` is byte-for-byte unchanged. No gameplay, source or test files are edited.

No unresolved asset issues were found in these checks.
