# Stack, four-head D — Step 1 approval

Chosen direction: **Stack** on **D**, `knight_rig_4_heads.glb`.
Production assets keep the layered plates, banded helmets, rolled rims, saturated painted gradients,
dark seams and broad edge highlights of the approved mockups. Knight Brand now measures
0.75 units from grip to tip, as specified by the updated catalogue.

![Approved Stack mockups beside compact production models](style-lock-studio.jpg)

![All three production classes beside the approved Stack captures](dojo-comparison.jpg)

The comparison sheet uses **native-size crops**. All linked `dojo-*.jpg` captures below are complete
1280 × 720 screenshots of the compact models from `npm start` and
`http://localhost:3000/lockdown.html?solo=1&dojo=1`.
Equipment and weapons were changed through B / the Armory; movement and attacks used normal controls.

| Class | Idle | Running | Swinging | Charging |
|---|---|---|---|---|
| Striker | [Idle](dojo-striker-idle.jpg) | [Running](dojo-striker-running.jpg) | [Swinging](dojo-striker-swinging.jpg) | [Charging](dojo-striker-charging.jpg) |
| Guardian | [Idle](dojo-guardian-idle.jpg) | [Running](dojo-guardian-running.jpg) | [Swinging](dojo-guardian-swinging.jpg) | [Charging](dojo-guardian-charging.jpg) |
| Recon | [Idle](dojo-recon-idle.jpg) | [Running](dojo-recon-running.jpg) | [Swinging](dojo-recon-swinging.jpg) | [Charging](dojo-recon-charging.jpg) |

- [Bare starter](dojo-bare-idle.jpg) and [Cobalt Guardian](dojo-cobalt-idle.jpg).
- [Helmet only](dojo-mix-helmet.jpg), [mail only](dojo-mix-mail.jpg), [cuisses only](dojo-mix-cuisses.jpg).
- [Recon with Blaster](dojo-recon-blaster.jpg), [lens during cloak](dojo-recon-cloak.jpg),
  [Blaster charge](dojo-blaster-charge.jpg), [charged shot hitting a dummy for 24](dojo-blaster-fired.jpg).
- [Held Cannonball](dojo-bomb-held.jpg), [bomb charging](dojo-bomb-charge.jpg), [planted Cannonball](dojo-bomb-planted.jpg).

## Download and texture budgets

The batch totals **1.16 MiB**, **94.8% smaller** than the previous full-atlas GLBs.
Each file embeds **one opaque JPEG**, containing only its referenced Stack/shared painted swatches.
There are no Arc/Cut rows or unused item regions; unused packing cells contain solid padding.
The complete painted atlas is retained only in the authoring sources.

| Model | GLB size (KiB) | JPEG size | Triangles |
|---|---:|---:|---:|
| Body | 264.0 | 1024² | 3176 |
| Hair | 55.1 | 512² | 740 |
| Guardian shield | 98.5 | 512² | 736 |
| Recon buckler | 36.9 | 256² | 676 |
| Cobalt helm | 99.2 | 512² | 1092 |
| Cobalt mail | 209.6 | 1024² | 2020 |
| Cobalt cuisses | 99.5 | 512² | 784 |
| Knight Brand | 81.4 | 512² | 1036 |
| Pulse Blaster | 88.7 | 512² | 1212 |
| Held Cannonball | 77.7 | 512² | 764 |
| Planted Cannonball | 77.7 | 512² | 764 |

Validation: art index **0 errors / 11 models**; `npm test` **83/83 passing**;
Khronos glTF Validator **0 errors and 0 warnings** for all eleven files.
[Asset audit](asset-audit.json) records bytes, triangles, source regions and validator results.
Every model is below 600,000 bytes and its triangle budget, with no skins or animations.
The body preserves D's exact named hierarchy and pivots, spans Y = 0 to 1.3 and faces +X.
No browser console errors or warnings were reported during the Dojo checks.

The generic three-head catalogue wording remains unchanged; the explicit D choice is recorded in
[ART-GUIDE.md](../../ART-GUIDE.md#chosen-direction-stack). This art work does not alter gameplay,
renderer or test logic; incoming changes from `origin/main` were pulled before rebuilding.
Earlier unlinked screenshots in this directory predate the compact textures and are historical.

This is the approval checkpoint. Other equipment, icons and arenas have not been started.
