import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { levelCell } from '../public/lockdown-maps.js';
import { MANIFEST, MANIFEST_BY_KEY } from '../public/lockdown-assets.js';

const { TICK_RATE, RULES, ABILITIES, WEAPONS, CLASSES, MAPS, TILE, GUARD, STATUS, BLADE } = L;

/** Two-knight arena: seat 0 (Amber) against seat 4 (Cyan); every other seat is benched. */
function duel({ mapId = 'temple', a = {}, b = {}, gap = 50 } = {}) {
  const state = L.createState({ mapId, seed: 7 });
  L.setConnected(state, 0, true, 'Ada'); L.setConnected(state, 4, true, 'Bo');
  L.startMatch(state, [0, 4]);
  state.phase = 'fight'; state.phaseTicks = 0;
  const point = MAPS[mapId].points[1];
  for (const player of state.players) {
    if (player.id !== 0 && player.id !== 4) Object.assign(player, { bot: false, human: false, alive: false, respawnTicks: 1e9 });
  }
  const me = state.players[0], foe = state.players[4];
  Object.assign(me, { x: point.x - gap / 2, y: point.y, aim: 0, shieldTicks: 0 }, a);
  Object.assign(foe, { x: point.x + gap / 2, y: point.y, aim: Math.PI, shieldTicks: 0 }, b);
  for (const player of [me, foe]) { player.clips = Object.fromEntries(player.weapons.filter(id => WEAPONS[id]?.family === 'gun').map(id => [id, WEAPONS[id].clip])); }
  state.events = [];
  return { state, me, foe };
}
const input = (fields = {}) => ({ ...L.emptyInput(fields.aim ?? 0), ...fields });
function run(state, ticks, controls = () => ({})) {
  for (let t = 0; t < ticks; t++) {
    const c = controls(t), inputs = [];
    inputs[0] = input({ aim: state.players[0].aim, ...(c[0] || {}) });
    inputs[4] = input({ aim: state.players[4].aim, ...(c[4] || {}) });
    L.step(state, inputs);
  }
}
const events = (state, type) => state.events.filter(event => event.type === type);

test('maps are mirrored with three points and four spawn tiles a side', () => {
  for (const id of L.MAP_IDS) {
    const map = MAPS[id];
    assert.equal(map.points.length, 3);
    assert.deepEqual(map.points.map(point => point.id), ['A', 'B', 'C']);
    assert.ok(map.spawns[0].length >= 4 && map.spawns[1].length >= 4, `${id} has room to spawn a full team`);
    for (const point of map.points) {
      assert.equal(L.MAPS[id].grid[Math.floor(point.y / TILE)][Math.floor(point.x / TILE)] !== '#', true, `${id} point ${point.id} sits on floor`);
      const mirror = map.points.find(other => Math.abs(other.x - (map.width - point.x)) < 1 && Math.abs(other.y - point.y) < 1);
      assert.ok(mirror, `${id} point ${point.id} has a mirror`);
    }
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      assert.equal(map.grid[row][col] === '#', map.grid[row][map.cols - 1 - col] === '#', `${id} walls mirror at ${col},${row}`);
    }
  }
});

test('lobby setup validates class, the four inventory slots and team size', () => {
  const state = L.createState();
  assert.equal(state.players.length, L.CAPACITY);
  assert.ok(state.players.every(player => player.bot && !player.human));
  L.setConnected(state, 0, true, 'Ada');
  assert.equal(state.players[0].human, true); assert.equal(state.players[0].name, 'Ada');
  assert.equal(L.setPlayerSetup(state, 0, { cls: 'wizard' }).ok, false);
  assert.equal(L.setPlayerSetup(state, 0, { weapons: ['brand', 'brand', 'blast'] }).ok, false);
  assert.equal(L.setPlayerSetup(state, 0, { weapons: [null, null, null, null] }).ok, false, 'at least one weapon');
  assert.equal(L.setPlayerSetup(state, 0, { weapons: ['brand', 'rapier', 'cleaver', 'spur', 'thorn'] }).ok, false, 'four slots at most');
  assert.equal(L.setPlayerSetup(state, 0, { weapons: ['brand', 'laser', 'blast'] }).ok, false);
  assert.equal(L.setPlayerSetup(state, 0, { team: 2 }).ok, false);
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'guardian', weapons: ['pulsar', 'rapier', 'vortex'], team: 1 }), { ok: true });
  assert.equal(state.players[0].hp, CLASSES.guardian.hp);
  for (const id of [1, 2, 3]) { L.setConnected(state, id, true, `P${id}`); L.setPlayerSetup(state, id, { team: 1 }); }
  assert.equal(state.players.filter(player => player.human && player.team === 1).length, 4);
  L.setConnected(state, 6, true, 'Late');
  assert.equal(state.players[6].team, 0, 'a seat on a full team moves to the other side');
  assert.match(L.setPlayerSetup(state, 6, { team: 1 }).error, /full/);
  state.phase = 'fight';
  assert.match(L.setPlayerSetup(state, 0, { team: 0 }).error, /lobby/);
});

test('starting balances the bots to four a side and counts down into the fight', () => {
  const state = L.createState({ seed: 3 });
  for (const id of [0, 1, 2]) { L.setConnected(state, id, true, `H${id}`); L.setPlayerSetup(state, id, { team: 1 }); }
  L.startMatch(state, [0, 1, 2]);
  assert.equal(state.phase, 'countdown');
  assert.deepEqual([0, 1].map(team => state.players.filter(player => player.team === team).length), [4, 4]);
  assert.ok([0, 1, 2].every(id => state.players[id].team === 1 && state.players[id].human));
  assert.ok(state.players.every(player => player.alive && Number.isFinite(player.x)));
  for (const player of state.players) assert.equal(player.weapons.length, L.SLOT_COUNT);
  for (let t = 0; t < RULES.countdownTicks; t++) L.step(state, []);
  assert.equal(state.phase, 'fight');
  assert.ok(events(state, 'fight').length === 1);
});

const swingTicks = move => move.startup + move.active + move.recovery;

test('a blade cut lands as the arc sweeps, with knockback, stun and hit-stop; a queued press chains the combo', () => {
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'recon' } }); // no class sword bonus
  const first = WEAPONS.brand.combo[0];
  run(state, first.startup, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.hp, foe.maxHp, 'nothing lands during the wind-up');
  run(state, first.active);
  assert.equal(foe.hp, foe.maxHp - first.damage);
  assert.ok(foe.stunTicks > 0 && foe.pushX > 0, 'pushed away from the cut');
  assert.ok(events(state, 'damage').at(-1).kind === 'blade');
  // Press again while the first cut recovers: the second cut follows on its own.
  run(state, 2, t => ({ 0: { attack: t === 0 } }));
  run(state, swingTicks(first) + 8);
  assert.deepEqual(events(state, 'swing').map(event => event.step), [0, 1]);
  const [opener, second] = events(state, 'swing');
  assert.equal(opener.dir, -1, 'the opener is a forehand from the sword side (right to left)');
  assert.equal(second.dir, 1, 'the next cut comes back the other way');
});

test('blades only hit what the sweep covers', () => {
  const { state, foe } = duel({ gap: 50 });
  Object.assign(foe, { x: state.players[0].x - 50 }); // behind the swing
  run(state, swingTicks(WEAPONS.brand.combo[0]) + 2, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.hp, foe.maxHp);
});

test('a full Knight Brand charge lunges into the target and ends in a burning burst', () => {
  const { state, me, foe } = duel({ gap: 120 });
  const swing = swingTicks(WEAPONS.brand.combo[0]) + Math.max(BLADE.whiffMin, Math.round(WEAPONS.brand.combo[0].recovery * BLADE.whiffRecovery)); // the first cut whiffs at this range
  run(state, swing + WEAPONS.brand.chargeTicks + 3, () => ({ 0: { attack: true } }));
  assert.ok(me.charging && me.chargeTicks >= WEAPONS.brand.chargeTicks);
  const startX = me.x;
  run(state, 60);
  assert.ok(me.x > startX + 60, 'the lunge carries you forward');
  assert.ok(events(state, 'damage').some(event => event.kind === 'lunge' && event.targetId === 4));
  assert.ok(events(state, 'explosion').some(event => event.burst));
});

test('guns spend their clip, reload, and the charged blaster bolt pierces', () => {
  const { state, me, foe } = duel({ gap: 200, a: { weapons: ['blaster', 'brand', 'blast'] } });
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.equal(me.clips.blaster, WEAPONS.blaster.clip - 1);
  assert.equal(foe.hp, foe.maxHp - WEAPONS.blaster.damage);
  for (let shot = 0; shot < 2; shot++) run(state, WEAPONS.blaster.interval + 2, t => ({ 0: { attack: t === 0 } }));
  assert.equal(me.clips.blaster, 0); assert.ok(me.reloadTicks.blaster > 0);
  run(state, WEAPONS.blaster.reload + 2);
  assert.equal(me.clips.blaster, WEAPONS.blaster.clip);
  const behind = state.players[5]; Object.assign(behind, { alive: true, armor: 'none', x: foe.x + 60, y: foe.y, hp: 100, maxHp: 100, shieldTicks: 0, respawnTicks: 0 });
  Object.assign(foe, { hp: 100, pushX: 0 });
  run(state, WEAPONS.blaster.chargeTicks + 4, () => ({ 0: { attack: true } }));
  run(state, 60);
  // The press fires a normal round (stopped by the first knight); the release fires the bolt.
  assert.equal(foe.hp, 100 - WEAPONS.blaster.damage - WEAPONS.blaster.charge.damage);
  assert.equal(behind.hp, 100 - WEAPONS.blaster.charge.damage, 'the bolt carried through');
});

