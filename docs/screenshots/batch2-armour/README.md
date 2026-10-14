# Batch 2 — 15 armour sets

Branch `art/batch2-armour` starts from fresh `main` `438e8e9`. All 15 torsos follow the joint template, with separate shoulders, upper arms and bracers. Silhouettes range from the slim Fencer and Windrunner to riveted Juggernaut siege plates, beast mantles, mirror scales, a medical module and the brass Clockwork harness. Coats use swept rigid tail sectors. Forward bicep covers leave the elbow exposed and clear both class shields through 100-degree elbow bends.

Items: `scout`, `ballistic`, `duelist`, `heavy`, `gunslinger`, `fencer`, `windrunner`, `juggernaut`, `bombardier`, `berserker`, `mirrorweave`, `medic`, `cobalt`, `vog`, `clockwork`.

## Review

- [Front gallery](review-sheet.jpg) and [rear gallery](review-sheet-rear.jpg): 30 native Dojo captures with the game's default lighting, shadows and bloom.
- Each `<id>-motion-sheet.jpg` shows idle, walking, running, dashing, the full three-cut sword combo, gun recoil and Guardian guarding.
- The 135 individual motion frames use the game's low-quality mode for repeatable action capture. An inspection camera changes framing only; movement, aiming, weapon actions and gear changes use the normal controls and the **B** menu.
- `captures-gallery.json` and `captures-motion.json` record the real player state, world joint matrices and SHA-256 hashes of the loaded model files for every frame.

## Validation

- `node tools/art3d-index.mjs`: no errors.
- `npm test`: 87 passed.
- [GLB validation](validation.json): 37 files, 0 errors and 0 warnings. Each authored model has one embedded painted JPEG, exact template roots, no skins or animation clips, and stays under its slot budget and 600 KB.
- This slot ranges from 812–1868 triangles and 189,044–275,764 bytes per file.
- [Joint sweeps](joint-clearance.json): 2520 neighbouring-part checks over the specified joint ranges, 0 intersecting samples.
- [Captured pose clearance](dojo-clearance.json): 2300 neighbouring gear checks across 165 real rendered frames, 0 intersecting pairs.
- Browser capture: 0 errors, 0 warnings; all GLBs loaded before capture.

Approved assets from earlier slots are carried into this fresh branch to review complete robots. Main's generated `knight/body.glb` is byte-for-byte unchanged. No gameplay, source or test files are edited.

No unresolved asset issues were found in these checks.
