# Batch 5 — holsters and heart, first approval checkpoint

Branch: `art/batch5-gear-fx`, based on main `3083df6`.

Four new embedded, rigid GLBs: a hollow dark sheath with gold locket and silver chape, an open pistol clip holster, a bomb cage with belt clip, and a glossy ruby heart with a soft emissive material. Each carrier has a team-colour trim and remains on the knight when empty. The sheath mouth is at the origin and extends along +X; the holster and cage follow the pistol and bomb templates.

| Model | Triangles / 800 | File bytes | Texture |
|---|---:|---:|---|
| `holsters/sheath.glb` | 212 | 46,092 | one embedded 512² JPEG |
| `holsters/holster.glb` | 368 | 60,940 | one embedded 512² JPEG |
| `holsters/pouch.glb` | 440 | 68,604 | one embedded 512² JPEG |
| `pickups/heart.glb` | 448 | 53,392 | one embedded 512² JPEG |

## In-game review

- [Contact sheet](contact-sheet.jpg): full four-slot loadout, front and back, with Brand, Katana, Pulse Blaster and Cannonball Bomb selected in turn. The last row shows the actual dummy knockout and both sides of its dropped heart.
- [Walking/running switches](swap-contact-sheet.jpg): native put-away, reach and draw phases, including a running cycle through slots 1–4. Full-resolution `swap-*.jpg` files are alongside it.
- [Armory turns](armory-contact-sheet.jpg): real pointer drags of the Armory preview. Full-window `armory-*.jpg` captures preserve the UI. The current Armory preview displays only the selected weapon and its carrier; the Dojo captures show all four together.

Captured in Chromium at `http://localhost:3008/lockdown.html?solo=1&dojo=1`, using the game's B loadout controls, movement, weapon keys and shooting. Inspection cameras and capture pauses were applied in browser memory; no repository code was edited. Animation and transforms are native. Fourteen actual Blaster shots knocked out a training dummy; its loaded heart GLB was photographed while bobbing and spinning, including two close views 400 ms apart.

## Fit issues requiring review

The numerical body-clearance check is **not a clean pass**. Carriers remain rigidly attached without drifting, but these contacts remain with the current sockets/poses:

1. **Brand's right-back sheath mouth meets the Cobalt back plate.** Its shell and locket overlap the chest armour in all 411 recorded poses. See [rear view](blaster-gallery-rear.jpg). The fixed socket places the template-sized mouth at the back plate; relocating the opening would break the specified weapon/carrier alignment. A socket offset needs review.
2. **Katana curvature exceeds the scaled straight sheath.** Its edge is visible outside the sheath near the lower thigh in the same rear views. The Katana has approximately +0.070 local Z curvature; the renderer scales the generic sheath to half width, giving about +0.037 internal clearance. A curve-aware sheath or per-weapon width/offset allowance needs review. Widening every sheath enough would exceed the requested roughly 0.17 nominal width.
3. **Brief running contacts:** five sampled poses have a Brand sheath/hip-armour contact; two have a pistol-carrier/right-hand contact outside the draw interval. These are retained in [carrier-clearance.json](carrier-clearance.json), with sequence and time. The check excludes the intended bomb belt-clip attachment and the reaching right hand during a native draw; it does not silently exclude these other findings.

These issues are documented under the brief's asset-only rule. No JavaScript, HTML or tests were changed. Review covers the requested four-weapon loadout, not every possible weapon/armour combination.

## Checks and evidence

- `node tools/art3d-index.mjs`: **115 models, no errors**.
- `npm test`: **107 passed, 0 failed**, [full output](tests.log).
- Khronos glTF validator: **115 GLBs, 0 errors, 0 warnings**; new files meet the 800-triangle, one 512² texture and 600 KB limits. [Validation](validation.json).
- Browser: **0 errors, 0 warnings**; 26 Dojo and 8 Armory screenshots.
- All **111 existing models unchanged**, including the core skeleton and already-painted Guardian. No existing icons changed.
- [Verification](verification.json), [capture state and source hashes](captures.json), [Armory evidence](armory-captures.json), and [411 native pose samples](motion-poses.json.gz). The recorded carrier-to-parent matrices remain constant to floating-point precision; all capture hashes match the delivered GLBs.

Only these four models, the generated 3D index and this review folder are delivered. Projectiles, effect sprites and later steps have not been started. **Stopped for approval.**
