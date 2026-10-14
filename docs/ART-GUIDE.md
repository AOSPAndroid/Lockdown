# Lockdown art guide

Everything an artist (or an art agent) needs to make Lockdown's art, in one place. **The knights are small
battle robots in the style of the LBX anime and its model kits:** a robot frame with swappable armour parts,
crisp hard-surface plates, glowing camera eyes, big weapons and shields. The designs, names and every pixel and
vertex are **original**: never copy, trace or recolour an existing LBX robot (or any other), its logos or names.

The item list is [CATALOG.md](CATALOG.md): 98 items, each with what it does, how it looks, its size and the
exact files to make. The fine print for models is [MODELS.md](MODELS.md) and for arenas [LOOK.md](LOOK.md);
this guide summarises both, so you can work from this page alone.

---

## 1. The LBX robot look

**Look at [reference/lbx/](reference/lbx/README.md) first:** reference images of an LBX-style robot with
notes on what to take from them. They are reference only: match the style, never copy the design.

The game's design maps straight onto LBX: every knight is the same **robot frame**, and the four gear slots are
its swappable **armour parts**: helmet = head unit, armour = chest and arm armour, pants = waist and leg armour,
shoes = feet. Starting with no gear means a **bare frame**.

### Shapes
- **Hard-surface, crisp and chamfered.** Armour is made of distinct plates with flat faces, wide chamfers and
  clean edges, like a plastic model kit. No soft, inflated or bulby forms.
- **Two layers.** A dark gunmetal **inner frame** (visible at the neck, shoulders, elbows, waist, knees and
  ankles: ball joints, pistons, cylinders) under light **armour plates**. The contrast between dark frame and
  bright plates is a big part of the look.
- **Heroic proportions.** About **five heads tall**: a compact head, broad shoulders and chest, a narrow waist,
  long armoured legs and big wedge feet. Not chibi, not a cute kid, not a mannequin.
- **Strong silhouettes.** Each robot is identifiable from its silhouette at 70 pixels tall: crests, horns, fins,
  antennae, shoulder shapes, big feet. Thin wires and filigree don't read.
- **Mechanical detail where it reads:** panel lines, vents, gold bolt caps at the joints, emblems on the chest,
  layered plates on thighs and shins.

### Materials and painting
- **Painted plastic, like a finished model kit.** Clean satin colours, crisp panel lines (dark lines in the
  seams), a light edge highlight on chamfers, soft shading in recesses. Little wear: a few scuffs at most.
- **One hand-painted texture per model** (panel lines, highlights and emblems painted in). Flat untextured colour
  looks like a toy, not a kit.
- **Metal** (weapons, joints, bolts) is painted too: steel blue-grey with a bright edge, gold with warm highlights.
- **Glow is an accent:** camera eyes, lenses, energy cores, gems and elemental parts. Plates never glow.

### Colour
- **White or light base plates + one strong main colour + one accent + gold.** For example white and royal
  blue with a red crest and gold bolts. Each armour set has its own main colour (in its catalogue entry).
- **Element colour code** (keep it consistent on every sword, gun, bomb, effect and icon):

| Element | Colours | Feel |
|---|---|---|
| Normal | steel blue-grey, gold trim, a red or blue gem | clean, heroic |
| Fire (burn) | orange-red to yellow, charred black | flickering, hot |
| Frost (chill, freeze) | pale blue, white, cyan glow | crystalline, sharp |
| Shock | cyan and white-yellow, copper coils | crackling, zigzag |
| Poison | acid green, dark teal, purple-black | bubbling, dripping |
| Curse | deep violet, black, magenta runes | smoky, cracked |
| Holy | white, warm gold, soft yellow glow | radiant, feathered |
| Drain | blood red, bone white | sharp, hungry |
| Rift | violet crystal, black frame | floating, angular |

- **Team colours are not part of any item:** Amber `#e39a3b` and Cyan `#3bb8c4` are painted on by the game,
  on materials named `team` (a chest stripe, an antenna fin, a shield band).

