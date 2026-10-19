/** Lockdown: a top-down team brawl over three control points (after Spiral Knights).
 * Deterministic 120 Hz simulation shared by the server and offline practice.
 * Up to 4v4; empty seats are filled by bots. Teams score every five seconds by
 * the points they hold; first to 500 (or the leader at the time limit) wins. */
import { MAPS, MAP_IDS, TILE, isWall, isBlocked, wallAt, levelAt, levelCell, levelOk, canStep, shotBlocked } from './lockdown-maps.js';
import { WEAPONS, WEAPON_IDS, MOVESETS, MOVE_KINDS, AIM, aimFactor, aimRating, CRITICAL, WEAPON_NOTES, CUTS, DEFAULT_LOADOUTS, SLOT_COUNT, STATUS, STATUS_IDS, GUARD, BLADE, BLOOM, FIGHT, GUN, BOMB, BUILD } from './lockdown-weapons.js';
import { ARMORS, ARMOR_IDS, HELMETS, PANTS, SHOES, GEAR, GEAR_SLOTS, combineGear } from './lockdown-equipment.js';

export { MAPS, MAP_IDS, TILE, BLOOM, FIGHT, GUN, BOMB, BUILD, WEAPONS, WEAPON_IDS, MOVESETS, MOVE_KINDS, AIM, aimFactor, aimRating, CRITICAL, WEAPON_NOTES, CUTS, DEFAULT_LOADOUTS, SLOT_COUNT, STATUS, STATUS_IDS, GUARD, BLADE, ARMORS, ARMOR_IDS, HELMETS, PANTS, SHOES, GEAR, GEAR_SLOTS, combineGear };
export const TICK_RATE = 120;
const DT = 1 / TICK_RATE;
export const TEAM_SIZE = 4;
export const CAPACITY = TEAM_SIZE * 2;
/** Match sizes. 4v4 is Lockdown proper over three zones; 2v2 and 1v1 fight over the middle zone alone, which
 * scores twice as fast so a match lasts about as long. Seats past the size sit the match out. */
export const TEAM_SIZES = Object.freeze([1, 2, 4]);
export const MODE_RULES = Object.freeze({
  1: Object.freeze({ label: '1v1', points: Object.freeze(['B']), scoreTable: Object.freeze([0, 10]) }),
  2: Object.freeze({ label: '2v2', points: Object.freeze(['B']), scoreTable: Object.freeze([0, 10]) }),
  4: Object.freeze({ label: '4v4', points: null, scoreTable: null }),
});
const modeOf = state => MODE_RULES[state.teamSize] || MODE_RULES[TEAM_SIZE];
/** How well bots play, chosen in the lobby. skill: the range each bot's skill is drawn from; reaction: how many
 * ticks a bot's idea of where you are lags behind you; turn: how fast it can swing its aim (radians a second);
 * wobble: how far its aim drifts off; lead: how much of a moving target's travel it allows for; pause: extra time
 * between its shots (times the gun's interval); reads: how often it dodges, blocks and cancels (times a hard bot);
 * runs: how often a Striker bot hits and runs (Boosts round its target after a cut lands or as it winds up). */
export const BOT_LEVELS = Object.freeze({
  easy: Object.freeze({ label: 'Easy', skill: [.15, .4], reaction: 26, turn: 3, wobble: .32, lead: .1, pause: 1.2, reads: .3, runs: .3 }),
  normal: Object.freeze({ label: 'Normal', skill: [.3, .6], reaction: 20, turn: 6.5, wobble: .12, lead: .65, pause: .35, reads: .65, runs: 1 }),
  hard: Object.freeze({ label: 'Hard', skill: [.5, .9], reaction: 10, turn: 11, wobble: .05, lead: 1, pause: .1, reads: 1, runs: 1.3 }),
});
const botLevel = state => BOT_LEVELS[state.botLevel] || BOT_LEVELS.normal;
/** How hard bots fight, chosen in the lobby (separately from how well). sight: how far off they pick a fight;
 * retreat: the health share at which they fall back to heal; heal: when they go for a nearby heart; melee: the
 * chance a non-Striker fights up close; range: their fighting distance (times the usual); cut: how often they swing
 * (times the usual); rush: how often they dash or Boost in; defend: how often they dodge, block and read cuts;
 * zones: how much more an enemy-held zone draws them than one to defend. */
export const BOT_AGGRESSION = Object.freeze({
  cautious: Object.freeze({ label: 'Cautious', sight: 340, retreat: .5, heal: .9, melee: .2, range: 1.35, cut: .7, rush: .4, defend: 1.4, zones: .6 }),
  balanced: Object.freeze({ label: 'Balanced', sight: 460, retreat: .35, heal: .75, melee: .4, range: 1, cut: 1, rush: 1, defend: 1, zones: 1 }),
  aggressive: Object.freeze({ label: 'Aggressive', sight: 600, retreat: .15, heal: .5, melee: .7, range: .75, cut: 1.5, rush: 2.5, defend: .7, zones: 1.8 }),
});
const botMood = state => BOT_AGGRESSION[state.botAggression] || BOT_AGGRESSION.balanced;
const activePoints = (map, teamSize) => map.points.filter(point => !MODE_RULES[teamSize]?.points || MODE_RULES[teamSize].points.includes(point.id)).map(point => ({ id: point.id, x: point.x, y: point.y, progress: 0, owner: null }));
/** `ability` is the class ability (right mouse): Striker Boost, Guardian shield (hold), Recon Cloak.
 * `dash` (Space) is the quick dash every knight has. */
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'attack', 'ability', 'dash', 'slot1', 'slot2', 'slot3', 'slot4', 'swap']);
export const emptyInput = (aim = 0) => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), aim });

export const RULES = Object.freeze({
  countdownTicks: 3 * TICK_RATE, timeLimitTicks: 10 * 60 * TICK_RATE, scoreToWin: 500,
  scoreIntervalTicks: 5 * TICK_RATE, scoreTable: Object.freeze([0, 5, 8, 9]),
  pointRadius: 132, captureTicks: 5 * TICK_RATE,
  respawnBaseTicks: 5 * TICK_RATE, respawnPerMinuteTicks: TICK_RATE, respawnMaxTicks: 12 * TICK_RATE,
  spawnShieldTicks: 2 * TICK_RATE, radius: 15, eventLimit: 160,
  // Standing in your own base heals you, and is where you change your loadout mid-match.
  baseHealPerSecond: 25,
  // Every knockout drops a heart that heals whoever grabs it first.
  // Hearts go into your inventory (two per slot) and heal when used; with no room they heal on the spot.
  heart: Object.freeze({ heal: 30, ttlTicks: 15 * TICK_RATE, radius: 24, stack: 2, useTicks: 30 }),
  // Personal score comes from the zones: taking a point, or knocking an enemy point back to neutral.
  captureScore: 30, neutralizeScore: 15,
  // Every knight can dash: a short burst the way you are moving, untouchable for a moment.
  // It also cancels a sword's recovery. The Striker's Boost is the long version.
  // The same for everyone, whatever the class or gear (gear only changes the cooldown). `exitSpeed`: how fast you come
  // out of it, so it stops crisply instead of gliding on.
  dash: Object.freeze({ ticks: 10, distance: 75, evadeTicks: 10, cooldown: Math.round(1.25 * TICK_RATE), exitSpeed: 100 }),
});

/** The three Lockdown classes, as in Spiral Knights: the class ability takes the place of the
 * shield, and each class tilts one weapon family. Multipliers above 1 on a charge make it slower. */
export const CLASSES = Object.freeze({
  striker: Object.freeze({ id: 'striker', name: 'Striker', hp: 100, speed: 210, bladeDamage: 1.25, bladeSpeed: 1.2, bombCharge: 1.5, ability: 'Boost',
    perks: 'Swords +25% damage and +20% speed · slow bomb charge', description: 'The sword specialist. Hold Boost to sprint while its nitro meter lasts, to close in or get out; pressing it also cancels a cut and slips a hit. Every sword hit refills some Boost: hit, Boost round them so their answer misses, hit again.' }),
  guardian: Object.freeze({ id: 'guardian', name: 'Guardian', hp: 120, speed: 190, bombCharge: .7, ability: 'Shield',
    perks: 'Most health · bombs charge 30% faster', description: 'The only knight with a shield. Hold it to raise a dome that covers teammates inside and slowly heals everyone in it. When the dome breaks you keep a small personal shield for a few hits; then it all recharges.' }),
  recon: Object.freeze({ id: 'recon', name: 'Recon', hp: 95, speed: 200, bombDamage: 1.25, bombCharge: .85, ability: 'Cloak',
    perks: 'Bombs +25% damage · bombs charge 15% faster · less health', description: 'The ambusher. Cloak turns you invisible; the first hit out of it (within a few seconds) deals double damage and marks the target to take 30% more from your team.' }),
});
export const ABILITIES = Object.freeze({
  // Striker Boost (nitro): hold the ability to run 50% faster while the meter lasts. Letting go stops it;
  // the meter refills after a short pause. Run it dry and it locks until it is a quarter full again.
  // Pressing it cancels a cut's recovery and gives a brief dodge. Hit and run, as in Spiral Knights: every sword hit
  // the Striker lands puts `hitRefill` ticks back in the meter, so cutting, boosting round and cutting again keeps
  // going, while just holding Boost to sprint still runs it dry.
  dash: { meter: 3 * TICK_RATE, speed: 1.5, regenDelay: TICK_RATE, refill: 6 * TICK_RATE, relock: .25, evadeTicks: 14, pressCost: 30, hitRefill: 50 },
  // Recon Cloak: the first hit within `ambushTicks` of leaving it deals `ambush` times damage and marks the target.
  cloak: { ticks: 4 * TICK_RATE, cooldown: 12 * TICK_RATE, markTicks: 5 * TICK_RATE, markBonus: .3, revealRange: 64, ambush: 2, ambushTicks: Math.round(2.5 * TICK_RATE) },
});
/** Ticks a full charge takes for this knight: class and outfit perks speed up or slow down a weapon family. */
export function chargeTicksFor(player, weapon) {
  const cls = CLASSES[player.cls] || {}, outfit = combineGear(player);
  return Math.round(weapon.chargeTicks * (weapon.family === 'bomb' ? (cls.bombCharge || 1) * outfit.bombCharge : weapon.family === 'gun' ? (cls.gunCharge || 1) * outfit.gunCharge : 1));
}
/** Attack multipliers from class and outfit together. */
/** Everything the knight wears (helmet, armour, pants, shoes) added up. */
const outfitOf = player => combineGear(player || {});
/** Health = class health plus what the gear adds (or costs). `gear` is a player, a gear object or a body armour id. */
export const maxHpFor = (cls, gear) => Math.max(40, CLASSES[cls].hp + combineGear(typeof gear === 'string' ? { armor: gear } : gear || {}).maxHp);
export const gunPower = player => (CLASSES[player.cls]?.gunDamage || 1) * outfitOf(player).gunDamage;
const bombPower = player => player ? (CLASSES[player.cls]?.bombDamage || 1) * outfitOf(player).bombDamage : 1;
export const bladePower = player => (CLASSES[player.cls]?.bladeDamage || 1) * outfitOf(player).bladeDamage;
/** Swing speed from class and gear, capped so stacked bonuses (a Striker in fencing gear) can't make cuts a blur. */
const BLADE_SPEED_MAX = 1.3;
const bladeSpeed = player => Math.min(BLADE_SPEED_MAX, (CLASSES[player.cls]?.bladeSpeed || 1) * outfitOf(player).bladeSpeed);
const CLASS_IDS = Object.keys(CLASSES);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function random(state) {
  // xorshift32 kept in state so bot choices replay exactly.
  let x = state.seed | 0 || 0x9e3779b9; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; state.seed = x >>> 0;
  return state.seed / 4294967296;
}
function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > RULES.eventLimit) state.events.splice(0, state.events.length - RULES.eventLimit);
}

function newPlayer(id) {
  const team = id < TEAM_SIZE ? 0 : 1, cls = CLASS_IDS[id % CLASS_IDS.length];
  return {
    id, team, name: `Bot ${id + 1}`, human: false, connected: false, bot: true, cls, armor: 'none', helmet: 'none', pants: 'none', shoes: 'none', weapons: [...DEFAULT_LOADOUTS[cls]], hearts: Array(SLOT_COUNT).fill(0), slot: 0,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, aim: team === 0 ? 0 : Math.PI, hp: CLASSES[cls].hp, maxHp: CLASSES[cls].hp, alive: false, lastHurtTick: 0,
    respawnTicks: 0, shieldTicks: 0, stunTicks: 0, pushX: 0, pushY: 0,
    action: 'idle', actionTicks: 0, actionTotal: 0, comboStep: 0, comboWindow: 0, hitIds: [], chargeTicks: 0, charging: false,
    clips: {}, reloadTicks: {}, sinceShot: {}, fireCooldown: 0, burst: null, hitStop: 0, bufferAttack: false,
    swingAim: 0, swingDir: 1, swingReach: 0, swingArc: 0, swingStartup: 0, swingActive: 0, swingRecovery: 0, swingDamage: 0, chargeMoveTicks: 0,
    dodgeTicks: 0, dodgeX: 0, dodgeY: 0, dodgeStep: 0, evadeTicks: 0, dashCooldown: 0, perfectUsed: false, riposteTicks: 0, stagger: 0, steadyTicks: 0, cancelLag: 0,
    guarding: false, guardRaise: 0, guardHp: GUARD.max, guardBroken: false, guardDelay: 0, domeHp: GUARD.domeMax, domeBroken: false,
    status: Object.fromEntries(STATUS_IDS.map(key => [key, 0])), statusOwner: {}, freezeImmune: 0, chillStacks: 0, catalysts: 0, catalystTicks: 0,
    dashTicks: 0, cloakTicks: 0, markTicks: 0, markReady: 0, abilityCooldown: 0, boostMeter: 3 * TICK_RATE, boostDelay: 0, boostLocked: false, boosting: false,
    kills: 0, deaths: 0, captures: 0, damage: 0, score: 0, previousInput: emptyInput(team === 0 ? 0 : Math.PI),
  };
}

export function createState({ mapId = MAP_IDS[0], seed = 1, teamSize = TEAM_SIZE, botLevel = 'normal', botClasses = ['mix', 'mix'], botAggression = 'balanced' } = {}) {
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Unknown Lockdown map.');
  const map = MAPS[mapId];
  if (map.training || !TEAM_SIZES.includes(teamSize)) teamSize = TEAM_SIZE;
  return {
    gameId: 'lockdown', mapId, mapName: map.name, mode: map.training ? 'dojo' : 'match', tick: 0, phase: 'lobby', phaseTicks: 0, seed: seed >>> 0 || 1, teamSize, botLevel: Object.hasOwn(BOT_LEVELS, botLevel) ? botLevel : 'normal', botAggression: Object.hasOwn(BOT_AGGRESSION, botAggression) ? botAggression : 'balanced', botClasses: [0, 1].map(team => BOT_CLASS_CHOICES.includes(botClasses?.[team]) ? botClasses[team] : 'mix'),
    scores: [0, 0], winner: null, timeLeftTicks: RULES.timeLimitTicks, scoreTimer: RULES.scoreIntervalTicks,
    points: activePoints(map, teamSize),
    players: Array.from({ length: CAPACITY }, (_, id) => newPlayer(id)),
    projectiles: [], bombs: [], clouds: [], pickups: [], events: [], eventId: 0, nextId: 1,
  };
}

/** The Dojo: free training on dummies. No countdown, no score, no end; loadouts change anywhere. */
export const isDojo = state => state.mode === 'dojo';
/** The dummies on the enemy team, in seat order. Positions are tiles on the Dojo map. 'still' stands,
 * 'strafe' walks back and forth, 'high' stands on a gallery, 'spar' is a normal bot that fights back. */
export const DOJO_DUMMIES = Object.freeze([
  Object.freeze({ kind: 'still', cls: 'striker', col: 10.5, row: 7.5, name: 'Dummy' }),
  Object.freeze({ kind: 'still', cls: 'guardian', col: 10.5, row: 11.5, name: 'Heavy dummy' }),
  Object.freeze({ kind: 'strafe', cls: 'recon', col: 16.5, row: 9.5, name: 'Moving dummy' }),
  Object.freeze({ kind: 'high', cls: 'recon', col: 15.5, row: 2.5, name: 'Gallery dummy' }),
]);
const DOJO = Object.freeze({ dummyRespawnTicks: 2 * TICK_RATE, respawnTicks: Math.round(1.5 * TICK_RATE), refillTicks: 2 * TICK_RATE, strafeTiles: 3 });

/** True while a knight stands on their own team's base (spawn) tiles. */
export function inBase(state, player) {
  const map = MAPS[state.mapId];
  return map.grid[Math.floor(player.y / TILE)]?.[Math.floor(player.x / TILE)] === (player.team === 0 ? '1' : '2');
}
// Bases are safe: a barrier keeps the other team out, rounds stop at its edge, and nobody fights across it
// (a knight in their own base can neither be hurt by an enemy nor hurt one).
const enemyBaseCell = team => team === 0 ? '2' : team === 1 ? '1' : null;
const baseCell = (map, x, y) => { const cell = map.grid[Math.floor(y / TILE)]?.[Math.floor(x / TILE)]; return cell === '1' || cell === '2' ? cell : null; };
/** True when this team may not walk onto the tile: the other team's base. */
const barred = (map, col, row, team) => team != null && map.grid[row]?.[col] === enemyBaseCell(team);

