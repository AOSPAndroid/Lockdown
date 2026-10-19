/** Equipment is independent of class abilities. Resistances are fractions of direct
 * health damage blocked after shields (negative means you take more); status damage keeps
 * its existing behavior. Outfits may also carry perks and drawbacks, multiplied with the
 * class perks. Multipliers are 1 when unused:
 * - gunDamage, bladeDamage, bombDamage: damage dealt with that weapon family.
 * - gunCharge, bombCharge: charge time (below 1 is faster). bladeSpeed: swing speed.
 * - dashCooldown, dashDistance: the Space dash. abilityCooldown: the class ability (and the
 *   Guardian shield's recharge).
 * - maxHp: flat health added to the class. knockback: how far hits push you.
 * - statusDuration: how long burn, poison, shock and freeze last on you.
 * - healing: hearts, base and dome healing received. regen: health per second after
 *   four seconds without taking damage. */
const PERKS = Object.freeze({ gunDamage: 1, gunCharge: 1, bladeDamage: 1, bladeSpeed: 1, bombDamage: 1, bombCharge: 1, dashCooldown: 1, dashDistance: 1,
  abilityCooldown: 1, maxHp: 0, knockback: 1, statusDuration: 1, healing: 1, regen: 0 });
export const PERK_IDS = Object.freeze(Object.keys(PERKS));
const armor = (id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle, perks = {}) => Object.freeze({
  id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle,
  ...Object.fromEntries(Object.entries(PERKS).map(([key, base]) => [key, perks[key] ?? base])),
  walk: Object.freeze([...(perks.walk || [])]),
});

/** Every piece is built to a budget so that no choice is simply better: body armour is worth about three times a
 * helmet, pants or shoes, and each piece trades a strength for a cost. Descriptions say what a piece is for; the
 * equipment screen shows its exact numbers. Lighter armour is faster, and a faster knight also dashes further. */
export const ARMORS = Object.freeze({
  none: armor('none', 'Unarmored', 'The bare robot frame: no protection, no penalties.', 0, 0, 0, 1, 'none'),
  scout: armor('scout', 'Scout Armor', 'Light leathers: quick on your feet and further on the dash, with thin all-round protection.', .05, .05, .05, 1.07, 'light'),
  ballistic: armor('ballistic', 'Ballistic Armor', 'Layered plates against bullets; a little heavy, and blades still find the gaps.', .30, .05, .10, .96, 'ballistic'),
  duelist: armor('duelist', 'Duelist Armor', 'Padded mail against blades; a little heavy, and bullets still punch through.', .05, .30, .10, .96, 'duelist'),
  heavy: armor('heavy', 'Heavy Armor', 'Thick plate against everything, at the cost of speed (and a shorter dash).', .25, .25, .20, .87, 'heavy'),
  gunslinger: armor('gunslinger', 'Gunslinger Duster', 'A long riding coat for marksmen: guns hit harder and charge faster, with light protection.', .10, .05, .05, 1, 'gunslinger', { gunDamage: 1.1, gunCharge: .9 }),
  fencer: armor('fencer', 'Fencing Garb', 'A padded fencing jacket: swords hit harder and swing faster, with light protection.', .05, .10, .05, 1, 'fencer', { bladeDamage: 1.1, bladeSpeed: 1.08 }),
  windrunner: armor('windrunner', 'Windrunner Wraps', 'Silk wraps for runners: much faster, with long, quick-recharging dashes, but no real protection and softer sword hits.', .05, 0, 0, 1.11, 'windrunner', { dashCooldown: .8, bladeDamage: .92 }),
  juggernaut: armor('juggernaut', 'Juggernaut Plate', 'Riveted siege plate: extra health and hard to knock back, but the slowest armour, with a short dash.', .20, .20, .15, .84, 'juggernaut', { maxHp: 20, knockback: .5, dashDistance: .8 }),
  bombardier: armor('bombardier', 'Bombardier Apron', 'A scorched apron full of fuses: bombs charge faster and hit harder, blasts barely scratch you, but guns lose their edge.', .05, .05, .30, 1, 'bombardier', { bombCharge: .8, bombDamage: 1.1, gunDamage: .9 }),
  berserker: armor('berserker', 'Berserker Hide', 'Bare arms and a wolf pelt: swords hit much harder and you move a little faster, but bullets bite deeper.', -.10, .10, 0, 1.04, 'berserker', { bladeDamage: 1.2, bladeSpeed: 1.05 }),
  mirrorweave: armor('mirrorweave', 'Mirrorweave Cloak', 'A shimmering cloak that sheds fire, poison, shock and frost and turns bullets aside, at the cost of a little health.', .20, 0, .10, 1, 'mirrorweave', { statusDuration: .5, maxHp: -5 }),
  medic: armor('medic', 'Field Medic Coat', 'A coat with a satchel of salves: you heal more and mend steadily out of combat, but every weapon hits a little softer.', .05, .05, .05, 1, 'medic', { healing: 1.4, regen: 2, gunDamage: .95, bladeDamage: .95, bombDamage: .95 }),
  cobalt: armor('cobalt', 'Cobalt Mail', 'Deep-blue knight\'s mail: even protection against everything, a little slower.', .15, .15, .15, .96, 'cobalt'),
  vog: armor('vog', 'Vog Cub Coat', 'A shaggy coat of fireproof fur: blasts hurt much less, statuses wear off fast and you are hard to shove, but it is warm and a touch slow.', .05, .05, .25, .98, 'vog', { statusDuration: .5, knockback: .85 }),
  clockwork: armor('clockwork', 'Clockwork Harness', 'A ticking brass harness: your class ability and dash recharge much faster, but guns and swords hit a little softer.', .10, .10, .05, 1, 'clockwork', { abilityCooldown: .7, dashCooldown: .8, gunDamage: .95, bladeDamage: .95 }),
});
export const ARMOR_IDS = Object.freeze(Object.keys(ARMORS));

