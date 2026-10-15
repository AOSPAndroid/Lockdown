/** Lockdown armoury: the same weapon types as Spiral Knights, with original names.
 * Pure data, read by the engine, renderer, bots, art manifest and lobby. All times are
 * simulation ticks (120 per second); distances are world units (a floor tile is 48).
 *
 * Blades swing a combo of steps. Each step winds up (`startup`), sweeps its arc across
 * `active` ticks (hits land where the blade actually is), then recovers. Pressing again
 * during a swing queues the next step. Holding the button charges a special.
 * Guns hold a clip and reload on their own after a short pause or when empty, even while
 * holstered. Bombs only plant from a full charge; you move slowly while charging. */
export const TICKS = 120;
// Equipment has one canonical table; armoury callers can import it here too.
export { ARMORS, ARMOR_IDS, PERK_IDS } from './lockdown-equipment.js';

/** Sword tempo: every wind-up and cut is drawn out so a swing reads and lands with weight, and the
 * recovery is a little shorter so a full combo only takes slightly longer than the raw numbers below. */
export const BLADE_TEMPO = Object.freeze({ startup: 1.4, active: 1.6, recovery: .8 });
const step = (damage, startup, active, recovery, reach, arc, push, stun, lunge) => Object.freeze({ damage, reach, arc, push, stun, lunge,
  startup: Math.round(startup * BLADE_TEMPO.startup), active: Math.round(active * BLADE_TEMPO.active), recovery: Math.max(4, Math.round(recovery * BLADE_TEMPO.recovery)) });

/** How a sword cuts, so aiming matters and a wide swing is not free. Precise swords sweep a narrow arc and
 * hit hard: miss and the whiff leaves you open. Sweeping swords catch anything in front but hit lighter.
 * Balanced sits between. Thrusts keep the narrow line they are written with. Applied to every step's arc,
 * push and reach below; the damage follows from the final arc (see AIM). */
export const CUTS = Object.freeze({
  precise: Object.freeze({ arc: .55, push: .4, reach: 1.25, label: 'Precise', note: 'narrow but long cut that hits hard and barely pushes: aim it, and stay on them' }),
  balanced: Object.freeze({ arc: .75, push: 1, label: 'Balanced', note: 'medium cut, medium damage' }),
  sweeping: Object.freeze({ arc: 1, push: 3, reel: true, label: 'Sweeping', note: 'wide cut that hits lighter but knocks the enemy back reeling: follow up with a heavy sword, or switch to a gun and shoot them out of reach' }),
  thrust: Object.freeze({ arc: 1, push: .5, label: 'Thrust', note: 'a straight, narrow line with a sweet spot at the tip, little knockback' }),
});
/** A heavy sword's second blow: after a normal first cut, it carries the momentum through a half turn (back to
 * the target, then round with the blade), so it winds up fast, cuts a narrower arc and lands far harder, but a miss leaves you spun round and wide open (see BLADE.momentumWhiff). */
const momentum = move => Object.freeze({ ...move, arc: Math.round(move.arc * .7 * 100) / 100, momentum: true });
/** The last cut of the katana's and the elemental swords' three-cut combo is a critical: on a perfect combo (see
 * BLADE.combo) it lands half again as hard; otherwise it lands as a plain cut. */
export const CRITICAL = 1.5;
const critical = move => Object.freeze({ ...move, damage: Math.round(move.damage * CRITICAL), critical: true });
/** Aim pays. The harder a weapon is to land, the harder it hits; the easier, the lighter. A cut's damage is its
 * written damage times (AIM.arc / arc) ^ AIM.power, kept within [AIM.min, AIM.max]: a 0.8 rad overhand strike
 * hits ~13% harder than a 1.2 rad cut, a 1.9 rad sweep ~13% lighter, a full spin ~40% lighter. Guns follow the
 * same rule through where the round meets the knight: through the middle is a clean shot, only the edge of a
 * big round touching them is a graze (AIM.shot). */
export const AIM = Object.freeze({ arc: 1.2, power: .3, min: .6, max: 1.3,
  shot: Object.freeze({ clean: .4, offCentre: .9, graze: .6 }) });
/** Guns against shoot-and-run. Every gun's normal shot deals `damage` of its written damage (to the nearest whole
 * point); charge attacks keep theirs. While you are shooting you move at `settleSpeed`: each shot slows you for
 * `settleTicks` (a slow gun for its whole interval), so firing again keeps you slow, and the moment you stop
 * you are back to full speed. */
export const GUN = Object.freeze({ damage: .9, settleTicks: 24, settleSpeed: .45 });
export const aimFactor = arc => Math.min(AIM.max, Math.max(AIM.min, (AIM.arc / arc) ** AIM.power));
const cuts = (cut, ...steps) => Object.freeze(steps.map(move => Object.freeze({ ...move, arc: Math.round(move.arc * CUTS[cut].arc * 100) / 100, push: Math.round(move.push * CUTS[cut].push), reach: Math.round(move.reach * (CUTS[cut].reach || 1)) })));