const isGun = id => WEAPONS[id]?.family === 'gun';
/** A loadout is four slots of distinct weapons or empty (null); at least one weapon. A three-slot list
 * (older clients) gets an empty fourth slot. */
function normalLoadout(weapons) { return Array.from({ length: SLOT_COUNT }, (_, i) => weapons[i] ?? null); }
function loadoutError(weapons) {
  if (!Array.isArray(weapons) || weapons.length < 1 || weapons.length > SLOT_COUNT || weapons.some(id => id !== null && !Object.hasOwn(WEAPONS, id))) return `Choose up to ${SLOT_COUNT} weapons, one per slot.`;
  const chosen = weapons.filter(id => id !== null);
  if (!chosen.length) return 'Carry at least one weapon.';
  if (new Set(chosen).size !== chosen.length) return 'Choose different weapons for each slot.';
  return null;
}
/** New weapons in the slots; hearts in a slot that now holds a weapon move to a free slot (or are lost). */
function setWeapons(player, weapons) {
  const hearts = player.hearts || Array(SLOT_COUNT).fill(0), carried = [];
  player.weapons = normalLoadout(weapons);
  player.hearts = Array(SLOT_COUNT).fill(0);
  hearts.forEach((count, slot) => { if (count > 0) { if (player.weapons[slot] === null) player.hearts[slot] = count; else carried.push(count); } });
  for (const count of carried) { const free = player.weapons.findIndex((id, slot) => id === null && player.hearts[slot] === 0); if (free >= 0) player.hearts[free] = count; }
}
/** Drag-and-drop in the inventory: `order` lists the old slot for each new position. The item in your
 * hands stays in your hands. Works anywhere, any time. */
export function reorderInventory(state, id, order) {
  const player = state.players[id];
  if (!player) return { ok: false, error: 'Unknown player.' };
  if (!Array.isArray(order) || order.length !== SLOT_COUNT || [...order].sort().join() !== [...Array(SLOT_COUNT).keys()].join()) return { ok: false, error: 'Reorder the four inventory slots.' };
  player.weapons = order.map(slot => player.weapons[slot] ?? null);
  player.hearts = order.map(slot => player.hearts?.[slot] || 0);
  player.slot = order.indexOf(player.slot); player.pendingSlot = null;
  emit(state, 'inventory', { playerId: player.id, weapons: [...player.weapons], hearts: [...player.hearts] });
  return { ok: true };
}
/** Lobby choices: team, class, armor and four inventory slots. During a match,
 * equipment can change only while you are in base (or waiting to respawn). */
export function setPlayerSetup(state, id, { team, cls, armor, helmet, pants, shoes, weapons, name } = {}) {
  const gear = { helmet, armor, pants, shoes }, gearChange = GEAR_SLOTS.some(slot => gear[slot] !== undefined);
  const player = state.players[id];
  if (!player) return { ok: false, error: 'Unknown player.' };
  const inMatch = state.phase === 'countdown' || state.phase === 'fight';
  if (inMatch && team !== undefined && team !== player.team) return { ok: false, error: 'Change teams in the lobby.' };
  if (inMatch && !isDojo(state) && (cls !== undefined || gearChange || weapons !== undefined) && player.alive && !inBase(state, player)) return { ok: false, error: 'Return to your base to change class, armor or weapons.' };
  if (cls !== undefined && !Object.hasOwn(CLASSES, cls)) return { ok: false, error: 'Choose Striker, Guardian or Recon.' };
  for (const slot of GEAR_SLOTS) if (gear[slot] !== undefined && (typeof gear[slot] !== 'string' || !Object.hasOwn(GEAR[slot], gear[slot]))) return { ok: false, error: slot === 'armor' ? 'Choose an available armor.' : `Choose an available ${slot === 'helmet' ? 'helmet' : slot === 'pants' ? 'pair of pants' : 'pair of shoes'}.` };
  if (weapons !== undefined) {
    const check = loadoutError(weapons); if (check) return { ok: false, error: check };
    weapons = normalLoadout(weapons);
  }
  if (team !== undefined && ![0, 1].includes(team)) return { ok: false, error: 'Choose a team.' };
  if (team !== undefined && team !== player.team && state.players.filter(other => other.human && other.team === team).length >= (state.teamSize || TEAM_SIZE)) return { ok: false, error: 'That team is full.' };
  if (team !== undefined) player.team = team;
  if (inMatch && player.alive) {
    // Swapping in base keeps your health fraction and drops any action in progress.
    const fraction = player.hp / player.maxHp;
    if (GEAR_SLOTS.some(slot => gear[slot] !== undefined && gear[slot] !== player[slot])) {
      for (const slot of GEAR_SLOTS) if (gear[slot] !== undefined) player[slot] = gear[slot];
      player.maxHp = maxHpFor(player.cls, player); player.hp = Math.max(1, fraction * player.maxHp);
    }
    if (cls !== undefined && cls !== player.cls) {
      player.cls = cls; player.maxHp = maxHpFor(cls, player); player.hp = Math.max(1, fraction * player.maxHp);
      player.dashTicks = player.cloakTicks = 0; player.markReady = 0; player.guarding = false;
    }
    if (weapons !== undefined) {
      setWeapons(player, weapons);
      player.clips = Object.fromEntries(weapons.filter(isGun).map(weaponId => [weaponId, WEAPONS[weaponId].clip]));
      player.reloadTicks = {}; player.sinceShot = {};
    }
    Object.assign(player, { slot: Math.max(0, player.weapons.findIndex(Boolean)), pendingSlot: null, action: 'idle', actionTicks: 0, charging: false, chargeTicks: 0, comboStep: 0, burst: null, bufferAttack: false });
    emit(state, 'loadoutChange', { playerId: player.id, cls: player.cls, armor: player.armor, helmet: player.helmet, pants: player.pants, shoes: player.shoes, weapons: [...player.weapons] });
  } else {
    for (const slot of GEAR_SLOTS) if (gear[slot] !== undefined) player[slot] = gear[slot];
    if (cls !== undefined) player.cls = cls;
    if (cls !== undefined || gearChange) player.maxHp = player.hp = maxHpFor(player.cls, player);
    if (weapons !== undefined) setWeapons(player, weapons);
  }
  if (typeof name === 'string') player.name = name.slice(0, 24);
  return { ok: true };
}

export function setConnected(state, id, connected, name) {
  const player = state.players[id]; if (!player) return;
  const joining = connected === true && !player.human;
  player.connected = connected === true; player.human = player.connected; player.bot = !player.human;
  if (joining) {
    // A new person starts with no equipment, including when taking over a live bot.
    // Remove all gear health bonuses without healing or reviving the knight.
    const fraction = player.hp / player.maxHp;
    for (const slot of GEAR_SLOTS) player[slot] = 'none';
    player.maxHp = maxHpFor(player.cls, player);
    player.hp = player.alive ? Math.max(1, fraction * player.maxHp) : fraction * player.maxHp;
  }
  if (player.human && typeof name === 'string') player.name = name.slice(0, 24);
  // A person never lands on a team that already has four people.
  if (joining && state.players.filter(other => other !== player && other.human && other.team === player.team).length >= (state.teamSize || TEAM_SIZE)) player.team = 1 - player.team;
  if (!player.human) player.name = `Bot ${id + 1}`;
}

/** Humans keep their seats; every other seat becomes a bot, balanced to four per team. */
export function startMatch(state, participantIds = []) {
  const humans = new Set(participantIds), size = state.teamSize || TEAM_SIZE;
  for (const player of state.players) { player.human = humans.has(player.id); player.bot = !player.human; player.connected = player.human || player.connected && player.human; player.benched = false; }
  // People past the mode's size on one team cross over while the other has room; any still left over watch.
  for (const team of [0, 1]) for (const extra of state.players.filter(player => player.human && player.team === team).slice(size)) {
    if (state.players.filter(player => player.human && player.team === 1 - team).length < size) extra.team = 1 - team;
  }
  // Bots fill each team up to the size, keeping their own team where they can; every other seat sits out.
  const free = state.players.filter(player => player.bot), used = new Set();
  for (const team of [0, 1]) {
    const people = state.players.filter(player => player.human && player.team === team);
    for (const watcher of people.slice(size)) watcher.benched = true;
    const picks = free.filter(bot => !used.has(bot)).sort((a, b) => (a.team !== team) - (b.team !== team)).slice(0, Math.max(0, size - people.length));
    for (const bot of picks) { bot.team = team; used.add(bot); }
  }
  for (const bot of free) if (!used.has(bot)) bot.benched = true;
  Object.assign(state, { phase: 'countdown', phaseTicks: RULES.countdownTicks, scores: [0, 0], winner: null, timeLeftTicks: RULES.timeLimitTicks, scoreTimer: RULES.scoreIntervalTicks, projectiles: [], bombs: [], clouds: [], pickups: [] });
  for (const point of state.points) { point.progress = 0; point.owner = null; }
  for (const player of state.players) {
    if (player.bot) {
      const pick = CLASS_IDS[Math.floor(random(state) * CLASS_IDS.length)], chosen = state.botClasses?.[player.team];
      player.cls = CLASS_IDS.includes(chosen) ? chosen : pick; // the lobby's choice for this team's bots, or a mix
      // Bots carry one blade, one gun and one bomb from the whole armoury, elemental ones included.
      player.weapons = [...['blade', 'gun', 'bomb'].map(family => { const ids = WEAPON_IDS.filter(id => WEAPONS[id].family === family); return ids[Math.floor(random(state) * ids.length)]; }), null];
      const picks = BOT_OUTFITS[player.cls];
      player.armor = picks[Math.floor(random(state) * picks.length)];
      // Bots path around pits, so they skip the shoes that cross them.
      for (const slot of ['helmet', 'pants', 'shoes']) { const ids = Object.keys(GEAR[slot]).filter(id => !GEAR[slot][id].walk?.length); player[slot] = ids[Math.floor(random(state) * ids.length)]; }
    }
    Object.assign(player, { kills: 0, deaths: 0, captures: 0, damage: 0, score: 0 });
    if (player.benched) Object.assign(player, { alive: false, respawnTicks: 0 }); else spawn(state, player);
  }
  if (isDojo(state)) setupDojo(state);
  emit(state, 'matchStart', { mapId: state.mapId });
  return state;
}

/** The Dojo has no countdown. People train on the left; their team's bots sit out, and the enemy seats
 * become dummies standing at their marks. */
function setupDojo(state) {
  const humans = state.players.filter(player => player.human);
  for (const player of humans) if (player.team !== 0) { player.team = 0; spawn(state, player); }
  const dummies = state.players.filter(player => player.bot && player.team === 1);
  for (const player of state.players.filter(player => player.bot && player.team === 0)) {
    // A bot on the people's side becomes a dummy if there are seats to fill, otherwise it sits out.
    if (dummies.length < DOJO_DUMMIES.length) { player.team = 1; dummies.push(player); continue; }
    Object.assign(player, { alive: false, benched: true, respawnTicks: 0 });
  }
  dummies.forEach((player, index) => {
    const spec = DOJO_DUMMIES[index];
    if (!spec) { Object.assign(player, { alive: false, benched: true }); return; }
    Object.assign(player, { dummy: spec.kind, home: { x: spec.col * TILE, y: spec.row * TILE }, name: spec.name, cls: spec.cls, brain: null });
    for (const slot of GEAR_SLOTS) player[slot] = 'none';
    spawn(state, player);
  });
  Object.assign(state, { phase: 'fight', phaseTicks: 0 });
}
/** Dojo: turn the moving dummy into a sparring partner that fights back, or back again. */
export function setDojoSpar(state, on) {
  if (!isDojo(state)) return { ok: false, error: 'Sparring is for the Dojo.' };
  const partner = state.players.find(player => player.dummy === 'strafe' || player.dummy === 'spar');
  if (!partner) return { ok: false, error: 'No dummy to spar with.' };
  partner.dummy = on ? 'spar' : 'strafe'; partner.name = on ? 'Sparring partner' : 'Moving dummy'; partner.brain = null;
  return { ok: true };
}

export function resetLobby(state) {
  const keep = state.players.map(player => ({ team: player.team, cls: player.cls, armor: player.armor, helmet: player.helmet, pants: player.pants, shoes: player.shoes, weapons: player.weapons, hearts: Array(SLOT_COUNT).fill(0), name: player.name, human: player.human, connected: player.connected }));
  const fresh = createState({ mapId: state.mapId, seed: state.seed, teamSize: state.teamSize, botLevel: state.botLevel, botClasses: state.botClasses, botAggression: state.botAggression });
  Object.assign(state, fresh, { tick: state.tick, eventId: state.eventId });
  state.players.forEach((player, id) => Object.assign(player, keep[id], { bot: !keep[id].human, maxHp: maxHpFor(keep[id].cls, keep[id]), hp: maxHpFor(keep[id].cls, keep[id]) }));
  return state;
}

export function selectMap(state, mapId) {
  if (!Object.hasOwn(MAPS, mapId)) return { ok: false, error: 'Unknown Lockdown map.' };
  if (MAPS[mapId].training || isDojo(state)) return { ok: false, error: 'The Dojo is for solo training.' };
  if (state.phase !== 'lobby') return { ok: false, error: 'Change the map in the lobby.' };
  const map = MAPS[mapId];
  Object.assign(state, { mapId, mapName: map.name, points: activePoints(map, state.teamSize) });
  return { ok: true };
}
/** Easy, Normal or Hard bots, chosen in the lobby. */
export function selectBotLevel(state, level) {
  if (!Object.hasOwn(BOT_LEVELS, level)) return { ok: false, error: 'Choose easy, normal or hard bots.' };
  if (state.phase !== 'lobby') return { ok: false, error: 'Change the bots in the lobby.' };
  state.botLevel = level; return { ok: true };
}
/** Cautious, Balanced or Aggressive bots, chosen in the lobby. */
export function selectBotAggression(state, aggression) {
  if (!Object.hasOwn(BOT_AGGRESSION, aggression)) return { ok: false, error: 'Choose cautious, balanced or aggressive bots.' };
  if (state.phase !== 'lobby') return { ok: false, error: 'Change the bots in the lobby.' };
  state.botAggression = aggression; return { ok: true };
}
/** The class each team's bots play, chosen in the lobby: 'mix' (each bot picks its own) or one class for all of them,
 * so a 1v1 can be practised against the class you want to beat. */
export const BOT_CLASS_CHOICES = Object.freeze(['mix', ...Object.keys(CLASSES)]);
export function selectBotClass(state, team, cls) {
  if (team !== 0 && team !== 1) return { ok: false, error: 'Choose Amber or Cyan.' };
  if (!BOT_CLASS_CHOICES.includes(cls)) return { ok: false, error: 'Choose a mix, Strikers, Guardians or Recons.' };
  if (state.phase !== 'lobby') return { ok: false, error: 'Change the bots in the lobby.' };
  state.botClasses = state.botClasses ? [...state.botClasses] : ['mix', 'mix']; state.botClasses[team] = cls; return { ok: true };
}
/** 1v1, 2v2 or 4v4, chosen in the lobby. */
export function selectTeamSize(state, size) {
  if (!TEAM_SIZES.includes(size)) return { ok: false, error: 'Choose 1v1, 2v2 or 4v4.' };
  if (isDojo(state)) return { ok: false, error: 'The Dojo is for solo training.' };
  if (state.phase !== 'lobby') return { ok: false, error: 'Change the mode in the lobby.' };
  if (state.players.filter(player => player.human).length > size * 2) return { ok: false, error: `Too many people here for ${MODE_RULES[size].label}.` };
  Object.assign(state, { teamSize: size, points: activePoints(MAPS[state.mapId], size) });
  return { ok: true };
}

/** Outfits bots wear, by class. */
const BOT_OUTFITS = Object.freeze({
  striker: ['duelist', 'fencer', 'berserker', 'windrunner', 'scout'],
  guardian: ['heavy', 'juggernaut', 'bombardier', 'medic', 'clockwork'],
  recon: ['scout', 'gunslinger', 'ballistic', 'mirrorweave', 'clockwork'],
});
function respawnDelay(state, player) {
  if (isDojo(state)) return player?.dummy ? DOJO.dummyRespawnTicks : DOJO.respawnTicks;
  const minutes = Math.floor((RULES.timeLimitTicks - state.timeLeftTicks) / (60 * TICK_RATE));
  return Math.min(RULES.respawnMaxTicks, RULES.respawnBaseTicks + minutes * RULES.respawnPerMinuteTicks);
}
function spawn(state, player) {
  const map = MAPS[state.mapId], tiles = map.spawns[player.team];
  let spot = player.home || tiles[0];
  for (let tries = 0; tries < 12 && !player.home; tries++) {
    const candidate = tiles[Math.floor(random(state) * tiles.length)];
    if (!state.players.some(other => other !== player && other.alive && dist(other, candidate) < RULES.radius * 2.2)) { spot = candidate; break; }
  }
  const cls = CLASSES[player.cls];
  Object.assign(player, {
    x: spot.x, y: spot.y, z: levelAt(map, spot.x, spot.y), vx: 0, vy: 0, alive: true, hp: maxHpFor(player.cls, player), maxHp: maxHpFor(player.cls, player), respawnTicks: 0, lastHurtTick: state.tick, shieldTicks: RULES.spawnShieldTicks,
    stunTicks: 0, pushX: 0, pushY: 0, action: 'idle', actionTicks: 0, actionTotal: 0, comboStep: 0, comboWindow: 0, hitIds: [], chargeTicks: 0, charging: false,
    dashTicks: 0, cloakTicks: 0, markTicks: 0, markReady: 0, fireCooldown: 0, boostMeter: ABILITIES.dash.meter, boostDelay: 0, boostLocked: false, boosting: false,
    aim: player.team === 0 ? 0 : Math.PI, burst: null, hitStop: 0, bufferAttack: false, dodgeTicks: 0, evadeTicks: 0, dashCooldown: 0, perfectUsed: false, riposteTicks: 0, stagger: 0, steadyTicks: 0, cancelLag: 0, guarding: false, guardRaise: 0, guardBroken: false, guardDelay: 0,
    guardHp: GUARD.max, domeHp: GUARD.domeMax, domeBroken: false, freezeImmune: 0, chillStacks: 0, buildup: {}, catalysts: 0, catalystTicks: 0,
    status: Object.fromEntries(STATUS_IDS.map(key => [key, 0])), statusOwner: {},
  });
  player.clips = Object.fromEntries(player.weapons.filter(isGun).map(id => [id, WEAPONS[id].clip]));
  player.slot = Math.max(0, player.weapons.findIndex(Boolean)); player.heartUse = 0;
  player.reloadTicks = {}; player.sinceShot = {};
  if (player.dummy) player.shieldTicks = 0;
}

