# Asset brief: what to make for Lockdown

**The code is done.** This page is everything an artist (or art agent) needs: what to make, how to build it
on the skeleton, the sizes, and the order. Details live in [ART-GUIDE.md](ART-GUIDE.md) (style),
[MODELS.md](MODELS.md) (file contract) and [CATALOG.md](CATALOG.md) (every item, with its look and size).

## The look

The knights are **small battle robots in the style of the LBX anime and its model kits**: original designs,
never a copy of an existing LBX robot. Look at [reference/lbx/](reference/lbx/README.md) first.
- Hard-surface armour plates with crisp chamfers, panel lines and gold bolts, a clean painted model-kit finish.
- White or light base plates, one strong main colour per set, one accent, gold details. Glowing eyes and lenses.
- Every armour set has its **own silhouette**: heavy and blocky, sleek, beast, winged (as varied as the LBX line-up).

## The skeleton is made: build on it

The body every knight shares is the **core skeleton**, made in code (`node tools/make-core-skeleton.mjs`
writes `public/art/3d/models/knight/body.glb`). **Don't make a body.** It is also the bare look: a knight with
no gear is just the skeleton.

![The core skeleton](reference/skeleton-sheet.png)

- [reference/knight_rig.glb](reference/knight_rig.glb): the skeleton. Import it into Blender and model on it.
- 1.3 units tall, faces **+X**, **Y up**, origin between the feet. **Both arms hang down** in the rest pose.
- Rigid named parts, no skinning, no animation clips. 15 parts, split at every joint:
  `hips` > `chest` > `head`, `arm_L` > `forearm_L` > `hand_L` (and `_R`), `hips` > `leg_L` > `shin_L` > `foot_L`
  (and `_R`). Pivots are in [MODELS.md](MODELS.md).
- **The game animates the joints**: a walk that blends into a run with knees and ankles bending, a body bob,
  sway and lean, arms swinging against the legs, an idle with breathing and the weapon held loosely, sword
  swings through shoulder, elbow and wrist, lunges, slams, aiming, guarding. So split armour at the joints
  (a thigh plate on `leg_L`, the knee guard and shin on `shin_L`) and keep every piece clear of its neighbours
  when the joint turns.

## Where armour goes: the fit guide

![Fit guide](reference/fit-sheet.png)

[reference/fit_guide.glb](reference/fit_guide.glb) is the skeleton with a see-through volume for each slot.
Model each piece **around these volumes** (about 1.5× at most; crests, wings, tails and horns may go further):

