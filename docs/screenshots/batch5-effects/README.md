# Batch 5 — effect sprites

Four white-on-transparent masks for the existing additive/tinted renderer: sharp hit star, pointed muzzle flash, billowing blast with a hot core, and an unwrapped directional slash ribbon. `spark.png`, `flash.png`, `blast.png` are **256²**; `slash.png` is **512²**. RGB is exactly white throughout, including transparent pixels. Opacity carries the artwork. Every outside edge has alpha **0**. The slash's upper-right quadrant has the highest mean opacity (32.76 versus 7.66, 4.28 and 7.24 elsewhere), with a crisp leading edge and fading start/inner edge.

[Sprite sheet](sprite-contact-sheet.jpg) displays the production masks on a review backdrop. [In-game sheet](contact-sheet.jpg) includes all three Brand cuts against a real dummy, the hit spark, the gun flash and two bomb explosions. [All 18 guns](guns-contact-sheet.jpg) were fired normally and charged again; [all ten bombs](bombs-contact-sheet.jpg) were planted. Solo combat uses the Old Keep, 1v1 with a normal bot, at `http://localhost:3010/lockdown.html?solo=1`. The dummy sequence uses `?solo=1&dojo=1`; the damage meter records 20, 26 and 54 damage for the three Brand hits and a knockout on the finisher.

Normal UI and mouse/keyboard inputs drive all actions. Inspection cameras, capture pauses and skipped intermediate GPU draws run only in browser memory; physics, entities, poses, mesh UVs, material tint, opacity and additive blending remain native. The source masks were exported to their exact sizes, with luminance/coverage represented by alpha and RGB normalized to white. No runtime tint is baked into the files.

## Runtime details to review

- **Reverse cuts:** the PNG follows the requested U=start→end gradient. `slashEffect` sorts its arc endpoints with `Math.min`/`Math.max`, while `arcGeometry` always assigns increasing U to increasing angle. It does not flip U when `event.dir < 0`, so the bright end can be at the start of a negative-direction cut. The Dojo captures preserve directions [-1, 1, -1]; this needs a runtime UV flip, not another fixed texture. No code was changed.
- **First-shot muzzle position:** in the captured Blaster shot after switching/moving, the flash is **0.422 units** from the muzzle after the shooting pose updates. `render` consumes events before updating knights; the current flash uses the previous pose's muzzle. [Capture](dojo/blaster-muzzle-flash.jpg) and [state](dojo/captures.json) retain both positions. The sprite loads correctly; placement timing remains a code issue.

Checks: **4 textures and 124 models, no asset-checker errors; 109 tests passed; glTF validation 0 errors/0 warnings; browser 0 errors/0 warnings** in both runs. All four PNGs were confirmed on live effect materials. All 124 models are byte-identical to projectile commit `5144045`.

Evidence: [pixel/size/hash validation](sprite-validation.json), [verification](verification.json), [solo capture states and hashes](captures.json), [Dojo states and hashes](dojo/captures.json), [glTF validation](validation.json), [test output](tests.txt). Only the four PNGs, generated index and this review folder change in this step.
