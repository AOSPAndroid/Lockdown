# Prompt for the art agent: build every Lockdown asset

Paste everything below the line into the art agent. It is self-contained; the docs it points to hold the details.

---

You are making the 3D art for **Lockdown**, a 4v4 control-point brawler (repo `AOSPAndroid/Lockdown`). The code
is done and animates everything: **you only make asset files**. Do not edit any `.js`, `.mjs`, `.html` or test
file. If something in the code seems wrong, write it down in your batch notes instead.

## Read first, in this order

1. `docs/ASSETS-BRIEF.md`: the one-page contract (skeleton, fit volumes, joint ranges, templates, sizes, limits,
   **the refit table**, order). It wins over everything else if two docs disagree.
2. `docs/reference/lbx/README.md` and its images: the look.
3. `docs/ART-GUIDE.md`: materials, colours, element colour code, icons (section 5).
4. `docs/CATALOG.md`: every item, what it does, how it should look, its exact file names and size.
5. `docs/MODELS.md`: the rig tree and the named parts the game animates.
6. The images in `docs/reference/`: `skeleton-sheet.png`, `fit-sheet.png`, `templates-sheet.png`,
   `sizes-sheet.png` and `motion-sheet.jpg` (how the body moves in the game: walk, run, strafe, backpedal, dash,
   sword combo, gun stances and recoil).

## The look

The knights are **small battle robots in the style of the LBX anime and its plastic model kits**, original
designs only (never copy an existing LBX robot). Hard-surface plates with crisp chamfers, panel lines, gold
bolts, glowing eyes and lenses, a clean painted model-kit finish. White or light base plates, one strong main
colour per set, one accent, gold details. Every armour set has its own silhouette (heavy and blocky, sleek, beast,
winged...). Trims that show the team use a material whose name starts with `team`; glowing parts are emissive.

## The body is made: build on it, never replace it