// ---------- physics ----------
/** How close your centre may come to a cliff edge (the drop to, or face of, the other floor). */
const CLIFF_RADIUS = 10;
function collides(map, x, y, radius, walk = null, z = null, from = null, team = null) {
  const minCol = Math.floor((x - radius) / TILE), maxCol = Math.floor((x + radius) / TILE), minRow = Math.floor((y - radius) / TILE), maxRow = Math.floor((y + radius) / TILE);
  const away = (col, row) => { if (!from) return false; const fx = clamp(from.x, col * TILE, (col + 1) * TILE), fy = clamp(from.y, row * TILE, (row + 1) * TILE), nx = clamp(x, col * TILE, (col + 1) * TILE), ny = clamp(y, row * TILE, (row + 1) * TILE);
    return (x - nx) ** 2 + (y - ny) ** 2 >= (from.x - fx) ** 2 + (from.y - fy) ** 2; };
  for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
    let reach = radius;
    // The other team's base is a wall to you (stepping back out of it is always allowed).
    if (barred(map, col, row, team)) { if (away(col, row)) continue; }
    else if (!isBlocked(map, col, row, walk)) {
      // On two-floor maps the other floor is a cliff: up only by stairs, never off a ledge.
      if (z === null || levelOk(map, col, row, z)) continue;
      reach = CLIFF_RADIUS;
      // Stepping away from an edge is always allowed, so turning on a stair never pins you.
      if (away(col, row)) continue;
    }
    const nx = clamp(x, col * TILE, (col + 1) * TILE), ny = clamp(y, row * TILE, (row + 1) * TILE);
    if ((x - nx) ** 2 + (y - ny) ** 2 < reach * reach) return true;
  }
  return false;
}
function moveBody(map, body, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6)), walk = outfitOf(body).walk;
  for (let step = 0; step < steps; step++) {
    if (!collides(map, body.x + dx / steps, body.y, RULES.radius, walk, levelAt(map, body.x, body.y), body, body.team)) body.x += dx / steps; else body.vx = 0;
    if (!collides(map, body.x, body.y + dy / steps, RULES.radius, walk, levelAt(map, body.x, body.y), body, body.team)) body.y += dy / steps; else body.vy = 0;
  }
  body.z = levelAt(map, body.x, body.y);
}
/** Tile ray from a to b: walls block it, and so does a cliff face when a stands on low ground
 * (except the last body-width, where a knight standing at the edge pokes out over it). */
export function lineOfSight(map, a, b) {
  const length = dist(a, b), steps = Math.ceil(length / (TILE / 3)), low = (a.z ?? levelAt(map, a.x, a.y)) < .5;
  for (let step = 1; step < steps; step++) {
    const x = a.x + (b.x - a.x) * step / steps, y = a.y + (b.y - a.y) * step / steps;
    if (wallAt(map, x, y)) return false;
    if (low && length * (1 - step / steps) > RULES.radius && levelCell(map, Math.floor(x / TILE), Math.floor(y / TILE)) === '1') return false;
  }
  return true;
}
/** Close enough in height to cross swords or share a cloud: the same floor, or on the stairs between. */
const sameFloor = (map, a, b) => Math.abs(levelAt(map, a.x, a.y) - levelAt(map, b.x, b.y)) <= .5;

// ---------- damage, shields and statuses ----------
/** A Guardian whose shield has grown into a dome covering this knight (not the Guardian itself). */
const domeUp = guard => guard.alive && guard.guarding && guard.guardRaise >= GUARD.expandTicks && !guard.domeBroken && guard.domeHp > 0;
function inAlliedBubble(state, target) {
  return state.players.find(guard => guard !== target && guard.team === target.team && domeUp(guard) && dist(guard, target) <= GUARD.radius) || null;
}
const guardMax = player => GUARD.max;
const BLADE_KINDS = new Set(['blade', 'lunge', 'spin', 'slam', 'burst']);
/** True while a committed action is only recovering, which a shield or a dodge may cancel. */
function inRecovery(player) {
  if (player.actionTicks === 0) return false;
  const elapsed = player.actionTotal - player.actionTicks;
  if (player.action === 'swing') return elapsed >= player.swingStartup + player.swingActive;
  return elapsed >= (player.chargeMoveTicks || 0);
}
/** A cut can be cancelled once it has landed (the rest of the sweep is skipped), or while it recovers. */
const canCancel = player => {
  if (player.action === 'swing' && player.swingFinisher) return player.actionTotal - player.actionTicks >= player.swingStartup + player.swingActive + Math.ceil(player.swingRecovery * BLADE.finisherLock);
  return inRecovery(player) || player.action === 'swing' && player.hitIds.length > 0 && !player.whiffed;
};
/** The animation cancel: drop the rest of the recovery. As in Spiral Knights, the combo starts over at the
 * quick first cut, and a short lag passes before the next attack. */
function cancelRecovery(state, player, by) {
  player.comboStep = 0; player.comboWindow = 0; player.cancelLag = BLADE.cancelLag;
  player.action = 'idle'; player.actionTicks = 0; player.bufferAttack = false; player.whiffed = false;
  emit(state, 'cancel', { playerId: player.id, by });
}
const CHARGE_MOVES = new Set(['lunge', 'lungeBurst', 'slam', 'spin']);
/** A hit knocks a knight out of a sword cut or a cast: the cut is lost and the combo starts over. */
function interrupt(state, player, by) {
  if (player.action !== 'swing' && player.action !== 'cast') return false;
  Object.assign(player, { action: 'idle', actionTicks: 0, comboStep: 0, comboWindow: 0, bufferAttack: false, whiffed: false });
  emit(state, 'interrupt', { playerId: player.id, by, x: player.x, y: player.y });
  return true;
}
/** Caught committed: winding up a cut, recovering from a whiff or a charge move, or holding a half-full charge. */
function exposed(player) {
  if (player.parriedTicks > 0) return true;
  if (player.action === 'swing') { const elapsed = player.actionTotal - player.actionTicks; return player.whiffed || elapsed < player.swingStartup || player.swingFinisher && elapsed >= player.swingStartup + player.swingActive; }
  if (CHARGE_MOVES.has(player.action) || player.action === 'cast') return inRecovery(player);
  return player.charging && player.chargeTicks >= chargeTicksFor(player, currentWeapon(player)) * .5;
}
/** True while this knight's cut is sweeping and the attacker stands inside the swept arc. */
function cutsInto(state, player, other) {
  if (player.action !== 'swing' || player.hitIds.includes(other.id)) return false;
  const elapsed = player.actionTotal - player.actionTicks;
  if (elapsed < player.swingStartup || elapsed >= player.swingStartup + player.swingActive) return false;
  const d = dist(player, other); if (d > player.swingReach + RULES.radius) return false;
  const pad = Math.atan2(RULES.radius, Math.max(1, d)), off = Math.abs(wrapAngle(Math.atan2(other.y - player.y, other.x - player.x) - player.swingAim));
  return off <= player.swingArc / 2 + pad && sameFloor(MAPS[state.mapId], player, other);
}
const isHeavy = player => !!WEAPONS[player.weapons?.[player.slot]]?.heavy;
/** Two cuts meet: equal weights bounce apart; a heavy cut knocks a light one aside and carries on. */
function clash(state, a, b) {
  const rule = FIGHT.clash, angle = Math.atan2(b.y - a.y, b.x - a.x), heavyA = isHeavy(a), heavyB = isHeavy(b);
  const recoil = (player, away) => {
    interrupt(state, player, 'clash');
    player.pushX = Math.cos(away) * rule.push * outfitOf(player).knockback; player.pushY = Math.sin(away) * rule.push * outfitOf(player).knockback;
    player.stunTicks = Math.max(player.stunTicks, rule.stun); player.hitStop = Math.max(player.hitStop, rule.hitStop);
  };
  emit(state, 'clash', { playerId: a.id, targetId: b.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, winner: heavyA === heavyB ? null : heavyA ? a.id : b.id });
  if (heavyA === heavyB) { a.hitIds.push(b.id); b.hitIds.push(a.id); recoil(a, angle + Math.PI); recoil(b, angle); return 'both'; }
  if (heavyA) { recoil(b, angle); a.hitStop = Math.max(a.hitStop, rule.hitStop); return 'attacker'; }
  recoil(a, angle + Math.PI); b.hitStop = Math.max(b.hitStop, rule.hitStop); return 'defender';
}
const STATUS_TICKS = new Set(['burn', 'shock', 'poison']);
const guardUp = player => player.guarding && player.guardRaise >= GUARD.raiseTicks;
const canHeal = player => !(player.status.poison > 0);
function heal(player, amount) {
  if (!canHeal(player)) return 0;
  amount *= outfitOf(player).healing;
  const gained = Math.min(amount, player.maxHp - player.hp); player.hp += gained; return gained;
}
/** Apply a status unless the shield is up; freeze leaves a short immunity behind. */
function applyStatus(state, target, id, ownerId, chance = 1, stacks = 1) {
  if (!id || !target.alive || guardUp(target) || inAlliedBubble(state, target) || random(state) >= chance) return false;
  if (id === 'freeze' && target.freezeImmune > 0) return false;
  if (id === 'chill') {
    // Chill stacks: each chilling hit slows a little more, and the last stack freezes solid.
    target.chillStacks = Math.min(STATUS.chill.freezeAt, (target.chillStacks || 0) + stacks);
    if (target.chillStacks >= STATUS.chill.freezeAt && !(target.freezeImmune > 0)) {
      target.chillStacks = 0; target.status.chill = 0;
      return applyStatus(state, target, 'freeze', ownerId);
    }
    target.chillStacks = Math.min(target.chillStacks, STATUS.chill.freezeAt - 1);
  }
  target.status[id] = Math.max(1, Math.round(STATUS[id].ticks * outfitOf(target).statusDuration)); target.statusOwner[id] = ownerId;
  if (id === 'freeze') { target.guarding = false; target.dodgeTicks = 0; } // rooted, but a swing or charge carries on
  emit(state, 'status', { playerId: target.id, status: id, x: target.x, y: target.y });
  return true;
}
function knockOut(state, attacker, target) {
  target.alive = false; target.hp = 0; target.deaths++; target.respawnTicks = respawnDelay(state, target);
  target.cloakTicks = target.dashTicks = 0; target.boosting = false; target.guarding = false; target.catalysts = 0;
  for (const id of STATUS_IDS) target.status[id] = 0;
  target.chillStacks = 0;
  // A knockout drops a heart, plus every heart the knight was carrying, scattered around them.
  const carried = (target.hearts || []).reduce((sum, count) => sum + count, 0);
  for (let i = 0; i <= carried; i++) {
    const angle = i * 2.4, spread = i ? 26 : 0, map = MAPS[state.mapId], x = target.x + Math.cos(angle) * spread, y = target.y + Math.sin(angle) * spread;
    const spot = collides(map, x, y, 6) ? target : { x, y };
    state.pickups.push({ id: state.nextId++, kind: 'heart', x: spot.x, y: spot.y, ttl: RULES.heart.ttlTicks });
  }
  target.hearts = Array(SLOT_COUNT).fill(0);
  emit(state, 'heartDrop', { x: target.x, y: target.y, count: carried + 1 });
  if (attacker && attacker.team !== target.team) attacker.kills++;
  emit(state, 'kill', { playerId: attacker?.id ?? null, targetId: target.id, x: target.x, y: target.y, respawnTicks: target.respawnTicks });
}
/** Every hit goes through here: spawn protection, domes, shields, poison, marks, statuses, knockback. */
function damage(state, attacker, target, amount, { push = 0, angle = 0, stun = 10, kind = 'hit', damageFamily = null, source = null, status = null, chance = 1, stacks = 1, build = 0, hitStop = 0, weapon = null, reel = false } = {}) {
  if (!target.alive || target.team === attacker?.team || target.shieldTicks > 0) return false;
  if (inBase(state, target) || attacker && inBase(state, attacker)) return false; // nobody fights across a base barrier
  // A Striker mid-dodge is untouchable.
  if (target.evadeTicks > 0) {
    emit(state, 'evade', { playerId: target.id, x: target.x, y: target.y });
    // Perfect dodge: slipping a real attack refunds most of the dash and readies a riposte.
    if (attacker && !STATUS_TICKS.has(kind) && !target.perfectUsed) {
      const rule = FIGHT.perfect;
      target.perfectUsed = true; target.riposteTicks = rule.window; target.dashCooldown = Math.round(target.dashCooldown * (1 - rule.dashRefund));
      emit(state, 'perfectDodge', { playerId: target.id, attackerId: attacker.id, x: target.x, y: target.y });
    }
    return false;
  }
  // A Guardian dome soaks hits that come from outside it.
  const dome = inAlliedBubble(state, target), origin = source || attacker;
  if (dome && origin && dist(dome, origin) > GUARD.radius) { hitGuard(state, dome, amount, kind, attacker, 0, angle, 0); return false; }
  // A raised shield takes the hit (bombs hit it harder) and only a little knockback gets through.
  if (guardUp(target)) { hitGuard(state, target, amount, kind, attacker, push, angle, hitStop); return false; }
  let total = amount * (attacker?.status.poison > 0 ? STATUS.poison.damageScale : 1) * (target.markTicks > 0 ? 1 + ABILITIES.cloak.markBonus : 1);
  // Armor protects health, never the dome or raised shield. Weapon family follows
  // the source through waves, bursts and shards; status ticks have no family.
  const armor = outfitOf(target);
  const resistance = damageFamily === 'gun' ? armor.gunResistance : damageFamily === 'blade' ? armor.bladeResistance : damageFamily === 'bomb' ? armor.bombResistance : 0;
  total *= 1 - resistance;
  if (attacker && attacker.markReady > 0 && attacker.cls === 'recon') {
    // Ambush: the first hit out of the cloak lands double and marks the target for the team.
    total *= ABILITIES.cloak.ambush; target.markTicks = ABILITIES.cloak.markTicks; attacker.markReady = 0;
    emit(state, 'ambush', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y });
    emit(state, 'mark', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y });
  }
  const direct = attacker && !STATUS_TICKS.has(kind);
  // Punish: catching a knight still recovering from a whiffed cut. Counter: catching one otherwise committed
  // (winding up, recovering from a charge move, holding a half charge). Both land harder and stun longer.
  if (direct && target.action === 'swing' && target.whiffed) {
    total *= FIGHT.punish.damage; stun = Math.round(stun * FIGHT.punish.stun);
    emit(state, 'punish', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y });
  } else if (direct && exposed(target)) {
    total *= FIGHT.counter.damage; stun = Math.round(stun * FIGHT.counter.stun);
    emit(state, 'counter', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y });
  } else if (direct && attacker.feintTicks > 0 && target.lastDashTick >= attacker.feintFrom) {
    // They bit: dashed away from a charge that was never coming, and the real attack catches them.
    total *= FIGHT.feint.damage; stun = Math.round(stun * FIGHT.feint.stun); attacker.feintTicks = 0;
    emit(state, 'feinted', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y });
  }
  // Riposte: the first hit after a perfect dodge.
  if (direct && attacker.riposteTicks > 0) {
    total *= FIGHT.perfect.damage; attacker.riposteTicks = 0;
    emit(state, 'riposte', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y });
  }
  // Follow-up: a different weapon catching a knight that a sweeping cut left reeling.
  // A sword follow-up uses the reel up; a gun's shots all land harder while it lasts.
  if (direct && target.reelTicks > 0 && weapon && weapon !== target.reelWeapon) {
    const gun = WEAPONS[weapon]?.family === 'gun', heavy = !!WEAPONS[weapon]?.heavy;
    total *= gun ? FIGHT.reel.gun : heavy ? FIGHT.reel.heavy : FIGHT.reel.followUp;
    if (!gun) target.reelTicks = 0;
    if (!gun || !target.reelShot) emit(state, 'followUp', { playerId: attacker.id, targetId: target.id, weapon, heavy, gun, x: target.x, y: target.y });
    if (gun) target.reelShot = true;
  }
  total = Math.max(1, Math.round(total));
  // Heavy weapons are unflinching mid-swing, and so is every charge move: a hit hurts but neither
  // stuns nor shoves you off the attack.
  const unflinching = (target.action === 'swing' || target.action === 'slam') && isHeavy(target) || CHARGE_MOVES.has(target.action) && !inRecovery(target);
  if (unflinching) { stun = 0; push *= .35; emit(state, 'unflinching', { playerId: target.id, x: target.x, y: target.y }); }
  // Stagger: stun piles up; past the limit the knight steadies and shrugs off stun for a moment.
  if (target.steadyTicks > 0) stun = 0;
  else if (stun > 0) {
    target.stagger += stun;
    if (target.stagger >= FIGHT.stagger.limit) { target.stagger = 0; target.steadyTicks = stun + FIGHT.stagger.steadyTicks; emit(state, 'steady', { playerId: target.id, x: target.x, y: target.y }); }
  }
  // Shatter: a sword or bomb hit breaks a frozen knight's ice and lands harder; bullets leave the ice whole.
  const shatters = target.status.freeze > 0 && (damageFamily === 'blade' || damageFamily === 'bomb');
  if (shatters) total *= STATUS.freeze.shatter;
  target.hp -= total; target.stunTicks = Math.max(target.stunTicks, stun);
  if (reel && !unflinching && target.hp > 0) { target.reelTicks = FIGHT.reel.ticks; target.reelWeapon = weapon; target.reelShot = false; emit(state, 'reel', { playerId: attacker?.id ?? null, targetId: target.id, x: target.x, y: target.y }); }
  if (stun > 0) interrupt(state, target, 'hit');
  const shove = push * outfitOf(target).knockback;
  target.pushX = Math.cos(angle) * shove; target.pushY = Math.sin(angle) * shove; target.lastHurtTick = state.tick;
  if (shatters) { target.status.freeze = 0; target.freezeImmune = STATUS.freeze.immuneTicks; emit(state, 'shatter', { playerId: attacker?.id ?? null, targetId: target.id, x: target.x, y: target.y }); emit(state, 'thaw', { playerId: target.id }); }
  if (target.cloakTicks > 0) { target.cloakTicks = 0; emit(state, 'uncloak', { playerId: target.id }); }
  if (target.charging && currentWeapon(target).family !== 'bomb') { target.charging = false; target.chargeTicks = 0; } // a bomb charge holds
  if (hitStop) { target.hitStop = Math.max(target.hitStop, hitStop); if (attacker) attacker.hitStop = Math.max(attacker.hitStop, hitStop); }
  if (attacker) attacker.damage += total;
  // A Striker's sword hit fuels the Boost (hit and run).
  if (direct && attacker.cls === 'striker' && damageFamily === 'blade') {
    const rule = ABILITIES.dash;
    attacker.boostMeter = Math.min(rule.meter, attacker.boostMeter + rule.hitRefill);
    if (attacker.boostLocked && attacker.boostMeter >= rule.meter * rule.relock) attacker.boostLocked = false;
  }
  emit(state, 'damage', { playerId: attacker?.id ?? null, targetId: target.id, amount: total, kind, x: target.x, y: target.y, hp: Math.max(0, target.hp) });
  // Elemental build-up: this hit fills the target's meter; a full one sets the effect off for sure.
  const proc = status && build > 0 ? buildUp(state, attacker, target, status, build) : false;
  weaponSpecials(state, attacker, target, total, WEAPONS[weapon], damageFamily, proc && status === 'shock');
  if (target.hp <= 0) { knockOut(state, attacker, target); return true; }
  if (status && !build) applyStatus(state, target, status, attacker?.id ?? null, chance, stacks);
  else if (proc && status === 'mark') { target.markTicks = Math.max(target.markTicks, BUILD.markTicks); emit(state, 'judged', { playerId: attacker?.id ?? null, targetId: target.id, x: target.x, y: target.y }); }
  else if (proc) applyStatus(state, target, status, attacker?.id ?? null, 1, stacks);
  return true;
}
/** Fill a target's build-up meter for an element; true when it fills (and empties again). */
function buildUp(state, attacker, target, id, amount) {
  if (guardUp(target) || inAlliedBubble(state, target)) return false;
  const meters = target.buildup ||= {}, meter = meters[id] && state.tick - meters[id].at <= BUILD.decayTicks ? meters[id] : { value: 0, at: 0 };
  meter.value += amount; meter.at = state.tick; meters[id] = meter;
  if (meter.value < BUILD.full) { emit(state, 'buildup', { playerId: attacker?.id ?? null, targetId: target.id, status: id, value: meter.value }); return false; }
  meter.value = 0; return true;
}
/** What a weapon does on top of its damage: draining swords heal the wielder, shock weapons
 * arc lightning to other enemies near the one they hit (arcs never arc again). */
