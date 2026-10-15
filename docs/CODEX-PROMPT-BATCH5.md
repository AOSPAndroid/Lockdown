# Prompt for the art agent: batch 5, holsters, rounds, heart and effects

Paste everything below the line into the art agent. It is self-contained; the docs it points to hold the details.

---

You are making art for **Lockdown** (repo `AOSPAndroid/Lockdown`), a control-point brawler drawn in 3D with
LBX-style battle-robot knights. The knights, armour, weapons, bombs and icons are done (batches 1 to 4). This
batch makes the pieces still drawn as placeholders in code: what holstered weapons ride in, the rounds in
flight, the heart pickup and the hit, muzzle, blast and slash effects. The game already loads every one of
them the moment its file exists. **You only make asset files.** Do not edit any `.js`, `.mjs`, `.html` or test
file; if something in the code seems wrong, write it down in your notes instead. Don't touch the arenas.

## Read first

1. `AGENTS.md`: the rules for agents on this repo.
2. `docs/MODELS.md`, especially the new **Holsters** and **Projectiles** sections, the effect sprites under
   **Files**, and **Budgets**. **It is the contract.**
3. `docs/ART-GUIDE.md`: the LBX look, materials, the element colour code (section 1 and 3).
4. `docs/reference/templates/gun.glb` and `bomb.glb`, and `docs/reference/weapon_sizes.glb`: the holster and
   the pouch are built around these.
5. `docs/screenshots/weapon-swap.gif` and `perfect-combo.jpg`: how weapons ride on the knight now and how
   effects look today.

## What to make

### 1. Holsters (`public/art/3d/models/holsters/`, 800 triangles each)

| File | What | Notes |
|---|---|---|
| `sheath.glb` | the sword sheath, for every sword | opening at the origin, 0.65 along +X, about 0.17 wide (Z) × 0.05 thick (Y); the game stretches it to each sword (0.5× to 1.5× across, 0.77× to 1.3× along), so a locket at the opening and a chape at the tip, no fine detail in between |
| `holster.glb` | the pistol hip holster | built around the pistol template, same origin and +X; wraps body and barrel, leaves the grip free |
| `pouch.glb` | the bomb belt pouch | built around the bomb template (body centred 0.14 along +X); a cage, net or clip |

LBX model-kit style like the armour: hard-surface plates or toy leather with crisp bevels, gold fittings, a
`team...` material for one trim so each knight's carriers show its team. They stay on the knight when the
weapon is drawn, so they must look right empty.

### 2. Rounds in flight (`public/art/3d/models/projectiles/`, 300 triangles each)

`bullet` (a short glowing slug), `pulse` (an energy orb with a ring), `bolt` (a piercing energy dart),
`ricochet` (a spinning disc), `catalyst` (a glowing crystal vial), `explosive` (a fat shell), `shard` (bomb
shrapnel), `thorn` (a thorn spike), `wave` (a wide crescent of shadow energy). Each points +X, origin at its
centre, about 0.13 across (the size-5 round). Emissive, with a warm white or neutral core: the game wraps each
in a glow tinted in its element's or team's colour.

### 3. The heart (`public/art/3d/models/pickups/heart.glb`, 800 triangles)

The heart a knocked-out knight drops: about 0.3 across, origin at its centre, a chunky glossy toy heart with
a soft emissive glow. The game bobs and spins it.

### 4. Effect sprites (`public/art/3d/fx/`)

`spark.png` (a hit: a sharp star burst), `flash.png` (a muzzle flash), `blast.png` (an explosion puff with a
hot core), `slash.png` (the sword trail). White on transparent, square, 256² (512² for `slash`), fading out
before the edges. The game tints them and draws them additively, so no colour and no dark outlines. For
`slash.png`, left to right runs from the start of the cut to its end and bottom to top from the inner edge of
the arc to the outer edge: brightest at the top right, a crisp leading edge, fading toward the start.

### 5. The Guardian's back

The painted back you noted in batch 3: fix it on `public/art/3d/models/class/guardian.glb` (same rules as
batch 1) and show it from behind in the Dojo.

## Order: holsters and the heart first, then stop

1. Start a branch from the latest `main`: `git fetch origin && git checkout -b art/batch5-gear-fx origin/main`.
2. Make the three holsters and the heart. Check, screenshot, push, and **stop for approval**.
3. After approval: the projectiles, then the effect sprites, then the Guardian's back. Commit and push after
   each.

## Every step

1. `node tools/art3d-index.mjs` reports **no errors** (folder, ids, budgets, file size, sprite sizes and
   edges).
2. `npm test` passes.
3. `npm start` and look at it in the game:
   - **Holsters:** the Dojo (<http://localhost:3000/lockdown.html?solo=1&dojo=1>). Press **B** and pick a
     loadout with a sword, a long sword (katana), a pistol and a bomb. Screenshot from the front and from
     behind (drag the Armory preview to turn the knight), and during a weapon switch (1–4) while walking and
     running. Nothing pokes through the body or floats off it.
   - **Heart:** knock out a dummy in the Dojo; it drops one.
   - **Rounds and effects:** a solo match (<http://localhost:3000/lockdown.html?solo=1>). Shoot every kind of
     gun, plant bombs, swing swords at a dummy.

   Put the screenshots in `docs/screenshots/batch5-<step>/` with a short `README.md` (what you made,
   anything you're unsure about).

## Limits

Binary glTF (`.glb`) only, everything embedded, at most one 512² texture per model, each file under 600 KB.
No bones, no animation clips, no copied LBX designs.

Done means every file above exists, the checker and the tests are clean, and the screenshots show them in game.