### Light
- Key light from the **top-left**, a cool fill from the sky, a soft warm bounce from the floor. The game lights
  every model this way, so **never bake lighting or shadows** into textures; paint only panel lines, edge
  highlights and soft recess shading.

---

## 2. Knights (the robots)

Every knight is the same **robot frame** (1.3 units tall), wearing four armour parts and a class mark, holding
one weapon. Build it on the rig in [reference/knight_rig.glb](reference/knight_rig.glb): about five heads tall,
broad shoulders, narrow waist, long legs, big feet.

- **The bare frame** (the body, and what a knight with no gear looks like): the dark inner frame with plain
  light-grey base plates (chest plate with a `team` stripe, shoulder caps, thigh, shin and foot plates) and the
  bare head unit: a compact rounded head with a dark visor band, **two round glowing camera eyes** and a small
  `team` antenna fin. It must look like a real, cool robot on its own, not unfinished.
- **Armour parts** go over the frame plates and change the silhouette: a new head unit, a new chest and
  pauldrons, new thighs and shins, new feet. Each set has its own shape language and main colour (Cobalt: deep
  blue knight; Wolver: grey wolf; Volcanic Demo: black and glowing orange; Seraph: white and gold with a halo;
  Vog Cub: shaggy orange-black). Every part must also look right mixed with any other part.
- **Heads read from above.** The camera looks down at about 48°, so the head, the shoulders and the weapon are
  what people see most. Put the most character there: crests, horns, fins, antennae, shoulder shapes.
- **Class marks** read on any outfit:
  - **Guardian:** a **big round battle shield** on the left arm (≈ 0.7 across, gold rim and radial vanes, a
    pointed boss), `class/guardian.glb`.
  - **Recon:** a **tiny round shield** on the left forearm with a glowing lens, the cloaking device,
    `class/recon.glb`. The game makes the lens flare when it cloaks.
  - **Striker:** nothing to model. The game draws a thin **neon line** in team colour trailing behind it.
- **No capes or cloth that should flow:** models are rigid. A cape, if any, is a stiff swept plate.

**Not this:** a chibi kid, a person in clothes, skin, hair, a cute face, soft rounded toy shapes, flat untextured
colours, a copy of an existing LBX robot.

---

## 3. Weapons

Weapons are the stars of every screenshot: bold, machined, colourful and glowing, sized for the robot.