const WEAPON_LIST = {
  // ---------- blades ----------
  brand: Object.freeze({ id: 'brand', family: 'blade', cut: 'balanced', type: 'Normal sword', name: 'Knight Brand', chargeTicks: 108,
    combo: cuts('balanced', step(14, 5, 5, 11, 70, 1.8, 120, 12, 10), step(19, 7, 6, 14, 74, 2.0, 170, 15, 20), step(27, 9, 7, 20, 78, 2.3, 260, 20, 30)),
    charge: Object.freeze({ kind: 'lungeBurst', distance: 120, ticks: 14, damage: 22, reach: 50, arc: 1.6, push: 180, stun: 16, recovery: 16,
      burst: Object.freeze({ radius: 76, damage: 20, push: 260, status: 'burn', chance: 1 }) }),
    description: 'Balanced three-cut combo. Charge: lunge forward and end in a burning burst.' }),
  cleaver: Object.freeze({ id: 'cleaver', family: 'blade', cut: 'sweeping', type: 'Heavy sword', name: 'Troll Cleaver', chargeTicks: 132, heavy: true,
    combo: cuts('sweeping', step(20, 6, 6, 14, 78, 2.0, 220, 18, 10), momentum(step(48, 8, 9, 30, 84, 2.3, 400, 34, 18))),
    charge: Object.freeze({ kind: 'slam', distance: 70, ticks: 30, radius: 104, offset: 34, damage: 42, push: 380, stun: 40, recovery: 24 }),
    description: 'Slow, brutal overhead chain that stuns. Charge: leap and slam the ground around you.' }),
  rapier: Object.freeze({ id: 'rapier', family: 'blade', cut: 'thrust', type: 'Fast sword', name: 'Needle Rapier', chargeTicks: 96, sweetSpot: Object.freeze({ from: .72, bonus: 1.4 }),
    combo: cuts('thrust', step(9, 4, 4, 7, 82, .62, 70, 8, 10), step(10, 4, 4, 8, 82, .62, 80, 8, 14), step(11, 5, 4, 9, 84, .62, 90, 9, 18), step(15, 6, 5, 12, 88, .62, 140, 11, 26)),
    charge: Object.freeze({ kind: 'lunge', distance: 190, ticks: 18, damage: 28, reach: 36, arc: 1.2, push: 200, stun: 16, recovery: 14 }),
    description: 'Quick narrow thrusts that step you forward. Charge: a long lunge straight through the target.' }),
  thorn: Object.freeze({ id: 'thorn', family: 'blade', cut: 'sweeping', type: 'Thorn sword', name: 'Briar Blade', chargeTicks: 108,
    combo: cuts('sweeping', step(13, 5, 5, 11, 68, 1.8, 110, 12, 10), step(18, 7, 6, 14, 72, 2.0, 160, 15, 18), step(25, 9, 7, 20, 76, 2.2, 230, 18, 28)),
    charge: Object.freeze({ kind: 'thorns', count: 9, spread: 1.1, damage: 7, speed: 520, range: 220, size: 5, status: 'poison', chance: .5, recovery: 20 }),
    description: 'Balanced combo. Charge: spray a short, wide shower of poison thorns.' }),
  greatblade: Object.freeze({ id: 'greatblade', family: 'blade', cut: 'precise', type: 'Dark sword', name: 'Umbral Greatblade', chargeTicks: 132, heavy: true,
    combo: cuts('precise', step(19, 6, 6, 14, 80, 2.0, 200, 16, 12), momentum(step(44, 7, 9, 26, 86, 2.3, 340, 28, 18))),
    charge: Object.freeze({ kind: 'wave', damage: 30, speed: 300, range: 420, size: 26, push: 160, status: 'shock', chance: .5, recovery: 26 }),
    description: 'Heavy two-hit chain. Charge: a slow wave of shadow that carries knights along with it.' }),
  spur: Object.freeze({ id: 'spur', family: 'blade', cut: 'sweeping', type: 'Spin sword', name: 'Gyre Spur', chargeTicks: 108,
    combo: cuts('sweeping', step(8, 4, 5, 6, 72, 1.7, 60, 6, 8), step(9, 4, 5, 7, 72, 1.7, 70, 6, 10), step(10, 5, 5, 8, 72, 1.8, 80, 7, 12), step(15, 6, 6, 11, 74, 2.2, 150, 10, 18)),
    charge: Object.freeze({ kind: 'spin', turns: 3, ticksPerTurn: 18, reach: 70, damage: 11, push: 120, stun: 8, speed: .6, recovery: 12 }),
    description: 'Fast light four-cut chain. Charge: spin three times, hitting everything around you each turn.' }),

  // Elemental and special swords: every cut can carry a status or a trick of its own.
  frostbite: Object.freeze({ id: 'frostbite', family: 'blade', cut: 'balanced', type: 'Frost sword', name: 'Frostbite Edge', chargeTicks: 108, element: 'chill',
    combo: cuts('balanced', step(12, 5, 5, 11, 68, 1.8, 100, 10, 10), step(15, 7, 6, 14, 72, 2.0, 140, 13, 18), critical(step(21, 9, 7, 20, 76, 2.2, 210, 16, 28))), onHit: Object.freeze({ status: 'chill', chance: 1 }),
    charge: Object.freeze({ kind: 'lungeBurst', distance: 110, ticks: 14, damage: 18, reach: 50, arc: 1.6, push: 120, stun: 16, recovery: 16, status: 'chill', chance: 1,
      burst: Object.freeze({ radius: 84, damage: 14, push: 140, status: 'freeze', chance: 1 }) }),
    description: 'Every cut chills: three chills freeze a knight solid. Charge: lunge into a freezing burst.' }),
  blazebrand: Object.freeze({ id: 'blazebrand', family: 'blade', cut: 'precise', type: 'Fire sword', name: 'Blazebrand', chargeTicks: 120, element: 'burn',
    combo: cuts('precise', step(13, 5, 5, 11, 70, 1.8, 110, 12, 10), step(17, 7, 6, 14, 74, 2.0, 150, 15, 18), critical(step(24, 9, 7, 20, 78, 2.3, 230, 18, 28))), onHit: Object.freeze({ status: 'burn', chance: .3 }),
    charge: Object.freeze({ kind: 'wave', damage: 22, speed: 320, range: 360, size: 24, push: 140, status: 'burn', chance: 1, recovery: 24 }),
    description: 'Cuts may set knights on fire (30%). Charge: a rolling wall of flame that always burns.' }),
  voltedge: Object.freeze({ id: 'voltedge', family: 'blade', cut: 'sweeping', type: 'Shock sword', name: 'Volt Fang', chargeTicks: 108, element: 'shock',
    combo: cuts('sweeping', step(8, 4, 5, 6, 72, 1.7, 50, 6, 8), step(9, 4, 5, 7, 72, 1.7, 60, 6, 10), step(10, 5, 5, 8, 72, 1.8, 70, 7, 12), step(15, 6, 6, 11, 74, 2.2, 130, 10, 18)),
    onHit: Object.freeze({ status: 'shock', chance: .15 }), chain: Object.freeze({ chance: .4, count: 2, radius: 140, damage: 7, status: 'shock', chance2: .5 }),
    charge: Object.freeze({ kind: 'spin', turns: 3, ticksPerTurn: 18, reach: 72, damage: 9, push: 100, stun: 8, speed: .6, recovery: 12, status: 'shock', chance: .5 }),
    description: 'Fast cuts that may shock (15%); a hit can arc lightning to two more enemies nearby. Charge: an electric spin.' }),
  sickle: Object.freeze({ id: 'sickle', family: 'blade', cut: 'sweeping', type: 'Vampire sword', name: 'Sanguine Sickle', chargeTicks: 108, element: 'drain',
    combo: cuts('sweeping', step(12, 5, 5, 11, 68, 1.9, 100, 10, 10), step(15, 7, 6, 14, 72, 2.1, 140, 13, 18), step(21, 9, 7, 20, 76, 2.4, 200, 16, 28)), lifesteal: .3,
    charge: Object.freeze({ kind: 'lunge', distance: 170, ticks: 18, damage: 24, reach: 40, arc: 1.4, push: 180, stun: 16, recovery: 14 }),
    description: 'Heals you for 30% of the damage it deals. Charge: a long draining lunge.' }),
  hexblade: Object.freeze({ id: 'hexblade', family: 'blade', cut: 'precise', type: 'Curse sword', name: 'Hexblade', chargeTicks: 132, element: 'curse', heavy: true,
    combo: cuts('precise', step(18, 6, 6, 14, 78, 2.0, 200, 16, 10), momentum(step(42, 8, 9, 28, 84, 2.3, 330, 30, 18))), onHit: Object.freeze({ status: 'curse', chance: .35 }),
    charge: Object.freeze({ kind: 'slam', distance: 60, ticks: 30, radius: 100, offset: 34, damage: 34, push: 320, stun: 36, recovery: 24, status: 'curse', chance: 1 }),
    description: 'Heavy cuts that may curse (35%): no dash and no class ability for a while. Charge: a cursing slam.' }),

  // Heavy: a sledgehammer. Two enormous blows; the second sends a shockwave around the impact.
  maul: Object.freeze({ id: 'maul', family: 'blade', cut: 'precise', type: 'Heavy hammer', name: 'Earthbreaker Maul', chargeTicks: 150, heavy: true,
    combo: cuts('precise', step(35, 22, 9, 30, 80, 1.8, 420, 34, 8), Object.freeze({ ...step(46, 26, 10, 36, 84, 1.6, 520, 44, 10), shockwave: Object.freeze({ radius: 92, offset: 46, scale: .5 }) })),
    charge: Object.freeze({ kind: 'slam', distance: 40, ticks: 36, radius: 130, offset: 30, damage: 58, push: 480, stun: 56, recovery: 34 }),
    description: 'The heaviest weapon: two huge, slow blows that are not interrupted when you are hit; the second shakes the ground around it. Charge: a crater-making slam.' }),

  // More Spiral Knights lines. A holy sword that fires light, a long blade and a three-blow heavy.
  avenger: Object.freeze({ id: 'avenger', family: 'blade', cut: 'precise', type: 'Holy sword', name: 'Dawnbringer', chargeTicks: 120, element: 'holy',
    combo: cuts('precise', step(14, 5, 5, 11, 72, 1.8, 110, 12, 10), step(18, 7, 6, 14, 76, 2.0, 160, 15, 18), critical(step(26, 9, 7, 20, 80, 2.3, 240, 18, 28))),
    charge: Object.freeze({ kind: 'beam', damage: 28, speed: 820, range: 640, size: 12, push: 140, pierce: true, recovery: 22 }),
    description: 'A blessed sword. Charge: a beam of light that pierces every knight down the lane.' }),
  leviathan: Object.freeze({ id: 'leviathan', family: 'blade', cut: 'precise', type: 'Long sword', name: 'Tidebreaker', chargeTicks: 120,
    combo: cuts('precise', step(16, 6, 5, 12, 84, 1.7, 130, 12, 10), step(21, 8, 6, 16, 88, 1.9, 180, 15, 18), step(30, 10, 7, 22, 92, 2.2, 260, 18, 26)),
    charge: Object.freeze({ kind: 'lungeBurst', distance: 150, ticks: 16, damage: 24, reach: 56, arc: 1.4, push: 200, stun: 16, recovery: 18,
      burst: Object.freeze({ radius: 84, damage: 22, push: 300 }) }),
    description: 'The longest reach of any sword, a little slower. Charge: a long lunge that ends in a crashing burst.' }),
  troika: Object.freeze({ id: 'troika', family: 'blade', cut: 'sweeping', type: 'Heavy sword', name: 'Tri-Fang Blade', chargeTicks: 144, heavy: true,
    combo: cuts('sweeping', step(24, 12, 8, 18, 76, 1.9, 240, 20, 10), step(28, 14, 8, 22, 80, 2.1, 300, 24, 12), step(36, 18, 9, 30, 84, 2.4, 420, 32, 16)),
    charge: Object.freeze({ kind: 'slam', distance: 60, ticks: 30, radius: 96, offset: 34, damage: 36, push: 360, stun: 36, recovery: 24 }),
    description: 'A three-blow heavy chain that is never interrupted when you are hit. Charge: a ground slam.' }),
  // Fencing sabres: sweeping cuts that knock back and stun hard, the opener of every sweep combo. Four variants.
  sabre: Object.freeze({ id: 'sabre', family: 'blade', cut: 'sweeping', type: 'Fencing sword', name: 'Duelist Sabre', chargeTicks: 108,
    combo: cuts('sweeping', step(14, 5, 5, 11, 72, 1.9, 140, 20, 10), step(18, 6, 6, 13, 74, 2.1, 180, 24, 16), step(24, 8, 7, 18, 78, 2.3, 260, 28, 24)),
    charge: Object.freeze({ kind: 'spin', turns: 2, ticksPerTurn: 20, reach: 76, damage: 14, push: 220, stun: 18, speed: .5, recovery: 14 }),
    description: 'A fencing sword whose wide cuts knock back and stun hard. Charge: two sweeping spins that throw everyone back.' }),
  flamesabre: Object.freeze({ id: 'flamesabre', family: 'blade', cut: 'sweeping', type: 'Fencing sword', name: 'Ember Sabre', chargeTicks: 108, element: 'burn',
    combo: cuts('sweeping', step(13, 5, 5, 11, 72, 1.9, 140, 18, 10), step(16, 6, 6, 13, 74, 2.1, 180, 22, 16), step(22, 8, 7, 18, 78, 2.3, 260, 26, 24)), onHit: Object.freeze({ status: 'burn', chance: .35 }),
    charge: Object.freeze({ kind: 'spin', turns: 2, ticksPerTurn: 20, reach: 76, damage: 12, push: 200, stun: 16, speed: .5, recovery: 14, status: 'burn', chance: 1 }),
    description: 'A fencing sword that may set knights on fire (35%) as it knocks them back. Charge: two blazing spins that always burn.' }),
  frostsabre: Object.freeze({ id: 'frostsabre', family: 'blade', cut: 'sweeping', type: 'Fencing sword', name: 'Rime Sabre', chargeTicks: 108, element: 'chill',
    combo: cuts('sweeping', step(12, 5, 5, 11, 72, 1.9, 130, 18, 10), step(15, 6, 6, 13, 74, 2.1, 170, 22, 16), step(21, 8, 7, 18, 78, 2.3, 240, 26, 24)), onHit: Object.freeze({ status: 'chill', chance: .6 }),
    charge: Object.freeze({ kind: 'spin', turns: 2, ticksPerTurn: 20, reach: 76, damage: 11, push: 190, stun: 16, speed: .5, recovery: 14, status: 'chill', chance: 1 }),
    description: 'A fencing sword that chills (60%) as it knocks knights back: three chills freeze. Charge: two frosty spins.' }),
  stormsabre: Object.freeze({ id: 'stormsabre', family: 'blade', cut: 'sweeping', type: 'Fencing sword', name: 'Storm Sabre', chargeTicks: 108, element: 'shock',
    combo: cuts('sweeping', step(12, 5, 5, 11, 72, 1.9, 130, 18, 10), step(15, 6, 6, 13, 74, 2.1, 170, 22, 16), step(21, 8, 7, 18, 78, 2.3, 240, 26, 24)), onHit: Object.freeze({ status: 'shock', chance: .3 }),
    charge: Object.freeze({ kind: 'spin', turns: 2, ticksPerTurn: 20, reach: 76, damage: 11, push: 190, stun: 16, speed: .5, recovery: 14, status: 'shock', chance: .6 }),
    description: 'A fencing sword that may shock (30%) as it knocks knights back. Charge: two crackling spins.' }),
  // The katana: the narrowest, hardest cuts of all. A clean hit (target in the middle of the cut) lands extra hard;
  // clipping someone with the edge barely scratches them.
  katana: Object.freeze({ id: 'katana', family: 'blade', cut: 'precise', type: 'Katana', name: 'Moonlit Katana', chargeTicks: 108,
    aim: Object.freeze({ clean: 1.3, graze: .5 }),
    combo: cuts('precise', step(17, 5, 4, 11, 80, 1.3, 120, 14, 12), step(20, 6, 4, 13, 82, 1.3, 150, 16, 18), critical(step(28, 8, 5, 18, 86, 1.4, 220, 20, 26))),
    charge: Object.freeze({ kind: 'lunge', distance: 190, ticks: 14, damage: 34, reach: 44, arc: .9, push: 160, stun: 18, recovery: 16 }),
    description: 'Fast, narrow, deadly cuts: a clean hit lands 30% harder, an edge hit only half. Charge: a lightning draw-cut dash.' }),

  // ---------- guns ----------
  blaster: Object.freeze({ id: 'blaster', family: 'gun', type: 'Blaster', name: 'Pulse Blaster', chargeTicks: 120,
    clip: 3, interval: 16, reload: 54, reloadDelay: 60, damage: 9, speed: 760, range: 620, push: 80, spread: .02, size: 5, kind: 'bullet',
    charge: Object.freeze({ kind: 'pierce', damage: 24, speed: 880, range: 700, push: 220, size: 9, pierce: true }),
    description: 'Reliable three-shot gun. Charge: a big bolt that pierces every knight in its path.' }),
  pulsar: Object.freeze({ id: 'pulsar', family: 'gun', type: 'Pulsar', name: 'Ripple Caster', chargeTicks: 120,
    clip: 3, interval: 22, reload: 60, reloadDelay: 60, damage: 8, speed: 400, range: 340, push: 60, spread: 0, size: 8, grow: 14, kind: 'pulse', pierce: true,
    charge: Object.freeze({ kind: 'bigPulse', damage: 22, speed: 260, range: 380, push: 140, size: 16, grow: 32, pierce: true }),
    description: 'Slow waves that widen as they travel and pass through knights. Charge: one huge wave.' }),
  alchemer: Object.freeze({ id: 'alchemer', family: 'gun', type: 'Ricochet', name: 'Ricochet Coil', chargeTicks: 120,
    clip: 3, interval: 18, reload: 60, reloadDelay: 60, damage: 9, speed: 620, range: 760, push: 60, spread: .02, size: 5, kind: 'ricochet', bounces: 1,
    charge: Object.freeze({ kind: 'split', count: 4, spread: .5, damage: 10, speed: 600, range: 820, push: 70, size: 5, bounces: 2, status: 'shock', chance: .35 }),
    description: 'Bolts that bounce off walls. Charge: four shocking bolts that bounce twice.' }),
  autogun: Object.freeze({ id: 'autogun', bloom: 0.03, family: 'gun', type: 'Autogun', name: 'Rattle Autogun', chargeTicks: 120,
    clip: 6, interval: 8, reload: 66, reloadDelay: 60, damage: 4, speed: 800, range: 560, push: 25, spread: .09, size: 4, kind: 'bullet',
    charge: Object.freeze({ kind: 'stream', count: 10, every: 4, damage: 5, speed: 820, range: 600, push: 30, size: 4, spread: .03 }),
    description: 'Six fast, light rounds. Charge: a focused ten-round stream.' }),
  sixgun: Object.freeze({ id: 'sixgun', bloom: 0.02, family: 'gun', type: 'Six-shooter', name: 'Prairie Sixgun', chargeTicks: 108,
    clip: 6, interval: 9, reload: 60, reloadDelay: 48, damage: 5, speed: 840, range: 520, push: 30, spread: .015, size: 4, kind: 'bullet',
    charge: Object.freeze({ kind: 'stream', count: 6, every: 3, damage: 6, speed: 860, range: 540, push: 40, size: 4, spread: .14 }),
    description: 'Six light, accurate shots as fast as you can pull the trigger, then a quick reload. Charge: fan the hammer, all six at once.' }),
  embersixgun: Object.freeze({ id: 'embersixgun', bloom: 0.02, family: 'gun', type: 'Fire six-shooter', name: 'Ember Sixgun', chargeTicks: 108, element: 'burn',
    clip: 6, interval: 9, reload: 66, reloadDelay: 48, damage: 4, speed: 820, range: 500, push: 30, spread: .015, size: 4, kind: 'bullet', status: 'burn', chance: .2,
    charge: Object.freeze({ kind: 'stream', count: 6, every: 3, damage: 5, speed: 840, range: 520, push: 40, size: 5, spread: .14, status: 'burn', chance: .5 }),
    description: 'Six fast incendiary shots, each may set the target on fire (20%). Charge: fan six burning rounds.' }),
  peacemaker: Object.freeze({ id: 'peacemaker', bloom: 0.05, family: 'gun', type: 'Heavy six-shooter', name: 'Iron Peacemaker', chargeTicks: 120,
    clip: 6, interval: 15, reload: 84, reloadDelay: 54, damage: 8, speed: 880, range: 580, push: 70, spread: .01, size: 5, kind: 'bullet',
    charge: Object.freeze({ kind: 'stream', count: 6, every: 4, damage: 9, speed: 900, range: 600, push: 90, size: 5, spread: .1 }),
    description: 'A heavy revolver: six hard-hitting shots with a kick, but a slower trigger and reload. Charge: fan six heavy rounds.' }),
  catalyzer: Object.freeze({ id: 'catalyzer', family: 'gun', type: 'Catalyzer', name: 'Tether Catalyst', chargeTicks: 120,
    clip: 3, interval: 20, reload: 60, reloadDelay: 60, damage: 8, speed: 560, range: 520, push: 20, spread: .02, size: 6, kind: 'catalyst',
    charge: Object.freeze({ kind: 'detonator', damage: 10, speed: 720, range: 620, push: 80, size: 7, perCharge: 18, pushPerCharge: 180 }),
    description: 'Shots stick up to three charges on a knight. Charge: a detonator that blows them all at once.' }),
  magnus: Object.freeze({ id: 'magnus', bloom: 0.12, family: 'gun', type: 'Hand-cannon', name: 'Thunder Hand-cannon', chargeTicks: 132, longShot: Object.freeze({ from: 220, bonus: .4 }),
    clip: 2, interval: 30, reload: 78, reloadDelay: 70, damage: 16, speed: 720, range: 640, push: 260, spread: .01, size: 6, kind: 'bullet',
    charge: Object.freeze({ kind: 'explosive', damage: 26, speed: 640, range: 640, push: 300, size: 9, radius: 72 }),
    description: 'Two heavy rounds with big knockback. Charge: a round that explodes on impact.' }),

  // Precision: one round, tiny and fast, that hits harder the farther it flies.
  rifle: Object.freeze({ id: 'rifle', bloom: 0.2, family: 'gun', type: 'Long rifle', name: 'Longshot Rifle', chargeTicks: 150, longShot: Object.freeze({ from: 180, bonus: .6 }),
    clip: 1, interval: 60, reload: 84, reloadDelay: 30, damage: 18, speed: 1400, range: 940, push: 140, spread: 0, size: 3, kind: 'bullet',
    charge: Object.freeze({ kind: 'pierce', damage: 30, speed: 1700, range: 1040, push: 200, size: 4, pierce: true, longShot: Object.freeze({ from: 180, bonus: .6 }) }),
    description: 'A single tiny, very fast round with a long reload: up to 60% more damage at long range. Hard to land, punishing when it does. Charge: a piercing rail shot.' }),

  // Elemental guns.
  frostgun: Object.freeze({ id: 'frostgun', family: 'gun', type: 'Frost blaster', name: 'Winter Repeater', chargeTicks: 120, element: 'chill',
    clip: 3, interval: 16, reload: 54, reloadDelay: 60, damage: 7, speed: 720, range: 580, push: 50, spread: .02, size: 5, kind: 'bullet', status: 'chill', chance: 1, stacks: 2,
    charge: Object.freeze({ kind: 'pierce', damage: 16, speed: 820, range: 660, push: 120, size: 9, pierce: true, status: 'freeze', chance: 1 }),
    description: 'Every round chills twice over: two rounds freeze a knight in place (they can still swing). A sword or bomb hit shatters the ice for extra damage. Charge: a piercing bolt that freezes on the spot.' }),
  embercaster: Object.freeze({ id: 'embercaster', family: 'gun', type: 'Fire pulsar', name: 'Ember Caster', chargeTicks: 120, element: 'burn',
    clip: 3, interval: 22, reload: 60, reloadDelay: 60, damage: 7, speed: 340, range: 320, push: 50, spread: 0, size: 8, grow: 14, kind: 'pulse', pierce: true, status: 'burn', chance: .25,
    charge: Object.freeze({ kind: 'bigPulse', damage: 18, speed: 250, range: 360, push: 120, size: 16, grow: 30, pierce: true, status: 'burn', chance: 1 }),
    description: 'Fire waves that may ignite (25%) every knight they pass. Charge: a huge wave that sets all of them alight.' }),
  voltneedle: Object.freeze({ id: 'voltneedle', bloom: 0.03, family: 'gun', type: 'Shock autogun', name: 'Volt Needle', chargeTicks: 120, element: 'shock',
    clip: 6, interval: 8, reload: 66, reloadDelay: 60, damage: 4, speed: 800, range: 540, push: 20, spread: .08, size: 4, kind: 'bullet', status: 'shock', chance: .08,
    chain: Object.freeze({ chance: .1, count: 1, radius: 120, damage: 4, status: 'shock', chance2: .3 }),
    charge: Object.freeze({ kind: 'stream', count: 10, every: 4, damage: 4, speed: 820, range: 580, push: 25, size: 4, spread: .03, status: 'shock', chance: .3 }),
    description: 'Six fast needles that may shock (8%) and arc to a nearby enemy. Charge: a shocking ten-needle stream.' }),
  viper: Object.freeze({ id: 'viper', family: 'gun', type: 'Toxic blaster', name: 'Viper Spitter', chargeTicks: 120, element: 'poison',
    clip: 3, interval: 18, reload: 60, reloadDelay: 60, damage: 10, speed: 660, range: 560, push: 50, spread: .02, size: 5, kind: 'bullet', status: 'poison', chance: .4,
    charge: Object.freeze({ kind: 'split', count: 5, spread: .4, damage: 8, speed: 600, range: 480, push: 50, size: 5, bounces: 0, status: 'poison', chance: .8 }),
    description: 'Rounds that may poison (40%): poisoned knights hit softer and cannot heal. Charge: a fan of five venom bolts.' }),
  grimcannon: Object.freeze({ id: 'grimcannon', bloom: 0.12, family: 'gun', type: 'Curse hand-cannon', name: 'Grim Hand-cannon', chargeTicks: 132, element: 'curse', longShot: Object.freeze({ from: 220, bonus: .4 }),
    clip: 2, interval: 30, reload: 78, reloadDelay: 70, damage: 14, speed: 700, range: 620, push: 220, spread: .01, size: 6, kind: 'bullet', status: 'curse', chance: .3,
    charge: Object.freeze({ kind: 'explosive', damage: 22, speed: 620, range: 620, push: 260, size: 9, radius: 76, status: 'curse', chance: 1 }),
    description: 'Heavy rounds that may curse (30%). Charge: a blast that curses everyone it catches.' }),

  // A shotgun, a pulsar whose waves bounce, and piercing bolts.
  scatter: Object.freeze({ id: 'scatter', bloom: .1, family: 'gun', type: 'Shotgun', name: 'Iron Scattergun', chargeTicks: 132,
    clip: 2, interval: 36, reload: 72, reloadDelay: 70, damage: 6, pellets: 6, speed: 700, range: 330, push: 60, spread: .3, size: 4, kind: 'bullet',
    charge: Object.freeze({ kind: 'pierce', damage: 30, speed: 760, range: 420, push: 360, size: 10, pierce: false }),
    description: 'Six pellets in a wide fan: brutal up close, useless far away. Charge: a single heavy slug that knocks knights flying.' }),
  polaris: Object.freeze({ id: 'polaris', family: 'gun', type: 'Pulsar', name: 'Northstar', chargeTicks: 120,
    clip: 3, interval: 22, reload: 60, reloadDelay: 60, damage: 8, speed: 380, range: 420, push: 60, spread: 0, size: 8, grow: 12, kind: 'pulse', pierce: true, bounces: 1,
    charge: Object.freeze({ kind: 'bigPulse', damage: 24, speed: 280, range: 460, push: 140, size: 16, grow: 28, pierce: true, bounces: 2 }),
    description: 'Widening waves that pass through knights and bounce once off walls. Charge: a huge wave that bounces twice.' }),
  riftlocker: Object.freeze({ id: 'riftlocker', bloom: .06, family: 'gun', type: 'Rift gun', name: 'Rift Repeater', chargeTicks: 132,
    clip: 3, interval: 20, reload: 66, reloadDelay: 60, damage: 8, speed: 560, range: 600, push: 40, spread: .015, size: 6, kind: 'bolt', pierce: true,
    charge: Object.freeze({ kind: 'stream', count: 6, every: 6, damage: 8, speed: 600, range: 620, push: 40, size: 6, spread: .02, pierce: true }),
    description: 'Slow violet bolts that pierce every knight in line. Charge: a stream of six piercing bolts.' }),

  // ---------- bombs ----------
  blast: Object.freeze({ id: 'blast', family: 'bomb', type: 'Blast bomb', name: 'Cannonball Bomb', chargeTicks: 60, fuse: 72, radius: 100, damage: 30, push: 340, stun: 20,
    description: 'Charges fast. A big knockback blast after a short fuse.' }),
  haze: Object.freeze({ id: 'haze', family: 'bomb', type: 'Haze bomb', name: 'Ember Haze', chargeTicks: 96, element: 'burn', fuse: 24, radius: 0, damage: 0, push: 0,
    cloud: Object.freeze({ radius: 92, ticks: 480, status: 'burn' }), description: 'Leaves a cloud that sets enemies on fire.' }),
  frost: Object.freeze({ id: 'frost', family: 'bomb', type: 'Haze bomb', name: 'Frost Haze', chargeTicks: 96, element: 'freeze', fuse: 24, radius: 0, damage: 0, push: 0,
    cloud: Object.freeze({ radius: 92, ticks: 480, status: 'freeze' }), description: 'Leaves a cloud that freezes enemies in place: they can still swing, but not move.' }),
  venom: Object.freeze({ id: 'venom', family: 'bomb', type: 'Haze bomb', name: 'Venom Veil', chargeTicks: 96, fuse: 24, radius: 0, damage: 0, push: 0, element: 'poison',
    cloud: Object.freeze({ radius: 92, ticks: 480, status: 'poison' }), description: 'Leaves a cloud that poisons enemies: they hit softer and cannot heal.' }),
  storm: Object.freeze({ id: 'storm', family: 'bomb', type: 'Haze bomb', name: 'Storm Haze', chargeTicks: 96, fuse: 24, radius: 0, damage: 0, push: 0, element: 'shock',
    cloud: Object.freeze({ radius: 92, ticks: 480, status: 'shock' }), description: 'Leaves a crackling cloud that shocks enemies over and over.' }),
  hex: Object.freeze({ id: 'hex', family: 'bomb', type: 'Haze bomb', name: 'Hex Haze', chargeTicks: 96, fuse: 24, radius: 0, damage: 0, push: 0, element: 'curse',
    cloud: Object.freeze({ radius: 92, ticks: 480, status: 'curse' }), description: 'Leaves a cloud that curses enemies: no dash and no class ability.' }),
  shard: Object.freeze({ id: 'shard', family: 'bomb', type: 'Shard bomb', name: 'Shard Burst', chargeTicks: 96, fuse: 84, radius: 40, damage: 10, push: 120, stun: 10,
    shards: Object.freeze({ count: 8, damage: 14, speed: 520, range: 230, size: 5, push: 120 }), description: 'Bursts into eight shards that cut across the point.' }),
  vortex: Object.freeze({ id: 'vortex', family: 'bomb', type: 'Vortex bomb', name: 'Vortex Bomb', chargeTicks: 120, fuse: 60, radius: 110, damage: 22, push: 320, stun: 20,
    pull: Object.freeze({ ticks: 180, radius: 150, speed: 260 }), description: 'Pulls every enemy in range to its centre and holds them, then blasts them apart.' }),
  nitro: Object.freeze({ id: 'nitro', family: 'bomb', type: 'Blast bomb', name: 'Nitro Colossus', chargeTicks: 180, fuse: 96, radius: 150, damage: 46, push: 460, stun: 30,
    description: 'A huge bomb: the slowest charge and fuse, the biggest blast in the game.' }),
  spark: Object.freeze({ id: 'spark', family: 'bomb', type: 'Flash bomb', name: 'Storm Flash', chargeTicks: 70, element: 'shock', fuse: 36, radius: 90, damage: 12, push: 120, stun: 48, status: 'shock', chance: 1,
    description: 'Charges fast and flashes almost at once: little damage, but a long stun and a shock.' }),
};