/** Helmets, pants and shoes. Same fields as body armour, about a third of its budget; every piece may help or hurt. */
const piece = (id, name, description, gun, blade, bomb, speed, perks = {}) => armor(id, name, description, gun, blade, bomb, speed, id, perks);
export const HELMETS = Object.freeze({
  none: piece('none', 'Bare head', 'The frame\'s plain head unit.', 0, 0, 0, 1),
  sallet: piece('sallet', 'Sallet Helm', 'A plain steel sallet that turns blades, a little heavy.', .03, .10, .03, .98),
  visor: piece('visor', 'Marksman Visor', 'A tinted visor: guns hit harder and charge faster, but it leaves your head bare to blades.', 0, -.03, 0, 1, { gunDamage: 1.1, gunCharge: .92 }),
  horned: piece('horned', 'Horned Helm', 'Swords hit harder and the helm turns a blade, but the horns make an easy target for guns.', -.03, .05, 0, 1, { bladeDamage: 1.1 }),
  hood: piece('hood', 'Hexweave Hood', 'Statuses wear off faster and your class ability recharges sooner; no protection.', 0, 0, 0, 1, { statusDuration: .7, abilityCooldown: .85 }),
  lampcap: piece('lampcap', 'Sapper Lamp Cap', 'Bombs charge faster and hit a little harder, with a little blast protection.', 0, 0, .05, 1, { bombCharge: .85, bombDamage: 1.05 }),
  feather: piece('feather', 'Feathered Cap', 'A dashing cap: faster on your feet and on the dash, at the cost of a little health.', 0, 0, 0, 1.05, { dashCooldown: .9, maxHp: -5 }),
  bucket: piece('bucket', 'Bucket Helm', 'Extra health, a little protection and hard to shove, but you can barely see where you are going.', .03, .03, .03, .97, { maxHp: 10, knockback: .8 }),
  circlet: piece('circlet', 'Mender Circlet', 'Healing is stronger and you mend slowly out of combat; statuses fade a little faster.', 0, 0, 0, 1, { healing: 1.25, regen: .5, statusDuration: .9 }),
  cobalt: piece('cobalt', 'Cobalt Helm', 'A deep-blue knight\'s helm: even protection, a touch heavy.', .05, .05, .05, .99),
  wolver: piece('wolver', 'Wolver Cowl', 'A wolf-pelt cowl, ears and all: a little faster and sharper with swords, a little weaker to guns.', -.03, 0, 0, 1.03, { bladeDamage: 1.05 }),
  demo: piece('demo', 'Volcanic Demo Helm', 'A blast-scarred demolition helm: bombs hit harder and blasts hurt you less, a touch heavy.', 0, 0, .10, .99, { bombDamage: 1.1 }),
  seraph: piece('seraph', 'Seraph Veil', 'A white veil under a golden halo: a little extra health, stronger healing and much shorter statuses.', 0, 0, 0, 1, { maxHp: 5, healing: 1.15, statusDuration: .7 }),
  goggles: piece('goggles', 'Clockwork Goggles', 'Your class ability recharges much sooner and guns charge faster, but the lenses dull your sword arm a little.', 0, 0, 0, 1, { abilityCooldown: .75, gunCharge: .92, bladeDamage: .97 }),
});
export const PANTS = Object.freeze({
  none: piece('none', 'Bare legs', 'The frame\'s plain leg plates.', 0, 0, 0, 1),
  greaves: piece('greaves', 'Plate Greaves', 'Steel leg plates that turn blades, a little slower.', .03, .10, .03, .98),
  leggings: piece('leggings', 'Runner Leggings', 'Light running leggings: faster, with a longer dash; no protection.', 0, 0, 0, 1.035, { dashDistance: 1.1 }),
  chausses: piece('chausses', 'Chainmail Chausses', 'Mail chausses: blast protection and less knockback, a little slower.', .03, .03, .12, .98, { knockback: .8 }),
  breeches: piece('breeches', 'Duelist Breeches', 'Swings come faster, with light sword protection.', 0, .05, 0, 1, { bladeSpeed: 1.08 }),
  sapper: piece('sapper', 'Sapper Trousers', 'Pockets full of fuses: bombs charge faster, with a little blast protection.', 0, 0, .05, 1, { bombCharge: .8 }),
  cargo: piece('cargo', 'Cargo Trousers', 'Spare magazines: guns charge faster and hit a little harder.', 0, 0, 0, 1, { gunCharge: .9, gunDamage: 1.06 }),
  cobalt: piece('cobalt', 'Cobalt Cuisses', 'Blue steel thigh plates: even protection, a touch heavy.', .05, .05, .05, .99),
  wolver: piece('wolver', 'Wolver Leggings', 'Fur-lined running leggings: a little faster, and swords swing a little faster.', 0, 0, 0, 1.03, { bladeSpeed: 1.05 }),
  demo: piece('demo', 'Demo Pantaloons', 'Baggy pantaloons stuffed with charges: bombs charge faster and hit harder, but blasts hurt you a little more.', 0, 0, -.03, 1, { bombCharge: .85, bombDamage: 1.1 }),
  seraph: piece('seraph', 'Seraph Tassets', 'White and gold tassets: you mend out of combat and heal a little more; light, so swords hurt a little more.', 0, -.03, 0, 1, { regen: 1, healing: 1.1 }),
  kilt: piece('kilt', 'Kilt of Fury', 'Swords hit harder and you move a little faster, but bullets find bare knees.', -.05, 0, 0, 1.03, { bladeDamage: 1.1 }),
});
export const SHOES = Object.freeze({
  none: piece('none', 'Bare feet', 'The frame\'s plain feet.', 0, 0, 0, 1),
  sneakers: piece('sneakers', 'Sprint Sneakers', 'Faster on your feet, at the cost of a little health.', 0, 0, 0, 1.06, { maxHp: -5 }),
  sabatons: piece('sabatons', 'Iron Sabatons', 'Rooted to the ground: much less knockback and some protection, but slower.', .03, .05, .10, .97, { knockback: .6 }),
  dashboots: piece('dashboots', 'Dash Boots', 'The dash recharges much sooner and goes a little further.', 0, 0, 0, 1, { dashCooldown: .7, dashDistance: 1.15 }),
  spurs: piece('spurs', 'Spurred Boots', 'Swords hit a little harder and you move a little faster.', 0, 0, 0, 1.02, { bladeDamage: 1.05 }),
  treads: piece('treads', 'Mud Treads', 'Sure footing: statuses wear off faster, a little protection and less knockback; heavy soles.', .03, .03, 0, .99, { statusDuration: .65, knockback: .85 }),
  clogs: piece('clogs', 'Rocket Clogs', 'A much longer dash and a little more speed, but the dash takes longer to recharge.', 0, 0, 0, 1.02, { dashDistance: 1.35, dashCooldown: 1.15 }),
  sandals: piece('sandals', 'Healer Sandals', 'You mend out of combat and heal a little more.', 0, 0, 0, 1, { regen: 1, healing: 1.05 }),
  striders: piece('striders', 'Stride Boots', 'Long, light strides: faster, and your class ability recharges sooner, but a little weaker to swords.', 0, -.03, 0, 1.04, { abilityCooldown: .9 }),
  magma: piece('magma', 'Magma Treads', 'Fireproof soles: statuses wear off faster and blasts hurt less; a touch heavy.', 0, 0, .10, .99, { statusDuration: .7 }),
  hover: piece('hover', 'Hover Boots', 'Float a hair off the floor: half the knockback, a longer dash and a little blast protection; a touch slow.', 0, 0, .05, .99, { knockback: .5, dashDistance: 1.2 }),
  quicksilver: piece('quicksilver', 'Quicksilver Slippers', 'The fastest thing you can wear on your feet, but paper-thin: a little weaker to everything.', -.06, -.06, -.06, 1.1),
});