| Slot | File | Top-level nodes | Volumes (size w×h×d, centre, in the part's own space) |
|---|---|---|---|
| helmet (head unit) | `helmet/<id>.glb` | `head` | 0.30 × 0.30 × 0.30 at (0, 0.15, 0); crest zone 0.24 × 0.12 × 0.06 at (−0.02, 0.36, 0) |
| armor | `armor/<id>.glb` | `chest`, `arm_L`, `arm_R`, `forearm_L`, `forearm_R` (optional `hips` for coat tails) | chest 0.28 × 0.32 × 0.42 at (0, 0.25, 0); pauldrons 0.15 × 0.11 × 0.15 at (0, 0, 0) on each `arm_`; bracers 0.08 × 0.13 × 0.08 at (0, −0.09, 0) on each `forearm_` |
| pants | `pants/<id>.glb` | `hips`, `leg_L`, `leg_R`, `shin_L`, `shin_R` | waist skirt 0.22 × 0.13 × 0.30 at (0, −0.01, 0); thighs 0.12 × 0.17 × 0.12 at (0, −0.1, 0) on each `leg_`; knees and shins 0.12 × 0.17 × 0.12 at (0, −0.1, 0) on each `shin_` |
| shoes | `shoes/<id>.glb` | `foot_L`, `foot_R` | foot 0.26 × 0.09 × 0.14 at (0.03, −0.055, 0) |
| class | `class/guardian.glb`, `class/recon.glb` | `forearm_L` | Guardian shield ≈ 0.7 across at (0.03, −0.1, −0.08), facing out (−Z); Recon shield ≈ 0.22 across at (0.02, −0.09, −0.055) |

Each node is moved onto that part of the skeleton keeping its offset, so model it in the rig's space, around
the part's pivot. Nothing may poke through when legs swing ±40°, arms ±35° and the weapon arm turns ±80°.

## Templates: start every piece from one

![Templates](reference/templates-sheet.png)

`docs/reference/templates/` has a blockout for every asset type with the **node names to keep**: `helmet`,
`armor`, `pants`, `shoes` (the fit volumes on the right parts), `shield_guardian`, `shield_recon`, `sword`,
`sword_heavy`, `sword_long`, `sword_short`, `maul`, `gun`, `gun_cannon`, `gun_rifle`, `bomb` and
`bomb_planted`. Open the right one, model over the blocks, keep the names, delete the blocks. The game
animates these named parts:

| Node | In | What the game does |
|---|---|---|
| `barrel`, `muzzle` | guns | the barrel kicks back on every shot; the muzzle flash comes out of `muzzle` |
| `fuse` | bombs (held and planted) | glows and flickers while charging; blinks faster before it blows |
| `tip` | swords, maul | marks the end of the blade |
| `lens` (material name) | Recon shield | flares while the Recon is cloaked |

## Weapons: sizes

![Weapon sizes](reference/sizes-sheet.png)

[reference/weapon_sizes.glb](reference/weapon_sizes.glb) has every size next to the skeleton. Origin at the
middle of the grip, pointing **+X**. Planted bombs: origin on the floor, standing up +Y.

| Weapon | Length from grip | Notes |
|---|---|---|
| normal sword | 0.75 | blade ≈ 0.12 wide, guard ≈ 0.24 |
| heavy sword | 0.95 | blade ≈ 0.18 wide |
| rapier, Tidebreaker | 0.9 | slim |
| four-cut sword | 0.6 | short, hooked |
| maul | 0.75 haft | head ≈ 0.28 × 0.28 × 0.36 |
| pistol | 0.5 | body ≈ 0.25 tall |
| hand-cannon, scattergun | 0.65 | body ≈ 0.3 tall |
| rifle | 1.0 | |
| bomb in hand | 0.28 across | Nitro Colossus 0.45 |
| planted bomb | 0.4 tall | Nitro Colossus 0.6 |

## Files and limits

- Binary glTF (`.glb`) in `public/art/3d/models/<folder>/<item id>.glb`; ids are in CATALOG.md.
- One hand-painted texture per model, embedded, a power of two (1024² for big armour, 512² for the rest),
  JPEG or WebP for colour. Each `.glb` **under 600 KB**.
- Materials named `team…` take the team colour (a stripe, a band). Glowing parts are emissive; the Recon's lens
  material has `lens` in its name.
- Weapons: the game holds them in the right fist (0.045 below the wrist), origin at the middle of the grip.
- Triangle budgets: armour 3000, helmet 2500, pants 2000, shoes, class piece and weapon 1500, planted bomb 1200.
- `node tools/art3d-index.mjs` checks all of this (ids, nodes, budgets, size, textures, weapon lengths) and must
  report no errors.

## Order

0. **Direction (stop for a pick):** 3 different design directions, each showing the Cobalt set (helmet, armour,
   pants) and the Scout armour with the Sallet helmet on the skeleton, holding the Knight Brand, plus the
   Guardian shield. One comparison sheet next to the LBX references, and each in the Dojo. Rough is fine.
1. **Style lock (stop for approval):** in the chosen direction, the Cobalt set, the Guardian and Recon shields,
   the Knight Brand, the Pulse Blaster and the Cannonball Bomb (held and planted).
2. **All armour:** 13 helmets, 15 armours, 11 pants, 11 shoes (not the `none` pieces: that's the skeleton).
3. **All weapons:** 15 swords, 15 guns, 10 bombs + 10 planted.
4. **Icons** (96×96, see ART-GUIDE section 5), made from the models.

After every batch: `node tools/art3d-index.mjs` (no errors), `npm test` (all pass), then `npm start` and open
the Dojo, <http://localhost:3000/lockdown.html?solo=1&dojo=1>: **B** puts gear on anywhere. Show screenshots
(idle, running, swinging, charging) next to the references, and push.
