#!/usr/bin/env node
/** Writes docs/CATALOG.md: every item in Lockdown with what it does, how it looks and exactly which files
 * to make. Generated from the game data and public/lockdown-looks.js, so it never drifts from the game.
 *   node tools/catalog.mjs */
import { writeFileSync } from 'node:fs';
import { WEAPONS, WEAPON_NOTES, CLASSES, ABILITIES } from '../public/lockdown-engine.js';
import { HELMETS, ARMORS, PANTS, SHOES, PERK_IDS } from '../public/lockdown-equipment.js';
import { BODY_LOOK, CLASS_LOOKS, GEAR_LOOKS, WEAPON_LOOKS } from '../public/lockdown-looks.js';

const pct = value => `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
const PERK_LABELS = { gunDamage: 'gun damage', gunCharge: 'gun charge time', bladeDamage: 'sword damage', bladeSpeed: 'swing speed', bombDamage: 'bomb damage', bombCharge: 'bomb charge time',
  dashCooldown: 'dash cooldown', dashDistance: 'dash distance', abilityCooldown: 'ability cooldown', maxHp: 'health', knockback: 'knockback taken', statusDuration: 'status duration', healing: 'healing received', regen: 'regeneration' };
function stats(piece) {
  const parts = [];
  for (const [key, label] of [['gunResistance', 'vs guns'], ['bladeResistance', 'vs swords'], ['bombResistance', 'vs bombs']]) if (piece[key]) parts.push(`${pct(piece[key])} ${label}`);
  if (piece.speedMultiplier !== 1) parts.push(`${pct(piece.speedMultiplier - 1)} speed`);
  for (const key of PERK_IDS) {
    const value = piece[key];
    if (key === 'maxHp') { if (value) parts.push(`${value > 0 ? '+' : ''}${value} health`); continue; }
    if (key === 'regen') { if (value) parts.push(`${value} HP/s regeneration`); continue; }
    if (value !== 1) parts.push(`${pct(value - 1)} ${PERK_LABELS[key]}`);
  }
  return parts.join(', ') || 'no stat changes';
}
const SLOT_PARTS = { helmet: '`head`', armor: '`chest` (plus optional `arm_L`, `arm_R` for sleeves and pauldrons, `hips` for coat tails or a skirt)', pants: '`hips`, `leg_L`, `leg_R`', shoes: '`foot_L`, `foot_R`' };
const BUDGET = { helmet: 2500, armor: 3000, pants: 2000, shoes: 1500 };
const ICON = { helmet: 'icon_helmet_', armor: 'icon_armor_', pants: 'icon_pants_', shoes: 'icon_shoes_' };

function gearSection(slot, table, title) {
  const rows = Object.values(table).map(piece => {
    const look = GEAR_LOOKS[slot][piece.id];
    const files = piece.id === 'none'
      ? (slot === 'helmet' ? `\`models/helmet/none.glb\` (the hair), icon \`${ICON[slot]}none.png\`` : `nothing (the body's ${slot === 'armor' ? 'T-shirt' : slot === 'pants' ? 'shorts' : 'shoes'}), icon \`${ICON[slot]}none.png\``)
      : `\`models/${slot}/${piece.id}.glb\`, icon \`${ICON[slot]}${piece.id}.png\``;
    return `### ${piece.name} \`${piece.id}\`\n\n- **Does:** ${piece.description} (${stats(piece)})\n- **Looks:** ${look}\n- **Make:** ${files}\n`;
  });
  return `## ${title} (${Object.keys(table).length})\n\nAttach to ${SLOT_PARTS[slot]}. Budget ${BUDGET[slot]} triangles.\n\n${rows.join('\n')}`;
}
function size(weapon) {
  if (weapon.family === 'bomb') return weapon.id === 'nitro' ? 'held ≈ 0.45 across; planted ≈ 0.6 tall' : 'held ≈ 0.28 across; planted ≈ 0.4 tall';
  if (weapon.family === 'gun') return weapon.id === 'rifle' ? 'long: ≈ 1.0 from grip to muzzle' : ['magnus', 'grimcannon', 'scatter'].includes(weapon.id) ? 'big: ≈ 0.65 from grip to muzzle, body ≈ 0.3 tall' : '≈ 0.5 from grip to muzzle, a fat body ≈ 0.25 tall';
  if (weapon.id === 'maul') return 'haft ≈ 1.0, head ≈ 0.4 × 0.4 × 0.5';
  if (weapon.heavy) return 'heavy: ≈ 1.3 from grip to tip, blade ≈ 0.25 wide';
  if (['rapier', 'leviathan'].includes(weapon.id)) return 'long: ≈ 1.2 from grip to tip, slim';
  if (['spur', 'voltedge'].includes(weapon.id)) return 'short: ≈ 0.8 from grip to tip';
  return '≈ 1.05 from grip to tip (most of the knight\'s height), blade ≈ 0.2 wide, a chunky guard ≈ 0.35 across';
}
function weaponStats(weapon) {
  const notes = WEAPON_NOTES[weapon.id];
  const facts = [weapon.type, weapon.element ? `element: ${weapon.element}` : null, weapon.heavy ? 'heavy (unflinching)' : null];
  if (weapon.family === 'blade') facts.push(`${weapon.combo.length}-cut combo (${weapon.combo.map(step => step.damage).join(' / ')} damage)`);
  if (weapon.family === 'gun') facts.push(`${weapon.clip}-round clip, ${weapon.pellets ? `${weapon.pellets} pellets × ${weapon.damage}` : weapon.damage} damage`);
  if (weapon.family === 'bomb') facts.push(weapon.cloud ? `${weapon.cloud.status} cloud` : `${weapon.damage} damage blast`);
  return `${facts.filter(Boolean).join(' · ')} · difficulty ${'★'.repeat(notes?.difficulty || 1)}${notes ? ` · good: ${notes.pros.join('; ')} · bad: ${notes.cons.join('; ')}` : ''}`;
}
function weaponSection(family, title) {
  const list = Object.values(WEAPONS).filter(weapon => weapon.family === family);
  const rows = list.map(weapon => {
    const files = family === 'bomb'
      ? `\`models/weapons/${weapon.id}.glb\` (in hand while charging), \`models/bombs/${weapon.id}.glb\` (planted, standing on the floor), icon \`icon_weapon_${weapon.id}.png\``
      : `\`models/weapons/${weapon.id}.glb\`, icon \`icon_weapon_${weapon.id}.png\``;
    return `### ${weapon.name} \`${weapon.id}\`\n\n- **Does:** ${weapon.description}\n- **Stats:** ${weaponStats(weapon)}\n- **Looks:** ${WEAPON_LOOKS[weapon.id]}\n- **Size:** ${size(weapon)}\n- **Make:** ${files}\n`;
  });
  return `## ${title} (${list.length})\n\n${rows.join('\n')}`;
}