/** How each cut moves: the hit sweep, the slash and the animation all follow it.
 *  sweep  a horizontal cut; cuts in a row alternate (right to left, then back left to right from where it ended)
 *  rise   a diagonal cut from low on one side to high on the other
 *  chop   an overhead blow straight down: a narrow line in front
 *  thrust a straight stab: the narrowest line and the longest reach
 *  spin   a full turn with the blade out, hitting everything around */
export const MOVE_KINDS = Object.freeze({
  sweep: Object.freeze({ label: 'sweep', alternates: true }),
  rise: Object.freeze({ label: 'rising cut', arc: .8, alternates: true }),
  // From above one shoulder, down across the body: narrow, so it hits harder (AIM) and pushes less. The next one comes
  // down from the other shoulder.
  overhand: Object.freeze({ label: 'overhand strike', fixedArc: .8, reach: 1.05, push: .75, alternates: true }),
  // Two quick strokes in one press, there and back: each deals 60% of the cut, so both must land to pay.
  flurry: Object.freeze({ label: 'flurry', fixedArc: .9, strokes: 2, stroke: .6, returns: true }),
  chop: Object.freeze({ label: 'overhead chop', fixedArc: .6, reach: 1.05, straight: true }),
  thrust: Object.freeze({ label: 'thrust', fixedArc: .35, reach: 1.2, straight: true }),
  spin: Object.freeze({ label: 'spin', fixedArc: Math.PI * 2, reach: .9 }),
});
/** Every sword type has its own combo. Elemental variants of one type (the four sabres) share it. */
export const MOVESETS = Object.freeze({
  // The brandish line (Knight Brand and its fire and ice forms): narrow overhand strikes and chops, each with its
  // own string (a critical finisher on the elemental ones).
  brand: ['overhand', 'overhand', 'chop'],          // off the right shoulder, off the left, straight down
  frostbite: ['overhand', 'rise', 'thrust'],         // an overhand, a rising cut, a critical ice-piercing thrust
  blazebrand: ['rise', 'flurry', 'chop'],            // a rising flame, a quick double strike, a critical blaze from overhead
  thorn: ['sweep', 'sweep', 'rise'],                 // two wide sweeps and a rising cut that throws them up and back
  avenger: ['thrust', 'sweep', 'chop'],              // a lance-like jab, a sweep, a critical judgement from above
  sickle: ['sweep', 'sweep', 'spin'],                // hooking reaps that end in a whirling reap
  sabre: ['sweep', 'sweep', 'spin'], flamesabre: ['sweep', 'sweep', 'spin'], frostsabre: ['sweep', 'sweep', 'spin'], stormsabre: ['sweep', 'sweep', 'spin'], // fencing sabres: wide sweeps and a spin that throws everyone back
  katana: ['sweep', 'rise', 'thrust'],               // a fast draw-cut, a rising cut, a critical dashing thrust
  rapier: ['thrust', 'thrust', 'sweep', 'thrust'],   // fencing jabs, a flick, and a deep lunge
  leviathan: ['sweep', 'thrust', 'chop'],            // a long sweep, a long thrust, a crashing chop
  spur: ['sweep', 'sweep', 'sweep', 'spin'],         // quick slashes into a spin
  voltedge: ['sweep', 'sweep', 'rise', 'spin'],      // quick slashes, a rising arc, a crackling spin
  cleaver: ['chop', 'sweep'],                        // a heavy chop, then the momentum blow spins round
  greatblade: ['rise', 'sweep'],                     // a heavy rising cut, then the momentum blow
  hexblade: ['sweep', 'sweep'],                      // a heavy sweep, then the momentum blow
  troika: ['sweep', 'sweep', 'chop'],                // two heavy sweeps and a crushing overhead
  maul: ['sweep', 'chop'],                           // a swing, then the overhead smash that shakes the ground
});
const withMoves = (id, combo) => Object.freeze(combo.map((move, i) => {
  const kind = MOVESETS[id]?.[i] || 'sweep', rule = MOVE_KINDS[kind], arc = rule.fixedArc ?? Math.round(move.arc * (rule.arc ?? 1) * 100) / 100;
  return Object.freeze({ ...move, kind, arc, reach: Math.round(move.reach * (rule.reach ?? 1)),
    damage: Math.round(move.damage * aimFactor(arc) * (rule.stroke ?? 1)), strokes: rule.strokes || 1, push: Math.round(move.push * (rule.push ?? 1)) });
}));
const gunShot = weapon => Object.freeze({ ...weapon, damage: Math.max(1, Math.round(weapon.damage * GUN.damage)) });
export const WEAPONS = Object.freeze(Object.fromEntries(Object.entries(WEAPON_LIST).map(([id, weapon]) => [id, weapon.family === 'blade' ? Object.freeze({ ...weapon, combo: withMoves(id, weapon.combo) }) : weapon.family === 'gun' ? gunShot(weapon) : weapon])));
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));
/** How hard a weapon is to aim, for the Armory: a sword by its cuts' average aim factor, a gun by how forgiving its
 * rounds are (pellets, spray, a big round) against how much each single shot has to count. */
