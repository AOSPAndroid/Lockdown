# Making models for Lockdown

The game draws every knight, piece of gear, weapon and bomb from code today. Each one is replaced by a
real model the moment its file exists. This page is the contract those files must follow. What to make
is in [CATALOG.md](CATALOG.md); the overall look is in [ART-GUIDE.md](ART-GUIDE.md) (LBX-style battle robots).

## Files

All models are binary glTF (`.glb`) under `public/art/3d/models/`:

| Folder | Files | What |
|---|---|---|
| `knight/` | `body.glb` | **made in code** (`node tools/make-core-skeleton.mjs`): the core skeleton every knight is built on. Don't make it. |
| `class/` | `guardian.glb`, `recon.glb` | class pieces: the Guardian's big shield, the Recon's tiny cloaking shield (the Striker's neon trail is drawn by the game) |
| `helmet/` | `<id>.glb` | one per head unit (not `none`: the bare head is part of the body) |
| `armor/` | `<id>.glb` | one per armour (not `none`) |
| `pants/` | `<id>.glb` | one per pants piece (not `none`) |
| `shoes/` | `<id>.glb` | one per pair of shoes (not `none`) |
| `weapons/` | `<id>.glb` | every sword, gun and bomb as held in the hand |
| `bombs/` | `<id>.glb` | every bomb as planted on the floor |
| `holsters/` | `sheath.glb`, `holster.glb`, `pouch.glb` | what holstered weapons ride in (see "Holsters" below) |
| `projectiles/` | `bullet`, `pulse`, `bolt`, `ricochet`, `catalyst`, `explosive`, `shard`, `thorn`, `wave` `.glb` | the rounds in flight (see "Projectiles" below) |
| `pickups/` | `heart.glb` | the heart a knocked-out knight drops (about 0.3 across, origin at its centre; the game bobs and spins it) |

Effect sprites are PNGs in `public/art/3d/fx/`: `spark.png` (a hit), `flash.png` (a muzzle flash), `blast.png`
(an explosion), `slash.png` (the sword trail). White on transparent (the game tints them and draws them
additively), square, 64 to 512, fading out before the edges. `slash.png` maps along the swing: left to right
(u) runs from where the cut starts to where it ends, bottom to top (v) from the inner edge of the arc to the
outer edge, so make it brightest at the top right (the blade's tip at the end of the cut).

After adding or changing files run `node tools/art3d-index.mjs`. It checks every model (folder, item id,
rig parts, gear node names, triangle budget) and lists it in `public/art/3d/index.json`, which the game
reads. Reload the game to see it. Anything without a file keeps its temporary shape, so models can arrive
one at a time.

## Units and axes

- 1 unit = 1 floor tile. A knight is **1.3 units** tall.
- **Y is up. The knight faces +X.** Its left side is −Z, its right side +Z.
- The knight's origin is between its feet, on the floor.
- glTF is right-handed with Y up, which is what Blender's glTF exporter writes with "+Y Up" on.

## The knight rig

The game animates knights by turning named parts, so models need **no skinning and no animation clips**:
every part is a rigid piece parented to the part above it, pivoting at its joint. Build on the core skeleton
in [reference/knight_rig.glb](reference/knight_rig.glb) (`node tools/make-core-skeleton.mjs` writes it, with
[reference/fit_guide.glb](reference/fit_guide.glb) and [reference/weapon_sizes.glb](reference/weapon_sizes.glb); the
sheets are in [ASSETS-BRIEF.md](ASSETS-BRIEF.md)):
same names, same hierarchy, same pivots. It is a **battle-robot frame about five heads tall**: a compact head,
broad shoulders and chest, a narrow waist, long legs and big wedge feet (LBX-style, see
[reference/lbx/](reference/lbx/README.md)). Rigid parts are natural for a robot: model visible joints (ball
shoulders, piston elbows and knees) so the swings look mechanical.

```
hips                  (0, 0.56, 0)        waist joint; the body bobs, sways and leans from here
├─ leg_L              (0, −0.03, −0.085)  hip joint: the thigh swings forward and back
│  └─ shin_L          (0, −0.215, 0)      knee: bends on the forward swing
│     └─ foot_L       (0, −0.215, 0)      ankle: stays flat, then pushes off
├─ leg_R …            (0, −0.03, +0.085)  (the same: shin_R, foot_R)
└─ chest              (0, 0.06, 0)        spine: twists against the hips, turns into a swing
   ├─ head            (0, 0.41, 0)        neck (at 1.03): a compact head, ≈ 0.26 tall
   ├─ arm_L           (0, 0.33, −0.25)    shoulder: hangs down in the rest pose
   │  └─ forearm_L    (0, −0.19, 0)       elbow (the class shields go here)
   │     └─ hand_L    (0, −0.19, 0)       wrist
   └─ arm_R …         (0, 0.33, +0.25)    (the same: forearm_R, hand_R)
                                           the weapon sits in the right fist, 0.045 below the wrist
```

The rest pose has **both arms hanging straight down** and the legs straight. The game animates every joint
itself (no skinning, no animation clips): a walk that blends into a run with knees and ankles bending, a
body bob, sway and lean, arms swinging against the legs, an idle with breathing and the weapon held loosely,
and sword swings that run through the shoulder, elbow and wrist. So every part must hold up when its joint
turns: legs swing ±45° and knees bend to 90°, arms rise to overhead and sweep ±90° across a swing, elbows
bend to 70°.

Positions are each part's pivot relative to its parent; the names, hierarchy and pivots are defined once in
`public/lockdown-skeleton.js`. Keep each part's own mesh around its pivot (a thigh hangs below `leg_L`, the
head sits above `head`). Names must match exactly (Blender's `.001` suffixes are ignored).

## Gear and class pieces

A gear file holds one top-level node per rig part it covers, **named after that part**. The game moves each
node onto that part of the knight, keeping its local offset, so model each piece in the rig's space, around
the part's pivot, sized to fit over the skeleton. Each slot may only use its own parts (the checker enforces it):

| Slot | Top-level nodes |
|---|---|
| helmet (head unit) | `head` |
| armor | `chest`; `arm_L`, `arm_R` (pauldrons, upper sleeves); `forearm_L`, `forearm_R` (bracers, gauntlets); optional `hips` (coat tails, a skirt of plates) |
| pants | `hips` (waist skirt), `leg_L`, `leg_R` (thighs), `shin_L`, `shin_R` (knee guards, shins) |
| shoes | `foot_L`, `foot_R` |
| class pieces | `forearm_L` (the Guardian's big shield, the Recon's tiny shield) |

Split pieces at the joints: a thigh plate goes on `leg_L`, the knee guard and shin plate on `shin_L`, so the
knee can bend between them. The templates in `docs/reference/templates/` (one per slot) are the fit volumes
as blocks on exactly these nodes: start from them.

## Weapons and bombs

- **In hand** (`weapons/<id>.glb`): the origin is the middle of the grip, the blade or barrel points along
  **+X**, the flat of a blade faces ±Y (edge forward along the swing). The game puts it in the right fist.
- **Planted** (`bombs/<id>.glb`): the origin is where the bomb touches the floor; it stands up along +Y.
- Sizes are in each item's catalogue entry (a normal sword ≈ 0.75 from grip to tip, heavy ≈ 0.95, a pistol
  ≈ 0.5, the rifle ≈ 1.0); [reference/weapon_sizes.glb](reference/weapon_sizes.glb) shows them all.
- **Named parts the game animates** (start from the template for the type, `docs/reference/templates/`):

| Type | Template | Nodes | What the game does with them |
|---|---|---|---|
| sword (normal, heavy, long, short) | `sword*.glb` | `grip`, `guard`, `blade`, `tip` | `tip` marks the end of the blade |
| maul | `maul.glb` | `grip`, `head`, `tip` | |
| gun (pistol, cannon, rifle) | `gun*.glb` | `body`, `barrel`, `core`, `muzzle` | `barrel` kicks back on every shot; the muzzle flash comes out of `muzzle` |
| bomb in hand | `bomb.glb` | `body`, `fuse` | `fuse` glows and flickers while charging (give it an emissive material) |
| planted bomb | `bomb_planted.glb` | `body`, `fuse` | `fuse` blinks faster as the bomb is about to blow; `body` swells just before |
| Guardian shield | `shield_guardian.glb` | `forearm_L` > `plate` | raised in front when the Guardian guards |
| Recon shield | `shield_recon.glb` | `forearm_L` > `buckler` > `lens` | the `lens` material flares while cloaked |

## Holsters

Holstered weapons ride on the knight at 70% of their size: swords and long guns crossed on the back (hilt
over a shoulder), pistols on the hips, bombs on the belt. Each carrier stays on the knight when its weapon is
drawn, so make them look right empty too.

- **`sheath.glb`**: one sheath for every sword. Model it for the standard sword: its **opening at the
  origin**, running along **+X for 0.65** (the blade from 0.1 to 0.75 from the grip), about **0.17 wide along
  Z and 0.05 thick along Y** (the blade is 0.12 wide along Z and 0.025 thick). The game stretches it along
  X to each sword's blade (0.5 for short swords, 0.8 for long, 0.85 for heavy) and along Z to its width (0.5×
  for the slim long swords, 1.5× for the heavy ones), so keep fittings simple: a locket at the opening and a
  chape at the tip read well stretched.
