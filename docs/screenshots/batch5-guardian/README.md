# Batch 5 — Guardian back

The Guardian's painted blue back cap, gold/silver rim, straps, fastening cuffs, silver bracket and gold bolts were already completed in batch 4. This step **retains that treatment** and finishes the exposed rear-bracket edge with four dark painted recess slots and a small gold registration chevron. The 12 added triangles sit on the existing plate surface, inside its outline, without changing the shield's bulk or attachment.

Final `class/guardian.glb`: **1,488 / 1,500 triangles**, **170,084 / 600,000 bytes**, one embedded **512² JPEG**, rigid nodes, no skins or clips. All **1,476 existing triangles**, their positions/normals/UVs and materials remain intact. The embedded atlas is byte-identical. Node names, pivots and hierarchy are unchanged, including `forearm_L > plate` and the mount. The approved front and its icon remain intact.

[Contact sheet](contact-sheet.jpg): actual Dojo views of the back on a bare frame and with Cobalt armour, the full knight from behind, the unchanged front, walking, running, shield raising and the expanded dome. The arm naturally covers part of the mounting bracket; [bare frame](guardian-bare-back-detail.jpg) and [gun-held view](guardian-back-gun-idle.jpg) expose the painted hardware without a back-mounted long gun. Full-resolution images and [capture state/source hashes](captures.json) are alongside the sheet. All actions use native B loadout controls, keyboard movement and held RMB at `http://localhost:3010/lockdown.html?solo=1&dojo=1`. Inspection cameras/capture pauses run in browser memory; poses and geometry remain native.

Checks: **4 textures and 124 models, no asset-checker errors; 109 tests passed; Khronos glTF validation 0 errors/0 warnings; browser 0 errors/0 warnings.** A triangle-level check confirms the existing front/back/mount geometry, UVs, materials and atlas are preserved, and the new triangle winding matches its normals. All 123 other models and the four effect sprites are unchanged.

The entire shield plate (including straps, bracket and new details) has **zero body/gear surface intersections in 282 pairs across these 11 captured poses**. The separate mount is the intended attachment and was not checked against its socket. The plate-to-forearm transform is constant within floating-point precision, so it does not drift. This sampled check does not claim every possible armour/pose combination.

Evidence: [preservation](preservation.json), [clearance](clearance.json), [verification](verification.json), [budgets](build.json), [glTF validation](validation.json), [test output](tests.txt). Only the Guardian GLB and this review folder change in this step. No JavaScript, HTML, tests, arenas or menu icons were edited.

The projectile, effect-sprite and Guardian steps of batch 5 are complete. The runtime disc-spin, reverse-slash UV and first-shot muzzle-placement notes are retained in the preceding step reviews; they were not changed in code.