function weaponSpecials(state, attacker, target, dealt, weapon, damageFamily, shocked = false) {
  if (!weapon || !attacker) return;
  if (weapon.lifesteal) { const gained = heal(attacker, dealt * weapon.lifesteal); if (gained > 0) emit(state, 'drain', { playerId: attacker.id, targetId: target.id, amount: gained, x: attacker.x, y: attacker.y }); }
  // A shock that goes off arcs to the nearest other enemies, shocking them too.
  const chain = weapon.chain;
  if (chain && shocked) {
    const map = MAPS[state.mapId];
    const others = state.players.filter(other => other.alive && other !== target && other.team !== attacker.team && dist(other, target) <= chain.radius && lineOfSight(map, target, other))
      .sort((a, b) => dist(a, target) - dist(b, target)).slice(0, chain.count);
    for (const other of others) {
      emit(state, 'chain', { playerId: attacker.id, fromX: target.x, fromY: target.y, toX: other.x, toY: other.y, targetId: other.id });
      damage(state, attacker, other, chain.damage * (damageFamily === 'gun' ? gunPower(attacker) : bladePower(attacker)), { stun: 6, kind: 'chain', damageFamily, source: target, status: chain.status, chance: 1 });
    }
  }
}
/** Damage soaked by a Guardian's shield: swords chew through it, bombs hit it hardest; breaking it stuns. */
function hitGuard(state, guard, amount, kind, attacker, push, angle, hitStop) {
  const load = amount * (kind === 'bomb' ? GUARD.bombScale : BLADE_KINDS.has(kind) ? GUARD.bladeScale : 1);
  guard.guardDelay = GUARD.regenDelay;
  if (domeUp(guard)) {
    // The dome takes it first; when it breaks, only the Guardian's own shield is left.
    guard.domeHp -= load;
    emit(state, 'domeHit', { playerId: guard.id, attackerId: attacker?.id ?? null, x: guard.x, y: guard.y, hp: Math.max(0, guard.domeHp) });
    if (guard.domeHp <= 0) { guard.domeHp = 0; guard.domeBroken = true; emit(state, 'domeBreak', { playerId: guard.id, x: guard.x, y: guard.y }); }
    if (attacker && hitStop) attacker.hitStop = Math.max(attacker.hitStop, hitStop);
    return;
  }
  if (kind === 'blade' && attacker && guard.guardRaise <= GUARD.raiseTicks + FIGHT.parry.window) {
    // Parry: the shield came up just in time. It takes nothing; the cut is turned aside and its swinger left open.
    interrupt(state, attacker, 'parry');
    attacker.stunTicks = Math.max(attacker.stunTicks, FIGHT.parry.stun); attacker.parriedTicks = FIGHT.parry.exposed;
    emit(state, 'parry', { playerId: guard.id, targetId: attacker.id, x: guard.x, y: guard.y });
    return;
  }
  guard.guardHp -= load;
  guard.pushX = Math.cos(angle) * push * GUARD.knockback; guard.pushY = Math.sin(angle) * push * GUARD.knockback;
  if (attacker && hitStop) attacker.hitStop = Math.max(attacker.hitStop, hitStop);
  emit(state, 'block', { playerId: guard.id, attackerId: attacker?.id ?? null, x: guard.x, y: guard.y, hp: Math.max(0, guard.guardHp) });
  if (guard.guardHp <= 0) {
    Object.assign(guard, { guardHp: 0, guarding: false, guardRaise: 0, guardBroken: true, stunTicks: GUARD.breakStun });
    emit(state, 'guardBreak', { playerId: guard.id, x: guard.x, y: guard.y });
  }
}
function breakCloak(state, player) {
  if (player.cloakTicks > 0) { player.cloakTicks = 0; player.markReady = ABILITIES.cloak.ambushTicks; emit(state, 'uncloak', { playerId: player.id }); }
}
function tickStatus(state, player) {
  const status = player.status;
  player.freezeImmune = Math.max(0, player.freezeImmune - 1);
  for (const id of STATUS_IDS) {
    if (!(status[id] > 0)) continue;
    const owner = state.players[player.statusOwner[id]] || null, elapsed = Math.round(STATUS[id].ticks * outfitOf(player).statusDuration) - status[id];
    if (id === 'burn' && elapsed > 0 && elapsed % STATUS.burn.every === 0) damage(state, owner, player, STATUS.burn.damage, { stun: 0, kind: 'burn' });
    if (id === 'shock' && elapsed > 0 && elapsed % STATUS.shock.every === 0) damage(state, owner, player, STATUS.shock.damage, { stun: STATUS.shock.stun, kind: 'shock' });
    if (!player.alive) return;
    if (--status[id] === 0) { if (id === 'freeze') player.freezeImmune = STATUS.freeze.immuneTicks; if (id === 'chill') player.chillStacks = 0; emit(state, 'statusEnd', { playerId: player.id, status: id }); }
  }
}
/** The Guardian's shield (hold the class ability). It blocks everything at once; after
 * GUARD.expandTicks it grows into a dome that also shields and heals teammates inside. */
function tickGuard(state, player, input) {
  if (player.cls !== 'guardian') { player.guarding = false; return; }
  const max = guardMax(player), held = input.ability;
  if (player.guardBroken && player.guardHp >= max * GUARD.recover) player.guardBroken = false;
  if (player.domeBroken && player.domeHp >= GUARD.domeMax * GUARD.domeRecover) player.domeBroken = false;
  // Shield cancel: raising the shield cuts a sword's recovery short.
  if (held && !player.guarding && !player.guardBroken && canCancel(player)) cancelRecovery(state, player, 'guard');
  const wants = held && !player.guardBroken && player.stunTicks === 0 && !(player.status.freeze > 0) && !(player.status.curse > 0) && player.actionTicks === 0;
  if (wants && !player.guarding) { player.guarding = true; player.guardRaise = 0; player.charging = false; player.chargeTicks = 0; player.bufferAttack = false; emit(state, 'guardUp', { playerId: player.id, x: player.x, y: player.y }); }
  if (!wants) player.guarding = false;
  if (player.guarding) {
    if (++player.guardRaise === GUARD.expandTicks && domeUp(player)) emit(state, 'dome', { playerId: player.id, x: player.x, y: player.y, radius: GUARD.radius });
    player.guardDelay = GUARD.regenDelay;
    if (domeUp(player)) for (const ally of state.players) if (ally.alive && ally.team === player.team && dist(ally, player) <= GUARD.radius) heal(ally, GUARD.healPerSecond / TICK_RATE);
  }
  else if (player.guardDelay > 0) player.guardDelay--;
  else {
    const pace = outfitOf(player).abilityCooldown * TICK_RATE;
    player.guardHp = Math.min(max, player.guardHp + GUARD.regenPerSecond / pace);
    player.domeHp = Math.min(GUARD.domeMax, (player.domeHp ?? GUARD.domeMax) + GUARD.domeRegenPerSecond / pace);
  }
}

// ---------- weapons ----------
/** Empty and heart slots hold no weapon: open hands (a heart slot heals on click instead). */
const HANDS = Object.freeze({ id: 'hands', family: 'none', name: 'Empty hands', chargeTicks: Infinity });
function currentWeapon(player) { return WEAPONS[player.weapons[player.slot]] || HANDS; }
/** Eat a heart from the selected slot: heals like a dropped heart, then a short pause. */
function useHeart(state, player) {
  if (!(player.hearts[player.slot] > 0) || player.heartUse > 0 || player.hp >= player.maxHp) return;
  if (!canHeal(player)) { emit(state, 'heartBlocked', { playerId: player.id, x: player.x, y: player.y }); return; }
  const amount = heal(player, RULES.heart.heal);
  player.hearts[player.slot]--; player.heartUse = RULES.heart.useTicks;
  emit(state, 'heartUse', { playerId: player.id, x: player.x, y: player.y, amount: Math.round(amount), left: player.hearts[player.slot] });
}
const targetsOf = (state, player) => state.players.filter(target => target.alive && target.team !== player.team);
/** Blade contact: anyone in reach whose bearing lies inside [from, to] of the swept arc (plus their body width). */
function bladeContacts(state, player, reach, from, to, amount, options) {
  const map = MAPS[state.mapId], low = Math.min(from, to), high = Math.max(from, to);
  for (const target of targetsOf(state, player)) {
    if (player.hitIds.includes(target.id)) continue;
    const d = dist(player, target); if (d > reach + RULES.radius) continue;
    const pad = Math.atan2(RULES.radius, Math.max(1, d)), bearing = player.swingAim + wrapAngle(Math.atan2(target.y - player.y, target.x - player.x) - player.swingAim);
    if (high - low < Math.PI * 2 - 1e-6 && (bearing < low - pad || bearing > high + pad)) continue;
    if (!sameFloor(map, player, target) || !lineOfSight(map, player, target)) continue;
    // Their cut is sweeping through us at the same moment: the blades meet instead of the bodies.
    if (options.kind === 'blade' && cutsInto(state, target, player)) {
      const result = clash(state, player, target);
      if (result !== 'attacker') return; // our cut was knocked aside
    }
    player.hitIds.push(target.id);
    // Precise blades reward spacing: the tip of the reach (the sweet spot) hits harder.
    const { sweetSpot, ...rest } = options;
    const tip = sweetSpot && d >= reach * sweetSpot.from;
    if (tip) emit(state, 'sweetSpot', { playerId: player.id, targetId: target.id, x: target.x, y: target.y });
    // Aim: how far off the middle of the cut the target stood, as a share of the half-arc.
    let aimed = 1, grazed = false;
    if (options.kind === 'blade') {
      player.swingHits = (player.swingHits || 0) + 1;
      const share = Math.abs(bearing - player.swingAim) / (player.swingArc / 2 + pad);
      grazed = share > BLADE.graze.beyond;
      const sharp = WEAPONS[options.weapon]?.aim; // the katana rewards and punishes aim harder
      if (share <= BLADE.clean.within) { aimed = sharp?.clean ?? 1; emit(state, 'clean', { playerId: player.id, targetId: target.id, x: target.x, y: target.y }); }
      else if (share > BLADE.graze.beyond) { aimed = sharp?.graze ?? BLADE.graze.damage; emit(state, 'graze', { playerId: player.id, targetId: target.id, x: target.x, y: target.y }); }
      else aimed = BLADE.offCentre;
    }
    // A perfect combo: the finisher lands on the knight every cut before it landed on, all of them solid.
    const chain = options.kind === 'blade' ? player.chain : null;
    let combo = 1;
    // The katana's and the elemental swords' finisher is a critical only then; otherwise it lands as a plain cut.
    if (chain && player.swingFinisher) {
      const perfect = !grazed && chain.target === target.id && chain.count === player.comboStep;
      if (perfect && player.swingCritical) emit(state, 'critical', { playerId: player.id, targetId: target.id, x: target.x, y: target.y });
      else if (perfect) { combo = 1 + BLADE.combo.perCut * player.comboStep; emit(state, 'combo', { playerId: player.id, targetId: target.id, x: target.x, y: target.y, hits: player.comboStep + 1, bonus: combo }); }
      else if (player.swingCritical) combo = 1 / CRITICAL;
    }
    const landed = damage(state, player, target, (tip ? amount * sweetSpot.bonus : amount) * aimed * combo, { angle: Math.atan2(target.y - player.y, target.x - player.x), damageFamily: 'blade', ...rest });
    // Each solid cut on the same knight extends the chain once; anything else leaves it short.
    if (chain && landed && !grazed && chain.counted !== player.swingId && (chain.target < 0 || chain.target === target.id) && chain.count === player.comboStep) Object.assign(chain, { target: target.id, count: chain.count + 1, counted: player.swingId });
  }
}
function radialHit(state, owner, team, center, radius, amount, options = {}) {
  const map = MAPS[state.mapId];
  // A blade's slam or burst stays on the swinger's floor, like its cuts; a blast carries over a ledge.
  const level = options.damageFamily === 'blade' ? levelAt(map, (owner || center).x, (owner || center).y) : null;
  const caught = state.players.filter(target => target.alive && target.team !== team && dist(target, center) <= radius + RULES.radius && lineOfSight(map, center, target)
    && (level === null || Math.abs(levelAt(map, target.x, target.y) - level) <= .5));
  // A bomb that catches several knights hits each of them harder.
  let crowd = 1;
  if (options.kind === 'bomb' && caught.length > 1) {
    crowd = 1 + Math.min(BOMB.crowdMax, BOMB.crowd * (caught.length - 1));
    emit(state, 'multiBlast', { playerId: owner?.id ?? null, x: center.x, y: center.y, hits: caught.length });
  }
  for (const target of caught) damage(state, owner, target, amount * crowd, { angle: Math.atan2(target.y - center.y, target.x - center.x), source: center, ...options });
}
function spawnShot(state, player, weapon, spec, angle) {
  const speed = spec.speed, size = spec.size || 5;
  const power = weapon.family === 'gun' ? gunPower(player) : 1;
  state.projectiles.push({
    id: state.nextId++, ownerId: player.id, team: player.team, weapon: weapon.id, damageFamily: weapon.family, kind: spec.kind || weapon.kind || 'bullet',
    x: player.x + Math.cos(angle) * (RULES.radius + 4), y: player.y + Math.sin(angle) * (RULES.radius + 4), z: levelAt(MAPS[state.mapId], player.x, player.y),
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size, grow: (spec.grow || 0) / Math.max(1, Math.ceil(spec.range / speed * TICK_RATE)),
    damage: spec.damage * power, push: spec.push ?? 0, ttl: Math.ceil(spec.range / speed * TICK_RATE), pierce: !!spec.pierce, bounces: spec.bounces || 0,
    status: spec.status || null, chance: spec.chance ?? 1, stacks: spec.stacks || 1, build: spec === weapon ? weapon.build || 0 : 0, radius: spec.radius || 0, carry: spec.kind === 'wave', hitIds: [],
    longShot: spec.longShot || (spec === weapon ? weapon.longShot : null) || null, ox: player.x, oy: player.y, range: spec.range,
    perCharge: (spec.perCharge || 0) * power, pushPerCharge: spec.pushPerCharge || 0,
  });
}
function fireVolley(state, player, weapon, spec, count = 1, spread = spec.spread ?? weapon.spread ?? 0, charged = false) {
  for (let i = 0; i < count; i++) {
    const offset = count > 1 ? (i / (count - 1) - .5) * spread : (random(state) - .5) * spread * 2;
    spawnShot(state, player, weapon, spec, player.aim + offset);
  }
  emit(state, 'shot', { playerId: player.id, weapon: weapon.id, charged, x: player.x, y: player.y, angle: player.aim });
}
function plantBomb(state, player, weapon) {
  state.bombs.push({ id: state.nextId++, ownerId: player.id, team: player.team, weapon: weapon.id, x: player.x, y: player.y, fuse: weapon.fuse, total: weapon.fuse, phase: 'fuse', pullTicks: 0 });
  emit(state, 'bombPlant', { playerId: player.id, weapon: weapon.id, x: player.x, y: player.y });
}
function explode(state, bomb) {
  const weapon = WEAPONS[bomb.weapon], owner = state.players[bomb.ownerId];
  emit(state, 'explosion', { playerId: bomb.ownerId, weapon: bomb.weapon, x: bomb.x, y: bomb.y, radius: weapon.cloud ? weapon.cloud.radius : weapon.radius });
  // Zone breaker: a bomb on a zone knocks the other team's hold on it (or their capture under way) back.
  for (const point of state.points) {
    if (dist(point, bomb) > RULES.pointRadius) continue;
    const theirs = bomb.team === 0 ? -1 : 1; // the sign of the other team's progress
    if (Math.sign(point.progress) !== theirs) continue;
    point.progress = theirs > 0 ? Math.max(0, point.progress - BOMB.zoneBreak) : Math.min(0, point.progress + BOMB.zoneBreak);
    emit(state, 'zoneBreak', { playerId: bomb.ownerId, pointId: point.id, x: point.x, y: point.y, progress: point.progress });
    if (point.progress === 0 && point.owner === 1 - bomb.team) { point.owner = null; emit(state, 'pointNeutral', { pointId: point.id, team: bomb.team }); }
  }
  if (weapon.cloud) { state.clouds.push({ id: state.nextId++, ownerId: bomb.ownerId, team: bomb.team, weapon: weapon.id, x: bomb.x, y: bomb.y, radius: weapon.cloud.radius, ticks: weapon.cloud.ticks, total: weapon.cloud.ticks, status: weapon.cloud.status }); return; }
  if (weapon.radius) radialHit(state, owner, bomb.team, bomb, weapon.radius, weapon.damage * bombPower(owner), { push: weapon.push, stun: weapon.stun ?? 20, kind: 'bomb', damageFamily: 'bomb', status: weapon.status, chance: weapon.chance });
  if (weapon.shards) {
    const shards = weapon.shards;
    for (let i = 0; i < shards.count; i++) {
      const angle = i / shards.count * Math.PI * 2;
      state.projectiles.push({ id: state.nextId++, ownerId: bomb.ownerId, team: bomb.team, weapon: bomb.weapon, damageFamily: 'bomb', kind: 'shard', x: bomb.x, y: bomb.y, vx: Math.cos(angle) * shards.speed, vy: Math.sin(angle) * shards.speed,
        size: shards.size, grow: 0, damage: shards.damage * bombPower(owner), push: shards.push, ttl: Math.ceil(shards.range / shards.speed * TICK_RATE), pierce: false, bounces: 0, status: null, chance: 1, radius: 0, carry: false, hitIds: [], perCharge: 0, pushPerCharge: 0 });
    }
  }
}