test('bombs plant on a full charge and blast enemies in range after the fuse', () => {
  const { state, me, foe } = duel({ gap: 60, a: { weapons: ['blast', 'brand', 'blaster'] } });
  run(state, 10, () => ({ 0: { attack: true } }));
  run(state, 1);
  assert.equal(state.bombs.length, 0, 'a short tap plants nothing');
  run(state, L.chargeTicksFor(me, WEAPONS.blast) + 2, () => ({ 0: { attack: true } }));
  run(state, 1);
  assert.equal(state.bombs.length, 1);
  run(state, WEAPONS.blast.fuse + 1);
  assert.equal(state.bombs.length, 0);
  assert.equal(foe.hp, foe.maxHp - WEAPONS.blast.damage);
  assert.equal(me.hp, me.maxHp, 'your own bomb never hurts you');
});

test('switching weapons uses 1–3 and Q, and cancels a charge', () => {
  const { state, me } = duel();
  run(state, 2, t => ({ 0: { slot3: t === 0 } })); assert.equal(me.slot, 2);
  run(state, 2, t => ({ 0: { swap: t === 0 } })); assert.equal(me.slot, 0);
  run(state, 60, () => ({ 0: { attack: true } }));
  const charged = me.chargeTicks; assert.ok(charged > 20);
  run(state, 1, () => ({ 0: { attack: true, slot2: true } }));
  assert.equal(me.slot, 1); assert.ok(me.chargeTicks <= 1, 'the old charge is dropped; holding starts a fresh one');
});

test('Striker Boost: faster only while held, burns a meter, locks when empty and refills', () => {
  const { state, me } = duel({ gap: 400 });
  const B = ABILITIES.dash;
  const start = me.x; run(state, 60, () => ({ 0: { right: true } }));
  const normal = me.x - start;
  me.x = start; me.vx = 0; me.y = MAPS.temple.points[1].y; run(state, 60, () => ({ 0: { right: true, ability: true } }));
  assert.ok(me.x - start > normal * 1.3, `boost covered ${me.x - start} vs ${normal}`);
  assert.ok(me.boosting); assert.equal(me.boostMeter, B.meter - B.pressCost - 60, 'each press costs a slice, then holding burns the meter');
  // Let go: back to normal speed straight away, and the meter waits, then refills.
  run(state, 2, () => ({ 0: { right: true } }));
  assert.equal(me.boosting, false); assert.equal(me.dashTicks, 0);
  run(state, B.regenDelay, () => ({}));
  const waited = me.boostMeter; run(state, 60, () => ({}));
  assert.ok(me.boostMeter > waited, 'refills after the pause');
  // Hold until empty: Boost locks and stays off while the key is still held, until a quarter is back.
  me.x = start; run(state, B.meter + 10, () => ({ 0: { ability: true, left: true, right: false } }));
  assert.equal(me.boostLocked, true); assert.equal(me.boosting, false);
  assert.ok(events(state, 'boostEmpty').length >= 1);
  let unlocked = false;
  for (let t = 0; t < B.regenDelay + Math.ceil(B.refill * B.relock) + 2 && !unlocked; t++) { run(state, 1, () => ({ 0: { ability: true } })); unlocked = !me.boostLocked; }
  assert.ok(unlocked, 'unlocked at a quarter');
});

test('the Guardian shield opens straight into a dome that shields and slowly heals teammates and the Guardian', () => {
  const { state, me, foe } = duel({ gap: 260, a: { cls: 'guardian', weapons: ['cleaver', 'magnus', 'vortex'], hp: 80, maxHp: 120 }, b: { weapons: ['blaster', 'brand', 'blast'] } });
  const ally = state.players[1]; Object.assign(ally, { alive: true, x: me.x - 10, y: me.y + 40, hp: 40, maxHp: 100, shieldTicks: 0, respawnTicks: 0, bot: false });
  run(state, GUARD.expandTicks + 1, () => ({ 0: { ability: true } }));
  assert.ok(me.guarding); assert.ok(events(state, 'dome').length === 1, 'the dome opens almost at once');
  // A round at the Guardian is soaked by the dome, not the personal shield.
  run(state, 40, t => ({ 0: { ability: true }, 4: { attack: t === 0 } }));
  assert.ok(me.hp >= 80 && me.hp < 80 + GUARD.healPerSecond, `no damage, only the slow dome healing (${me.hp})`);
  assert.equal(me.domeHp, GUARD.domeMax - WEAPONS.blaster.damage); assert.equal(me.guardHp, GUARD.max);
  // Everyone inside heals slowly, the Guardian too.
  const allyBefore = ally.hp, meBefore = me.hp;
  run(state, TICK_RATE, () => ({ 0: { ability: true } }));
  assert.ok(Math.abs(ally.hp - allyBefore - GUARD.healPerSecond) < .5, `ally healed by ${ally.hp - allyBefore}`);
  assert.ok(Math.abs(me.hp - meBefore - GUARD.healPerSecond) < .5);
  // Shots from outside stop at the dome's edge.
  const before = me.domeHp; Object.assign(foe, { aim: Math.atan2(ally.y - foe.y, ally.x - foe.x) });
  run(state, 40, t => ({ 0: { ability: true }, 4: { attack: t === 0, aim: foe.aim } }));
  assert.ok(me.domeHp < before); assert.ok(ally.hp > 40);
  // Only Guardians have a shield; for the others the ability is Boost or Cloak.
  const { state: other, me: striker } = duel();
  run(other, 3, () => ({ 0: { ability: true } }));
  assert.equal(striker.guarding, false); assert.ok(striker.boosting);
});

test('Recon cloak hides you; the first hit out of it marks the target for extra damage', () => {
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'recon', weapons: ['rapier', 'autogun', 'shard'], hp: 90, maxHp: 90 } });
  run(state, 2, t => ({ 0: { ability: t === 0 } }));
  assert.ok(me.cloakTicks > 0);
  run(state, 2, t => ({ 0: { attack: t === 0 } }));
  assert.equal(me.cloakTicks, 0, 'attacking breaks the cloak');
  run(state, swingTicks(WEAPONS.rapier.combo[0]) + 6);
  assert.ok(foe.markTicks > 0);
  const before = foe.hp;
  run(state, 24, t => ({ 0: { attack: t === 0 } }));
  assert.equal(before - foe.hp, Math.round(WEAPONS.rapier.combo[1].damage * (1 + ABILITIES.cloak.markBonus)));
});

test('standing on a point captures it and scores every five seconds', () => {
  const { state, me, foe } = duel();
  const point = state.points[0];
  Object.assign(me, { x: point.x, y: point.y }); Object.assign(foe, { alive: false, respawnTicks: 1e9 });
  run(state, RULES.captureTicks + 1);
  assert.equal(point.owner, 0);
  assert.equal(me.captures, 1);
  const score = state.scores[0]; state.scoreTimer = 1; run(state, 1);
  assert.equal(state.scores[0] - score, RULES.scoreTable[1]);
  // Contesting stops progress; outnumbering flips it back to neutral then theirs.
  Object.assign(foe, { alive: true, x: point.x + 10, y: point.y, shieldTicks: 1e9 });
  const progress = point.progress; run(state, 30); assert.equal(point.progress, progress);
  Object.assign(me, { alive: false, respawnTicks: 1e9 });
  run(state, RULES.captureTicks + 1); assert.equal(point.owner, null);
  run(state, RULES.captureTicks + 1); assert.equal(point.owner, 1);
});

test('a knocked-out knight respawns at base after the delay with a spawn shield', () => {
  const { state, foe } = duel();
  foe.hp = 5; run(state, 1, () => ({ 0: { attack: true } })); run(state, 30);
  assert.equal(foe.alive, false); assert.equal(state.players[0].kills, 1); assert.equal(foe.deaths, 1);
  assert.equal(foe.respawnTicks <= RULES.respawnBaseTicks, true);
  run(state, foe.respawnTicks + 1);
  assert.equal(foe.alive, true); assert.equal(foe.hp, foe.maxHp); assert.ok(foe.shieldTicks > 0);
  assert.ok(MAPS.temple.spawns[1].some(spot => spot.x === foe.x && spot.y === foe.y));
});

test('bot matches are deterministic, finite and reach a result', () => {
  const play = ticks => { const state = L.createState({ mapId: 'foundry', seed: 99 }); L.startMatch(state, []); for (let t = 0; t < ticks; t++) L.step(state, []); return state; };
  const a = play(6000), b = play(6000);
  assert.deepEqual(a.scores, b.scores); assert.equal(a.eventId, b.eventId);
  assert.deepEqual(a.players.map(player => [player.x, player.y, player.hp]), b.players.map(player => [player.x, player.y, player.hp]));
  assert.ok(a.players.every(player => Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.hp)));
  assert.ok(a.points.some(point => point.owner !== null), 'bots take points');
  assert.ok(a.players.some(player => player.kills > 0), 'bots fight');
  const full = play(RULES.timeLimitTicks + RULES.countdownTicks + 10);
  assert.equal(full.phase, 'matchEnd');
  assert.ok(full.winner === null || [0, 1].includes(full.winner));
  const board = L.getScoreboard(full);
  assert.equal(board.length, L.CAPACITY);
  assert.ok(board.every(row => Number.isInteger(row.kills) && Number.isInteger(row.captures)));
  L.resetLobby(full);
  assert.equal(full.phase, 'lobby'); assert.deepEqual(full.scores, [0, 0]);
});