export function aimRating(weapon) {
  if (weapon.family === 'blade') {
    const factor = weapon.combo.reduce((sum, move) => sum + aimFactor(move.arc), 0) / weapon.combo.length;
    const level = factor >= 1.12 ? 'hard' : factor <= .92 ? 'easy' : 'medium';
    return { level, note: `${level}: ${factor >= 1 ? 'narrow' : 'wide'} cuts, ×${factor.toFixed(2)} damage` };
  }
  if (weapon.family !== 'gun') return null;
  const easy = weapon.pellets > 1 || weapon.spread >= .08 || weapon.size + (weapon.grow || 0) >= 18;
  const level = easy ? 'easy' : weapon.interval >= 30 && weapon.spread <= .02 ? 'hard' : 'medium';
  return { level, note: `${level}: ${easy ? 'forgiving rounds, lighter hits' : level === 'hard' ? 'every shot must count' : 'steady rounds'}; a clean shot through the middle deals full damage, a graze ${Math.round(AIM.shot.graze * 100)}%` };
}

/** Armory notes: what each weapon is good and bad at, and how hard it is to use well (1 easy, 3 hard). */
const note = (difficulty, pros, cons) => Object.freeze({ difficulty, pros: Object.freeze(pros), cons: Object.freeze(cons) });
export const WEAPON_NOTES = Object.freeze({
  brand: note(2, ['Reliable three-cut combo of narrow overhand strikes that hit hard', 'Charge lunges in and sets a burning burst'], ['Narrow: aim it, or it misses']),
  cleaver: note(2, ['Second blow spins round on the first one\'s momentum: fast and brutal', 'Not interrupted when hit mid-swing', 'Charge: leaping ground slam'], ['Missing the second blow leaves you spun round and wide open']),
  rapier: note(3, ['Fastest cuts, long narrow reach', 'Sweet spot: +40% at the tip of its reach'], ['Narrow arc misses moving targets', 'Low damage up close']),
  thorn: note(1, ['Steady combo', 'Charge sprays poison thorns'], ['Thorns are short range']),
  greatblade: note(2, ['Second blow spins round on momentum for huge damage', 'Not interrupted when hit', 'Charge: a long shadow wave that drags knights'], ['Slow first swing', 'Missing the second blow is punished hard']),
  spur: note(2, ['Very fast four-cut chain', 'Charge: three full spins'], ['Light hits: easily out-traded by heavies']),
  maul: note(3, ['Biggest single hits in the game', 'Second blow sends a shockwave', 'Never interrupted when hit mid-swing'], ['Extremely slow: whiffs are punished', 'Slowest charge']),
  frostbite: note(2, ['Every cut chills; the third freezes', 'Charge ends in a freezing burst'], ['Slightly weaker cuts', 'A frozen knight can still swing back']),
  blazebrand: note(1, ['Cuts may set knights on fire', 'Charge: a wall of fire'], ['Burn is random on normal cuts']),
  voltedge: note(2, ['Fast cuts that may shock', 'Lightning jumps to two nearby enemies (40%)'], ['Light damage per cut']),
  sickle: note(2, ['Heals you for 30% of its damage', 'Charge: a long draining lunge'], ['Lower damage than a plain sword']),
  hexblade: note(2, ['Heavy cuts that may curse (no dash, no ability)', 'Second blow spins round on momentum for huge damage'], ['Slow first swing', 'Missing the second blow is punished hard']),
  blaster: note(1, ['Reliable three-shot clip', 'Charge: a bolt that pierces everyone in line'], ['No special strength']),
  pulsar: note(1, ['Wide waves are easy to land and pass through knights'], ['Low damage', 'Slow and short ranged']),
  alchemer: note(3, ['Bolts bounce off walls: hit around corners', 'Charge: four shocking bolts'], ['Bank shots take practice']),
  autogun: note(1, ['Six fast rounds, easy to keep on target'], ['Wide spread, light hits']),
  sixgun: note(1, ['Fires as fast as you click, and stays accurate', 'Quick reload', 'Great after a sweep knocks someone back'], ['Very low damage per shot', 'Short clip']),
  embersixgun: note(1, ['Fast shots that may set on fire (20%)', 'Burning keeps hurting after the shots'], ['Lowest damage per shot']),
  peacemaker: note(2, ['Hardest-hitting six-shooter, with knockback', 'Very accurate'], ['Slower trigger and reload']),
  katana: note(3, ['Hardest light cuts: a clean hit lands 30% harder', 'Charge: a long draw-cut dash'], ['Narrowest cut of all', 'An edge hit deals only half']),
  sabre: note(1, ['Wide cuts that knock back and stun hard', 'Starts every sweep combo'], ['Lower damage than a plain sword']),
  flamesabre: note(2, ['Knocks back and may set on fire (35%)', 'Charge: burning spins'], ['Lower damage than a plain sword']),
  frostsabre: note(2, ['Knocks back and chills (60%): three chills freeze', 'Charge: frosty spins'], ['Lowest damage of the sabres']),
  stormsabre: note(2, ['Knocks back and may shock (30%)', 'Charge: crackling spins'], ['Lowest damage of the sabres']),
  catalyzer: note(3, ['Stack charges, then detonate them for a huge hit'], ['Weak until you detonate', 'Needs a follow-up shot']),
  magnus: note(2, ['Heavy rounds with big knockback', 'Up to +40% damage at long range', 'Charge: explosive round'], ['Two-round clip, slow reload']),
  rifle: note(3, ['Up to +60% damage at long range', 'Very fast, accurate round', 'Charge: piercing rail shot'], ['One round, long reload', 'Tiny bullet: hard to hit']),
  frostgun: note(1, ['Two rounds freeze a knight in place', 'Switch to a sword to shatter the ice (+25%)'], ['Lower damage per round', 'A frozen knight can still swing and shoot']),
  embercaster: note(1, ['Fire waves are easy to land', 'Charge always burns everyone it passes'], ['Short range, low damage']),
  voltneedle: note(1, ['Fast shocking needles that arc between enemies'], ['Very light hits']),
  viper: note(2, ['Poison stops healing and weakens hits', 'Charge: a fan of venom bolts'], ['Poison is random on normal shots']),
  grimcannon: note(2, ['Heavy rounds that may curse', 'Up to +40% damage at long range', 'Charge: a cursing explosion'], ['Two-round clip, slow reload']),
  blast: note(1, ['Fast charge, big blast and knockback'], ['Short fuse: easy to dodge if seen']),
  haze: note(1, ['Fire cloud burns everyone who stays in it'], ['No direct damage']),
  frost: note(1, ['Cloud freezes enemies solid'], ['No direct damage', 'Frozen knights break free when hit']),
  venom: note(1, ['Poison cloud: no healing, weaker hits'], ['No direct damage']),
  storm: note(1, ['Shock cloud stuns over and over'], ['No direct damage']),
  hex: note(1, ['Curse cloud: no dash or class ability'], ['No direct damage']),
  shard: note(2, ['Eight shards cut across a point'], ['Shards spread out at range']),
  vortex: note(2, ['Pulls enemies in and holds them, then blasts', 'Sets up big combos'], ['Slow charge']),
  avenger: note(2, ['Steady three-cut combo', 'Charge: a piercing beam of light down a whole lane'], ['Beam recovery leaves you open']),
  leviathan: note(2, ['Longest sword reach', 'Charge: long lunge into a crashing burst'], ['Slightly slower cuts']),
  troika: note(3, ['Three huge blows, never interrupted when hit', 'Charge: ground slam'], ['Very slow wind-ups', 'A whiff leaves you wide open']),
  scatter: note(2, ['Six pellets: huge damage point blank', 'Charge: a slug that knocks knights flying'], ['Almost no damage at range', 'Two-shell clip']),
  polaris: note(2, ['Waves pierce knights and bounce off walls'], ['Low damage per wave', 'Bank shots take practice']),
  riftlocker: note(2, ['Bolts pierce every knight in line', 'Charge: six piercing bolts'], ['Slow bolts are easy to dodge']),
  nitro: note(2, ['The biggest blast and knockback in the game'], ['Slowest charge and fuse: easy to see and avoid']),
  spark: note(1, ['Fast charge, near-instant flash', 'Long stun and a shock'], ['Little damage']),
});