/** The four equipment slots, head to toe, and the table each one picks from. */
export const GEAR_SLOTS = Object.freeze(['helmet', 'armor', 'pants', 'shoes']);
export const GEAR = Object.freeze({ helmet: HELMETS, armor: ARMORS, pants: PANTS, shoes: SHOES });
// Stacking is allowed, within bounds: a full set of sword gear tops out at +25% sword damage, and so on.
export const GEAR_LIMITS = Object.freeze({ resistance: [-.4, .6], speed: [.7, 1.3], power: [.75, 1.25], tempo: [.5, 1.5], maxHp: [-30, 40], knockback: [.3, 1.5], statusDuration: [.3, 1.5], healing: [.7, 1.8] });
const PERK_LIMIT = { gunDamage: 'power', bladeDamage: 'power', bombDamage: 'power', bladeSpeed: 'power', healing: 'healing',
  gunCharge: 'tempo', bombCharge: 'tempo', dashCooldown: 'tempo', dashDistance: 'tempo', abilityCooldown: 'tempo', knockback: 'knockback', statusDuration: 'statusDuration', maxHp: 'maxHp' };

const combined = new Map();
/** Everything a knight wears, added up: resistances add (capped), speed and multipliers
 * multiply, health and regeneration add. Accepts a player or { helmet, armor, pants, shoes }. */