test('the art manifest covers the common body, equipment, classes, weapons and themes with valid strips', () => {
  for (const cls of Object.keys(CLASSES)) assert.ok(MANIFEST_BY_KEY[`icon_class_${cls}`]);
  for (const team of [0, 1]) assert.ok(MANIFEST_BY_KEY[`character_base_team${team}`]);
  for (const [slot, pieces] of Object.entries(L.GEAR)) for (const id of Object.keys(pieces)) {
    if (slot === 'armor') {
      assert.ok(MANIFEST_BY_KEY[`icon_armor_${id}`]);
      if (id !== 'none') for (const team of [0, 1]) assert.ok(MANIFEST_BY_KEY[`armor_${id}_team${team}`]);
    } else if (id !== 'none') {
      assert.ok(MANIFEST_BY_KEY[`gear_${slot}_${id}`]);
      assert.ok(MANIFEST_BY_KEY[`icon_${slot}_${id}`]);
    }
  }
  for (const id of L.WEAPON_IDS) { assert.ok(MANIFEST_BY_KEY[`weapon_${id}`]); assert.ok(MANIFEST_BY_KEY[`icon_weapon_${id}`]); }
  for (const map of Object.values(MAPS)) for (const key of [`tile_floor_${map.theme}`, `tile_floor_${map.theme}_alt`, `tile_wall_top_${map.theme}`, `tile_wall_front_${map.theme}`]) assert.ok(MANIFEST_BY_KEY[key], key);
  const keys = new Set();
  for (const entry of MANIFEST) {
    assert.ok(!keys.has(entry.key), `${entry.key} is unique`); keys.add(entry.key);
    assert.equal(entry.file, `${entry.key}.png`);
    assert.equal(entry.size[0] % entry.frames, 0, `${entry.key} splits into ${entry.frames} frames`);
    assert.equal(entry.size[1] % (entry.rows || 1), 0, `${entry.key} splits into ${entry.rows} rows`);
    assert.ok(entry.anchor[0] <= entry.size[0] / entry.frames && entry.anchor[1] <= entry.size[1] / (entry.rows || 1), `${entry.key} anchor is inside a frame`);
    assert.ok(entry.description.length > 10);
  }
});

test('your own base heals you; the enemy base does not', () => {
  const { state, me, foe } = duel();
  const home = MAPS.temple.spawns[0][0], away = MAPS.temple.spawns[1][0];
  Object.assign(me, { x: home.x, y: home.y, hp: 40 });
  assert.equal(L.inBase(state, me), true);
  run(state, TICK_RATE);
  assert.ok(Math.abs(me.hp - (40 + RULES.baseHealPerSecond)) < .01, `healed to ${me.hp}`);
  run(state, TICK_RATE * 10); assert.equal(me.hp, me.maxHp, 'never past full');
  Object.assign(foe, { x: home.x + 48, y: home.y, hp: 40 });
  assert.equal(L.inBase(state, foe), false, 'an enemy standing in your base is not in theirs');
  run(state, TICK_RATE); assert.equal(foe.hp, 40);
  Object.assign(me, { x: away.x, y: away.y, hp: 40 }); run(state, TICK_RATE); assert.equal(me.hp, 40);
});

test('class and weapons change mid-match only in base or while respawning', () => {
  const { state, me } = duel({ a: { weapons: ['brand', 'blaster', 'blast'] } });
  assert.match(L.setPlayerSetup(state, 0, { cls: 'recon' }).error, /base/);
  assert.match(L.setPlayerSetup(state, 0, { weapons: ['rapier', 'magnus', 'shard'] }).error, /base/);
  const home = MAPS.temple.spawns[0][0];
  Object.assign(me, { x: home.x, y: home.y, hp: 50, slot: 1 });
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'guardian', weapons: ['rapier', 'magnus', 'shard'] }), { ok: true });
  assert.equal(me.cls, 'guardian'); assert.equal(me.maxHp, CLASSES.guardian.hp);
  assert.equal(me.hp, 50 / CLASSES.striker.hp * CLASSES.guardian.hp, 'keeps the same health fraction');
  assert.deepEqual(me.weapons, ['rapier', 'magnus', 'shard', null]); assert.equal(me.slot, 0);
  assert.equal(me.clips.magnus, WEAPONS.magnus.clip);
  assert.ok(events(state, 'loadoutChange').length === 1);
  assert.match(L.setPlayerSetup(state, 0, { team: 1 }).error, /lobby/, 'teams stay fixed');
  // Knocked out: the choice is stored and used on respawn.
  Object.assign(me, { x: MAPS.temple.points[1].x, y: MAPS.temple.points[1].y, alive: false, respawnTicks: 3 });
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'recon' }), { ok: true });
  run(state, 4);
  assert.equal(me.alive, true); assert.equal(me.cls, 'recon'); assert.equal(me.hp, CLASSES.recon.hp);
});

test('a knockout drops a heart: it goes into a free slot (two per slot) and heals when used', () => {
  const { state, me, foe } = duel();
  foe.hp = 5; run(state, 1, () => ({ 0: { attack: true } })); run(state, 30);
  assert.equal(foe.alive, false);
  assert.ok(events(state, 'heartDrop').length === 1);
  assert.equal(state.pickups.length + me.hearts[3], 1, 'one heart, on the floor or already in the bag');
  // Walking over it stores it in the empty fourth slot, even at full health.
  const heart = state.pickups[0];
  if (heart) { Object.assign(me, { x: heart.x, y: heart.y }); run(state, 1); }
  assert.equal(state.pickups.length, 0); assert.deepEqual(me.hearts, [0, 0, 0, 1]);
  // A second heart stacks in the same slot; a third has no room and a full-health knight leaves it.
  state.pickups.push({ id: 990, kind: 'heart', x: me.x, y: me.y, ttl: 500 }); run(state, 1);
  assert.deepEqual(me.hearts, [0, 0, 0, RULES.heart.stack]);
  state.pickups.push({ id: 991, kind: 'heart', x: me.x, y: me.y, ttl: 500 }); run(state, 1);
  assert.equal(state.pickups.length, 1, 'no room and nothing to heal');
  // Hurt with a full inventory: the heart is eaten on the spot.
  me.hp = 50; run(state, 1);
  assert.equal(me.hp, 50 + RULES.heart.heal); assert.equal(state.pickups.length, 0);
  // Select the heart slot (4) and click to eat one.
  me.hp = 40; run(state, 2, t => ({ 0: { slot4: t === 0 } }));
  assert.equal(me.slot, 3);
  run(state, 2, t => ({ 0: { attack: t === 0 } }));
  assert.equal(me.hp, 40 + RULES.heart.heal); assert.equal(me.hearts[3], 1);
  assert.equal(events(state, 'heartUse').length, 1);
  // A knocked-out knight drops the hearts it carried as well.
  Object.assign(foe, { alive: true, hp: 400, maxHp: 400, x: me.x + 400, y: me.y, shieldTicks: 0 });
  me.hp = 5; me.shieldTicks = 0; me.evadeTicks = 0; state.pickups = [];
  L.reorderInventory(state, 0, [0, 1, 2, 3]);
  const before = me.hearts.reduce((a, b) => a + b, 0);
  foe.weapons = ['blaster', 'brand', 'blast', null]; foe.slot = 0; foe.clips = { blaster: 3 }; foe.aim = Math.PI; foe.x = me.x + 120;
  run(state, 60, t => ({ 4: { attack: t % 20 === 0, aim: Math.PI } }));
  assert.equal(me.alive, false);
  assert.equal(state.pickups.length, before + 1, 'its own heart plus the ones it carried');
  assert.deepEqual(me.hearts, [0, 0, 0, 0]);
  state.pickups = [{ id: 999, kind: 'heart', x: 100, y: 100, ttl: 5 }];
  run(state, 6); assert.equal(state.pickups.length, 0, 'unclaimed hearts fade');
});

test('inventory slots are free: any mix of weapons or hearts, reordered by drag and drop', () => {
  const state = L.createState(); L.setConnected(state, 0, true, 'Ada');
  assert.ok(L.setPlayerSetup(state, 0, { weapons: ['brand', 'rapier', 'cleaver', 'spur'] }).ok, 'four swords');
  assert.ok(L.setPlayerSetup(state, 0, { weapons: ['blast', 'vortex', 'haze', 'frost'] }).ok, 'four bombs');
  assert.ok(L.setPlayerSetup(state, 0, { weapons: [null, 'blaster', null, null] }).ok, 'one gun and three free slots');
  const { state: s, me } = duel({ a: { weapons: ['brand', 'blaster', 'blast', null], hearts: [0, 0, 0, 2], slot: 1 } });
  assert.match(L.reorderInventory(s, 0, [0, 0, 1, 2]).error, /four/);
  assert.ok(L.reorderInventory(s, 0, [3, 1, 0, 2]).ok);
  assert.deepEqual(me.weapons, [null, 'blaster', 'brand', 'blast']); assert.deepEqual(me.hearts, [2, 0, 0, 0]);
  assert.equal(me.slot, 1, 'the item in your hands stays in your hands');
  // Reordering works away from base; the swap key skips empty slots.
  L.reorderInventory(s, 0, [1, 0, 2, 3]); assert.equal(me.slot, 0);
  // Changing loadout in base keeps carried hearts in a free slot.
  const home = MAPS.temple.spawns[0][0]; Object.assign(me, { x: home.x, y: home.y });
  assert.ok(L.setPlayerSetup(s, 0, { weapons: ['rapier', null, 'magnus', 'shard'] }).ok);
  assert.deepEqual(me.hearts, [0, 2, 0, 0]);
});

