# Prompt for the art agent: batch 5, the arena materials

Paste everything below the line into the art agent. It is self-contained; the docs it points to hold the details.

---

You are making art for **Lockdown** (repo `AOSPAndroid/Lockdown`), a control-point brawler drawn in 3D. The knights,
armour, weapons and icons are done (batches 1 to 4). Every arena surface is still a placeholder pattern painted
in code: **this batch replaces them with real materials.** You only make image files. Do not edit any `.js`,
`.mjs`, `.html` or test file; if something in the code seems wrong, write it down in your notes instead.

## Read first

1. `AGENTS.md`: the rules for agents on this repo.
2. `docs/LOOK.md`, sections 2 to 4: the design rules, the theme palettes, the texture slots and their rules.
   **Section 4's texture rules are the contract.**
3. `docs/ART-GUIDE.md`, section 4 (arenas) and section 7 (do and don't).
4. `docs/reference/spiral-knights/`: the reference for arenas, camera and effects (chunky toy fortresses floating
   in a dark void, glass railings on brass posts, ball-topped pillars, glowing lamps).
5. `docs/screenshots/`: what the arenas look like now, with the code's placeholder materials. Your materials
   must look clearly better.

## What to make

Six themes, four slots each, under `public/art/3d/<theme>/`:

| Theme | Arenas using it | Look |
|---|---|---|
| `castle` | Old Keep, Rampart Walk | worn flagstones, grey ashlar walls |
| `maze` | Hedge Labyrinth | bright trimmed grass, round clipped hedges for walls |
| `foundry` | Clockwork Foundry | iron floor plates with rivets, red walls with brass X-braces |
| `ruins` | Sunken Temple, Sunken Atrium | warm sandstone with carved swirls |
| `graveyard` | Gloom Graveyard | dark slate, cold moss, old stone |
| `skyway` | Sky Bridges | white marble with gold inlay |

| File | Size | Covers |
|---|---|---|
| `floor.png` | 1024² | 4×4 floor tiles, seen from above; seamless both ways |
| `wall.png` | 1024² | one tile wide × the whole wall face; seamless left-right; lit cap band at the top, the theme's pattern in the middle, darker plinth at the bottom |
| `wall_top.png` | 512² | 1×1 tile from above; lighter than the wall face; seamless |
| `cliff.png` | 512² | 1×1 unit; dark foundation rock, masonry or girders; darker than anything walkable; seamless |

Make a `<slot>_normal.png` (OpenGL convention, +Y up) for each slot too: the bevels, grout, rivets and carvings
should catch the game's light.

Paint **albedo only**: no baked shadows or highlights, no perspective, no vignette, no dark border, no text,
no logos, no team colours. The floor must stay quiet enough that the knights, the capture zones and the
attack tells (the glowing arcs on the floor) read clearly on top of it. Keep each theme's palette from
`docs/LOOK.md`.

## Order: castle first, then stop

1. Start a branch from the latest `main`: `git fetch origin && git checkout -b art/batch5-arenas origin/main`.
2. Make **castle** (all four slots and their normal maps). Run the checks below, take the screenshots, push,
   and **stop for approval** before the other themes.
3. After approval: maze, foundry, ruins, graveyard, skyway, one commit and push per theme.

## Every theme

1. `node tools/art3d-index.mjs` lists the new textures with **no errors** (it rejects wrong sizes,
   transparency, seams, dark edges, stretched rows and unknown slot names).
2. `npm test` passes.
3. `npm start`, open <http://localhost:3000/lockdown.html?solo=1>, pick the arena in the lobby and play.
   Screenshot each arena that uses the theme in four places: your base, standing on a capture zone, on the raised
   floor (top of the grand stairs), and mid-fight. Check that nothing seams, tiles visibly or drowns out the
   knights. Put the screenshots in `docs/screenshots/batch5-<theme>/` with a short `README.md` (what you made,
   anything you're unsure about).
4. When the last theme is done, replace the arena screenshots in `docs/screenshots/` (`keep.jpg`, `maze.jpg`,
   `graveyard.jpg`, `skyway.jpg`, `ramparts.jpg`, and add `foundry.jpg`, `temple.jpg`, `atrium.jpg`) with
   new 1440×810 JPEGs of each arena mid-fight.

## Also in this batch

- The Guardian's painted back that you noted in batch 3: fix it on `public/art/3d/models/class/guardian.glb`
  (same rules as batch 1: node names, budgets, the checker) and show it from behind in the Dojo.

Done means the six themes are in, the checker and the tests are clean, and the screenshots show every arena.
