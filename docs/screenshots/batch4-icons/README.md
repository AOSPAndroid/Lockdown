# Batch 4 — model-rendered menu icons and Guardian back

Branch `art/batch4-icons` starts from latest main `33d40fa`, after the batch 3 merge `67622fd`.

[All 109 icons, light background](contact-sheet.png) · [Dark background](contact-sheet-dark.png)

| Icons | Count |
|---|---:|
| Helmets, including bare head | 14 |
| Armour, including unarmoured | 16 |
| Pants, including bare legs | 12 |
| Shoes, including bare feet | 12 |
| Swords, including four sabres and katana | 20 |
| Guns, including three six-shooters | 18 |
| Bombs | 10 |
| Classes | 3 |
| Ability buttons | 4 |

Every icon is a 96×96 RGBA PNG with a transparent background, rendered from the final GLBs. The whole set shares one orthographic three-quarter camera, Y up, a warm key light projecting from the top-left, cool fill and warm bounce. Each item is fitted uniformly without stretching. Swords share a display tilt. A soft dark outline is applied at 4× resolution before the final antialiased reduction. [Render and image checks](icon-validation.json) record the settings, source-model hashes, output hashes, dimensions and transparent margins for every icon.

Gear is assembled at the core frame's joint positions. Open equipment includes the matching underlying frame parts; the four `none` icons show those bare parts directly. The core GLB is unchanged. Guardian and Recon class icons show their shield devices; Striker shows the core robot with its trail. Ability icons use model parts and their light effects. Bomb menu icons use the held casings.

## Guardian back

The existing back cap now uses the painted blue atlas swatch, with gold and silver rim bands, dark straps with gold fastening cuffs, and a silver bracket plate with gold bolts. It is 1,476 triangles and 168,932 bytes, with the same embedded 512×512 painted atlas, hierarchy and pivots.

- [Front in the Dojo](guardian-dojo/brand-gallery-front.jpg) · [Painted back in the Dojo](guardian-dojo/brand-gallery-rear.jpg).
- [Front preservation checks](guardian-front-validation.json): all 1,214 original front/mount/side triangles remain; only the 22 existing back-cap triangles are repainted. Added back detail uses 240 triangles. The approved paint atlas is unchanged.
- `guardian-dojo/` contains 23 native screenshots: front/back, idle, walking, running, dashing, the full Brand combo, Blaster shooting/reload, charge and guarding. Gear and actions use normal controls; the inspection camera changes framing only.
- [Weapon clearance](guardian-dojo/weapon-clearance.json): 539 native poses and 51,226 weapon/body/gear comparisons, no intersections. Intended fist and grip/socket contact is excluded.

## Menu registration and verification

Three bare-frame icons were absent from the asset manifest, and class-icon entries expected 64/128-pixel files. The asset declarations now register those three `none` icons and use the same logical 48×48 / 2× PNG contract for class icons as other menu icons. The index and standalone kit manifest/checklist are regenerated. Gameplay, the renderer and client behavior are unchanged.

- [Runtime menu validation](menu-validation.json): all 109 icons load at 96×96; gear grids, classes and all 48 Armory cards use their images; no browser errors or warnings.
- [Helmet menu](menu-helmet.jpg) · [Armour](menu-armor.jpg) · [Pants](menu-pants.jpg) · [Shoes/classes](menu-classes.jpg).
- [All swords](armory-blade-last.jpg) · [Guns](armory-gun-last.jpg) · [Bombs](armory-bomb-last.jpg).
- Model index: 111 models, no errors. [Official glTF and contract validation](validation.json): 0 errors and 0 warnings.
- Icon art checker: 109/109 present, no errors. Every expected icon is listed in the regenerated asset index.
- `npm test`: 96 passed, 0 failed. [Check summary](checks.json).

## Existing client issue for a later pass

On a cold page load, the loadout's three weapon-slot buttons can retain glyph placeholders after images finish loading. Armory cards, gear and classes load correctly. Reselecting a weapon refreshes its loadout thumbnail; the menu screenshots use that normal selection flow. [Initial state](loadout-cache-initial.jpg). `renderMenu()` caches loadout buttons by `id:editable`; `refreshIcons()` does not invalidate those buttons. This client cache behavior is recorded here for a code pass.