test('personal score comes from taking and neutralising zones, and leads the scoreboard', () => {
  const { state, me, foe } = duel();
  const point = state.points[0];
  Object.assign(me, { x: point.x, y: point.y }); Object.assign(foe, { alive: false, respawnTicks: 1e9 });
  run(state, RULES.captureTicks + 1);
  assert.equal(me.score, RULES.captureScore);
  Object.assign(me, { alive: false, respawnTicks: 1e9 }); Object.assign(foe, { alive: true, x: point.x, y: point.y, shieldTicks: 1e9 });
  run(state, RULES.captureTicks + 1);
  assert.equal(point.owner, null); assert.equal(foe.score, RULES.neutralizeScore);
  run(state, RULES.captureTicks + 1);
  assert.equal(point.owner, 1); assert.equal(foe.score, RULES.neutralizeScore + RULES.captureScore);
  foe.damage = 12.6;
  const board = L.getScoreboard(state);
  const row = board.find(entry => entry.id === 4);
  assert.deepEqual([row.score, row.captures, row.damage], [45, 1, 13]);
  assert.ok(board.every(entry => ['score', 'kills', 'deaths', 'damage', 'captures'].every(key => Number.isInteger(entry[key]))));
  const team1 = board.filter(entry => entry.team === 1);
  assert.deepEqual(team1.map(entry => entry.score), [...team1.map(entry => entry.score)].sort((a, b) => b - a));
});

test('when the dome breaks the Guardian keeps a personal shield for a few hits, then is stunned; both recharge', () => {
  const { state, me, foe } = duel({ gap: 200, a: { cls: 'guardian' }, b: { weapons: ['blaster', 'brand', 'blast'] } });
  run(state, GUARD.expandTicks + 1, () => ({ 0: { ability: true } }));
  me.domeHp = 5;
  run(state, 40, t => ({ 0: { ability: true }, 4: { attack: t === 0 } }));
  assert.equal(events(state, 'domeBreak').length, 1); assert.equal(me.domeBroken, true); assert.ok(me.guarding, 'still shielded');
  assert.equal(me.hp, me.maxHp);
  // The personal shield now takes the hits.
  foe.fireCooldown = 0;
  run(state, 40, t => ({ 0: { ability: true }, 4: { attack: t === 0 } }));
  assert.equal(me.hp, me.maxHp); assert.equal(me.guardHp, GUARD.max - WEAPONS.blaster.damage);
  assert.ok(events(state, 'block').length >= 1);
  me.guardHp = 5; foe.clips.blaster = WEAPONS.blaster.clip;
  run(state, 40, t => ({ 0: { ability: true }, 4: { attack: t === 0 } }));
  assert.ok(events(state, 'guardBreak').length === 1);
  assert.equal(me.guarding, false); assert.ok(me.stunTicks > 0 && me.guardBroken);
  run(state, 2, () => ({ 0: { ability: true } })); assert.equal(me.guarding, false, 'a broken shield cannot be raised');
  // Lowered, both recharge after a pause; the dome reopens only once half full.
  run(state, GUARD.regenDelay + Math.ceil(GUARD.domeMax * GUARD.domeRecover / GUARD.domeRegenPerSecond * TICK_RATE) + GUARD.breakStun + 5);
  assert.equal(me.guardBroken, false);
  run(state, 2, () => ({ 0: { ability: true } }));
  assert.equal(me.domeBroken, false); assert.ok(me.domeHp >= GUARD.domeMax * GUARD.domeRecover);
  run(state, GUARD.expandTicks + 1, () => ({ 0: { ability: true } })); assert.ok(me.guarding && events(state, 'dome').length >= 1);
});

test('statuses: burn ticks damage, poison stops healing, freeze holds you until hit', () => {
  const { state, me, foe } = duel();
  L.step(state, []); // settle
  // Burn: a few points every half second.
  state.events = [];
  const hazeBomb = { id: 77, ownerId: 0, team: 0, weapon: 'haze', x: foe.x, y: foe.y, fuse: 1, total: 1, phase: 'fuse', pullTicks: 0 };
  state.bombs.push(hazeBomb); run(state, 2);
  assert.equal(state.clouds.length, 1); assert.ok(foe.status.burn > 0);
  run(state, STATUS.burn.every * 2 + 1);
  assert.ok(events(state, 'damage').filter(event => event.kind === 'burn').length >= 2);
  // Poison: no healing from hearts or base.
  foe.status.poison = STATUS.poison.ticks; foe.hp = 40;
  foe.hearts[3] = RULES.heart.stack; // no free slot, so the heart would be eaten on the spot
  state.pickups.push({ id: 900, kind: 'heart', x: foe.x, y: foe.y, ttl: 500 }); run(state, 2);
  assert.equal(state.pickups.some(pickup => pickup.id === 900), true, 'a poisoned knight cannot take a heart');
  // Freeze: no movement until the ice breaks; a hit thaws it.
  state.clouds = []; foe.status.burn = 0;
  const start = foe.x; foe.status.freeze = STATUS.freeze.ticks;
  run(state, 20, () => ({ 4: { right: true } }));
  assert.equal(foe.x, start, 'frozen knights cannot move');
  me.weapons = ['brand', 'blaster', 'blast']; Object.assign(me, { x: foe.x - 50, y: foe.y, aim: 0 });
  run(state, 20, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.status.freeze, 0); assert.ok(foe.freezeImmune > 0, 'a thawed knight is briefly immune');
});

test('ricochet bolts bounce off walls; catalysts stick and the detonator sets them off', () => {
  const { state, me, foe } = duel({ a: { weapons: ['alchemer', 'catalyzer', 'blast'] } });
  // Fire straight into the nearest wall.
  // Fire north at the nearest wall.
  let wallY = me.y; while (L.MAPS.temple.grid[Math.floor(wallY / TILE)][Math.floor(me.x / TILE)] !== '#') wallY -= 4;
  Object.assign(foe, { alive: false, respawnTicks: 1e9 }); me.aim = -Math.PI / 2;
  run(state, 1, () => ({ 0: { attack: true, aim: -Math.PI / 2 } })); run(state, 1, () => ({ 0: { aim: -Math.PI / 2 } }));
  const shot = state.projectiles[0]; assert.equal(shot.kind, 'ricochet');
  run(state, Math.ceil((me.y - wallY) / WEAPONS.alchemer.speed * TICK_RATE) + 6, () => ({ 0: { aim: -Math.PI / 2 } }));
  assert.ok(events(state, 'ricochet').length >= 1); assert.ok(state.projectiles[0]?.vy > 0, 'the bolt comes back');
  me.aim = 0;
  // Catalyst: three stuck charges, then the detonator.
  state.projectiles = []; Object.assign(foe, { alive: true, x: me.x + 140, y: me.y, hp: 300, maxHp: 300, shieldTicks: 0 });
  run(state, 2, t => ({ 0: { slot2: t === 0 } }));
  for (let i = 0; i < 3; i++) run(state, WEAPONS.catalyzer.interval + 2, t => ({ 0: { attack: t === 0 } }));
  run(state, 20);
  assert.equal(foe.catalysts, 3);
  const before = foe.hp;
  run(state, L.chargeTicksFor(me, WEAPONS.catalyzer) + 3, () => ({ 0: { attack: true } }));
  run(state, 30);
  assert.ok(events(state, 'detonate').some(event => event.count === 3));
  assert.ok(before - foe.hp >= WEAPONS.catalyzer.charge.damage + WEAPONS.catalyzer.charge.perCharge * 3);
  assert.equal(foe.catalysts, 0);
});

test('the vortex drags enemies in, holds them, then blasts them apart', () => {
  const { state, foe } = duel();
  const centre = { x: foe.x - 100, y: foe.y };
  state.bombs.push({ id: 88, ownerId: 0, team: 0, weapon: 'vortex', ...centre, fuse: 1, total: 1, phase: 'fuse', pullTicks: 0 });
  run(state, 2); assert.equal(state.bombs[0].phase, 'pull');
  run(state, 60, () => ({ 4: { right: true } }));
  assert.ok(Math.hypot(foe.x - centre.x, foe.y - centre.y) < 30, 'pulled to the centre against its will');
  run(state, WEAPONS.vortex.pull.ticks);
  assert.equal(state.bombs.length, 0);
  assert.equal(foe.hp, foe.maxHp - WEAPONS.vortex.damage);
});

test('every weapon fires its charge without errors', () => {
  for (const id of L.WEAPON_IDS) {
    const { state, me } = duel({ gap: 140, a: { weapons: [id, ...L.WEAPON_IDS.filter(other => other !== id && WEAPONS[other].family !== WEAPONS[id].family).slice(0, 2)] } });
    me.clips = Object.fromEntries(me.weapons.filter(weaponId => WEAPONS[weaponId]?.family === 'gun').map(weaponId => [weaponId, WEAPONS[weaponId].clip]));
    run(state, 140 + L.chargeTicksFor(me, WEAPONS[id]) + 3, () => ({ 0: { attack: true } }));
    run(state, 400);
    assert.ok(events(state, 'chargeRelease').some(event => event.weapon === id), `${id} released its charge`);
    assert.ok(state.players.every(player => Number.isFinite(player.x) && Number.isFinite(player.hp)), `${id} stays finite`);
  }
});

test('Strikers hit 25% harder with swords and swing faster', () => {
  const plain = duel({ gap: 50, a: { cls: 'recon' } }), striker = duel({ gap: 50, a: { cls: 'striker' } });
  const move = WEAPONS.brand.combo[0];
  for (const { state } of [plain, striker]) run(state, swingTicks(move) + 6, t => ({ 0: { attack: t === 0 } }));
  assert.equal(plain.foe.maxHp - plain.foe.hp, move.damage);
  assert.equal(striker.foe.maxHp - striker.foe.hp, Math.round(move.damage * CLASSES.striker.bladeDamage));
  const swings = [plain, striker].map(({ state }) => events(state, 'swing')[0]);
  assert.ok(swings[1].startup + swings[1].active < swings[0].startup + swings[0].active, 'faster cut');
});