/** Status effects. Shields block them; a hit breaks freeze early. Chill stacks: each chilling
 * hit adds one (slowing you a little more) and the third freezes you. Curse locks dash and
 * class ability (including the Guardian shield). */
export const STATUS = Object.freeze({
  burn: Object.freeze({ id: 'burn', name: 'Burning', ticks: 3 * TICKS, every: 30, damage: 4 }),
  poison: Object.freeze({ id: 'poison', name: 'Poisoned', ticks: 5 * TICKS, damageScale: .7, noHeal: true }),
  shock: Object.freeze({ id: 'shock', name: 'Shocked', ticks: 3 * TICKS, every: 48, stun: 14, damage: 2 }),
  // Frozen: rooted in ice (no moving, dashing, shield or ability) but the arms still work: you can turn, swing
  // and shoot. Bullets don't break the ice; a sword or bomb hit shatters it and lands `shatter` harder.
  freeze: Object.freeze({ id: 'freeze', name: 'Frozen', ticks: 150, immuneTicks: 2 * TICKS, shatter: 1.25 }),
  chill: Object.freeze({ id: 'chill', name: 'Chilled', ticks: Math.round(2.5 * TICKS), slowPerStack: .14, freezeAt: 3 }),
  curse: Object.freeze({ id: 'curse', name: 'Cursed', ticks: Math.round(2.5 * TICKS) }),
});
export const STATUS_IDS = Object.freeze(Object.keys(STATUS));

