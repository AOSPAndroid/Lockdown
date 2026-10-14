# Batch 2 — 13 helmets

Branch `art/batch2-helmets` starts from fresh `main` `9f6d485`. All 13 heads have distinct rigid silhouettes, painted panel lines, gold hardware and emissive optics. Cobalt and Sallet keep their approved sharp blue blade fins. Feather uses a gold quill and Horned uses amber eyes, following the requested helmet palette change. No helmet has a red painted crest or rounded crest lobes.

Items: `sallet`, `visor`, `horned`, `hood`, `lampcap`, `feather`, `bucket`, `circlet`, `cobalt`, `wolver`, `demo`, `seraph`, `goggles`.

## Review

- [Front gallery](review-sheet.jpg) and [rear gallery](review-sheet-rear.jpg): 26 native Dojo captures with the game's default lighting, shadows and bloom.
- Each `<id>-motion-sheet.jpg` shows idle, walking, running, dashing, the full three-cut sword combo, gun recoil and Guardian guarding.
- The 117 individual motion frames use the game's low-quality mode for repeatable action capture. An inspection camera changes framing only; movement, aiming, weapon actions and gear changes use the normal controls and the **B** menu.
- `captures-gallery.json` and `captures-motion.json` record the real player state and world joint matrices for every frame.

## Validation

- `node tools/art3d-index.mjs`: no errors.
- `npm test`: 84 passed.
- [GLB validation](validation.json): 24 files, 0 errors and 0 warnings. Each authored model has one embedded painted JPEG, exact template roots, no skins or animation clips, and stays under its slot budget and 600 KB.
- This slot ranges from 384–1072 triangles and 70,660–139,816 bytes per file.
- [Joint sweeps](joint-clearance.json): 39 neighbouring-part checks over the specified joint ranges, 0 intersecting samples.
- [Captured pose clearance](dojo-clearance.json): 1898 neighbouring gear checks across 143 real rendered frames, 0 intersecting pairs.
- Browser capture: 0 errors, 0 warnings; all GLBs loaded before capture.

Approved assets from earlier slots are carried into this fresh branch to review complete robots. Main's generated `knight/body.glb` is byte-for-byte unchanged. No gameplay, source or test files are edited.

No unresolved asset issues were found in these checks.