export function combineGear(gear = {}) {
  const ids = GEAR_SLOTS.map(slot => Object.hasOwn(GEAR[slot], gear[slot]) ? gear[slot] : 'none'), key = ids.join('|');
  if (combined.has(key)) return combined.get(key);
  const pieces = ids.map((id, index) => GEAR[GEAR_SLOTS[index]][id]);
  const clamp = (value, [low, high]) => Math.max(low, Math.min(high, value));
  const sum = field => pieces.reduce((total, part) => total + part[field], 0), product = field => pieces.reduce((total, part) => total * part[field], 1);
  const stats = { gunResistance: clamp(sum('gunResistance'), GEAR_LIMITS.resistance), bladeResistance: clamp(sum('bladeResistance'), GEAR_LIMITS.resistance), bombResistance: clamp(sum('bombResistance'), GEAR_LIMITS.resistance),
    speedMultiplier: Math.round(clamp(product('speedMultiplier'), GEAR_LIMITS.speed) * 1e4) / 1e4 };
  for (const perk of PERK_IDS) {
    const value = perk === 'maxHp' || perk === 'regen' ? sum(perk) : product(perk);
    stats[perk] = PERK_LIMIT[perk] ? Math.round(clamp(value, GEAR_LIMITS[PERK_LIMIT[perk]]) * 1e4) / 1e4 : value;
  }
  const walk = Object.freeze([...new Set(pieces.flatMap(part => part.walk))].sort());
  const result = Object.freeze({ ...stats, walk, name: pieces.filter(part => part.id !== 'none').map(part => part.name).join(' + ') || 'Unarmored', pieces: Object.freeze(ids) });
  combined.set(key, result);
  return result;
}