- **Swords:** a normal sword is ≈ 0.75 from grip to tip (just over half the knight's 1.3 height), blade ≈ 0.12
  wide, guard ≈ 0.24 across. Heavies are longer and wider (≈ 0.95, blades ≈ 0.18 wide), the rapier and the
  Tidebreaker long and slim (≈ 0.9), and the four-cut swords short and hooked (≈ 0.6). Never longer than the
  knight is tall; the exact size of each sword is in its catalogue entry. Big readable cross-guards, a pommel gem, a fuller or an engraved line on the
  blade. Elemental swords make the element the blade itself (ice, flame, lightning, poison vines, runes).
- **Guns:** short, fat and toy-like, steampunk-meets-sci-fi: a rounded brass or steel body, a big grip, a
  visible energy core or canister in the element colour, and a distinctive muzzle (flared trumpet, ringed
  emitter, skull, fangs, claw, double barrel). Length ≈ 0.5 for pistols, ≈ 0.65 for hand-cannons and the
  scattergun, ≈ 1.0 for the rifle.
- **Bombs:** round, heavy and friendly: an iron or glass sphere with a band, a fuse or cap and the element
  showing (smoke, frost, venom, sparks, runes, a vortex window). Held ≈ 0.28 across; planted ≈ 0.4 tall; the
  Nitro Colossus is barrel-sized.
- **Heavy means heavy.** The Troll Cleaver, Umbral Greatblade, Hexblade, Earthbreaker Maul and Tri-Fang Blade
  must look like they take two hands and a run-up.

---

## 4. Arenas

Arenas are built by the game from the map grid; art replaces their materials (textures). The look: a chunky
toy fortress floating in a dark void, built only from walls and two floors, kept open, with grand stairs,
glass railings on brass posts, ball-topped pillars and glowing lamps. Six themes: castle (worn flagstones,
grey ashlar), maze (bright grass, round hedges), foundry (iron plates, red walls with brass X-braces), ruins
(sandstone), graveyard (slate), skyway (white marble with gold inlay, clouds below). Full palettes and rules
are in [LOOK.md](LOOK.md). Per theme, make four textures:

| File (under `public/art/3d/<theme>/`) | Size | Covers | Notes |
|---|---|---|---|
| `floor.png` | 1024² | 4×4 tiles from above | broad bevelled plates, grout inside the image only, an occasional carved swirl; seamless both ways |
| `wall.png` | 1024² | one tile wide × the whole wall face | lit cap band at the top, the theme pattern in the middle, a dark plinth at the bottom; seamless left-right |
| `wall_top.png` | 512² | 1×1 tile from above | lighter than the face; seamless; no outline |
| `cliff.png` | 512² | 1×1 unit | dark foundation rock or girders; seamless |

Optional `<slot>_normal.png` for any of them. Albedo only: no baked light, no perspective, no dark borders.

---

## 5. Menu icons

Every item also needs a menu icon (the armory and inventory show them): `public/art/lockdown/icon_*.png`,
drawn at **96×96** with a transparent background. The icon style: the item rendered in 3D
from a three-quarter view, slightly from above, filling the frame, lit from the top-left, with a soft dark
outline so it reads on any background. Make icons from your models so they match exactly. File names are in
each catalogue entry (`icon_weapon_<id>`, `icon_helmet_<id>`, `icon_armor_<id>`, `icon_pants_<id>`,
`icon_shoes_<id>`); the class and ability icons (`icon_class_*`, `icon_ability_*`) are listed in
`public/art/lockdown/ASSETS.md`.

---

## 6. Technical rules (models)

- Binary glTF (`.glb`) under `public/art/3d/models/`: `knight/body.glb`, `class/<class>.glb`,
  `helmet|armor|pants|shoes/<id>.glb`, `weapons/<id>.glb`, `bombs/<id>.glb`.
- **1 unit = 1 floor tile; the knight is 1.3 tall; Y up; the knight faces +X**; origin between the feet.
- **Rigid named parts, no skinning, no animation** (natural for robots). The game swings the parts itself. Build the body on
  `docs/reference/knight_rig.glb` (the five-heads-tall robot frame): `hips` > `chest` > `head`, `arm_L` > `hand_L`, `arm_R` > `hand_R`, and
  `hips` > `leg_L` > `foot_L`, `leg_R` > `foot_R`, with the same names and pivots.
- **Gear** files hold one top-level node per body part they cover, named after it: helmets `head`; armour
  `chest` (plus optional `arm_L`, `arm_R`, `hips`); pants `hips`, `leg_L`, `leg_R`; shoes `foot_L`, `foot_R`; class
  pieces `arm_L`. Make them slightly bigger than what they cover, since legs swing ±40°, arms ±35°
  and the weapon arm up to ±80°.
- **Weapons:** origin at the middle of the grip, pointing **+X**. **Planted bombs:** origin on the floor, standing
  up +Y.
- **Materials:** glTF metal/rough. Materials named `team…` take the team colour. Glowing parts get an emissive
  colour. One painted texture per model, embedded, a power of two (1024² at most); each `.glb` under 600 KB.
- **Triangle budgets:** body 4000, armour 3000, helmet 2500, pants 2000, shoes/class piece/weapon 1500, planted
  bomb 1200.

Full details: [MODELS.md](MODELS.md).

---

## 7. Do and don't

**Do:** crisp hard-surface plates over a dark frame, five-heads-tall heroic robots, panel lines, gold bolts,
glowing camera eyes, one strong colour per set, readable from above, matching sets, the element colour code,
original designs.

**Don't:** copy or trace an LBX robot (or any game's or show's) designs, logos or names; chibi or bulby shapes;
skin, hair or faces; photoreal or noisy textures;
pixel art or voxels; thin spindly parts; grimdark or gore; text on items; baked lighting; team colours in
textures; anything that pokes through other gear when the knight moves; stretching or smearing art to fix it
(redraw instead).

---

## 8. How to work

0. **Design options (stop for a choice).** Before any full model set, show **three different robot design
   directions**, all clearly LBX-style (see [reference/lbx/](reference/lbx/README.md)) but different in shape
   language (sleek, chunky, angular), proportions within "about five heads", how much frame shows, colour
   scheme and detail level. Show each on the **bare frame** and on **two armoured builds** (the Cobalt set, and
   Scout armour with the Sallet head), each holding the Knight Brand, plus a Guardian with its big shield. One
   comparison sheet with a short name per direction, next to the reference, plus each one in the Dojo at game
   distance. Quick block-outs with painted textures; nothing final. Wait for a pick.
1. **Style lock (stop for approval).** In the chosen direction only: the robot frame (`knight/body.glb`, which
   includes the bare head), the Guardian's big shield and the Recon's tiny shield, the Cobalt set (head, chest,
   legs), the Knight Brand, the Pulse Blaster and the Cannonball Bomb (in hand and planted). Run the checks,
   play the game and show screenshots next to the reference.
2. **Gear:** all 14 helmets, 16 armours, 12 pants and 12 shoes.
3. **Weapons:** all 15 swords, 15 guns and 10 bombs, plus the 10 planted bombs.
4. **Icons** for every item, made from the models.
5. **Arenas:** the four textures per theme, one theme at a time (foundry first).

After every batch:
- `node tools/art3d-index.mjs`: no errors (it checks folders, ids, rig parts, gear nodes, budgets, textures).
- `node tools/lockdown-art-index.mjs`: no errors for icons.
- `npm test`: everything passes.
- `npm start`, open the **Dojo** (<http://localhost:3000/lockdown.html?solo=1&dojo=1>): press **B** anywhere
  to put the item on, and use the dummies to see it from every side. Take screenshots: idle, running,
  swinging, charging (hold attack), hitting a dummy, next to the gallery. For arenas use a solo match
  (<http://localhost:3000/lockdown.html?solo=1>): in base, on a capture point, mid-fight. Put mismatched combinations side by side. Show the screenshots.

Never change gameplay code to make art fit. If an item's description in the catalogue seems wrong, say so.

---

## 9. Delivery checklist

| What | Count | Where |
|---|---|---|
| Robot frame | 1 | `models/knight/body.glb` (with the bare head and base plates) |
| Class pieces | 2 | `models/class/guardian.glb` (big shield), `models/class/recon.glb` (tiny cloaking shield) |
| Helmets | 13 | `models/helmet/<id>.glb` (not `none`: the bare head is part of the body) |
| Armour | 15 | `models/armor/<id>.glb` (not `none`: the bare plates are part of the body) |
| Pants | 11 | `models/pants/<id>.glb` (not `none`) |
| Shoes | 11 | `models/shoes/<id>.glb` (not `none`) |
| Swords | 15 | `models/weapons/<id>.glb` |
| Guns | 15 | `models/weapons/<id>.glb` |
| Bombs | 10 + 10 | `models/weapons/<id>.glb` and `models/bombs/<id>.glb` |
| Icons | 98 | `public/art/lockdown/icon_*.png` (96×96): 40 weapons, 13 helmets, 16 armours, 11 pants, 11 shoes, 3 classes, 4 class abilities |
| Arena textures | 6 × 4 | `public/art/3d/<theme>/{floor,wall,wall_top,cliff}.png` |

Ids, names, looks and sizes for every row: [CATALOG.md](CATALOG.md).
