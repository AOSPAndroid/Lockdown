# Batch 3 — bombs

Branch `art/batch3-weapons` began from latest `main` `ee0faff`. All 10 bomb ids have both held and planted models. Planted body pivots are on the floor; the fuse moves with the casing through its warning swell. The two sizes share the same painted casing language, element palette and hardware. Nitro is barrel-sized; the others are compact spheres, canisters or faceted shells. Every model has body and an emissive fuse node. Held origins fit the fist; planted origins sit on the floor.

Items: `blast`, `haze`, `frost`, `venom`, `storm`, `hex`, `shard`, `vortex`, `nitro`, `spark`.

## Native review

- [Front gallery](review-sheet.jpg), [opposite-side gallery](review-sheet-rear.jpg): 20 held-bomb frames under default lighting, shadows and bloom. Another 20 frames show the planted models below.
- Each `<id>-motion-sheet.jpg` shows walking, running, dashing, the weapon's actions, charge readiness/release and Guardian guarding. Motion capture uses the game's low-quality setting; the inspection camera changes framing only.
- Planting uses normal attack holds and releases. The player dashes away before the planted inspection frames to expose the casing, warning fuse and floor contact.
- Gear, weapon selection and actions use normal controls and the **B** menu. `captures-*.json` contains player state, live joint/weapon matrices, marker positions and model hashes. `poses-<id>.json` records full action sequences, including transitions between the selected screenshots.

[Planted front gallery](review-sheet-planted-front.jpg) and [planted rear gallery](review-sheet-planted-rear.jpg) show all ten floor models. [Floor checks](planted-floor.json): 45 native planted samples, 0 floor issues, including warning swell.

## Checks

- Asset index: no errors. `npm test`: 94 passed.
- [GLB validation](validation.json): 111 models, 0 errors and 0 warnings; embedded painted textures, rigid nodes, slot budgets and file limits checked.
- [Weapon clearance](weapon-clearance.json): 2322 native poses, 125730 weapon/body/gear comparisons, 0 intersecting pairs. Intended right-fist contact is excluded; casing, fins, hardware and fuse contacts remain checked.
- Browser capture: 0 errors and 0 warnings. All indexed GLBs loaded before capture.
- Main's generated core and all gameplay/source/test files are unchanged.

Later pass requested: paint the back of `class/guardian.glb` with a rim, straps and a bracket plate so it reads from behind. That class asset is unchanged in this weapon batch.