test('animation cancels: the shield or a dodge cuts recovery short, and a queued press cancels into the next cut', () => {
  const move = WEAPONS.brand.combo[0];
  // Shield cancel: raise the shield once the blade has passed.
  const shield = duel({ gap: 300, a: { cls: 'guardian' } });
  run(shield.state, move.startup + move.active + 1, t => ({ 0: { attack: t === 0 } }));
  assert.equal(shield.me.action, 'swing');
  run(shield.state, 1, () => ({ 0: { ability: true } }));
  assert.equal(shield.me.action, 'idle'); assert.equal(shield.me.comboStep, 0, 'a whiffed cut breaks the combo, even cancelled');
  assert.ok(events(shield.state, 'cancel').some(event => event.by === 'guard'));
  // The shield cannot cancel the wind-up or the cut itself.
  const early = duel({ gap: 300, a: { cls: 'guardian' } });
  run(early.state, 2, t => ({ 0: { attack: t === 0 } }));
  run(early.state, 1, () => ({ 0: { ability: true } }));
  assert.equal(early.me.action, 'swing');
  // Combo cancel: after a cut that lands, a queued press starts the next cut partway through the recovery.
  const combo = duel({ gap: 50, a: { cls: 'recon' } });
  run(combo.state, 1, () => ({ 0: { attack: true } }));
  let waited = 0; while (!combo.me.hitIds.length && waited++ < 40) run(combo.state, 1);
  run(combo.state, 1); // let go, then press again once the cut has landed
  run(combo.state, 1, () => ({ 0: { attack: true } }));
  run(combo.state, move.active + Math.ceil(move.recovery * BLADE.comboCancel) + 1 + BLADE.hitStop * 2);
  assert.deepEqual(events(combo.state, 'swing').map(event => event.step), [0, 1]);
  // A cut that lands also freezes its swinger for the hit-stop, so compare with a full landed cut.
  assert.ok(events(combo.state, 'swing')[1].tick - events(combo.state, 'swing')[0].tick < swingTicks(move) + BLADE.hitStop, 'the next cut came early');
  // A whiff cannot chain: the queued press is dropped, the recovery is longer and you barely move.
  const air = duel({ gap: 300, a: { cls: 'recon' } });
  run(air.state, move.startup + 1, t => ({ 0: { attack: t === 0 } }));
  run(air.state, 1, () => ({ 0: { attack: true } }));
  run(air.state, move.active + move.recovery, () => ({ 0: { right: true } }));
  assert.deepEqual(events(air.state, 'swing').map(event => event.step), [0], 'no chained cut after a miss');
  assert.equal(air.me.action, 'swing', 'still recovering from the whiff'); assert.ok(air.me.whiffed);
  run(air.state, Math.max(BLADE.whiffMin, Math.round(move.recovery * BLADE.whiffRecovery)) + 2);
  assert.equal(air.me.action, 'idle'); assert.equal(air.me.comboStep, 0, 'the combo starts over');
  // Dodge cancel: a Striker's boost cuts recovery and slips away untouchable.
  const dodge = duel({ gap: 300, a: { cls: 'striker' } });
  run(dodge.state, 20, t => ({ 0: { attack: t === 0 } }));
  const startX = dodge.me.x;
  run(dodge.state, 1, () => ({ 0: { ability: true, left: true } }));
  assert.equal(dodge.me.action, 'idle'); assert.ok(dodge.me.evadeTicks > 0);
  run(dodge.state, 30, () => ({ 0: { ability: true, left: true } }));
  assert.ok(startX - dodge.me.x > 30 * 210 / 120 * 1.2, 'holding Boost carries you away fast');
});

test('a dodging Striker is untouchable; swords wear shields down faster than guns', () => {
  const { state, me } = duel({ gap: 100, b: { weapons: ['blaster', 'brand', 'blast'] } });
  me.evadeTicks = ABILITIES.dash.evadeTicks; // mid-dodge
  run(state, 16, t => ({ 4: { attack: t === 0 } }));
  assert.equal(me.hp, me.maxHp);
  assert.ok(events(state, 'evade').length === 1);
  const block = duel({ gap: 50, a: { cls: 'recon' }, b: { cls: 'guardian' } });
  run(block.state, GUARD.raiseTicks + 1, () => ({ 4: { ability: true } }));
  const shieldBefore = block.foe.guardHp;
  run(block.state, swingTicks(WEAPONS.brand.combo[0]) + 6, t => ({ 0: { attack: t === 0 }, 4: { ability: true } }));
  assert.equal(block.foe.hp, block.foe.maxHp);
  assert.equal(Math.round(shieldBefore - block.foe.guardHp), Math.round(WEAPONS.brand.combo[0].damage * GUARD.bladeScale));
});

test('every class can dash: a short untouchable burst on a cooldown that also cancels recovery', () => {
  for (const cls of Object.keys(CLASSES)) {
    const { state, me } = duel({ gap: 300, a: { cls } });
    const startX = me.x;
    run(state, 1, () => ({ 0: { dash: true, left: true } }));
    assert.ok(me.evadeTicks > 0, `${cls} is untouchable while dashing`);
    run(state, RULES.dash.ticks + 2);
    assert.ok(startX - me.x > RULES.dash.distance * .8, `${cls} dashed ${startX - me.x}`);
    const afterFirst = me.x;
    run(state, 2, t => ({ 0: { dash: t === 1, left: true } }));
    assert.ok(Math.abs(me.x - afterFirst) < 20, 'a second dash waits for the cooldown');
    assert.ok(events(state, 'dodge').length === 1);
  }
  // Dash-cancel a cut's recovery, and keep a charge going through a dash.
  const cancel = duel({ gap: 300, a: { cls: 'recon' } }), move = WEAPONS.brand.combo[0];
  run(cancel.state, move.startup + move.active + 1, t => ({ 0: { attack: t === 0 } }));
  run(cancel.state, 1, () => ({ 0: { dash: true } }));
  assert.equal(cancel.me.action, 'idle'); assert.ok(events(cancel.state, 'cancel').some(event => event.by === 'dash'));
  const charge = duel({ gap: 300, a: { cls: 'recon', weapons: ['blaster', 'brand', 'blast'] } });
  run(charge.state, 40, () => ({ 0: { attack: true } }));
  run(charge.state, 1, () => ({ 0: { attack: true, dash: true } }));
  assert.ok(charge.me.charging, 'the charge survives a dash');
});

test('outfits add attack perks on top of the class: gunslinger guns, fencing swords', () => {
  const plain = duel({ gap: 200, a: { cls: 'guardian', weapons: ['blaster', 'brand', 'blast'] } });
  const slinger = duel({ gap: 200, a: { cls: 'guardian', armor: 'gunslinger', weapons: ['blaster', 'brand', 'blast'] } });
  for (const { state } of [plain, slinger]) run(state, 40, t => ({ 0: { attack: t === 0 } }));
  assert.equal(slinger.foe.maxHp - slinger.foe.hp, Math.round(WEAPONS.blaster.damage * L.ARMORS.gunslinger.gunDamage * (1 - L.ARMORS[slinger.foe.armor].gunResistance)));
  assert.ok(L.chargeTicksFor(slinger.me, WEAPONS.blaster) < L.chargeTicksFor(plain.me, WEAPONS.blaster));
  // Fencing garb stacks with the Striker's sword perks.
  const fencer = duel({ gap: 50, a: { cls: 'striker', armor: 'fencer' } });
  run(fencer.state, swingTicks(WEAPONS.brand.combo[0]) + 6, t => ({ 0: { attack: t === 0 } }));
  const expected = Math.round(WEAPONS.brand.combo[0].damage * CLASSES.striker.bladeDamage * L.ARMORS.fencer.bladeDamage * (1 - L.ARMORS[fencer.foe.armor].bladeResistance));
  assert.equal(fencer.foe.maxHp - fencer.foe.hp, expected);
  const cut = events(fencer.state, 'swing')[0], base = WEAPONS.brand.combo[0];
  assert.ok(cut.startup + cut.active < base.startup + base.active, 'fencing garb swings faster');
});

