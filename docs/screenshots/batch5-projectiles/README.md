# Batch 5 — projectiles

Based on main `b4aae03`, after the approved holster/socket fixes. Nine original rigid +X projectile models, centred at the origin: glowing slug, ringed orb, finned dart, radial disc, crystal vial, fat shell, shrapnel, thorn and wide crescent. Warm-white emissive cores and neutral painted fittings leave element/team colour to the runtime glow. Each embeds one 256² JPEG; no skins, clips or external resources.

| File | Triangles / 300 | Bytes / 600,000 |
|---|---:|---:|
| `bullet.glb` | 130 | 22076 |
| `pulse.glb` | 248 | 33452 |
| `bolt.glb` | 90 | 18280 |
| `ricochet.glb` | 188 | 27672 |
| `catalyst.glb` | 156 | 24564 |
| `explosive.glb` | 180 | 26836 |
| `shard.glb` | 10 | 9968 |
| `thorn.glb` | 30 | 11848 |
| `wave.glb` | 132 | 22272 |

[Model sheet](model-contact-sheet.jpg) shows all nine under one studio light without the game's glow overlay. [In-game sheet](contact-sheet.jpg) shows every family as an actual solo-play projectile. [All 18 guns](guns-contact-sheet.jpg) were fired normally and charged, including all three six-shooters. [All ten bombs](bombs-contact-sheet.jpg) were charged and planted, with native explosions and Shard Burst shrapnel captured. Charged Briar Blade, Umbral Greatblade, Blazebrand and Exalted Avenger cover thorns, shadow/fire waves and the light beam. Charged variants reuse the specified base models.

Solo URL: `http://localhost:3010/lockdown.html?solo=1`, Old Keep, 1v1 with the normal bot running. Loadouts, movement, charge/release, gun fire and bomb planting used the game's controls; the knight stays in its base to change all loadouts. Base barriers stop rounds at the boundary. Native-view normal-shot frames preserve gameplay scale; detailed views use inspection cameras sized to the actual projectile, especially growing charged pulses. Cameras/capture pauses and skipped intermediate GPU draws were applied only in browser memory; physics and effects remain native, with no fabricated entities or repository code edits.

Notes: the game deliberately adds a broad, bright tinted glow, which obscures some small painted fittings in flight. The studio sheet makes those details inspectable. The ricochet model is radial, but the current renderer does not animate disc spin; it retains the initial projectile orientation across bounces. No animation clips or code changes were added.

Checks: **124 models, no asset-checker errors; 109 tests passed; Khronos glTF validation 0 errors and 0 warnings; browser 0 errors and 0 warnings.** All nine models were confirmed loaded on actual shots, and the capture hashes match the delivered GLBs. All 115 previously merged models are byte-identical to main. Only the nine GLBs, generated index and this review folder change in this step.

Evidence: [capture state/source hashes](captures.json), [verification/bounds](verification.json), [glTF validation](validation.json), [build budgets](build.json), [test output](tests.txt). Full-resolution captures are alongside the sheets.