- **`holster.glb`**: made around the pistol template (`docs/reference/templates/gun.glb`): the same origin
  (the middle of the grip) and the gun pointing +X, wrapping the body and barrel and leaving the grip free.
- **`pouch.glb`**: made around the bomb template (`templates/bomb.glb`, the bomb's body centred at 0.14 along
  +X): a cage, net or clip that holds the bomb on the belt.

## Projectiles

Each points **+X**, origin at its centre, sized for a round of size 5 (about **0.13 across**; the game
scales it to each round, and pulses grow as they fly). Bright and emissive: the game adds a glow tinted in the
element's or the team's colour around it, so a warm white or neutral core reads best. Charged rounds reuse
their family's model (a charged pierce uses `bolt`, a big pulse `pulse`, a shotgun spray `bullet`).

## Materials

- glTF metal/rough PBR. One material per surface type (steel, leather, cloth, gem…), names that say what
  they are.
- **Team trim:** any material whose name starts with `team` (`team`, `team_trim`…) is recoloured by the game
  to the knight's team: Amber `#e39a3b` or Cyan `#3bb8c4`. Use it only for trims, bands and crests.
- **Glow:** give glowing parts (gems, cores, lenses, runes) an emissive colour; the game's bloom makes them
  glow. Keep glow to small accents.