test('outfit perks and drawbacks: speed vs swords, plate, bombs, berserk, mirrorweave, medic, clockwork', () => {
  const A = L.ARMORS;
  // Windrunner: faster and longer dashes, softer swords.
  const wind = duel({ gap: 50, a: { cls: 'recon', armor: 'windrunner' } });
  run(wind.state, swingTicks(WEAPONS.brand.combo[0]) + 6, t => ({ 0: { attack: t === 0 } }));
  assert.equal(wind.foe.maxHp - wind.foe.hp, Math.round(WEAPONS.brand.combo[0].damage * A.windrunner.bladeDamage * (1 - A[wind.foe.armor].bladeResistance)));
  wind.me.dashCooldown = 0; run(wind.state, 1, () => ({ 0: { dash: true, left: true } }));
  assert.equal(wind.me.dashCooldown, Math.round(RULES.dash.cooldown * A.windrunner.dashCooldown));
  // Juggernaut: extra health, little knockback; Mirrorweave costs health.
  const state = L.createState({ mapId: 'temple' }); L.setConnected(state, 0, true, 'A');
  L.setPlayerSetup(state, 0, { cls: 'striker', armor: 'juggernaut' });
  assert.equal(state.players[0].maxHp, CLASSES.striker.hp + 30);
  L.setPlayerSetup(state, 0, { armor: 'mirrorweave' });
  assert.equal(state.players[0].maxHp, CLASSES.striker.hp + L.ARMORS.mirrorweave.maxHp);
  const plate = duel({ gap: 50, a: { cls: 'recon' }, b: { cls: 'recon', armor: 'juggernaut' } });
  const bare = duel({ gap: 50, a: { cls: 'recon' }, b: { cls: 'recon' } });
  for (const { state: s } of [plate, bare]) run(s, WEAPONS.brand.combo[0].startup + WEAPONS.brand.combo[0].active + 1, t => ({ 0: { attack: t === 0 } }));
  assert.ok(Math.abs(plate.foe.pushX) < Math.abs(bare.foe.pushX) * .5, 'plate barely moves');
  // Berserker takes more from guns.
  const berserk = duel({ gap: 200, a: { cls: 'guardian', weapons: ['blaster', 'brand', 'blast'] }, b: { cls: 'recon', armor: 'berserker' } });
  run(berserk.state, 40, t => ({ 0: { attack: t === 0 } }));
  assert.equal(berserk.foe.maxHp - berserk.foe.hp, Math.round(WEAPONS.blaster.damage * (1 - A.berserker.gunResistance)));
  assert.ok(berserk.foe.maxHp - berserk.foe.hp > WEAPONS.blaster.damage);
  // Bombardier: faster charge, harder blast.
  const bomber = duel({ gap: 60, a: { cls: 'recon', armor: 'bombardier', weapons: ['blast', 'brand', 'blaster'] } });
  assert.ok(L.chargeTicksFor(bomber.me, WEAPONS.blast) < WEAPONS.blast.chargeTicks);
  run(bomber.state, L.chargeTicksFor(bomber.me, WEAPONS.blast) + 2, () => ({ 0: { attack: true } })); run(bomber.state, WEAPONS.blast.fuse + 3);
  assert.equal(bomber.foe.maxHp - bomber.foe.hp, Math.round(WEAPONS.blast.damage * CLASSES.recon.bombDamage * A.bombardier.bombDamage * (1 - A[bomber.foe.armor].bombResistance)));
  // Mirrorweave: statuses wear off sooner.
  const mirror = duel({ b: { armor: 'mirrorweave' } });
  mirror.state.bombs.push({ id: 7, ownerId: 0, team: 0, weapon: 'haze', x: mirror.foe.x, y: mirror.foe.y, fuse: 1, total: 1, phase: 'fuse', pullTicks: 0 });
  run(mirror.state, 3);
  assert.ok(mirror.foe.status.burn > 0 && mirror.foe.status.burn <= Math.round(STATUS.burn.ticks * A.mirrorweave.statusDuration));
  // Medic: bigger hearts and slow mending out of combat.
  const medic = duel({ a: { armor: 'medic' } });
  Object.assign(medic.foe, { alive: false, respawnTicks: 1e9 });
  medic.me.hp = 30; medic.me.hearts[3] = RULES.heart.stack; medic.state.pickups.push({ id: 901, kind: 'heart', x: medic.me.x, y: medic.me.y, ttl: 500 }); run(medic.state, 1);
  assert.equal(Math.round(medic.me.hp), 30 + RULES.heart.heal * A.medic.healing);
  medic.me.hp = 30; medic.me.lastHurtTick = medic.state.tick - 5 * TICK_RATE; run(medic.state, TICK_RATE);
  assert.ok(Math.abs(medic.me.hp - 30 - A.medic.regen * A.medic.healing) < .5, `mended ${medic.me.hp - 30}`); // regen counts as healing
  // Clockwork: the class ability comes back sooner.
  const clock = duel({ a: { cls: 'recon', armor: 'clockwork' } });
  run(clock.state, 1, () => ({ 0: { ability: true } }));
  assert.equal(clock.me.abilityCooldown, Math.round(ABILITIES.cloak.cooldown * A.clockwork.abilityCooldown) - 0);
});

test('fighting: a hit interrupts a cut, and catching a knight committed is a counter', () => {
  const move = WEAPONS.brand.combo[0];
  const hitOn = whiffing => {
    const { state, me, foe } = duel({ gap: 300, a: { cls: 'guardian', weapons: ['brand', null, null, null] }, b: { cls: 'guardian', weapons: ['brand', null, null, null] } });
    if (whiffing) run(state, move.startup + move.active + 2, t => ({ 4: { attack: t === 0 } }));
    assert.equal(foe.action, whiffing ? 'swing' : 'idle'); if (whiffing) assert.ok(foe.whiffed);
    Object.assign(me, { x: foe.x - 50, y: foe.y });
    run(state, move.startup + move.active, t => ({ 0: { attack: t === 0 } }));
    return { state, foe, dealt: events(state, 'damage').find(event => event.targetId === foe.id).amount };
  };
  const plain = hitOn(false), punished = hitOn(true);
  assert.equal(events(plain.state, 'counter').length + events(plain.state, 'punish').length, 0);
  assert.equal(events(punished.state, 'punish').length, 1, 'hitting a whiffing knight is a punish');
  assert.ok(Math.abs(punished.dealt / plain.dealt - L.FIGHT.punish.damage) < .08, 'a punish lands harder');
  assert.equal(punished.foe.action, 'idle', 'the hit knocked them out of their cut');
  assert.equal(punished.foe.comboStep, 0);
  assert.ok(events(punished.state, 'interrupt').some(event => event.playerId === punished.foe.id));
});

test('fighting: two cuts that meet clash; a heavy cut knocks a light one aside', () => {
  const even = duel({ gap: 50, a: { cls: 'recon', weapons: ['brand', null, null, null] }, b: { cls: 'recon', weapons: ['brand', null, null, null] } });
  run(even.state, 30, t => ({ 0: { attack: t === 0 }, 4: { attack: t === 0 } }));
  assert.equal(events(even.state, 'clash').length, 1, 'the blades meet');
  assert.equal(events(even.state, 'damage').length, 0, 'neither knight is cut');
  assert.equal(events(even.state, 'clash')[0].winner, null);
  const heavy = duel({ gap: 50, a: { cls: 'recon', weapons: ['cleaver', null, null, null] }, b: { cls: 'recon', weapons: ['brand', null, null, null] } });
  // The light cut starts later so the two blades sweep at the same moment.
  const late = WEAPONS.cleaver.combo[0].startup - WEAPONS.brand.combo[0].startup;
  run(heavy.state, 80, t => ({ 0: { attack: t === 0 }, 4: { attack: t === late } }));
  const clash = events(heavy.state, 'clash')[0];
  assert.ok(clash, 'the cuts meet'); assert.equal(clash.winner, heavy.me.id, 'the heavy cut wins');
  assert.equal(heavy.me.hp, heavy.me.maxHp, 'the light cut never landed');
  assert.ok(heavy.foe.hp < heavy.foe.maxHp, 'the heavy cut carried on through');
});

test('fighting: a perfect dodge refunds the dash and readies a riposte', () => {
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'recon', weapons: ['brand', null, null, null] }, b: { weapons: ['brand', null, null, null] } });
  Object.assign(me, { evadeTicks: 30, dashCooldown: 100, perfectUsed: false });
  run(state, WEAPONS.brand.combo[0].startup + WEAPONS.brand.combo[0].active + 1, t => ({ 4: { attack: t === 0 } }));
  assert.equal(me.hp, me.maxHp);
  assert.equal(events(state, 'perfectDodge').length, 1);
  assert.ok(me.dashCooldown < 100 * (1 - L.FIGHT.perfect.dashRefund) + 1, 'most of the dash cooldown comes back');
  assert.ok(me.riposteTicks > 0);
  run(state, 40, t => ({ 0: { attack: t === 0 } }));
  assert.equal(events(state, 'riposte').length, 1, 'the next hit is a riposte');
  assert.ok(foe.hp < foe.maxHp);
});

test('fighting: piled-up stun turns a knight steady, so nobody can be stun-locked forever', () => {
  const { state, me, foe } = duel({ gap: 50, a: { weapons: ['brand', null, null, null] }, b: { weapons: [null, null, null, null] } });
  foe.stagger = L.FIGHT.stagger.limit - 1;
  run(state, 20, t => ({ 0: { attack: t === 0 } }));
  assert.equal(events(state, 'steady').length, 1);
  assert.ok(foe.steadyTicks > 0);
  foe.stunTicks = 0;
  run(state, 30, t => ({ 0: { attack: t === 2 } }));
  assert.ok(events(state, 'damage').length >= 2, 'the next cut still hurts');
  assert.equal(foe.stunTicks, 0, 'but does not stun a steady knight');
});

test('Spiral Knights cancel: a cancel sends the combo back to the quick first cut, after a short lag', () => {
  const first = WEAPONS.brand.combo[0];
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'guardian', weapons: ['brand', null, null, null] }, b: { weapons: [null, null, null, null] } });
  run(state, first.startup + first.active + BLADE.hitStop + 2, t => ({ 0: { attack: t === 0 } }));
  assert.ok(me.hitIds.includes(foe.id), 'the first cut landed');
  run(state, 1, () => ({ 0: { ability: true } }));
  assert.equal(me.action, 'idle'); assert.equal(me.comboStep, 0, 'cancelled: back to the first cut');
  // A press during the lag is kept and fires as soon as the lag ends.
  run(state, 1, () => ({ 0: { attack: true } }));
  assert.equal(me.action, 'idle', 'still in the cancel lag');
  run(state, BLADE.cancelLag);
  const swings = events(state, 'swing');
  assert.deepEqual(swings.map(event => event.step), [0, 0], 'first cut, cancel, first cut again');
  assert.ok(swings[1].tick - swings[0].tick >= first.startup + first.active + BLADE.cancelLag, 'the lag is paid');
});

test('later cuts in a combo hit harder but wind up slower, lunge further and steer less', () => {
  for (const id of ['brand', 'thorn', 'frostbite', 'blazebrand', 'sickle', 'rapier', 'spur', 'voltedge']) {
    const combo = WEAPONS[id].combo;
    for (let i = 1; i < combo.length; i++) {
      assert.ok(combo[i].damage >= combo[i - 1].damage && combo[i].startup >= combo[i - 1].startup && combo[i].lunge > combo[i - 1].lunge, `${id} cut ${i + 1}`);
    }
    assert.ok(combo.at(-1).damage > combo[0].damage, `${id} finisher hits harder than the opener`);
  }
  assert.ok(BLADE.moveLater < BLADE.moveFirst);
});

