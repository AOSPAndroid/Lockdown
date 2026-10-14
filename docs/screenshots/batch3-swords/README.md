# Batch 3 — swords

Branch `art/batch3-weapons` began from latest `main` `ee0faff`. All 20 sword ids are present, including the four curved fencing sabres with open basket guards and the long Moonlit Katana. Each starts from its size template and retains its grip, guard/blade (or maul head) and exact tip marker. Tapered steel, ice, flame, lightning, vine and rune surfaces use the element palette. Heavy blades have forward-swept guards; basket ribs leave the bracer clear. The starter Brand keeps its approved blade and paint with a small guard refit.

Items: `cleaver`, `brand`, `rapier`, `thorn`, `greatblade`, `spur`, `frostbite`, `blazebrand`, `voltedge`, `sickle`, `hexblade`, `maul`, `avenger`, `leviathan`, `troika`, `sabre`, `flamesabre`, `frostsabre`, `stormsabre`, `katana`.

## Native review

- [Front gallery](review-sheet.jpg), [rear gallery](review-sheet-rear.jpg): 40 native Dojo frames under default lighting, shadows and bloom.
- Each `<id>-motion-sheet.jpg` shows walking, running, dashing, the weapon's actions, charge readiness/release and Guardian guarding. Motion capture uses the game's low-quality setting; the inspection camera changes framing only.
- Momentum: Cleaver, Greatblade and Hexblade are sampled through the complete back-facing wind-up, returning cut and recovery. Maul and Troika are also sampled through every heavy combo step and charged slam.
- Gear, weapon selection and actions use normal controls and the **B** menu. `captures-*.json` contains player state, live joint/weapon matrices, marker positions and model hashes. `poses-<id>.json` records full action sequences, including transitions between the selected screenshots.

## Checks

- Asset index: no errors. `npm test`: 94 passed.
- [GLB validation](validation.json): 76 models, 0 errors and 0 warnings; embedded painted textures, rigid nodes, slot budgets and file limits checked.
- [Weapon clearance](weapon-clearance.json): 5592 native poses, 446354 weapon/body/gear comparisons, 0 intersecting pairs. Intended right-fist and grip/wrist socket contacts are excluded; blade, guard and maul head contacts remain checked.
- Browser capture: 0 errors and 0 warnings. All indexed GLBs loaded before capture.
- Main's generated core and all gameplay/source/test files are unchanged.

Later pass requested: paint the back of `class/guardian.glb` with a rim, straps and a bracket plate so it reads from behind. That class asset is unchanged in this weapon batch.
