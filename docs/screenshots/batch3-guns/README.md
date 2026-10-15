# Batch 3 — guns

Branch `art/batch3-weapons` began from latest `main` `ee0faff`. The Blaster retains its approved paint with a receiver/grip refit at the wrist. The rifle uses a bracket and an offset wooden stock to clear the arm. All 18 gun ids are present, including the three six-shooters with six visible chamber caps, long octagonal barrels and distinct wooden or steel-capped grips. Other silhouettes include flared emitters, copper coils, needle drums, a scoped rifle, twin scatter barrels, a claw launcher, fangs, a skull muzzle and an open crystal frame. Every gun has body, core, barrel and muzzle nodes; the muzzle follows the recoiling barrel.

Items: `blaster`, `pulsar`, `alchemer`, `autogun`, `sixgun`, `embersixgun`, `peacemaker`, `catalyzer`, `magnus`, `rifle`, `frostgun`, `embercaster`, `voltneedle`, `viper`, `grimcannon`, `scatter`, `polaris`, `riftlocker`.

## Native review

- [Front gallery](review-sheet.jpg), [rear gallery](review-sheet-rear.jpg): 36 native Dojo frames under default lighting, shadows and bloom.
- Each `<id>-motion-sheet.jpg` shows walking, running, dashing, the weapon's actions, charge readiness/release and Guardian guarding. Motion capture uses the game's low-quality setting; the inspection camera changes framing only.
- Recoil: shooting captures record both barrel position and muzzle world position. Charged shots use normal attack holds and releases.
- Gear, weapon selection and actions use normal controls and the **B** menu. `captures-*.json` contains player state, live joint/weapon matrices, marker positions and model hashes. `poses-<id>.json` records full action sequences, including transitions between the selected screenshots.

## Checks

- Asset index: no errors. `npm test`: 94 passed.
- [GLB validation](validation.json): 93 models, 0 errors and 0 warnings; embedded painted textures, rigid nodes, slot budgets and file limits checked.
- [Weapon clearance](weapon-clearance.json): 4670 native poses, 496248 weapon/body/gear comparisons, 0 intersecting pairs. Intended right-fist and grip/wrist socket contacts are excluded; blade, guard and maul head contacts remain checked.
- Browser capture: 0 errors and 0 warnings. All indexed GLBs loaded before capture.
- Main's generated core and all gameplay/source/test files are unchanged.

Later pass requested: paint the back of `class/guardian.glb` with a rim, straps and a bracket plate so it reads from behind. That class asset is unchanged in this weapon batch.