/** The Guardian's shield (class ability, held). Raised, it opens at once into a dome that shields
 * every teammate inside from outside fire and slowly heals everyone in it, the Guardian included.
 * The dome has its own health (`domeMax`); when it breaks, the Guardian keeps a personal shield for a
 * few more hits (`max`), then is stunned. Both recharge after a pause once the shield is lowered;
 * a broken dome only reopens once it is half recharged. */
export const GUARD = Object.freeze({ raiseTicks: 6, max: 60, regenPerSecond: 15, regenDelay: 90, breakStun: 72, recover: .5, speed: .5, knockback: .3, bombScale: 1.5, bladeScale: 1.3,
  expandTicks: 18, radius: 96, healPerSecond: 6, domeMax: 160, domeRegenPerSecond: 25, domeRecover: .5 });

/** Sword timing rules. Raising the shield or dodging cancels a cut's recovery (the
 * animation cancel), and a queued press may start the next cut once this fraction of
 * the recovery has passed (the last cut of a combo always recovers fully unless cancelled). */
export const BLADE = Object.freeze({ comboCancel: .4, comboWindow: 36, hitStop: 4,
  // A perfect combo: every cut before the finisher landed solidly (no graze, not blocked) on the same knight. The
  // finisher then hits `perCut` harder for every cut before it (a three-cut combo +30%, four +45%); a critical
  // finisher (katana, elemental swords) crits instead, +50%, and lands as a plain cut without the perfect chain. A miss, a
  // graze, a block, switching target or cancelling breaks the chain; openers stun only briefly, so a sharp
  // knight can dash out between cuts.
  combo: Object.freeze({ perCut: .15 }),
  // Commitment: a cut that hits nothing (a whiff) recovers twice its recovery longer (at least `whiffMin`
  // ticks), cannot chain into the next cut and drops the combo, and you barely move meanwhile, so swinging
  // at air leaves you wide open (a hit on a whiffed knight is a punish, see FIGHT).
  whiffRecovery: 2, whiffMin: 36, whiffMove: .12,
  // A heavy sword's momentum blow (the second cut, a half-turn swing) that misses recovers this much longer again.
  momentumWhiff: 2,
  // Timing: the next cut can only be queued once this one has landed. Pressing earlier (mashing) is
  // ignored and locks the cut out of the combo, so it plays to the end and the next press starts over.
  // Aim: a cut that meets the target near the middle of its arc is clean and deals its full damage; off
  // the middle it deals less, and one that only clips the target with the edge of the arc grazes.
  clean: Object.freeze({ within: .4 }), offCentre: .9, graze: Object.freeze({ beyond: .8, damage: .75 }),
  // Spiral Knights cancel: a shield, dash, Boost or cloak press after a cut lands drops its recovery and sends
  // the combo back to the quick first cut, after a short lag. Later cuts hit harder but are slower, lunge
  // further and commit you to their direction (you steer less).
  cancelLag: 6, moveFirst: .35, moveLater: .2,
  // Commitment against spam: an opening or middle cut stuns for only `chainStun` of its listed stun, so the
  // target recovers in time to dash, guard or strike first (a counter) before the next cut lands; finishers,
  // criticals and momentum blows keep their full stun. The last cut of a combo recovers `finisherRecovery`
  // times longer, leaves you exposed (hits on you are counters), and its first `finisherLock` cannot be cancelled.
  chainStun: .5, finisherRecovery: 2, finisherLock: .5,
  // Swap cancel: once a cut has landed, switching weapons drops its recovery and readies the new weapon after
  // this short lag, so a sweep can lead straight into a heavier blade (see FIGHT.reel).
  swapLag: 4 });
