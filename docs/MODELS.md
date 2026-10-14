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
hips                (0, 0.56, 0)          waist joint; the body bobs and leans from here
├─ leg_L            (0, −0.03, −0.085)    hip joint; swings forward/back (about Z)
│  └─ foot_L        (0, −0.43, 0)         ankle
├─ leg_R            (0, −0.03, +0.085)
│  └─ foot_R        (0, −0.43, 0)
└─ chest            (0, 0.06, 0)          waist
   ├─ head          (0, 0.41, 0)          neck (at 1.03); the head is compact, ≈ 0.26 tall and 0.24 across
   ├─ arm_L         (0, 0.33, −0.25)      shoulder; hangs down, swings when running
   │  └─ hand_L     (0, −0.38, 0)
   └─ arm_R         (0.04, 0.26, +0.25)   shoulder; points forward (+X) holding the weapon,
      └─ hand_R     (0.36, 0, 0)          the weapon socket; turns across a sword's arc
```

Positions are each part's pivot relative to its parent. Keep each part's own mesh around its pivot (a leg
hangs below `leg_L`, the head sits above `head`). Names must match exactly (Blender's `.001` suffixes are
ignored).

## Gear and class pieces

A gear file holds one top-level node per rig part it covers, **named after that part**. The game moves each
node onto that part of the knight, keeping its local offset, so model each piece in the rig's space, around
the part's pivot, sized to fit over the body.

| Slot | Top-level nodes |
|---|---|
| helmet (head unit) | `head` |
| armor | `chest`; optional `arm_L`, `arm_R` (sleeves, pauldrons), `hips` (coat tails, skirt plates) |
| pants | `hips`, `leg_L`, `leg_R` |
| shoes | `foot_L`, `foot_R` |
| class pieces | `arm_L` (the Guardian's big shield, the Recon's tiny shield) |

Armour parts go over the frame's plain base plates: a head unit replaces the look of the bare head (keep the
visor and the two glowing eyes, or give the head its own), armour covers the chest plate and shoulder caps,
pants the thigh and shin plates, shoes the feet. Make pieces slightly larger than what they cover so nothing pokes through
in any pose (legs swing ±40°, arms ±35°, the right arm turns up to ±80° across a swing).

## Weapons and bombs

- **In hand** (`weapons/<id>.glb`): the origin is the middle of the grip, the blade or barrel points along
  **+X**, the flat of a blade faces ±Y (edge forward along the swing). The game puts it in `hand_R`.
- **Planted** (`bombs/<id>.glb`): the origin is where the bomb touches the floor; it stands up along +Y.
- Sizes are in each item's catalogue entry (a normal sword ≈ 1.0 from grip to tip, heavy ≈ 1.3, a pistol
  ≈ 0.5, the rifle ≈ 1.0).

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

Eight knights are on screen at once, so chunky shapes with few, well-placed bevels beat dense detail.

## Checking your work

1. `node tools/art3d-index.mjs` reports no errors.
2. `npm test` passes.
3. `npm start`, open the Dojo (<http://localhost:3000/lockdown.html?solo=1&dojo=1>), put your item on with
   **B** (it works anywhere there) and look at it on a knight: idle, running, swinging, charging (hold
   attack), hitting a dummy, from every side.
4. Check it next to other pieces: every helmet with every armour must still read as one knight.
