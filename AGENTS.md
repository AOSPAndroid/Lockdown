# Instructions for agents working on Lockdown

Lockdown is a finished game mechanically: a 4v4 Spiral Knights-style control-point brawl with swords,
guns and bombs, three classes, gear, bots and online rooms. **The work now is design and assets.**

## Read first

- **`docs/ART-GUIDE.md`: all the art guidance in one place (the Spiral Knights-style direction, characters,
  weapons, arenas, icons, technical rules, workflow and the delivery checklist). Start here.**
- `docs/LOOK.md`: the target look, the design rules, every number, the texture slots and their rules.
- `docs/MODELS.md`: the model contract (rig, units, materials, budgets).
- `docs/CATALOG.md`: every item to make (body, classes, helmets, armour, pants, shoes, swords, guns, bombs),
  what it does and how it looks. Item looks live in `public/lockdown-looks.js`; regenerate the catalogue with
  `node tools/catalog.mjs` after changing them.
- `docs/GAMEPLAY.md`: how the game plays (so art supports it).
- `docs/screenshots/`: what the game looks like now. New art must look at least this good, and better.

## Rules

1. Do not change gameplay: leave `public/lockdown-engine.js`, `lockdown-weapons.js`,
   `lockdown-equipment.js`, the bots and `server.js` alone unless the person you work with asks.
2. Art goes in `public/art/3d/<theme>/` (3D materials), `public/art/3d/models/` (models) or
   `public/art/lockdown/` (menu icons). Use the
   exact slot and file names in `docs/LOOK.md` and `public/art/lockdown/ASSETS.md`.
3. Arenas are walls and two floors only, with grand stairs. Never add pits, lava, water or gaps.
4. Work one theme at a time and stop for approval after the first theme.
5. Never fix art by stretching, smearing or resizing it unevenly; redraw it.
6. Before reporting work: run `node tools/art3d-index.mjs` (no errors), `npm test` (all pass), then play
   the arena (`npm start`, http://localhost:3000/lockdown.html?solo=1) and take screenshots in base, on a
   capture point, on the raised floor and mid-fight. Show those screenshots.

## Commands

- `npm install` once, then `npm start` (port 3000, or `PORT=…`).
- `npm test`: engine, server, renderer and art-tool tests.
- `node tools/art3d-index.mjs`: check and list 3D textures and models.
- `node tools/catalog.mjs`: regenerate `docs/CATALOG.md`.
- `node tools/make-reference-rig.mjs`: rewrite the reference knight rig.
- `node tools/lockdown-art-index.mjs`: check and list 2D sprites and icons.