/** Start a blade combo step: lock the swing direction, alternate sides, step forward. */
function startSwing(state, player, weapon) {
  const move = weapon.combo[player.comboStep];
  breakCloak(state, player);
  const finisher = weapon.combo.length > 1 && player.comboStep === weapon.combo.length - 1;
  // The blade moves like a real one: an opener starts from the sword side (right), and a sweep, rising cut or
  // spin sets off from wherever the last cut left the blade, back the other way (dir -1 runs right to left).
  // Chops and thrusts come down or out in front and leave the blade back on the sword side.
  const kind = move.kind || 'sweep', side = player.comboStep === 0 ? 1 : player.bladeSide ?? 1;
  const dir = MOVE_KINDS[kind].straight ? -1 : side < 0 ? 1 : -1;
  player.bladeSide = MOVE_KINDS[kind].returns ? -dir : MOVE_KINDS[kind].alternates ? dir : 1;
  if (player.comboStep === 0) player.chain = { target: -1, count: 0, counted: 0 }; // a fresh string
  const speed = bladeSpeed(player), startup = Math.max(2, Math.round(move.startup / speed)), active = Math.max(2, Math.round(move.active / speed)), recovery = Math.max(2, Math.round(move.recovery / speed * (finisher ? BLADE.finisherRecovery : 1)));
  Object.assign(player, { action: 'swing', actionTotal: startup + active + recovery, actionTicks: startup + active + recovery, hitIds: [], swingHits: 0, bufferAttack: false, whiffed: false,
    swingAim: player.aim, swingDir: dir, swingKind: kind, swingId: (player.swingId || 0) + 1, swingReach: move.reach, swingArc: move.arc,
    swingStartup: startup, swingActive: active, swingRecovery: recovery, swingDamage: move.damage * bladePower(player), swingMomentum: !!move.momentum, swingCritical: !!move.critical, swingFinisher: finisher });
  emit(state, 'swing', { playerId: player.id, weapon: weapon.id, step: player.comboStep, x: player.x, y: player.y, angle: player.aim, dir: player.swingDir, kind, arc: move.arc, reach: move.reach, startup, active, strokes: move.strokes || 1, momentum: !!move.momentum, critical: !!move.critical });
}
function startCharge(state, player, weapon) {
  const charge = weapon.charge;
  breakCloak(state, player); player.hitIds = []; player.swingAim = player.aim; player.bufferAttack = false;
  emit(state, 'chargeRelease', { playerId: player.id, weapon: weapon.id, kind: weapon.family === 'bomb' ? 'bomb' : charge.kind, x: player.x, y: player.y, angle: player.aim });
  if (weapon.family === 'bomb') { plantBomb(state, player, weapon); return; }
  if (weapon.family === 'gun') {
    if (charge.kind === 'stream') player.burst = { weapon: weapon.id, remaining: charge.count, timer: 0 };
    else if (charge.kind === 'split') fireVolley(state, player, weapon, charge, charge.count, charge.spread, true);
    else fireVolley(state, player, weapon, charge, 1, 0, true);
    player.clips[weapon.id] = weapon.clip; player.reloadTicks[weapon.id] = 0; player.fireCooldown = weapon.interval * 2; player.sinceShot[weapon.id] = 0;
    return;
  }
  const kind = charge.kind;
  if (kind === 'thorns') { fireVolley(state, player, weapon, { ...charge, kind: 'thorn', damage: charge.damage * bladePower(player) }, charge.count, charge.spread, true); Object.assign(player, { action: 'cast', actionTicks: charge.recovery, actionTotal: charge.recovery }); return; }
  if (kind === 'wave' || kind === 'beam') { spawnShot(state, player, weapon, { ...charge, damage: charge.damage * bladePower(player) }, player.aim); emit(state, 'shot', { playerId: player.id, weapon: weapon.id, charged: true, x: player.x, y: player.y, angle: player.aim }); Object.assign(player, { action: 'cast', actionTicks: charge.recovery, actionTotal: charge.recovery }); return; }
  const ticks = kind === 'spin' ? charge.turns * charge.ticksPerTurn : charge.ticks;
  Object.assign(player, { action: kind, actionTicks: ticks + charge.recovery, actionTotal: ticks + charge.recovery, chargeMoveTicks: ticks });
}
/** One tick of a committed action. Returns nothing; ends the action when its timer runs out. */
function tickAction(state, player, weapon) {
  const map = MAPS[state.mapId], elapsed = player.actionTotal - player.actionTicks;
  if (player.action === 'swing') {
    const move = weapon.combo[player.comboStep], startup = player.swingStartup, active = player.swingActive;
    if (elapsed < startup && !(player.status.freeze > 0)) moveBody(map, player, Math.cos(player.swingAim) * move.lunge / startup, Math.sin(player.swingAim) * move.lunge / startup); // no step forward out of the ice
    else if (elapsed < startup + active) {
      // The blade sweeps from one side of the arc to the other across the active ticks. A flurry sweeps across
      // and straight back, each stroke able to hit the same knight once.
      const start = player.swingAim - player.swingDir * move.arc / 2, k = elapsed - startup, half = (move.strokes || 1) > 1 ? Math.ceil(active / 2) : active;
      if (k === half && half < active) player.hitIds = [];
      const [from, to] = k < half ? [start, start + player.swingDir * move.arc * (k + 1) / half] : [start + player.swingDir * move.arc, start + player.swingDir * move.arc * (1 - (k - half + 1) / (active - half))];
      bladeContacts(state, player, move.reach, from, to, player.swingDamage, { push: move.push, stun: player.swingFinisher || move.critical || move.momentum ? move.stun : Math.round(move.stun * BLADE.chainStun), kind: 'blade', hitStop: move.critical ? BLADE.hitStop * 2 : BLADE.hitStop, weapon: weapon.id, status: weapon.onHit?.status, chance: weapon.onHit?.chance, build: weapon.onHit?.build || 0, sweetSpot: weapon.sweetSpot, reel: !!CUTS[weapon.cut]?.reel });
      // A heavy blow that shakes the ground sends a shockwave around the impact on its first active tick.
      if (move.shockwave && elapsed === startup) {
        const wave = move.shockwave, center = { x: player.x + Math.cos(player.swingAim) * wave.offset, y: player.y + Math.sin(player.swingAim) * wave.offset };
        emit(state, 'slam', { playerId: player.id, weapon: weapon.id, x: center.x, y: center.y, radius: wave.radius });
        radialHit(state, player, player.team, center, wave.radius, player.swingDamage * wave.scale, { push: move.push * .6, stun: Math.round(move.stun * .6), kind: 'slam', damageFamily: 'blade' });
      }
    } else if (elapsed === startup + active && !player.hitIds.length && !player.swingHits && !player.whiffed) {
      // A whiff: nothing was hit. The recovery stretches, the queued press is dropped and the combo breaks.
      const extra = Math.max(BLADE.whiffMin, Math.round(player.swingRecovery * BLADE.whiffRecovery)) * (player.swingMomentum ? BLADE.momentumWhiff : 1);
      Object.assign(player, { whiffed: true, bufferAttack: false, actionTicks: player.actionTicks + extra, actionTotal: player.actionTotal + extra, swingRecovery: player.swingRecovery + extra });
      emit(state, 'whiff', { playerId: player.id, x: player.x, y: player.y });
    } else if (player.bufferAttack && !player.whiffed && player.comboStep < weapon.combo.length - 1 && elapsed >= startup + active + Math.ceil(player.swingRecovery * BLADE.comboCancel)) {
      // Combo cancel: a queued press cuts the recovery short and goes straight into the next cut.
      player.comboStep++; player.action = 'idle'; player.actionTicks = 0; startSwing(state, player, weapon);
      return;
    }
  } else if (player.action === 'lunge' || player.action === 'lungeBurst') {
    const charge = weapon.charge;
    if (elapsed < player.chargeMoveTicks) {
      moveBody(map, player, Math.cos(player.swingAim) * charge.distance / charge.ticks, Math.sin(player.swingAim) * charge.distance / charge.ticks);
      bladeContacts(state, player, charge.reach, player.swingAim - charge.arc / 2, player.swingAim + charge.arc / 2, charge.damage * bladePower(player), { push: charge.push, stun: charge.stun, kind: 'lunge', hitStop: 3, weapon: weapon.id, status: charge.status, chance: charge.chance });
    }
    if (elapsed === player.chargeMoveTicks - 1 && charge.burst) {
      const center = { x: player.x + Math.cos(player.swingAim) * 24, y: player.y + Math.sin(player.swingAim) * 24 };
      emit(state, 'explosion', { playerId: player.id, weapon: weapon.id, x: center.x, y: center.y, radius: charge.burst.radius, burst: true });
      radialHit(state, player, player.team, center, charge.burst.radius, charge.burst.damage * bladePower(player), { push: charge.burst.push, stun: 18, kind: 'burst', damageFamily: 'blade', status: charge.burst.status, chance: charge.burst.chance });
    }
  } else if (player.action === 'slam') {
    const charge = weapon.charge;
    if (elapsed < player.chargeMoveTicks - 8) moveBody(map, player, Math.cos(player.swingAim) * charge.distance / (player.chargeMoveTicks - 8), Math.sin(player.swingAim) * charge.distance / (player.chargeMoveTicks - 8));
    if (elapsed === player.chargeMoveTicks - 1) {
      const center = { x: player.x + Math.cos(player.swingAim) * charge.offset, y: player.y + Math.sin(player.swingAim) * charge.offset };
      emit(state, 'slam', { playerId: player.id, weapon: weapon.id, x: center.x, y: center.y, radius: charge.radius });
      radialHit(state, player, player.team, center, charge.radius, charge.damage * bladePower(player), { push: charge.push, stun: charge.stun, kind: 'slam', damageFamily: 'blade', hitStop: 5, weapon: weapon.id, status: charge.status, chance: charge.chance });
    }
  } else if (player.action === 'spin') {
    const charge = weapon.charge;
    if (elapsed < player.chargeMoveTicks) {
      const turn = Math.floor(elapsed / charge.ticksPerTurn), within = elapsed % charge.ticksPerTurn;
      if (within === 0) { player.hitIds = []; emit(state, 'spinTurn', { playerId: player.id, x: player.x, y: player.y, reach: charge.reach, turn }); }
      const from = player.swingAim + within / charge.ticksPerTurn * Math.PI * 2, to = player.swingAim + (within + 1) / charge.ticksPerTurn * Math.PI * 2;
      bladeContacts(state, player, charge.reach, from, to, charge.damage * bladePower(player), { push: charge.push, stun: charge.stun, kind: 'spin', hitStop: 2, weapon: weapon.id, status: charge.status, chance: charge.chance });
    }
  }
  if (--player.actionTicks === 0) {
    const wasSwing = player.action === 'swing';
    player.action = 'idle';
    if (wasSwing) {
      if (player.whiffed) { player.comboStep = 0; player.comboWindow = 0; player.whiffed = false; player.bufferAttack = false; }
      else { player.comboStep = (player.comboStep + 1) % weapon.combo.length; player.comboWindow = BLADE.comboWindow; }
      if (player.bufferAttack) startSwing(state, player, weapon); // a well-timed press chains straight into the next cut
    }
  }
}

/** A press during a cut queues the next one, as in Spiral Knights: press rapidly and the combo flows, but only
 * while the cuts land. A whiff drops the queued press and breaks the combo. */
