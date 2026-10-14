# Making models for Lockdown

The game draws every knight, piece of gear, weapon and bomb from code today. Each one is replaced by a
real model the moment its file exists. This page is the contract those files must follow. What to make
is in [CATALOG.md](CATALOG.md); the overall look is in [LOOK.md](LOOK.md).

## Files

All models are binary glTF (`.glb`) under `public/art/3d/models/`:

| Folder | Files | What |
|---|---|---|
| `knight/` | `body.glb` | the knight body every class wears: the rig, the dark under-suit, the gauntlets and the dark head with two glowing eyes (no skin, hair or face) |
| `class/` | `striker.glb`, `guardian.glb`, `recon.glb` | class pieces (crest, Guardian shield, scarf) |
| `helmet/` | `<id>.glb` | one per helmet, including `none.glb` (the Recruit Helm) |
| `armor/` | `<id>.glb` | one per armour, including `none.glb` (the Recruit Plate) |
| `pants/` | `<id>.glb` | one per pants piece, including `none.glb` (the Recruit Greaves) |
| `shoes/` | `<id>.glb` | one per pair of shoes, including `none.glb` (the Recruit Boots) |
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
every part is a rigid piece parented to the part above it, pivoting at its joint. Build on the mannequin
in [reference/knight_rig.glb](reference/knight_rig.glb) (`node tools/make-reference-rig.mjs` writes it):
same names, same hierarchy, same pivots.

```
hips                (0, 0.31, 0)          pelvis; the body bobs and leans from here
├─ leg_L            (0, 0, −0.14)         hip joint; swings forward/back (about Z)
│  └─ foot_L        (0, −0.25, 0)         ankle
├─ leg_R            (0, 0, +0.14)
│  └─ foot_R        (0, −0.25, 0)
└─ chest            (0, 0.08, 0)          waist
   ├─ head          (0, 0.50, 0)          neck; the head is big (≈ 0.6 across)
   ├─ arm_L         (0.03, 0.28, −0.35)   shoulder; hangs down, swings when running
   │  └─ hand_L     (0, −0.20, 0)
   └─ arm_R         (0.07, 0.14, +0.34)   shoulder; points forward (+X) holding the weapon,
      └─ hand_R     (0.25, 0, 0)          the weapon socket; turns across a sword's arc
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
| helmet | `head` |
| armor | `chest`; optional `arm_L`, `arm_R` (sleeves, pauldrons), `hips` (coat tails, skirt plates) |
| pants | `hips`, `leg_L`, `leg_R` |
| shoes | `foot_L`, `foot_R` |
| class pieces | `head` (crest), `chest` (scarf, chevrons), `arm_L` (the Guardian shield) |

Gear goes over the body's dark under-suit. A knight always wears one piece per slot (the Recruit set to
start), so the under-suit only shows in the gaps. Every helmet is a shell over the body's dark head with a
visor opening that lets its two glowing eyes show. Make pieces slightly larger than what they cover so nothing pokes through
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
- One texture set per model at most (1024² or smaller), embedded in the `.glb`. Flat colours with soft
  vertex shading are fine and often better at this camera distance.
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