- **One hand-painted albedo texture per model**, embedded in the `.glb`: painted gradients, edge highlights,
  panel lines, emblems and bolts, like a finished model kit (see ART-GUIDE). Untextured flat colours are not enough. A normal
  map is optional. Keep small glowing parts as separate emissive materials. If a part should flare in game
  (the Recon's cloak lens), name its material with `lens` in it.
- **Keep downloads small.** Every player downloads every model, so each `.glb` stays **under 600 KB**. Each texture
  is a power of two: 1024² at most for the body and big armour, 512² for helmets, pants, shoes and weapons, and
  256² for small parts. Use JPEG or WebP for opaque colour and PNG only where alpha is needed. Embed **only the part
  of an atlas the model uses**, never a sheet shared with other items or styles. `node tools/art3d-index.mjs`
  rejects anything over these limits.
- No baked lighting, no team colour in textures, no text.

## Budgets

| Model | Triangles |
|---|---|
| knight body | 4000 |
| armour piece | 3000 |
| helmet | 2500 |
| pants | 2000 |
| shoes, class piece, weapon | 1500 |
| planted bomb | 1200 |
| holster, sheath or pouch, heart | 800 |
| projectile | 300 |

Eight knights are on screen at once, so chunky shapes with few, well-placed bevels beat dense detail.

## Checking your work

1. `node tools/art3d-index.mjs` reports no errors.
2. `npm test` passes.
3. `npm start`, open the Dojo (<http://localhost:3000/lockdown.html?solo=1&dojo=1>), put your item on with
   **B** (it works anywhere there) and look at it on a knight: idle, running, swinging, charging (hold
   attack), hitting a dummy, from every side.
4. Check it next to other pieces: every helmet with every armour must still read as one knight.