function queueCut(state, player) {
  if (!player.whiffed) player.bufferAttack = true;
}
function tickWeapon(state, player, input, previous) {
  const weapon = currentWeapon(player), pressed = input.attack && !previous.attack;
  player.fireCooldown = Math.max(0, player.fireCooldown - 1);
  if (player.bloom > 0) player.bloom = Math.max(0, player.bloom - BLOOM.settlePerSecond / TICK_RATE);
  // Guns reload on their own: after a short pause or when empty, even holstered.
  for (const id of Object.keys(player.clips)) {
    const gun = WEAPONS[id]; player.sinceShot[id] = (player.sinceShot[id] ?? 1e6) + 1; // never fired: long ago
    if (player.reloadTicks[id] > 0) { if (--player.reloadTicks[id] === 0) { player.clips[id] = gun.clip; emit(state, 'reloaded', { playerId: player.id, weapon: id }); } }
    else if (player.clips[id] < gun.clip && (player.clips[id] === 0 || player.sinceShot[id] >= gun.reloadDelay)) player.reloadTicks[id] = gun.reload;
  }
  if (player.burst) {
    const gun = WEAPONS[player.burst.weapon];
    if (player.burst.timer-- <= 0) { fireVolley(state, player, gun, gun.charge, 1, gun.charge.spread, true); player.burst.timer = gun.charge.every; if (--player.burst.remaining <= 0) player.burst = null; }
  }
  if (player.comboWindow > 0 && --player.comboWindow === 0) player.comboStep = 0;
  if (player.feintTicks > 0) player.feintTicks--;
  if (player.heartUse > 0) player.heartUse--;
  if (weapon === HANDS) { if (pressed) useHeart(state, player); return; }
  if (player.actionTicks > 0) {
    if (pressed && player.action === 'swing') queueCut(state, player);
    tickAction(state, player, weapon);
    return;
  }
  // Just after a cancel the next attack waits a moment; a press meanwhile is kept for when it ends.
  if (player.cancelLag > 0) {
    if (pressed) player.bufferAttack = true;
    if (--player.cancelLag > 0) return;
    if (player.bufferAttack && !player.guarding && weapon.family === 'blade') { startSwing(state, player, weapon); return; }
    player.bufferAttack = false;
  }
  if (player.guarding || player.burst) return;
  // Holding the button charges; a full charge releases the special on let-go.
  if (input.attack && (player.charging || !pressed && weapon.family !== 'bomb')) { if (!player.charging) { player.charging = true; player.chargeTicks = 0; } player.chargeTicks++; }
  if (weapon.family === 'bomb' && pressed) { player.charging = true; player.chargeTicks = 0; }
  let feint = false;
  // Letting go ends a charge, even a release made while stunned (the edge itself was missed then).
  if (player.charging && !input.attack) {
    const held = player.chargeTicks, full = held >= chargeTicksFor(player, weapon);
    player.charging = false; player.chargeTicks = 0;
    if (full) { startCharge(state, player, weapon); return; }
    // A fake charge: shown long enough to bait, then let go early for a normal attack straight away.
    if (weapon.family === 'bomb' || held < (weapon.family === 'gun' ? FIGHT.feint.gunHold : FIGHT.feint.minHold)) return;
    feint = true; player.feintTicks = FIGHT.feint.window; player.feintFrom = state.tick - held;
    emit(state, 'feint', { playerId: player.id, x: player.x, y: player.y, weapon: weapon.id });
  }
  if (!(pressed || feint) || weapon.family === 'bomb') return;
  if (weapon.family === 'blade') { startSwing(state, player, weapon); return; }
  if (player.fireCooldown > 0) return;
  if (!(player.clips[weapon.id] > 0)) { if (!(player.reloadTicks[weapon.id] > 0)) player.reloadTicks[weapon.id] = weapon.reload; emit(state, 'dryFire', { playerId: player.id, weapon: weapon.id }); return; }
  breakCloak(state, player);
  player.clips[weapon.id]--; player.fireCooldown = weapon.interval; player.reloadTicks[weapon.id] = 0; player.sinceShot[weapon.id] = 0;
  // Bloom: shots fired back to back spread wider; a short pause settles the aim again.
  // A shotgun fires a fan of pellets; everything else one round.
  fireVolley(state, player, weapon, weapon, weapon.pellets || 1, (weapon.spread || 0) + (player.bloom || 0));
  player.bloom = Math.min(BLOOM.max, (player.bloom || 0) + (weapon.bloom ?? BLOOM.perShot));
}

/** The quick dash every knight has (Space). Keeps a charge going; cancels a cut's recovery. */
function tickDash(state, player, input, previous) {
  player.dashCooldown = Math.max(0, player.dashCooldown - 1);
  if (!(input.dash && !previous.dash) || player.dashCooldown > 0 || player.dodgeTicks > 0) return;
  if (player.status.curse > 0) { emit(state, 'cursed', { playerId: player.id, x: player.x, y: player.y }); return; }
  if (player.actionTicks > 0 && !canCancel(player)) return;
  if (canCancel(player)) cancelRecovery(state, player, 'dash');
  player.guarding = false;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (!dx && !dy) { dx = Math.cos(player.aim); dy = Math.sin(player.aim); }
  // Every knight dashes the same short distance, whatever the class or gear; gear only changes how soon it recharges.
  const length = Math.hypot(dx, dy), rule = RULES.dash, outfit = outfitOf(player);
  Object.assign(player, { perfectUsed: false, dodgeX: dx / length, dodgeY: dy / length, dodgeTicks: rule.ticks, dodgeStep: rule.distance / rule.ticks, evadeTicks: Math.max(player.evadeTicks, rule.evadeTicks), dashCooldown: Math.round(rule.cooldown * outfit.dashCooldown) });
  player.reelTicks = 0; // a dash shakes off a reel
  player.lastDashTick = state.tick; // a feint can catch a knight who dashed away from a charge that never came
  emit(state, 'dodge', { playerId: player.id, x: player.x, y: player.y, angle: Math.atan2(player.dodgeY, player.dodgeX) });
}
function tickAbilities(state, player, input, previous) {
  player.abilityCooldown = Math.max(0, player.abilityCooldown - 1);
  player.dashTicks = Math.max(0, player.dashTicks - 1); player.markTicks = Math.max(0, player.markTicks - 1);
  if (player.markReady > 0) player.markReady--;
  if (player.cloakTicks > 0 && --player.cloakTicks === 0) { player.markReady = ABILITIES.cloak.ambushTicks; emit(state, 'uncloak', { playerId: player.id }); }
  // The off-hand cancel (as in Spiral Knights): pressing the class button cuts a landed cut short whatever it
  // holds, even with Boost empty, the shield broken or the cloak cooling down, so you hit, cancel and move in one go.
  if (input.ability && !previous.ability && canCancel(player)) cancelRecovery(state, player, 'ability');
  if (player.cls === 'striker') { tickBoost(state, player, input); return; }
  if (!(input.ability && !previous.ability) || player.abilityCooldown > 0 || player.cls === 'guardian') return;
  if (player.status.curse > 0) { emit(state, 'cursed', { playerId: player.id, x: player.x, y: player.y }); return; }
  // Cloak may also cancel a cut's recovery, like the Guardian's shield.
  if (player.actionTicks > 0 && !canCancel(player)) return;
  if (canCancel(player)) cancelRecovery(state, player, 'cloak');
  if (player.cls === 'recon') {
    player.cloakTicks = ABILITIES.cloak.ticks; player.abilityCooldown = Math.round(ABILITIES.cloak.cooldown * outfitOf(player).abilityCooldown); player.markReady = 0;
    emit(state, 'cloak', { playerId: player.id, x: player.x, y: player.y });
  }
}

/** Striker Boost: held, it burns the meter for speed; released (or empty, or cursed) it refills. */
function tickBoost(state, player, input) {
  const rule = ABILITIES.dash, held = !!input.ability;
  if (held && player.status.curse > 0) { if (!player.boosting && !player.cursedPing) emit(state, 'cursed', { playerId: player.id, x: player.x, y: player.y }); player.cursedPing = true; }
  else player.cursedPing = false;
  const boosting = held && !(player.status.curse > 0) && !player.boostLocked && player.boostMeter > 0;
  if (boosting && !player.boosting) {
    // Pressing Boost once a cut lands cuts the rest of it short and slips one hit (sweep, boost in, sweep
    // again); each press costs a slice of the meter.
    if (canCancel(player)) cancelRecovery(state, player, 'dodge');
    player.boostMeter = Math.max(0, player.boostMeter - rule.pressCost);
    player.evadeTicks = Math.max(player.evadeTicks, rule.evadeTicks); player.perfectUsed = false;
    emit(state, 'dash', { playerId: player.id, x: player.x, y: player.y, angle: Math.atan2(player.vy, player.vx) });
  }
  if (boosting) {
    player.boostMeter = Math.max(0, player.boostMeter - 1); player.boostDelay = rule.regenDelay; player.dashTicks = 1;
    if (player.boostMeter === 0) { player.boostLocked = true; emit(state, 'boostEmpty', { playerId: player.id }); }
  } else if (player.boostDelay > 0) player.boostDelay--;
  else {
    player.boostMeter = Math.min(rule.meter, player.boostMeter + rule.meter / (rule.refill * outfitOf(player).abilityCooldown));
    if (player.boostLocked && player.boostMeter >= rule.meter * rule.relock) player.boostLocked = false;
  }
  if (!boosting && player.boosting) emit(state, 'boostEnd', { playerId: player.id });
  player.boosting = boosting;
}
/** How fast a knight may walk right now, as a fraction of their class speed. */
function moveScale(player, weapon) {
  if (player.status.freeze > 0 || ['lunge', 'lungeBurst', 'slam'].includes(player.action)) return 0;
  if (player.stunTicks > 0) return .25;
  if (player.held > 0) return .15;
  if (player.action === 'swing') return player.whiffed ? BLADE.whiffMove : player.comboStep > 0 ? BLADE.moveLater : BLADE.moveFirst;
  if (player.action === 'cast') return .3;
  if (player.action === 'spin') return weapon.charge.speed;
  if (player.guarding) return GUARD.speed;
  if (player.charging) return weapon.family === 'bomb' ? .55 : .7;
  if (weapon.family === 'gun' && (player.fireCooldown > 0 || (player.sinceShot?.[weapon.id] ?? Infinity) < Math.max(GUN.settleTicks, weapon.interval))) return GUN.settleSpeed * reelSlow(player);
  return reelSlow(player);
}
const reelSlow = player => player.reelTicks > 0 ? FIGHT.reel.slow : 1;

function tickPlayer(state, player, input) {
  if (player.alive && state.phase === 'fight' && player.hp < player.maxHp && inBase(state, player)) heal(player, RULES.baseHealPerSecond / TICK_RATE);
  // Some outfits mend slowly after four seconds without taking damage.
  if (player.alive && state.phase === 'fight' && outfitOf(player).regen > 0 && player.hp < player.maxHp && state.tick - player.lastHurtTick > 4 * TICK_RATE) heal(player, outfitOf(player).regen / TICK_RATE);
  // Dojo dummies are back to full health after two seconds left alone.
  if (player.dummy && player.alive && player.hp < player.maxHp && state.tick - player.lastHurtTick > DOJO.refillTicks) player.hp = player.maxHp;
  const previous = player.previousInput || emptyInput(), map = MAPS[state.mapId];
  if (player.benched) { player.previousInput = input; return; }
  if (!player.alive) {
    if (state.phase === 'fight' && --player.respawnTicks <= 0) { spawn(state, player); emit(state, 'respawn', { playerId: player.id, x: player.x, y: player.y }); }
    player.previousInput = input; return;
  }
  const frozen = player.status.freeze > 0;
  // Committed swings and lunges keep their direction; otherwise you face the pointer (frozen too: you turn in the ice).
  player.aim = wrapAngle(finite(input.aim, player.aim));
  player.shieldTicks = Math.max(0, player.shieldTicks - 1);
  if (state.phase !== 'fight') { player.previousInput = input; return; }
  tickStatus(state, player);
  if (!player.alive) { player.previousInput = input; return; }
  // Hit-stop: a few frozen ticks on contact give blades their weight.
  if (player.hitStop > 0) {
    // A press during the pause (the cut has landed) queues the next cut.
    if (input.attack && !previous.attack && player.action === 'swing') queueCut(state, player);
    player.hitStop--; player.previousInput = input; return;
  }
  // Weapon slots: 1-4 pick a slot; swap cycles to the next slot that holds something. Switching cancels a
  // charge, never a committed swing: a press while busy is remembered and the switch happens the moment you
  // are free, so it never gets lost.
  const filled = index => player.weapons[index] || player.hearts[index] > 0;
  const from = player.pendingSlot ?? player.slot;
  const nextFilled = () => { for (let step = 1; step <= SLOT_COUNT; step++) { const index = (from + step) % SLOT_COUNT; if (filled(index)) return index; } return from; };
  const picked = [0, 1, 2, 3].find(index => input[`slot${index + 1}`] && !previous[`slot${index + 1}`]);
  const slot = picked !== undefined ? picked : input.swap && !previous.swap ? nextFilled() : from;
  player.pendingSlot = slot !== player.slot ? slot : null;
  // Swap cancel: after a cut lands, switching weapons drops its recovery (a sweep into a heavy blade).
  const swapCancel = slot !== player.slot && player.action === 'swing' && player.hitIds.length > 0 && !player.whiffed;
  if (swapCancel) { cancelRecovery(state, player, 'swap'); player.cancelLag = BLADE.swapLag; }
  if (slot !== player.slot && player.actionTicks === 0 && !player.burst) { const before = player.weapons[player.slot]; player.slot = slot; player.pendingSlot = null; player.charging = false; player.chargeTicks = 0; player.comboStep = 0; player.bufferAttack = false; emit(state, 'swapWeapon', { playerId: player.id, weapon: player.weapons[slot], from: before }); }
  if (player.stunTicks > 0 || frozen) { player.dashTicks = 0; player.boosting = false; }
  if (player.stunTicks > 0) { player.stunTicks--; player.guarding = false; tickGuard(state, player, emptyInput()); }
  else if (!frozen) { tickGuard(state, player, input); tickDash(state, player, input, previous); tickAbilities(state, player, input, previous); tickWeapon(state, player, input, previous); }
  // Frozen: rooted (no shield, dash or ability) but the arms still work.
  else { tickGuard(state, player, emptyInput()); tickWeapon(state, player, input, previous); }
  if (player.shieldTicks > 0 && (input.attack && !previous.attack)) player.shieldTicks = 0;
  if (player.catalystTicks > 0 && --player.catalystTicks === 0) player.catalysts = 0;
  if (player.held > 0) player.held--;
  if (player.evadeTicks > 0) player.evadeTicks--;
  player.stagger = Math.max(0, player.stagger - FIGHT.stagger.drainPerTick);
  if (player.reelTicks > 0) player.reelTicks--;
  if (player.parriedTicks > 0) player.parriedTicks--;
  if (player.steadyTicks > 0) player.steadyTicks--;
  if (player.riposteTicks > 0) player.riposteTicks--;
  if (player.dodgeTicks > 0) {
    player.dodgeTicks--;
    moveBody(map, player, player.dodgeX * player.dodgeStep, player.dodgeY * player.dodgeStep);
    const exitSpeed = RULES.dash.exitSpeed;
    player.vx = player.dodgeX * exitSpeed; player.vy = player.dodgeY * exitSpeed;
  }
  // Movement: steering eases toward the wanted velocity; actions, shields and charging slow you.
  const cls = CLASSES[player.cls], weapon = currentWeapon(player);
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0), my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(mx, my); if (length > 0) { mx /= length; my /= length; }
  const chill = player.status.chill > 0 ? 1 - STATUS.chill.slowPerStack * Math.max(1, player.chillStacks) : 1;
  const speed = cls.speed * outfitOf(player).speedMultiplier * moveScale(player, weapon) * chill * (player.dashTicks > 0 ? ABILITIES.dash.speed : 1);
  const blend = 1 - Math.exp(-18 * DT);
  player.vx += (mx * speed - player.vx) * blend; player.vy += (my * speed - player.vy) * blend;
  moveBody(map, player, (player.vx + player.pushX) * DT, (player.vy + player.pushY) * DT);
  const decay = Math.exp(-9 * DT); player.pushX *= decay; player.pushY *= decay;
  if (Math.hypot(player.pushX, player.pushY) < 2) player.pushX = player.pushY = 0;
  player.previousInput = input;
}

/** Flinch follows the round's weight: light rapid-fire rounds barely flinch, heavy rounds stagger. */
const shotStun = shot => Math.round(Math.min(8, 3 + shot.damage * .3));
/** Knights don't settle inside each other: two bodies more than half overlapped ease apart a little each tick, so
 * neither hides the other and one cut can't find two knights in one spot. It is soft (slower than walking), so it
 * never body-blocks: you still walk or dash straight through a knight, and nobody is shoved off a zone. */