test('bases are safe: the other team cannot walk in, rounds stop at the edge, nobody fights across it', () => {
  // A gate: a tile of Amber's base next to open floor on the same storey.
  const mapId = 'temple', map = MAPS[mapId];
  let gate = null;
  for (let row = 0; row < map.rows && !gate; row++) for (let col = 0; col < map.cols && !gate; col++) {
    if (map.grid[row][col] !== '1') continue;
    for (const [dc, dr] of [[1, 0], [-1, 0]]) if ([1, 2, 3].every(k => map.grid[row][col + k * dc] === '.' && levelCell(map, col + k * dc, row) === levelCell(map, col, row))) { gate = { col, row, dc }; break; }
  }
  assert.ok(gate, `${mapId} has an open base edge`);
  const inside = { x: (gate.col + .5) * TILE, y: (gate.row + .5) * TILE }, outside = { x: (gate.col + gate.dc + .5) * TILE, y: inside.y };
  const toBase = gate.dc > 0 ? Math.PI : 0, tileOf = p => map.grid[Math.floor(p.y / TILE)][Math.floor(p.x / TILE)];
  // Walking (and dashing) at the barrier never gets a Cyan knight into Amber's base.
  const walk = duel({ mapId, a: { x: inside.x - gate.dc * TILE * 2, y: inside.y }, b: { ...outside, aim: toBase } });
  run(walk.state, 240, t => ({ 4: { [gate.dc > 0 ? 'left' : 'right']: true, dash: t % 40 === 0 } }));
  assert.notEqual(tileOf(walk.foe), '1', 'the barrier holds');
  // A knight in their own base cannot be cut or shot from outside...
  const cut = duel({ mapId, a: { ...inside, aim: toBase + Math.PI, weapons: ['brand', null, null, null] }, b: { ...outside, aim: toBase, weapons: ['brand', null, null, null] } });
  run(cut.state, 120, t => ({ 4: { attack: t % 20 === 0 } }));
  assert.equal(cut.me.hp, cut.me.maxHp, 'safe from a sword at the edge');
  // ...and cannot shoot out of it either (a lunge that carries you out of the base is fair game both ways).
  const out = duel({ mapId, a: { ...inside, aim: toBase + Math.PI, weapons: ['blaster', null, null, null] }, b: { x: outside.x + gate.dc * TILE, y: inside.y } });
  run(out.state, 120, t => ({ 0: { attack: t % 30 === 0 } }));
  assert.equal(out.foe.hp, out.foe.maxHp, 'no shooting out of the base');
  const shot = duel({ mapId, a: { ...inside }, b: { x: outside.x + gate.dc * TILE * 2, y: inside.y, aim: toBase, weapons: ['blaster', null, null, null] } });
  run(shot.state, 120, t => ({ 4: { attack: t % 30 === 0 } }));
  assert.equal(shot.me.hp, shot.me.maxHp, 'rounds stop at the barrier');
  assert.ok(events(shot.state, 'barrier').length > 0, 'and spark on it');
});

test('rapid presses flow through the combo while cuts land; whiffs break it; aim in the middle of the cut hits clean', () => {
  const move = WEAPONS.brand.combo[0];
  // Pressing rapidly on a target chains the whole combo, as in Spiral Knights.
  const flow = duel({ gap: 50, a: { cls: 'recon' } });
  run(flow.state, 150, t => ({ 0: { attack: t % 4 === 0 } }));
  assert.deepEqual(events(flow.state, 'swing').slice(0, 3).map(event => event.step), [0, 1, 2], 'the presses flow into the next cuts');
  // At air, the same presses never chain: every miss starts the combo over.
  const spam = duel({ gap: 300, a: { cls: 'recon' } });
  run(spam.state, 150, t => ({ 0: { attack: t % 4 === 0 } }));
  assert.ok(events(spam.state, 'swing').every(event => event.step === 0), 'whiffs never chain');
  // A whiff recovers for a long time.
  const air = duel({ gap: 300 });
  run(air.state, 1, () => ({ 0: { attack: true } }));
  run(air.state, swingTicks(move));
  assert.equal(air.me.action, 'swing', 'still stuck recovering from the miss');
  assert.ok(air.me.swingRecovery >= BLADE.whiffMin, 'a long recovery');
  // Aim: a target in the middle of the cut is a clean hit at full damage; off to the side it deals less.
  const hitAt = offset => {
    const d = duel({ gap: 50, a: { cls: 'recon', aim: offset } });
    run(d.state, swingTicks(move) + BLADE.hitStop * 2, t => ({ 0: { attack: t === 0, aim: offset } }));
    return { clean: events(d.state, 'clean').length, dealt: events(d.state, 'damage').find(event => event.targetId === 4)?.amount ?? 0 };
  };
  const centre = hitAt(0), side = hitAt(move.arc / 2 * .9);
  assert.equal(centre.clean, 1); assert.equal(side.clean, 0);
  assert.ok(side.dealt > 0 && side.dealt < centre.dealt, 'an edge hit deals less than a clean one');
});

test('sweep, close in, swap, follow up: a sweeping cut leaves the target reeling for a heavier blade', () => {
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'recon', weapons: ['thorn', 'greatblade', null, null] } });
  assert.ok(L.CUTS[WEAPONS.thorn.cut].reel, 'the Briar Blade sweeps');
  run(state, 1, () => ({ 0: { attack: true } }));
  let waited = 0; while (!events(state, 'reel').length && waited++ < 60) run(state, 1);
  assert.ok(foe.reelTicks > 0, 'the sweep leaves them reeling');
  // Swap cancel: switching to the heavy blade drops the sweep's recovery.
  run(state, BLADE.hitStop + 2);
  run(state, 1, () => ({ 0: { slot2: true } }));
  assert.equal(me.slot, 1); assert.ok(events(state, 'cancel').some(event => event.by === 'swap'));
  // Close in and cut: a heavy follow-up.
  Object.assign(me, { x: foe.x - 50, y: foe.y, aim: 0 });
  run(state, BLADE.swapLag + 1);
  run(state, 1, () => ({ 0: { attack: true } }));
  run(state, WEAPONS.greatblade.combo[0].startup + WEAPONS.greatblade.combo[0].active + BLADE.hitStop * 2);
  const follow = events(state, 'followUp');
  assert.equal(follow.length, 1); assert.ok(follow[0].heavy, 'a heavy follow-up');
  assert.equal(foe.reelTicks, 0, 'the follow-up uses the reel up');
  // A dash shakes the reel off.
  const shake = duel({ gap: 50, a: { cls: 'recon', weapons: ['thorn', null, null, null] } }), startX = shake.foe.x;
  run(shake.state, 1, () => ({ 0: { attack: true } }));
  waited = 0; while (!shake.foe.reelTicks && waited++ < 60) run(shake.state, 1);
  run(shake.state, 40);
  assert.ok(shake.foe.x - startX > 30, 'the sweep knocks them well back');
  run(shake.state, 1, () => ({ 4: { dash: true, left: true } }));
  assert.equal(shake.foe.reelTicks, 0);
});

test('sweep them out of reach, switch to the gun, shoot: every shot lands harder while they reel, and they are slowed', () => {
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'recon', weapons: ['thorn', 'blaster', null, null] } });
  run(state, 1, () => ({ 0: { attack: true } }));
  let waited = 0; while (!foe.reelTicks && waited++ < 60) run(state, 1);
  run(state, BLADE.hitStop + 1);
  run(state, 1, () => ({ 0: { slot2: true } }));
  assert.equal(me.slot, 1, 'the swap cancels the sweep');
  // Reeling slows them down.
  const before = foe.x;
  run(state, 12, () => ({ 4: { left: true } }));
  const reelingStep = before - foe.x;
  // Shoot twice while they reel.
  run(state, BLADE.swapLag + 1);
  run(state, 40, t => ({ 0: { attack: t === 0 || t === 30, aim: Math.atan2(foe.y - me.y, foe.x - me.x) } }));
  const shots = events(state, 'damage').filter(event => event.targetId === 4 && event.kind !== 'blade');
  assert.ok(shots.length >= 2, 'both shots land');
  assert.equal(events(state, 'followUp').filter(event => event.gun).length, 1, 'one follow-up callout');
  assert.ok(foe.reelTicks > 0, 'shooting does not use the reel up');
  for (const shot of shots) assert.ok(Math.abs(shot.amount - Math.round(WEAPONS.blaster.damage * L.FIGHT.reel.gun)) <= 1, 'each shot lands harder');
  // Once the reel wears off they walk at full speed again.
  run(state, L.FIGHT.reel.ticks);
  const free = foe.x; run(state, 12, () => ({ 4: { left: true } }));
  assert.ok(reelingStep < (free - foe.x) * .75, 'reeling knights are slowed');
});

