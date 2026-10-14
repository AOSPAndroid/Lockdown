# Lockdown

A 4v4 control-point brawl in the spirit of Spiral Knights' Lockdown, in the browser: three capture
points, swords, guns and bombs, Striker / Guardian / Recon classes, four gear slots, a four-slot
inventory with hearts, and bots in every empty seat. Drawn in real 3D (three.js): chunky bevelled
fortresses floating in the void, grand stairs to a second floor, glowing lamps and crystals.

![Clockwork Foundry mid-fight](docs/screenshots/foundry-fight.jpg)

## Play

```
npm install
npm start
```

Open <http://localhost:3000>. **Play solo** starts a practice match against seven bots. **Create room**
opens an online room (up to eight people, Amber vs Cyan); share the link or the six-letter code with
friends on your network, who open the same address. The host picks the arena and starts the match.

Controls: **WASD** move, **mouse** aim, **left click** attack (hold to charge), **right click** class
ability (Striker Boost, Guardian shield, Recon cloak), **Space** dash, **1–4** or **Q** switch slot,
**I** inventory, **B** equipment in base, **Tab** scoreboard, **Esc** menu.

Views: the 3D view is the default; `?quality=low` turns off shadows and glow for slower machines,
`?view=2d` plays the original flat view.

## How it plays

See [docs/GAMEPLAY.md](docs/GAMEPLAY.md): classes, gear, weapons and their traits, the fighting rules
(interrupts, counters, perfect dodges, clashes, Spiral Knights-style cancels), statuses, hearts and the
eight arenas.

## Look and art

See [docs/LOOK.md](docs/LOOK.md) for the design rules, every number behind the look, and how to add
textures (`public/art/3d/<theme>/`, checked by `node tools/art3d-index.mjs`). Agents start with
[AGENTS.md](AGENTS.md).

## Project layout

| Path | What |
|---|---|
| `server.js` | static files, room API (`/api/rooms`) and WebSocket rooms (`/ws?room=CODE`), 120 Hz simulation |
| `public/index.html` | start page: play solo, create or join a room |
| `public/lockdown.html`, `lockdown-client.js`, `lockdown.css` | the game page, input, HUD, menus |
| `public/lockdown-engine.js` | deterministic simulation: movement, combat, classes, points, bots |
| `public/lockdown-maps.js` | the eight arenas (walls, two floors, stairs) |
| `public/lockdown-weapons.js`, `lockdown-equipment.js` | the armoury and the gear tables |
| `public/lockdown-renderer3d.js` | the 3D view (three.js, vendored in `public/vendor/three/`) |
| `public/lockdown-renderer.js`, `lockdown-assets.js` | the 2D view, minimap, reticle, and the sprite manifest |
| `public/art/` | 3D textures (`3d/`) and 2D sprites and icons (`lockdown/`) |
| `tools/` | art checkers and indexers; `lockdown-art-kit/` for sprite work |
| `test/` | `npm test` |

three.js is MIT-licensed (`public/vendor/three/LICENSE`).
