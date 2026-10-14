# Stack / Step 1

Approved direction: **Stack**, using **D**, `docs/reference/knight_rig_4_heads.glb`.
The standing body is 1.3 units tall, faces +X and preserves every rigid reference part, pivot and parent.
The chosen art rules live in [ART-GUIDE.md](../../docs/ART-GUIDE.md#chosen-direction-stack).

This batch contains eleven runtime models: the starter body and hair, Guardian and Recon devices,
Cobalt helm/mail/cuisses, Knight Brand, Pulse Blaster and Cannonball Bomb in hand and planted.
There is no Striker mesh; the game supplies its trail.

## Sources

- `build.mjs`: the approved Stack body, hair, Cobalt set, Guardian shield and Knight Brand.
- `kit.mjs`: bevelled geometry, atlas UVs and binary glTF export.
- `extras.mjs`: the Recon buckler with the named emissive `lens`, Blaster and Cannonball models.
- `painted-atlas.png`: the approved atlas, uniformly exported at 1024 × 1024 for the runtime contract.
- `texture-prompt.txt`: the original atlas-generation prompt. Stack uses its third material row,
  plus the shared auxiliary swatches; the earlier style rows remain only for provenance.

The original mockups and 1254 × 1254 source painting are preserved on the unmerged
[`art/style-mockups` branch](https://github.com/AOSPAndroid/Lockdown/tree/art/style-mockups/review/style-contrast),
at commit `3bda5a1`. Step 1 retains those shapes and paint, adds the catalogue's gloves/hairband,
and extends the same layered construction to the Recon device, gun and bombs.

From the repository root, rebuild only this batch with:

```sh
node review/step1-stack/build.mjs
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
- <http://localhost:3012/review/dojo-review.html> shows native-size crops from the real Dojo,
  with links to every complete screenshot. The review server reads approved references from
  commit `3bda5a1` if a local `mockup/` cache is absent. It never alters the game server or its assets.
- Permanent screenshots and validation results: [docs/screenshots/step1-stack](../../docs/screenshots/step1-stack).

Stop here for approval before other equipment, weapons, icons or arenas.