`docs/reference/knight_rig.glb` is the core skeleton the game uses (`public/art/3d/models/knight/body.glb` is
generated from code: **don't make or edit a body**). 1.3 units tall, faces **+X**, **Y up**, origin between the
feet, **arms hanging straight down**. 15 rigid parts split at every joint:

```
hips > chest > head
           chest > arm_L > forearm_L > hand_L      (and _R; the weapon goes in hand_R)
hips > leg_L > shin_L > foot_L                     (and _R)
```

Each gear file has top-level nodes named after the parts it covers. **A node's origin is the joint at the top of
its part** (shoulder for `arm_L`, elbow for `forearm_L`, hip for `leg_L`, knee for `shin_L`, neck for `head`),
and the piece is modelled in that part's own space, exactly like the templates in `docs/reference/templates/`.
Rigid pieces only: no skinning, no bones, no animation clips. The game moves the parts; every joint bends like a
human body (hip 35° back to 60° forward, knee to 110°, ankle ±40°, shoulder to straight overhead, elbow to 100°,
waist twist ±30°), so split armour at the joints and keep pieces clear of each other through those ranges.

## Batch 1: refit the step-1 models (stop for approval)

The Stack-style pieces you made on branch `art/step1-knights` are kept: same designs and textures, refitted to
the new skeleton. Start a new branch from the latest `main`:

```
git fetch origin && git checkout -b art/refit origin/main
git checkout origin/art/step1-knights -- public/art/3d/models
node tools/art3d-index.mjs      # lists every refit problem
```

Then follow the **"Reusing the step-1 models (refit)"** table in `docs/ASSETS-BRIEF.md`:

- Delete `knight/body.glb` from your files (keep main's generated one) and `helmet/none.glb`.
- Helmets `cobalt`, `sallet`: scale to the 0.30 head volume (about 0.7×), origin at the neck.
- Armours `cobalt`, `scout`: reshape the chest to the 0.28 × 0.32 × 0.42 volume. Turn `arm_R` down so it hangs
  like `arm_L`, then cut both arms at the elbow (0.19 below the shoulder): pauldron and upper arm on
  `arm_L`/`arm_R`, bracer on new `forearm_L`/`forearm_R` nodes with the origin at the elbow.
- Pants `cobalt`: cut each leg at the knee (0.215 below the hip): thigh on `leg_L`/`leg_R`, knee guard and shin on
  new `shin_L`/`shin_R` nodes with the origin at the knee.
- Shields `class/guardian`, `class/recon`: the node becomes `forearm_L`; place them at the shield volumes.
- Sword `weapons/brand`: keep the 0.75 length, split into child nodes `grip`, `guard`, `blade`, `tip`.
- Gun `weapons/blaster`: split into `body`, `barrel` (it kicks back on every shot), `core`, `muzzle` (the flash
  comes out of it).
- Bombs `weapons/blast`, `bombs/blast`: add a `fuse` node (it glows while charging, blinks before the blast).
- Make `shoes/sabatons` in the Cobalt style so the first knight is complete head to toe.
- While refitting, push the look toward the LBX references: crisper plate edges, panel lines, glowing eyes.

Show it working (see "Every batch" below) and **stop for approval** before batch 2.

## Batch 2: all armour

Every id below gets one `.glb` in `public/art/3d/models/<slot>/<id>.glb`. Start each from its template
(`templates/helmet.glb`, `armor.glb`, `pants.glb`, `shoes.glb`), keep the node names, model over the blocks,
delete the blocks. Pieces that share a name (`cobalt`, `wolver`, `demo`, `seraph`) are one matching set.

- **Helmets (13):** sallet visor horned hood lampcap feather bucket circlet cobalt wolver demo seraph goggles
- **Armour (15):** scout ballistic duelist heavy gunslinger fencer windrunner juggernaut bombardier berserker
  mirrorweave medic cobalt vog clockwork
- **Pants (11):** greaves leggings chausses breeches sapper cargo cobalt wolver demo seraph kilt
- **Shoes (11):** sneakers sabatons dashboots spurs treads clogs sandals striders magma hover quicksilver

The `none` pieces are the bare skeleton: make nothing for them. Each piece's look is in `docs/CATALOG.md`.
Push after each slot (helmets, then armour, then pants, then shoes).

## Batch 3: all weapons

Origin at the middle of the grip, pointing **+X**; the game holds it in the right fist. Planted bombs stand on the
floor, origin on the floor, up +Y. Start from the template for the type and keep its node names:

| Template | Ids | Length from grip |
|---|---|---|
| `sword.glb` | brand thorn frostbite blazebrand sickle avenger, and the fencing sabres sabre flamesabre frostsabre stormsabre (curved blade, basket guard) | 0.75 |
| `sword_heavy.glb` | cleaver greatblade hexblade troika | 0.95 |
| `sword_long.glb` | rapier leviathan | 0.9 |
| `sword_short.glb` | spur voltedge | 0.6 |
| `maul.glb` | maul | 0.75 haft |
| `gun.glb` (pistol) | blaster pulsar alchemer autogun sixgun catalyzer frostgun embercaster voltneedle viper polaris riftlocker | 0.5 |
| `gun_cannon.glb` | magnus grimcannon scatter | 0.65 |
| `gun_rifle.glb` | rifle | 1.0 |
| `bomb.glb` → `weapons/<id>.glb` | blast haze frost venom storm hex shard vortex nitro spark | 0.28 across (nitro 0.45) |
| `bomb_planted.glb` → `bombs/<id>.glb` | the same 10 | 0.4 tall (nitro 0.6) |

Elements follow the colour code in ART-GUIDE (fire, ice, shock, poison...). Push after swords, after guns, after
bombs.

## Batch 4: icons

Every item gets a 96×96 PNG icon with a transparent background, rendered from your models
(`docs/ART-GUIDE.md` section 5; file names are in `docs/CATALOG.md`).

## Every batch

1. `node tools/art3d-index.mjs` reports **no errors** (it checks ids, node names, joint splits, named weapon parts,
   triangle budgets, file size under 600 KB, power-of-two embedded textures, weapon lengths).
2. `npm test` passes.
3. `npm start`, open <http://localhost:3000/lockdown.html?solo=1&dojo=1>, press **B** to put gear on. Take
   screenshots of the new pieces: idle, walking, running, dashing, a sword combo, shooting, guarding. Check that
   nothing pokes through or floats off its part while the joints move. Put them in
   `docs/screenshots/<batch>/` with a short `README.md` (what's in the batch, anything you're unsure about).
4. Commit with a clear message and push the branch (`art/refit` for batch 1; one branch per batch after that,
   each from the latest `main`).

## Limits

- Binary glTF (`.glb`) only, everything embedded, one hand-painted texture per model (1024² for big armour, 512²
  for the rest, JPEG or WebP for colour), each file **under 600 KB**.
- Triangles: armour 3000, helmet 2500, pants 2000, shoes / class piece / weapon 1500, planted bomb 1200.
- Only add files under `public/art/3d/models/`, `public/art/lockdown/` (icons) and `docs/screenshots/`.
- No body, no bones, no animation clips, no copied LBX designs.

Done means every id above has its file, the checker and the tests are clean, and the Dojo screenshots show each
piece moving with the body.