const SEPARATE = Object.freeze({ share: .1, max: .6 });
function separateKnights(state) {
  const map = MAPS[state.mapId], bodies = state.players.filter(player => player.alive), reach = RULES.radius;
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], d = dist(a, b);
    if (d >= reach || !sameFloor(map, a, b)) continue;
    // A Dojo dummy on its mark holds still: the other knight steps aside.
    const angle = d > .01 ? Math.atan2(b.y - a.y, b.x - a.x) : (a.id - b.id) * 2.4, step = Math.min(SEPARATE.max, (reach - d) * SEPARATE.share);
    const holdA = a.dummy === 'still', holdB = b.dummy === 'still';
    if (holdA && holdB) continue;
    if (!holdA) moveBody(map, a, -Math.cos(angle) * step * (holdB ? 2 : 1), -Math.sin(angle) * step * (holdB ? 2 : 1));
    if (!holdB) moveBody(map, b, Math.cos(angle) * step * (holdA ? 2 : 1), Math.sin(angle) * step * (holdA ? 2 : 1));
  }
}
function tickProjectiles(state) {
  const map = MAPS[state.mapId], survivors = [];
  for (const shot of state.projectiles) {
    let alive = true;
    const steps = Math.max(1, Math.ceil(Math.hypot(shot.vx, shot.vy) * DT / 6));
    shot.size += shot.grow;
    for (let step = 0; step < steps && alive; step++) {
      const nx = shot.x + shot.vx * DT / steps, ny = shot.y + shot.vy * DT / steps;
      const blocked = (x, y) => shotBlocked(map, x, y, shot.z ?? 0);
      if (blocked(nx, ny)) {
        // Ricochets reflect off the face they struck (walls, or a cliff seen from below); everything else stops.
        if (shot.bounces > 0) {
          shot.bounces--; shot.hitIds = [];
          if (blocked(nx, shot.y)) shot.vx = -shot.vx;
          if (blocked(shot.x, ny)) shot.vy = -shot.vy;
          if (!blocked(nx, shot.y) && !blocked(shot.x, ny)) { shot.vx = -shot.vx; shot.vy = -shot.vy; }
          emit(state, 'ricochet', { x: shot.x, y: shot.y });
          continue;
        }
        if (shot.kind === 'explosive') explodeShot(state, shot);
        alive = false; break;
      }
      // Base barriers stop rounds going in or out.
      if (baseCell(map, nx, ny) !== baseCell(map, shot.x, shot.y)) { emit(state, 'barrier', { x: nx, y: ny, team: (baseCell(map, nx, ny) || baseCell(map, shot.x, shot.y)) === '1' ? 0 : 1 }); if (shot.kind === 'explosive') explodeShot(state, shot); alive = false; break; }
      const px = shot.x, py = shot.y;
      shot.x = nx; shot.y = ny;
      // Enemy domes stop rounds at their edge.
      const dome = state.players.find(guard => guard.team !== shot.team && domeUp(guard) && dist(guard, shot) <= GUARD.radius && dist(guard, { x: shot.x - shot.vx * DT, y: shot.y - shot.vy * DT }) > GUARD.radius - 2);
      if (dome) { hitGuard(state, dome, shot.damage, shot.kind, state.players[shot.ownerId], 0, 0, 0); alive = false; break; }
      // Contact along the whole step (not just where it ends), nearest first: a knight pressed against the muzzle is
      // hit, and a round that overlaps two knights hits the one it reaches first.
      const sx = nx - px, sy = ny - py, span = sx * sx + sy * sy || 1, reach = RULES.radius + shot.size, along = target => clamp(((target.x - px) * sx + (target.y - py) * sy) / span, 0, 1);
      const off = target => Math.hypot(px + sx * along(target) - target.x, py + sy * along(target) - target.y);
      const entry = target => along(target) - Math.sqrt(Math.max(0, reach * reach - off(target) ** 2) / span); // where the round first touches the body
      const touching = state.players.filter(target => target.alive && target.team !== shot.team && off(target) <= reach).sort((a, b) => entry(a) - entry(b));
      for (const target of touching) {
        // Shadow waves carry knights along with them.
        if (shot.carry && !guardUp(target)) moveBody(map, target, shot.vx * DT / steps * .8, shot.vy * DT / steps * .8);
        if (shot.hitIds.includes(target.id)) continue;
        shot.hitIds.push(target.id);
        const owner = state.players[shot.ownerId], blocked = guardUp(target);
        if (shot.kind === 'explosive') { explodeShot(state, shot); alive = false; break; }
        const damageFamily = shot.damageFamily || WEAPONS[shot.weapon]?.family;
        // Precision rounds hit harder the farther they have flown.
        const flown = Math.hypot(shot.x - shot.ox, shot.y - shot.oy), long = shot.longShot ? 1 + shot.longShot.bonus * clamp((flown - shot.longShot.from) / Math.max(1, shot.range - shot.longShot.from), 0, 1) : 1;
        if (long > 1.15) emit(state, 'longShot', { playerId: shot.ownerId, targetId: target.id, x: target.x, y: target.y, bonus: long });
        // Aim: how far the round's line passes from the middle of the knight. Through the middle is clean (full
        // damage); only a big round's edge touching them is a graze. Bomb shrapnel is not aimed.
        let aimed = 1;
        if (damageFamily === 'gun') {
          const speed = Math.hypot(shot.vx, shot.vy) || 1, off = Math.abs((target.x - shot.x) * shot.vy - (target.y - shot.y) * shot.vx) / speed / RULES.radius;
          if (off <= AIM.shot.clean) emit(state, 'clean', { playerId: shot.ownerId, targetId: target.id, x: target.x, y: target.y, shot: true });
          else if (off > 1) { aimed = AIM.shot.graze; emit(state, 'graze', { playerId: shot.ownerId, targetId: target.id, x: target.x, y: target.y, shot: true }); }
          else aimed = AIM.shot.offCentre;
        }
        const landed = damage(state, owner, target, shot.damage * long * aimed, { push: shot.push, angle: Math.atan2(shot.vy, shot.vx), stun: shotStun(shot), kind: shot.kind, damageFamily, source: shot, status: shot.status, chance: shot.chance, stacks: shot.stacks, build: shot.build, weapon: shot.weapon });
        if (landed && shot.kind === 'catalyst') { target.catalysts = Math.min(3, (target.catalysts || 0) + 1); target.catalystTicks = 6 * TICK_RATE; emit(state, 'catalyst', { playerId: target.id, count: target.catalysts }); }
        if (shot.kind === 'detonator' && target.alive && target.catalysts > 0) {
          const count = target.catalysts; target.catalysts = 0;
          emit(state, 'detonate', { playerId: target.id, x: target.x, y: target.y, count });
          damage(state, owner, target, shot.perCharge * count, { push: shot.pushPerCharge * count, angle: Math.atan2(shot.vy, shot.vx), stun: 12 * count, kind: 'detonate', damageFamily });
        }
        if (!shot.pierce || blocked) { alive = false; break; }
      }
    }
    if (alive && --shot.ttl > 0) survivors.push(shot);
  }
  state.projectiles = survivors;
}
function explodeShot(state, shot) {
  emit(state, 'explosion', { playerId: shot.ownerId, weapon: shot.weapon, x: shot.x, y: shot.y, radius: shot.radius });
  radialHit(state, state.players[shot.ownerId], shot.team, shot, shot.radius, shot.damage, { push: shot.push, stun: 16, kind: 'explosion', status: shot.status, chance: shot.chance, damageFamily: shot.damageFamily || WEAPONS[shot.weapon]?.family });
}
function tickBombs(state) {
  const map = MAPS[state.mapId], remaining = [];
  for (const bomb of state.bombs) {
    const weapon = WEAPONS[bomb.weapon];
    if (bomb.phase === 'pull') {
      // The vortex drags enemies to its centre and holds them there, then blasts them apart.
      for (const target of state.players) {
        if (!target.alive || target.team === bomb.team || guardUp(target)) continue;
        const d = dist(target, bomb); if (d > weapon.pull.radius || d < 3) continue;
        moveBody(map, target, (bomb.x - target.x) / d * Math.min(d, weapon.pull.speed * DT), (bomb.y - target.y) / d * Math.min(d, weapon.pull.speed * DT));
        target.held = 2; // caught knights can barely move until it blows
      }
      if (--bomb.pullTicks <= 0) explode(state, bomb); else remaining.push(bomb);
      continue;
    }
    if (--bomb.fuse > 0) { remaining.push(bomb); continue; }
    if (weapon.pull) { bomb.phase = 'pull'; bomb.pullTicks = weapon.pull.ticks; emit(state, 'vortex', { playerId: bomb.ownerId, x: bomb.x, y: bomb.y, radius: weapon.pull.radius }); remaining.push(bomb); continue; }
    explode(state, bomb);
  }
  state.bombs = remaining;
}
function tickClouds(state) {
  const remaining = [];
  for (const cloud of state.clouds) {
    for (const target of state.players) if (target.alive && target.team !== cloud.team && dist(target, cloud) <= cloud.radius + RULES.radius && sameFloor(MAPS[state.mapId], target, cloud) && !(target.status[cloud.status] > 0)) applyStatus(state, target, cloud.status, cloud.ownerId);
    if (--cloud.ticks > 0) remaining.push(cloud);
  }
  state.clouds = remaining;
}

/** Where a picked-up heart goes: a heart slot with room first, then an empty slot; -1 when full. */
function heartRoom(player) {
  const partial = player.hearts.findIndex((count, slot) => count > 0 && count < RULES.heart.stack && player.weapons[slot] === null);
  return partial >= 0 ? partial : player.weapons.findIndex((id, slot) => id === null && !(player.hearts[slot] > 0));
}
function tickPickups(state) {
  const remaining = [], map = MAPS[state.mapId];
  for (const heart of state.pickups) {
    // The nearest knight in reach, of either team, takes it: into the inventory when there is room,
    // otherwise eaten on the spot if hurt.
    const taker = state.players.filter(player => player.alive && dist(player, heart) <= RULES.heart.radius + RULES.radius && sameFloor(map, player, heart)
      && (heartRoom(player) >= 0 || player.hp < player.maxHp && canHeal(player))).sort((a, b) => dist(a, heart) - dist(b, heart))[0];
    if (!taker) { if (--heart.ttl > 0) remaining.push(heart); continue; }
    const slot = heartRoom(taker);
    if (slot >= 0) {
      taker.hearts[slot]++;
      emit(state, 'heartStored', { playerId: taker.id, x: heart.x, y: heart.y, slot, count: taker.hearts[slot] });
    } else {
      const amount = heal(taker, RULES.heart.heal);
      emit(state, 'heartPickup', { playerId: taker.id, x: heart.x, y: heart.y, amount: Math.round(amount) });
    }
  }
  state.pickups = remaining;
}

function tickPoints(state) {
  for (const point of state.points) {
    const counts = [0, 0];
    for (const player of state.players) if (player.alive && dist(player, point) <= RULES.pointRadius) counts[player.team]++;
    point.counts = counts;
    const net = counts[0] - counts[1];
    if (net === 0) continue;
    const before = point.progress, rate = 100 / RULES.captureTicks;
    point.progress = clamp(point.progress + net * rate, -100, 100);
    if (point.owner === 0 && point.progress <= 0 || point.owner === 1 && point.progress >= 0) {
      const team = 1 - point.owner;
      point.owner = null;
      for (const player of state.players) if (player.alive && player.team === team && dist(player, point) <= RULES.pointRadius) player.score += RULES.neutralizeScore;
      emit(state, 'pointNeutral', { pointId: point.id, team });
    }
    if (point.owner !== 0 && point.progress >= 100 && before < 100) captured(state, point, 0);
    if (point.owner !== 1 && point.progress <= -100 && before > -100) captured(state, point, 1);
  }
  if (--state.scoreTimer <= 0) {
    state.scoreTimer = RULES.scoreIntervalTicks;
    for (const team of [0, 1]) state.scores[team] += (modeOf(state).scoreTable || RULES.scoreTable)[Math.min(3, state.points.filter(point => point.owner === team).length)] || 0;
    emit(state, 'scoreTick', { scores: [...state.scores] });
  }
}
function captured(state, point, team) {
  point.owner = team;
  for (const player of state.players) if (player.alive && player.team === team && dist(player, point) <= RULES.pointRadius) { player.captures++; player.score += RULES.captureScore; }
  emit(state, 'capture', { pointId: point.id, team, x: point.x, y: point.y });
}

export function step(state, rawInputs = []) {
  state.tick++;
  const inputs = state.players.map(player => {
    const raw = player.bot ? botInput(state, player) : rawInputs[player.id];
    const input = emptyInput(player.aim);
    for (const key of INPUT_KEYS) input[key] = raw?.[key] === true;
    input.aim = finite(raw?.aim, player.aim);
    return input;
  });
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    for (const player of state.players) tickPlayer(state, player, inputs[player.id]);
    if (--state.phaseTicks <= 0) { state.phase = 'fight'; emit(state, 'fight'); }
    return state;
  }
  for (const player of state.players) tickPlayer(state, player, inputs[player.id]);
  separateKnights(state);
  tickProjectiles(state); tickBombs(state); tickClouds(state); tickPickups(state);
  if (isDojo(state)) return state;
  tickPoints(state);
  state.timeLeftTicks = Math.max(0, state.timeLeftTicks - 1);
  const won = state.scores.findIndex(score => score >= RULES.scoreToWin);
  if (won >= 0 || state.timeLeftTicks === 0) {
    state.phase = 'matchEnd'; state.winner = won >= 0 ? won : state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
    emit(state, 'matchEnd', { winner: state.winner, scores: [...state.scores] });
  }
  return state;
}

