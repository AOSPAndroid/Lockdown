# Stack / Step 1

Approved direction: **Stack**, using **D**, `docs/reference/knight_rig_4_heads.glb`.
The standing body is 1.3 units tall, faces +X and preserves every rigid reference part, pivot and parent.
The chosen art rules live in [ART-GUIDE.md](../../docs/ART-GUIDE.md#chosen-direction-stack).

This batch contains eleven runtime models: the starter body and hair, Guardian and Recon devices,
Cobalt helm/mail/cuisses, Knight Brand, Pulse Blaster and Cannonball Bomb in hand and planted.
There is no Striker mesh; the game supplies its trail.

## Sources

- `build.mjs`: the approved Stack body, hair, Cobalt set, Guardian shield and Knight Brand.
- `kit.mjs`: bevelled geometry, packed UVs, lossless vertex indexing and binary glTF export.
- `extras.mjs`: the Recon buckler with the named emissive `lens`, Blaster and Cannonball models.
- `painted-atlas.png`: the approved source painting, uniformly resized to 1024 × 1024.
  This complete atlas is an authoring source only; it is never embedded in a runtime model.
- `texture-prompt.txt`: the original atlas-generation prompt. Stack uses its third material row,
  plus the shared auxiliary swatches; the earlier style rows remain only for provenance.
- `pack-texture.mjs`: crops only the swatches referenced by each model, packs square regions
  without stretching, and exports opaque JPEG at quality 90 with 4:4:4 colour sampling.
- `packed-textures/` and `texture-manifest.json`: the exact per-model JPEGs and region/byte report.
- `audit-packed.mjs`: checks texture budgets, referenced regions, UV bounds, rigid D pivots,
  triangle streams against the previous batch, Brand length and Khronos glTF diagnostics.

The original mockups and 1254 × 1254 source painting are preserved on the unmerged
[`art/style-mockups` branch](https://github.com/AOSPAndroid/Lockdown/tree/art/style-mockups/review/style-contrast),
at commit `3bda5a1`. Step 1 retains those shapes and paint, adds the catalogue's gloves/hairband,
and extends the same layered construction to the Recon device, gun and bombs.
Knight Brand now measures 0.75 units from grip to tip, following the updated catalogue.

The eleven GLBs total **1.16 MiB**, **94.8% smaller** than the previous full-atlas batch.
Every file is below 600,000 bytes; the largest is the 264 KiB body. Each embeds one JPEG:
1024² for body/mail, 512² for hair/helm/cuisses/Guardian/weapons, and 256² for Recon.
Only used Stack/shared swatches are packed; unused cells are solid padding. No Arc/Cut rows
or unused item regions are shipped. Character geometry and normals are unchanged by repacking.

From the repository root, rebuild only this batch with:

```sh
npm ci --prefix review/step1-stack
node review/step1-stack/build.mjs
node review/step1-stack/audit-packed.mjs
node tools/art3d-index.mjs
npm test
npm start
```

The current index tool's default path needs POSIX on Windows; run the exact checks in WSL,
or pass `public/art/3d` explicitly to the index tool when using native Windows Node.
No game, renderer, catalogue or test logic was changed for this batch.

## Review

Open the actual game at <http://localhost:3000/lockdown.html?solo=1&dojo=1>.
Press B to mix the three Cobalt pieces, change class, and choose the three new weapons.

For the comparison pages:

```sh
git fetch origin art/style-mockups
node review/step1-stack/serve-review.mjs
```

- <http://localhost:3012/> compares the approved mockup GLBs with the production GLBs.
- <http://localhost:3012/review/classes-review.html> shows all three classes idle, running,
  swinging and charging as native-size crops from the real Dojo,
  with links to every complete screenshot. The review server reads approved references from
  commit `3bda5a1` if a local `mockup/` cache is absent. It never alters the game server or its assets.
- Permanent screenshots and validation results: [docs/screenshots/step1-stack](../../docs/screenshots/step1-stack).

Stop here for approval before other equipment, weapons, icons or arenas.