test('sweep, boost, sweep: a Striker Boost pressed as soon as a cut lands cancels the rest of it', () => {
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'striker', weapons: ['thorn', null, null, null] } });
  run(state, 1, () => ({ 0: { attack: true } }));
  let waited = 0; while (!me.hitIds.length && waited++ < 40) run(state, 1);
  run(state, BLADE.hitStop + 1);
  const elapsed = me.actionTotal - me.actionTicks;
  assert.ok(elapsed < me.swingStartup + me.swingActive, 'still mid-sweep when Boost is pressed');
  run(state, 1, () => ({ 0: { ability: true, right: true } }));
  assert.equal(me.action, 'idle'); assert.ok(events(state, 'cancel').some(event => event.by === 'ability' || event.by === 'dodge'), 'Boost cancels the landed cut');
  // Close in under Boost and sweep again: the target is still reeling.
  run(state, 30, () => ({ 0: { ability: true, right: foe.x - me.x > 45 } }));
  run(state, 1, () => ({ 0: { attack: true } }));
  waited = 0; while (events(state, 'damage').filter(event => event.targetId === 4).length < 2 && waited++ < 60) run(state, 1);
  assert.equal(events(state, 'damage').filter(event => event.targetId === 4).length, 2, 'the second sweep lands');
  // A whiffed cut cannot be cancelled before its recovery.
  const air = duel({ gap: 300, a: { cls: 'striker', weapons: ['thorn', null, null, null] } });
  run(air.state, 1, () => ({ 0: { attack: true } }));
  run(air.state, 5);
  run(air.state, 1, () => ({ 0: { ability: true } }));
  assert.equal(air.me.action, 'swing', 'no cancel before a whiff has played out');
});

test('the off-hand cancel: the class button cancels a landed cut even when the ability itself cannot fire', () => {
  for (const [cls, setup] of [['recon', { abilityCooldown: 999 }], ['striker', { boostMeter: 0 }], ['guardian', { guardBroken: true }]]) {
    const { state, me } = duel({ gap: 50, a: { cls, weapons: ['brand', null, null, null] } });
    run(state, 1, () => ({ 0: { attack: true } }));
    let waited = 0; while (!me.hitIds.length && waited++ < 40) run(state, 1);
    run(state, BLADE.hitStop + 1);
    Object.assign(me, setup);
    run(state, 1, () => ({ 0: { ability: true } }));
    assert.equal(me.action, 'idle', `${cls}: the press cancels the cut`);
    assert.ok(events(state, 'cancel').length === 1, `${cls}: one cancel`);
    // and the next cut comes after the short cancel lag
    run(state, BLADE.cancelLag, () => ({ 0: { attack: true } }));
    run(state, 2);
    assert.equal(me.action, 'swing', `${cls}: swinging again right away`);
  }
});

test('heavy momentum: the second blow winds up faster and hits far harder, and a miss is punished hard', () => {
  for (const id of ['cleaver', 'greatblade', 'hexblade']) {
    const [first, second] = WEAPONS[id].combo;
    assert.ok(first.startup <= WEAPONS.brand.combo[0].startup + 1, `${id}: the first swing is a normal one`);
    assert.ok(second.momentum && second.damage > first.damage * 1.5, `${id}: then a heavy momentum blow`);
  }
  const land = () => {
    const d = duel({ gap: 50, a: { cls: 'recon', weapons: ['greatblade', null, null, null] } });
    run(d.state, 1, () => ({ 0: { attack: true } }));
    let waited = 0; while (!d.me.hitIds.length && waited++ < 60) run(d.state, 1);
    run(d.state, BLADE.hitStop + 1);
    return d;
  };
  // Chained after a landed first cut, the second blow carries momentum.
  const hit = land();
  run(hit.state, 1, () => ({ 0: { attack: true } }));
  run(hit.state, 80);
  const swings = events(hit.state, 'swing');
  assert.equal(swings.length, 2); assert.ok(swings[1].momentum);
  const dealt = events(hit.state, 'damage').filter(event => event.targetId === 4).map(event => event.amount);
  assert.ok(dealt[1] > dealt[0] * 1.5, 'the momentum blow lands far harder');
  // Whiffed: a much longer recovery than an ordinary miss.
  const miss = land();
  run(miss.state, 1, () => ({ 0: { attack: true } }));
  Object.assign(miss.foe, { x: miss.foe.x + 400 });
  let waited = 0; while (!miss.me.whiffed && waited++ < 120) run(miss.state, 1);
  assert.ok(miss.me.swingMomentum && miss.me.whiffed);
  assert.ok(miss.me.swingRecovery >= BLADE.whiffMin * BLADE.momentumWhiff, 'spun round and wide open');
});

test('the six-shooter fires six light shots as fast as you click, then reloads quickly; sabres sweep and stun', () => {
  const gun = WEAPONS.sixgun;
  assert.equal(gun.clip, 6); assert.ok(gun.interval < WEAPONS.blaster.interval && gun.damage < WEAPONS.blaster.damage);
  const { state, me } = duel({ gap: 200, a: { cls: 'recon', weapons: ['sixgun', null, null, null] } });
  run(state, 6 * (gun.interval + 1), t => ({ 0: { attack: t % (gun.interval + 1) === 0 } }));
  assert.equal(events(state, 'shot').length, 6, 'six shots in under a second');
  assert.equal(me.clips.sixgun, 0);
  for (const id of ['sabre', 'flamesabre', 'frostsabre', 'stormsabre']) {
    const sabre = WEAPONS[id];
    assert.equal(sabre.cut, 'sweeping'); assert.ok(sabre.combo[0].stun >= WEAPONS.brand.combo[0].stun, `${id} stuns hard`);
  }
  assert.equal(WEAPONS.flamesabre.onHit.status, 'burn');
});

test('the katana: the narrowest cut; a clean hit lands extra hard, an edge hit barely scratches', () => {
  const katana = WEAPONS.katana, move = katana.combo[0];
  assert.ok(move.arc < WEAPONS.blazebrand.combo[0].arc, 'narrower than the elemental swords');
  const hitAt = offset => {
    const d = duel({ gap: 50, a: { cls: 'recon', aim: offset, weapons: ['katana', null, null, null] } });
    run(d.state, swingTicks(move) + BLADE.hitStop * 2, t => ({ 0: { attack: t === 0, aim: offset } }));
    return events(d.state, 'damage').find(event => event.targetId === 4)?.amount ?? 0;
  };
  const clean = hitAt(0), edge = hitAt((move.arc / 2 + Math.atan2(L.RULES.radius, 50)) * .8); // near the edge of the cut
  assert.ok(Math.abs(clean - Math.round(move.damage * katana.aim.clean)) <= 1, 'a clean hit lands 30% harder');
  assert.ok(edge > 0 && edge <= Math.ceil(move.damage * katana.aim.graze), 'an edge hit deals half');
  for (const id of ['sixgun', 'embersixgun', 'peacemaker']) assert.equal(WEAPONS[id].clip, 6, `${id} is a six-shooter`);
});

test('the katana and the three-cut elemental swords end on a critical; narrow swords reach further', () => {
  for (const id of ['katana', 'blazebrand', 'frostbite', 'avenger']) {
    const combo = WEAPONS[id].combo;
    assert.equal(combo.length, 3); assert.ok(combo[2].critical && !combo[0].critical, `${id} ends on a critical`);
  }
  assert.ok(WEAPONS.katana.combo[0].reach > WEAPONS.brand.combo[0].reach, 'the katana reaches further than a plain sword');
  const { state } = duel({ gap: 50, a: { cls: 'recon', weapons: ['katana', null, null, null] } });
  run(state, 200, t => ({ 0: { attack: t % 4 === 0 } }));
  assert.ok(events(state, 'critical').length >= 1, 'the third cut lands as a critical');
});

test('against spam: opening cuts stun briefly, the finisher is committal, and a Guardian can parry', () => {
  const brand = WEAPONS.brand.combo;
  // An opening cut stuns for half its listed stun, so the target can answer before the next cut lands.
  const open = duel({ gap: 50, a: { cls: 'recon' } });
  run(open.state, 1, () => ({ 0: { attack: true } }));
  let waited = 0; while (!open.me.hitIds.length && waited++ < 40) run(open.state, 1);
  assert.ok(open.foe.stunTicks <= Math.round(brand[0].stun * BLADE.chainStun), 'a short stun');
  // The finisher: a long recovery that cannot be cancelled at first, and you are exposed while it plays out.
  const last = duel({ gap: 50, a: { cls: 'recon' }, b: { hp: 1e4, maxHp: 1e4 } });
  let t = 0; while (!(last.me.action === 'swing' && last.me.swingFinisher && last.me.hitIds.length) && t++ < 400) run(last.state, 1, () => ({ 0: { attack: t % 4 === 0 } }));
  assert.ok(last.me.swingFinisher, 'reached the finisher');
  run(last.state, BLADE.hitStop * 2 + last.me.swingActive);
  assert.ok(last.me.swingRecovery >= Math.round(brand[2].recovery * BLADE.finisherRecovery) - 1, 'a long recovery');
  run(last.state, 1, () => ({ 0: { ability: true } }));
  assert.equal(last.me.action, 'swing', 'the off-hand cannot cancel the start of it');
  Object.assign(last.foe, { stunTicks: 0 });
  run(last.state, 30, k => ({ 4: { attack: k === 0, aim: Math.atan2(last.me.y - last.foe.y, last.me.x - last.foe.x) } }));
  assert.ok(events(last.state, 'counter').some(event => event.targetId === last.me.id), 'hitting a knight in their finisher recovery is a counter');
  // Parry: a shield raised just before the cut lands turns it aside.
  const parry = duel({ gap: 50, a: { cls: 'recon' }, b: { cls: 'guardian' } });
  const lands = brand[0].startup + Math.ceil(brand[0].active / 2);
  run(parry.state, lands + 4, k => ({ 0: { attack: k === 0 }, 4: { ability: k >= lands - GUARD.raiseTicks - 2 } }));
  assert.equal(events(parry.state, 'parry').length, 1, 'parried');
  assert.equal(parry.foe.guardHp, GUARD.max, 'the shield takes nothing');
  assert.ok(parry.me.stunTicks > 0 && parry.me.parriedTicks > 0, 'the attacker is stunned and left open');
});