/** Guns bloom: every shot widens the spread, which settles back while you hold fire. Measured shots stay
 * accurate; holding the trigger sprays. Precise guns bloom harder. */
/** Fighting rules that reward reading the opponent over mashing.
 * - interrupt: a hit that stuns cancels the target's sword cut or cast (heavy cuts and charge moves are unflinching).
 * - counter: hitting a knight while they wind up, recover from a charge move or hold a half-full charge
 *   lands harder and stuns longer.
 * - punish: hitting a knight still recovering from a whiffed cut lands harder still.
 * - reel: a sweeping cut knocks the target back reeling and slows them; a different weapon catching them
 *   meanwhile is a follow-up that hits harder: boost in and swap to a heavy sword, or swap to a gun and shoot
 *   them while they are out of reach. A dash shakes the reel off.
 * - perfect: dodging an attack at the right moment (dash or Boost press) refunds part of the dash cooldown and
 *   makes your next hit within the window a riposte that lands harder.
 * - stagger: stun builds a stagger load that drains over time; past the limit the knight turns steady for a
 *   moment and cannot be stunned, so two attackers or a fast gun cannot lock someone forever.
 * - clash: two cuts that meet mid-swing bounce off each other; a heavy cut beats a light one. */
export const FIGHT = Object.freeze({
  counter: Object.freeze({ damage: 1.25, stun: 1.5 }),
  punish: Object.freeze({ damage: 1.5, stun: 2 }),
  // Parry: a Guardian shield raised just before a cut lands (within `window` ticks of it coming up) turns it
  // aside: the shield takes nothing and the attacker is stunned and left exposed.
  parry: Object.freeze({ window: 8, stun: 40, exposed: 60 }),
  // Reel: a sweeping cut knocks the target back reeling and slows them. The first hit on them with a different
  // sword before it wears off is a follow-up that lands harder (harder still with a heavy one); a gun's shots
  // all land harder while it lasts (knock them out of reach, switch to the gun, shoot). A dash shakes it off.
  reel: Object.freeze({ ticks: 90, followUp: 1.3, heavy: 1.5, gun: 1.25, slow: .6 }),
  perfect: Object.freeze({ window: 90, damage: 1.3, dashRefund: .6 }),
  stagger: Object.freeze({ limit: 54, drainPerTick: .4, steadyTicks: 72 }),
  clash: Object.freeze({ push: 240, stun: 12, hitStop: 6 }),
  // Fake charge (as in Spiral Knights PvP): let go of a charge early, after at least `minHold` ticks of showing
  // it, and a normal attack comes out at once (the next cut of the combo, or a shot). If the knight you baited
  // dashed away from the charge meanwhile, the feint's first hit within `window` ticks lands `damage` harder and
  // stuns `stun` longer: their dash is spent.
  // A gun starts charging the moment its shot is out, so its fake charge needs a deliberate hold (`gunHold`):
  // an ordinary click never fires twice.
  feint: Object.freeze({ minHold: 10, gunHold: 36, window: 60, damage: 1.25, stun: 1.5 }),
});
/** Bombs. A bomb charge is not dropped when you are hit (you still take the hit and flinch). A blast that catches
 * several knights hits each harder (`crowd` per extra knight, up to `crowdMax`). A bomb going off on a zone knocks
 * the other team's hold on it back by `zoneBreak` (of 100): bombs crack zones. */
export const BOMB = Object.freeze({ crowd: .15, crowdMax: .45, zoneBreak: 25 });
export const BLOOM = Object.freeze({ perShot: .07, max: .32, settlePerSecond: .3 });

/** Four free inventory slots: any weapon in any slot (four swords is fine), or hearts, or nothing.
 * Loadouts list a weapon id or null per slot; the empty fourth slot is where hearts go. */
export const SLOT_COUNT = 4;
export const DEFAULT_LOADOUTS = Object.freeze({ striker: ['brand', 'blaster', 'blast', null], guardian: ['cleaver', 'magnus', 'vortex', null], recon: ['rapier', 'alchemer', 'shard', null] });