const counts = { helmets: Object.keys(HELMETS).length, armor: Object.keys(ARMORS).length, pants: Object.keys(PANTS).length, shoes: Object.keys(SHOES).length,
  swords: Object.values(WEAPONS).filter(w => w.family === 'blade').length, guns: Object.values(WEAPONS).filter(w => w.family === 'gun').length, bombs: Object.values(WEAPONS).filter(w => w.family === 'bomb').length };
const markdown = `# Lockdown asset catalogue

<!-- Generated by tools/catalog.mjs from the game data and public/lockdown-looks.js. Edit those, not this file. -->

Everything the game shows, item by item: what it does, how it should look, and the exact files to make.
Read [MODELS.md](MODELS.md) for how models are built (rig, units, materials, budgets) and [LOOK.md](LOOK.md)
for the overall look. All model paths are under \`public/art/3d/\`; icons are 2D PNGs under
\`public/art/lockdown/\` (drawn at 96×96, see \`public/art/lockdown/ASSETS.md\`).

**House style:** the Spiral Knights art style (see [ART-GUIDE.md](ART-GUIDE.md) and [reference/spiral-knights/](reference/spiral-knights/README.md)): chunky, rounded, toy-like shapes with hand-painted textures; oversized weapons; soft painted materials; clean
silhouettes that read from a camera ~48° above; light from the top-left. Original designs only. Team
colour is never baked in: trims meant to show the team use a material named \`team\`.

| Category | Items | Model files |
|---|---|---|
| Knight body | 1 | \`models/knight/body.glb\` (with the T-shirt, shorts and shoes; the hair is \`helmet/none.glb\`) |
| Class pieces | 2 | \`models/class/guardian.glb\` (big shield), \`models/class/recon.glb\` (tiny cloaking shield); the Striker's neon line is drawn by the game |
| Helmets | ${counts.helmets} | \`models/helmet/<id>.glb\` |
| Armor | ${counts.armor} | \`models/armor/<id>.glb\` |
| Pants | ${counts.pants} | \`models/pants/<id>.glb\` |
| Shoes | ${counts.shoes} | \`models/shoes/<id>.glb\` |
| Swords | ${counts.swords} | \`models/weapons/<id>.glb\` |
| Guns | ${counts.guns} | \`models/weapons/<id>.glb\` |
| Bombs | ${counts.bombs} | \`models/weapons/<id>.glb\` + \`models/bombs/<id>.glb\` |

## The knight body

- **Looks:** ${BODY_LOOK}
- **Make:** \`models/knight/body.glb\`, built on the rig in [docs/reference/knight_rig.glb](reference/knight_rig.glb). Budget 4000 triangles.

## Classes (3)

Class pieces attach like gear (both shields go on \`arm_L\`). Budget 1500 triangles each.

${Object.entries(CLASSES).map(([id, cls]) => `### ${cls.name || id[0].toUpperCase() + id.slice(1)} \`${id}\`\n\n- **Does:** ${cls.hp} HP, ability: ${cls.ability}. ${cls.perks}. ${cls.description}\n- **Looks:** ${CLASS_LOOKS[id]}\n- **Make:** ${id === 'striker' ? 'nothing (the game draws the neon line); icon only' : `\`models/class/${id}.glb\``}\n`).join('\n')}
${gearSection('helmet', HELMETS, 'Helmets')}
${gearSection('armor', ARMORS, 'Armor')}
${gearSection('pants', PANTS, 'Pants')}
${gearSection('shoes', SHOES, 'Shoes')}
${weaponSection('blade', 'Swords')}
${weaponSection('gun', 'Guns')}
${weaponSection('bomb', 'Bombs')}`;
writeFileSync(new URL('../docs/CATALOG.md', import.meta.url), markdown);
const total = 1 + 3 + Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`docs/CATALOG.md written: ${total} items.`);