// ---------- bots ----------
const flowCache = new Map();
/** Breadth-first distance field from a world point over walkable tiles. */
function flowField(map, x, y, team = null) {
  const key = `${map.id}:${team}:${Math.floor(x / TILE)}:${Math.floor(y / TILE)}`;
  if (flowCache.has(key)) return flowCache.get(key);
  const field = new Int32Array(map.cols * map.rows).fill(-1), queue = [];
  const start = Math.floor(y / TILE) * map.cols + Math.floor(x / TILE);
  field[start] = 0; queue.push(start);
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head], col = index % map.cols, row = (index - col) / map.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc, r = row + dr, next = r * map.cols + c;
      if (!canStep(map, col, row, c, r) || barred(map, c, r, team) || field[next] >= 0) continue;
      field[next] = field[index] + 1; queue.push(next);
    }
  }
  flowCache.set(key, field); return field;
}
function stepToward(map, player, goal) {
  if (lineOfSight(map, player, goal) && dist(player, goal) < TILE * 3 && levelCell(map, Math.floor(player.x / TILE), Math.floor(player.y / TILE)) === levelCell(map, Math.floor(goal.x / TILE), Math.floor(goal.y / TILE))) return Math.atan2(goal.y - player.y, goal.x - player.x);
  const field = flowField(map, goal.x, goal.y, player.team), col = Math.floor(player.x / TILE), row = Math.floor(player.y / TILE);
  const open = (c, r) => canStep(map, col, row, c, r) && !barred(map, c, r, player.team);
  let best = null, bestValue = Infinity;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const c = col + dc, r = row + dr; if (!open(c, r)) continue;
    if (dc && dr && (!open(col + dc, row) || !open(col, row + dr))) continue;
    const value = field[r * map.cols + c]; if (value >= 0 && value < bestValue) { bestValue = value; best = { x: (c + .5) * TILE, y: (r + .5) * TILE }; }
  }
  return best ? Math.atan2(best.y - player.y, best.x - player.x) : Math.atan2(goal.y - player.y, goal.x - player.x);
}
/** Raised tiles that overlook a point from shooting range: where a gunner bot likes to stand. */
const perchCache = new Map();
function perchesFor(map, point) {
  if (!map.twoFloors) return [];
  const key = `${map.id}:${point.id}`;
  if (!perchCache.has(key)) {
    const perches = [];
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      if (levelCell(map, col, row) !== '1' || isBlocked(map, col, row)) continue;
      const spot = { x: (col + .5) * TILE, y: (row + .5) * TILE, z: 1 }, d = dist(spot, point);
      if (d > RULES.pointRadius + 40 && d < 540 && lineOfSight(map, spot, point)) perches.push(Object.freeze(spot));
    }
    perchCache.set(key, perches);
  }
  return perchCache.get(key);
}
/** The closest of your team's base tiles (bases can be split into several blocks). */
function nearestBaseTile(map, bot) {
  return map.spawns[bot.team].reduce((best, tile) => dist(tile, bot) < dist(best, bot) ? tile : best);
}
function botInput(state, bot) {
  const input = emptyInput(bot.aim);
  if (!bot.alive || bot.benched || state.phase !== 'fight' && state.phase !== 'countdown') return input;
  if (bot.dummy && bot.dummy !== 'spar') return dummyInput(state, bot, input);
  const map = MAPS[state.mapId], brain = bot.brain ||= { goal: null, rethink: 0, strafe: 1, strafeTicks: 0, pulse: 0 }, mood = botMood(state);
  // Objective: take a point we don't hold (nearest by path), otherwise guard a contested one.
  if (--brain.rethink <= 0 && !(brain.perchUntil > state.tick)) {
    brain.rethink = 90 + Math.floor(random(state) * 60);
    const ranked = state.points.map(point => {
      const field = flowField(map, point.x, point.y, bot.team), steps = field[Math.floor(bot.y / TILE) * map.cols + Math.floor(bot.x / TILE)];
      const contested = point.counts ? point.counts[1 - bot.team] : 0;
      // Aggressive bots push into zones the enemy holds; cautious ones stay to defend their own.
      const want = point.owner === bot.team ? (contested ? 1.2 * Math.min(1, mood.zones) : 4) : point.owner === null ? 1 : 1.5 / mood.zones;
      return { point, score: (steps < 0 ? 999 : steps) * want - contested * 4 };
    }).sort((a, b) => a.score - b.score);
    brain.goal = ranked[Math.floor(random(state) * Math.min(2, ranked.length) * .6)].point;
    // On two-floor maps gunners sometimes take the high ground over their point and shoot down.
    const perches = perchesFor(map, brain.goal), weapon = currentWeapon(bot);
    if (perches.length && (bot.cls === 'recon' || weapon.family === 'gun') && random(state) < .35) { brain.goal = perches[Math.floor(random(state) * perches.length)]; brain.perchUntil = state.tick + 12 * TICK_RATE; }
    // A Dojo sparring partner goes looking for the people training.
    if (bot.dummy === 'spar') brain.goal = state.players.filter(other => other.alive && other.team !== bot.team).sort((a, b) => dist(a, bot) - dist(b, bot))[0] || brain.goal;
  }
  const enemies = state.players.filter(other => other.alive && other.team !== bot.team && !inBase(state, other) && (other.cloakTicks === 0 || dist(other, bot) < ABILITIES.cloak.revealRange) && dist(other, bot) < mood.sight && lineOfSight(map, bot, other));
  const target = enemies.sort((a, b) => dist(a, bot) - dist(b, bot))[0];
  // Badly hurt: fall back to base to heal, or grab a nearby heart, unless someone is right on top of us.
  const health = bot.hp / bot.maxHp, pressed = target && dist(target, bot) < 160;
  if (health < mood.retreat) brain.retreat = true; else if (health >= .95 || !bot.alive) brain.retreat = false;
  const heart = health < mood.heal ? state.pickups.filter(pickup => dist(pickup, bot) < 260 && lineOfSight(map, bot, pickup)).sort((a, b) => dist(a, bot) - dist(b, bot))[0] : null;
  const detour = pressed ? null : brain.retreat && !inBase(state, bot) ? nearestBaseTile(map, bot) : heart ? heart : null;
  let moveAngle = null;
  if (target) {
    const d = dist(target, bot), level = botLevel(state);
    // Aim like a person: the bot follows where it last saw you (a reaction lag), its aim drifts a little, and it
    // turns onto you at a human pace instead of snapping. Its level sets how well.
    const track = brain.track?.id === target.id ? brain.track : (brain.track = { id: target.id, x: target.x, y: target.y, vx: 0, vy: 0 });
    const follow = 1 / level.reaction;
    track.x += (target.x - track.x) * follow; track.y += (target.y - track.y) * follow;
    track.vx += ((target.vx || 0) - track.vx) * follow; track.vy += ((target.vy || 0) - track.vy) * follow;
    // The drift wanders smoothly with a typical size of about half the level's wobble.
    brain.wobble = Math.max(-level.wobble * 1.5, Math.min(level.wobble * 1.5, (brain.wobble || 0) * .95 + (random(state) - .5) * level.wobble * .6));
    let desired = Math.atan2(track.y - bot.y, track.x - bot.x) + brain.wobble;
    // Choose a weapon for the range: blade close, gun mid, bomb when they crowd us or a point.
    const families = bot.weapons.map(id => WEAPONS[id]?.family ?? 'none');
    const crowded = state.players.filter(other => other.alive && other.team !== bot.team && dist(other, bot) < 130).length >= 2 || state.points.some(point => dist(point, bot) <= RULES.pointRadius && dist(point, target) <= RULES.pointRadius);
    if (!brain.style || brain.life !== bot.deaths) { brain.life = bot.deaths; brain.style = bot.cls === 'striker' || random(state) < mood.melee ? 'melee' : 'ranged'; brain.skill = level.skill[0] + random(state) * (level.skill[1] - level.skill[0]); }
    const want = d < (brain.style === 'melee' ? 170 : 90) ? 'blade' : crowded && d < 140 ? 'bomb' : 'gun';
    let slot = families.indexOf(want);
    // Hurt bots eat a stored heart when they get a moment.
    const heartSlot = bot.hearts.findIndex(count => count > 0);
    if (heartSlot >= 0 && bot.hp < bot.maxHp * .45 && canHeal(bot)) slot = heartSlot;
    if (slot >= 0 && slot !== bot.slot && bot.actionTicks === 0 && !bot.charging) input[`slot${slot + 1}`] = !bot.previousInput[`slot${slot + 1}`];
    const weapon = currentWeapon(bot);
    // Gunners lead a moving target, as far as they read its movement (better bots lead it better).
    if (weapon.family === 'gun') {
      const lead = d / weapon.speed * (brain.skill ?? .5) * 1.4 * level.lead;
      desired = Math.atan2(track.y + track.vy * lead - bot.y, track.x + track.vx * lead - bot.x) + brain.wobble;
    }
    const off = wrapAngle(desired - bot.aim), turn = level.turn / TICK_RATE, onTarget = Math.abs(off) < .25;
    bot.aim = wrapAngle(bot.aim + Math.max(-turn, Math.min(turn, off))); input.aim = bot.aim;
    if (weapon === HANDS) { if (bot.slot === heartSlot) input.attack = !bot.previousInput.attack; }
    else {
    // Bombs always charge; blades and guns mostly tap, sometimes commit to a full charge.
    if (!bot.charging && brain.mode !== 'charge' && weapon.family !== 'bomb' && random(state) < .006) brain.mode = 'charge';
    if (weapon.family === 'bomb' || brain.mode === 'charge') {
      const full = bot.charging && bot.chargeTicks >= chargeTicksFor(bot, weapon);
      // Skilled bots sometimes fake it: show the charge close up, then let go early for a normal attack.
      const feint = weapon.family !== 'bomb' && bot.charging && !full && bot.chargeTicks > FIGHT.feint.minHold * 2 && d < 110 && random(state) < (brain.skill || .5) * .03;
      input.attack = !full && !feint;
      if (full || feint) brain.mode = 'tap';
    } else if (weapon.family === 'blade') {
      // Swords: cut only when the target is in reach (whiffs are punished), and jump on a committed enemy.
      const reach = weapon.combo[bot.comboStep]?.reach ?? weapon.combo[0].reach, inReach = d <= reach + RULES.radius + 6;
      brain.pulse = (brain.pulse + 1) % Math.max(5, Math.round(14 / mood.cut));
      // A target left reeling: follow up with another weapon. Knocked out of reach, the gun; still close, the
      // heaviest other sword.
      const others = family => [...bot.weapons.keys()].filter(i => i !== bot.slot && WEAPONS[bot.weapons[i]]?.family === family);
      const followWith = target.reelTicks > 0 && target.reelWeapon === weapon.id
        ? (d > reach + RULES.radius + 20 ? others('gun')[0] : undefined) ?? others('blade').sort((a, b) => !!WEAPONS[bot.weapons[b]].heavy - !!WEAPONS[bot.weapons[a]].heavy)[0] : undefined;
      if (followWith !== undefined && random(state) < brain.skill) input[`slot${followWith + 1}`] = !bot.previousInput[`slot${followWith + 1}`];
      // Press to start a cut, then again once it lands to flow into the next.
      if (bot.action === 'swing') input.attack = bot.hitIds.length > 0 && !bot.whiffed && !bot.previousInput.attack;
      else if (inReach && exposed(target) && !bot.previousInput.attack && random(state) < brain.skill) input.attack = true;
      else input.attack = inReach && brain.pulse < 2;
    } else { brain.pulse = (brain.pulse + 1) % (Math.round(weapon.interval * (1 + level.pause)) + 2); input.attack = brain.pulse < 2 && onTarget; }
    }
    // Keep a fighting distance and strafe.
    if (--brain.strafeTicks <= 0) { brain.strafeTicks = 40 + Math.floor(random(state) * 60); brain.strafe = random(state) < .5 ? -1 : 1; }
    // Melee-minded bots keep closing in, shooting on the way; ranged ones hold their distance.
    const ideal = (weapon.family === 'blade' || brain.style === 'melee' ? 45 : weapon.family === 'gun' ? 220 : 40) * mood.range;
    const toward = Math.atan2(target.y - bot.y, target.x - bot.x);
    moveAngle = d > ideal + 30 ? stepToward(map, bot, target) : d < ideal - 30 ? toward + Math.PI : toward + brain.strafe * Math.PI / 2;
    // A gunner by a zone its team does not safely hold keeps its range only as far as the zone allows: it steps
    // back onto the zone, and strafes rather than backing off it (otherwise a 1v1 gunner never scores).
    const zone = weapon.family === 'gun' ? state.points.find(point => dist(point, bot) < RULES.pointRadius * 2 && !(point.owner === bot.team && !point.counts?.[1 - bot.team])) : null;
    if (zone) {
      const edge = RULES.pointRadius * .8;
      if (dist(zone, bot) > edge) moveAngle = stepToward(map, bot, zone);
      else if (d < ideal - 30 && dist(zone, { x: bot.x - Math.cos(toward) * 40, y: bot.y - Math.sin(toward) * 40 }) > edge) moveAngle = toward + brain.strafe * Math.PI / 2;
    }
    // Strikers hit and run, as in Spiral Knights: once a cut lands (or the target winds up an answer), Boost round
    // it so its answer whiffs, then come back in on the miss. Better bots do it more often.
    if (bot.cls === 'striker' && weapon.family === 'blade') {
      const landed = bot.action === 'swing' && bot.hitIds.length > 0 && !bot.whiffed && brain.runFor !== bot.swingId;
      const answer = target.action === 'swing' && target.actionTotal - target.actionTicks < target.swingStartup && d < target.swingReach + RULES.radius + 40 && brain.slipFor !== target.swingId;
      if (landed) brain.runFor = bot.swingId;
      if (answer) brain.slipFor = target.swingId;
      if (!(brain.run > 0) && (landed || answer) && !bot.boostLocked && bot.boostMeter > ABILITIES.dash.meter * .2 && random(state) < (brain.skill || .5) * level.runs) { brain.run = 36; brain.runSide = random(state) < .5 ? -1 : 1; }
      // Keep running while their cut is still live (a heavy blow winds up long), up to a second and a half.
      const live = target.action === 'swing' && !target.whiffed && target.actionTotal - target.actionTicks < target.swingStartup + target.swingActive;
      if (brain.run === 1 && live && (brain.ran || 0) < 180) brain.run = 2;
      if (brain.run > 0) {
        brain.run--; brain.ran = brain.run > 0 ? (brain.ran || 0) + 1 : 0;
        const reach = weapon.combo[0].reach + RULES.radius, out = d < reach * .85 ? .35 : d > reach * 1.3 ? -.35 : 0;
        moveAngle = toward + brain.runSide * (Math.PI / 2 + out);
        input.ability = brain.run > 10 || live;
        if (!(target.whiffed && d <= reach)) input.attack = false; // only to punish the miss
      }
    }
    // Abilities.
    // Strikers hold Boost to close in, saving the last of the meter.
    if (bot.cls === 'striker' && d > 140 / Math.min(1.6, mood.rush) && (bot.boosting || bot.boostMeter > ABILITIES.dash.meter * (mood.rush > 1 ? .3 : .5))) input.ability = true;
    if (bot.cls === 'recon' && d > 200 && bot.abilityCooldown === 0) input.ability = !bot.previousInput.ability;
    // Guardians raise the dome over hurt teammates nearby.
    if (bot.cls === 'guardian' && !bot.guardBroken && bot.guardHp > GUARD.max * .5 && state.players.filter(ally => ally.alive && ally.team === bot.team && dist(ally, bot) < GUARD.radius && ally.hp < ally.maxHp * .6).length >= 1 && brain.guardTicks === 0 && random(state) < .03) brain.guardTicks = GUARD.expandTicks + 120;
  } else if (brain.goal) {
    const d = dist(bot, brain.goal);
    if (d > RULES.pointRadius * .5) moveAngle = stepToward(map, bot, brain.goal);
    else if (--brain.strafeTicks <= 0) { brain.strafeTicks = 50; brain.strafe = random(state) * Math.PI * 2; }
    else moveAngle = d > 20 ? brain.strafe : null;
    if (moveAngle !== null) { bot.aim = moveAngle; input.aim = moveAngle; }
    if (bot.cls === 'striker' && d > 400 && (bot.boosting || bot.boostMeter > ABILITIES.dash.meter * .6)) input.ability = true;
    // Between fights, a hurt bot eats a stored heart.
    const heartSlot = bot.hearts.findIndex(count => count > 0);
    if (heartSlot >= 0 && bot.hp < bot.maxHp * .6 && canHeal(bot)) {
      if (bot.slot !== heartSlot) input[`slot${heartSlot + 1}`] = !bot.previousInput[`slot${heartSlot + 1}`];
      else input.attack = !bot.previousInput.attack;
    }
  }
  // Shield up against shots on target, swings and full charges up close, and bombs about to blow.
  const threatened = state.projectiles.some(shot => {
    if (shot.team === bot.team) return false;
    const d = dist(shot, bot), speed = Math.hypot(shot.vx, shot.vy);
    return d < 150 && ((bot.x - shot.x) * shot.vx + (bot.y - shot.y) * shot.vy) / (speed * Math.max(1, d)) > .92;
  }) || state.players.some(enemy => enemy.alive && enemy.team !== bot.team && dist(enemy, bot) < 100 && (enemy.action !== 'idle' || enemy.charging && enemy.chargeTicks > chargeTicksFor(enemy, currentWeapon(enemy)) * .8))
    || state.bombs.some(bomb => bomb.team !== bot.team && bomb.fuse < 36 && dist(bomb, bot) < (WEAPONS[bomb.weapon].radius || 0) + 24);
  // The Spiral Knights habit: land the quick first cut, cancel its recovery, cut again.
  if (target && bot.action === 'swing' && bot.comboStep === 0 && inRecovery(bot) && bot.hitIds.length && dist(target, bot) < 120 && random(state) < (brain.skill || .5) * .12 * botLevel(state).reads) {
    if (bot.cls === 'recon') { if (bot.dashCooldown === 0) input.dash = !bot.previousInput.dash; }
    else if (!bot.previousInput.ability && !(bot.cls === 'striker' && bot.boostLocked)) input.ability = true;
  }
  // Reading a wind-up: a cut about to come our way can be slipped with a well-timed dodge (or blocked).
  const windup = state.players.find(enemy => enemy.alive && enemy.team !== bot.team && enemy.action === 'swing' && enemy.actionTotal - enemy.actionTicks < enemy.swingStartup
    && dist(enemy, bot) <= enemy.swingReach + RULES.radius + 10 && Math.abs(wrapAngle(Math.atan2(bot.y - enemy.y, bot.x - enemy.x) - enemy.swingAim)) <= enemy.swingArc / 2 + .3);
  const read = windup && bot.actionTicks === 0 && random(state) < (brain.skill || .5) * .08 * botLevel(state).reads * mood.defend;
  if (read && bot.cls !== 'guardian' && bot.dashCooldown === 0) input.dash = !bot.previousInput.dash;
  if (read && bot.cls === 'guardian' && !bot.guardBroken && (brain.guardTicks || 0) === 0) brain.guardTicks = 24;
  brain.guardTicks = Math.max(0, (brain.guardTicks || 0) - 1);
  if (threatened && bot.cls === 'guardian' && !bot.guardBroken && bot.guardHp > guardMax(bot) * .3 && !bot.charging && brain.guardTicks === 0 && random(state) < .05 * botLevel(state).reads * mood.defend) brain.guardTicks = 30 + Math.floor(random(state) * 40);
  // Anyone may dash out of a threat; melee bots dash in to close the gap.
  if (threatened && bot.cls !== 'guardian' && bot.dashCooldown === 0 && random(state) < .03 * botLevel(state).reads * mood.defend) input.dash = !bot.previousInput.dash;
  if (target && brain.style === 'melee' && dist(target, bot) > 110 && dist(target, bot) < 220 && bot.dashCooldown === 0 && random(state) < .02 * mood.rush) input.dash = !bot.previousInput.dash;
  // Strikers dodge through the threat; Guardians block it.
  if (threatened && bot.cls === 'striker' && !bot.boostLocked && bot.boostMeter > ABILITIES.dash.meter * .25 && random(state) < .04 * botLevel(state).reads) input.ability = true; // a tap of Boost slips the hit
  else if (bot.cls === 'guardian' && brain.guardTicks > 0) { input.ability = true; input.attack = false; }
  if (detour) { moveAngle = stepToward(map, bot, detour); if (!target) { bot.aim = moveAngle; input.aim = moveAngle; } }
  else if (brain.retreat && !pressed && inBase(state, bot)) moveAngle = null; // wait in base until healed
  if (moveAngle !== null) {
    const x = Math.cos(moveAngle), y = Math.sin(moveAngle);
    input.right = x > .38; input.left = x < -.38; input.down = y > .38; input.up = y < -.38;
    // Slide off wall corners: if the axis we want is blocked, line up with the middle of our row or column.
    const sx = input.right ? 1 : input.left ? -1 : 0, sy = input.down ? 1 : input.up ? -1 : 0;
    if (sx && !sy && collides(map, bot.x + sx * 4, bot.y, RULES.radius)) { const centre = (Math.floor(bot.y / TILE) + .5) * TILE - bot.y; input.down = centre > 2; input.up = centre < -2; }
    if (sy && !sx && collides(map, bot.x, bot.y + sy * 4, RULES.radius)) { const centre = (Math.floor(bot.x / TILE) + .5) * TILE - bot.x; input.right = centre > 2; input.left = centre < -2; }
  }
  return input;
}

/** Dojo dummies: stand still facing the nearest person, or walk back and forth across their mark. */
function dummyInput(state, bot, input) {
  const near = state.players.filter(other => other.alive && other.team !== bot.team).sort((a, b) => dist(a, bot) - dist(b, bot))[0];
  if (near) { bot.aim = Math.atan2(near.y - bot.y, near.x - bot.x); input.aim = bot.aim; }
  if (bot.dummy === 'strafe') {
    const brain = bot.brain ||= { dir: 1 }, map = MAPS[state.mapId], offset = bot.y - bot.home.y;
    if (offset > DOJO.strafeTiles * TILE) brain.dir = -1; else if (offset < -DOJO.strafeTiles * TILE) brain.dir = 1;
    else if (collides(map, bot.x, bot.y + brain.dir * (RULES.radius + 4), RULES.radius)) brain.dir = -brain.dir;
    input[brain.dir > 0 ? 'down' : 'up'] = true;
  }
  return input;
}

export function getScoreboard(state) {
  return state.players.filter(player => !player.benched || player.human).map(player => ({ id: player.id, name: player.name, team: player.team, cls: player.cls, human: player.human, score: player.score, kills: player.kills, deaths: player.deaths, captures: player.captures, damage: Math.round(player.damage) }))
    .sort((a, b) => a.team - b.team || b.score - a.score || b.kills - a.kills || b.damage - a.damage);
}
