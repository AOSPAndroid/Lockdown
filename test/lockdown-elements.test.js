import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { isBlocked } from '../public/lockdown-maps.js';

const { WEAPONS, STATUS, MAPS, RULES, TILE } = L;

function duel({ mapId = 'temple', a = {}, b = {}, gap = 60, third = null } = {}) {
  const state = L.createState({ mapId, seed: 11 });
  L.setConnected(state, 0, true, 'Ada'); L.setConnected(state, 4, true, 'Bo');
  L.startMatch(state, [0, 4]);
  state.phase = 'fight'; state.phaseTicks = 0;
  const point = MAPS[mapId].points[1];
  for (const player of state.players) if (player.id !== 0 && player.id !== 4) Object.assign(player, { bot: false, human: false, alive: false, respawnTicks: 1e9 });
  const me = state.players[0], foe = state.players[4];
  Object.assign(me, { x: point.x - gap / 2, y: point.y, aim: 0, shieldTicks: 0, slot: 0 }, a);
  Object.assign(foe, { x: point.x + gap / 2, y: point.y, aim: Math.PI, shieldTicks: 0, hp: 400, maxHp: 400 }, b);
  if (third) Object.assign(state.players[5], { alive: true, x: foe.x + 50, y: foe.y + 30, hp: 400, maxHp: 400, shieldTicks: 0, ...third });
  for (const player of state.players) player.clips = Object.fromEntries(player.weapons.filter(id => WEAPONS[id]?.family === 'gun').map(id => [id, WEAPONS[id].clip]));
  state.events = [];
  return { state, me, foe };
}
function run(state, ticks, controls = () => ({})) {
  for (let t = 0; t < ticks; t++) {
    const c = controls(t), inputs = [];
    for (const id of [0, 4]) inputs[id] = { ...L.emptyInput(state.players[id].aim), ...(c[id] || {}) };
    L.step(state, inputs);
  }
}
const events = (state, type) => state.events.filter(event => event.type === type);

test('the frost gun freezes in two hits; bullets leave the ice whole, a sword hit shatters it', () => {
  const { state, me, foe } = duel({ a: { weapons: ['frostgun', 'brand', 'blast'] }, gap: 160, b: { hp: 1e4, maxHp: 1e4 } });
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.status.chill > 0, true); assert.equal(foe.chillStacks, 2, 'a frost round chills twice over');
  // A chilled knight walks slower than a fresh one.
  const fresh = duel({ gap: 160 });
  const walk = s => { const p = s.players[4], x = p.x; run(s, 20, () => ({ 4: { up: true } })); return Math.abs(p.y - 600) + Math.abs(p.x - x); };
  const chilled = duel({ gap: 160 }); chilled.foe.status.chill = 200; chilled.foe.chillStacks = 2;
  assert.ok(walk(chilled.state) < walk(fresh.state) * .8, 'two chill stacks slow you down');
  me.fireCooldown = 0;
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.ok(foe.status.freeze > 0, 'the second frost round freezes'); assert.equal(foe.chillStacks, 0); assert.equal(foe.status.chill, 0);
  // More bullets don't break the ice.
  me.clips.frostgun = WEAPONS.frostgun.clip;
  run(state, 20, t => ({ 0: { attack: t === 0 } }));
  assert.ok(foe.status.freeze > 0, 'still frozen after another bullet');
  // A sword cut shatters it: extra damage, a SHATTER, and a short immunity so it cannot chain-freeze.
  Object.assign(foe, { x: me.x + 50, y: me.y, stunTicks: 0 });
  me.slot = 1; me.actionTicks = 0; me.action = 'idle';
  const before = foe.hp;
  run(state, 40, t => ({ 0: { attack: t === 0, aim: 0 } }));
  assert.equal(foe.status.freeze, 0); assert.ok(foe.freezeImmune > 0);
  assert.equal(events(state, 'shatter').length, 1, 'shattered');
  assert.ok(before - foe.hp > 0);
});

test('frozen knights cannot move, dash or shield, but can still turn and swing', () => {
  const { state, foe } = duel({ gap: 300, b: { cls: 'guardian', weapons: ['brand', null, null, null], slot: 0 } });
  foe.status.freeze = 120;
  const x0 = foe.x, y0 = foe.y;
  run(state, 30, t => ({ 4: { left: true, up: true, dash: t === 0, ability: true, aim: 1 } }));
  assert.equal(foe.x, x0); assert.equal(foe.y, y0); assert.equal(foe.guarding, false);
  assert.ok(Math.abs(foe.aim - 1) < 1e-6, 'turns in the ice');
  run(state, 1, () => ({ 4: { attack: true, aim: 1 } }));
  assert.equal(foe.action, 'swing', 'and swings');
  run(state, 30, () => ({ 4: { aim: 1 } }));
  assert.equal(foe.x, x0, 'without stepping out of the ice');
});

test('Frostbite Edge freezes with its third cut', () => {
  const { state, foe } = duel({ a: { weapons: ['frostbite', 'blaster', 'blast'] } });
  let frozen = false;
  run(state, 160, t => { if (foe.status.freeze > 0) frozen = true; return { 0: { attack: t % 12 === 0 } }; });
  assert.ok(frozen, 'a three-cut combo freezes');
});

test('curse locks dash and class ability, including the Guardian shield', () => {
  const { state, foe } = duel({ b: { cls: 'striker' } });
  foe.status.curse = 200; foe.dashCooldown = 0; foe.abilityCooldown = 0;
  run(state, 2, t => ({ 4: { dash: t === 0, left: true } }));
  assert.equal(foe.dodgeTicks, 0); assert.ok(events(state, 'cursed').length > 0);
  run(state, 2, t => ({ 4: { ability: t === 0 } }));
  assert.equal(foe.dashTicks, 0, 'no Boost');
  const guard = duel({ b: { cls: 'guardian' } }); guard.foe.status.curse = 200;
  run(guard.state, 10, () => ({ 4: { ability: true } }));
  assert.equal(guard.foe.guarding, false);
  // Hexblade cuts can curse; its charged slam always does.
  const hex = duel({ a: { weapons: ['hexblade', 'blaster', 'blast'] } });
  hex.me.charging = true; hex.me.chargeTicks = L.chargeTicksFor(hex.me, WEAPONS.hexblade); hex.me.previousInput = { ...L.emptyInput(0), attack: true };
  run(hex.state, 80);
  assert.ok(hex.foe.status.curse > 0);
});

test('Sanguine Sickle heals the wielder for part of the damage dealt', () => {
  const { state, me, foe } = duel({ a: { weapons: ['sickle', 'blaster', 'blast'], hp: 40 } });
  const before = me.hp;
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  const dealt = 400 - foe.hp;
  assert.ok(dealt > 0);
  assert.ok(Math.abs(me.hp - before - dealt * WEAPONS.sickle.lifesteal) < 1e-6, `healed ${me.hp - before} of ${dealt}`);
  assert.ok(events(state, 'drain').length > 0);
});

test('Volt Fang arcs lightning to another enemy near the one it hits', () => {
  const { state, foe } = duel({ a: { weapons: ['voltedge', 'blaster', 'blast'] }, third: {} });
  const bystander = state.players[5];
  let chained = false;
  for (let i = 0; i < 40 && !chained; i++) { run(state, 20, t => ({ 0: { attack: t === 0 } })); chained = state.events.some(event => event.type === 'chain' && event.targetId === 5); }
  assert.ok(chained, 'lightning jumped');
  assert.ok(bystander.hp < 400, 'the bystander was never swung at but still took damage');
  assert.ok(foe.hp < 400);
});

test('elemental guns carry their status on rounds and charges', () => {
  // Ember Caster charge burns everything it passes through.
  const fire = duel({ a: { weapons: ['embercaster', 'brand', 'blast'] }, gap: 140 });
  fire.me.charging = true; fire.me.chargeTicks = L.chargeTicksFor(fire.me, WEAPONS.embercaster); fire.me.previousInput = { ...L.emptyInput(0), attack: true };
  run(fire.state, 80);
  assert.ok(fire.foe.status.burn > 0 || events(fire.state, 'damage').some(event => event.kind === 'burn'));
  // Grim Hand-cannon's explosive charge curses.
  const grim = duel({ a: { weapons: ['grimcannon', 'brand', 'blast'] }, gap: 160 });
  grim.me.charging = true; grim.me.chargeTicks = L.chargeTicksFor(grim.me, WEAPONS.grimcannon); grim.me.previousInput = { ...L.emptyInput(0), attack: true };
  run(grim.state, 60);
  assert.ok(grim.foe.status.curse > 0);
  // Every elemental weapon names a status the engine knows.
  for (const weapon of Object.values(WEAPONS)) {
    for (const status of [weapon.status, weapon.onHit?.status, weapon.charge?.status, weapon.cloud?.status, weapon.chain?.status]) if (status) assert.ok(STATUS[status] || status === 'mark', `${weapon.id}: ${status}`);
  }
});

test('bots carry a blade, a gun and a bomb from the whole armoury, and never pit-walking shoes', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const state = L.createState({ seed }); L.startMatch(state, []);
    for (const bot of state.players) {
      assert.deepEqual(bot.weapons.map(id => WEAPONS[id]?.family ?? null), ['blade', 'gun', 'bomb', null]);
      bot.weapons.filter(Boolean).forEach(id => seen.add(id));
      assert.equal(L.combineGear(bot).walk.length, 0);
    }
  }
  assert.ok(['frostbite', 'blazebrand', 'voltedge', 'sickle', 'hexblade', 'frostgun', 'embercaster', 'voltneedle', 'viper', 'grimcannon'].some(id => seen.has(id)));
});

test('arenas are walls and two floors: no pits anywhere, and the old pit shoes carry new perks', () => {
  for (const id of L.MAP_IDS) assert.ok(!MAPS[id].grid.join('').includes('~'), `${id} has no pits`);
  const gear = shoes => L.combineGear({ shoes });
  assert.ok(gear('striders').abilityCooldown < 1 && gear('striders').speedMultiplier > 1, 'Stride Boots: faster, quicker ability');
  assert.ok(gear('magma').statusDuration < 1 && gear('magma').bombResistance > 0, 'Magma Treads: shorter statuses, blast protection');
  assert.ok(gear('hover').knockback < 1, 'Hover Boots: less knockback');
  for (const shoes of Object.keys(L.SHOES)) assert.equal(gear(shoes).walk.length, 0, `${shoes} no longer walks on pits`);
  assert.ok(L.combineGear({ shoes: 'quicksilver' }).speedMultiplier > L.combineGear({ shoes: 'sneakers' }).speedMultiplier);
});

test('capture zones are open circles big enough for six knights', () => {
  assert.ok(RULES.pointRadius >= 128);
  for (const map of Object.values(MAPS)) for (const point of map.points) {
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      if (!isBlocked(map, col, row)) continue;
      const nx = Math.max(col * TILE, Math.min(point.x, (col + 1) * TILE)), ny = Math.max(row * TILE, Math.min(point.y, (row + 1) * TILE));
      assert.ok(Math.hypot(nx - point.x, ny - point.y) >= RULES.pointRadius, `${map.id} ${point.id}: tile ${col},${row} inside the zone`);
    }
  }
  // Six knights standing shoulder to shoulder all count for the point.
  const state = L.createState({ mapId: 'keep', seed: 2 }); L.startMatch(state, []); state.phase = 'fight';
  const point = MAPS.keep.points[1], team = state.players.filter(player => player.team === 0);
  const ring = [...team, ...state.players.filter(player => player.team === 1).slice(0, 2)];
  ring.forEach((player, i) => Object.assign(player, { x: point.x + Math.cos(i / ring.length * Math.PI * 2) * 80, y: point.y + Math.sin(i / ring.length * Math.PI * 2) * 80 }));
  for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) assert.ok(Math.hypot(ring[i].x - ring[j].x, ring[i].y - ring[j].y) >= RULES.radius * 2);
  assert.equal(ring.filter(player => Math.hypot(player.x - point.x, player.y - point.y) <= RULES.pointRadius).length, 6);
});

test('weapon traits: heavy swings are unflinching, the rapier tip hits harder, long shots and the maul shockwave', () => {
  // Heavy: hit mid-swing, the Maul keeps swinging (no stun) where a Knight Brand is stunned.
  for (const [weapon, unflinching] of [['maul', true], ['brand', false]]) {
    const { state, me, foe } = duel({ a: { weapons: [weapon, 'blaster', 'blast', null], hp: 400, maxHp: 400 }, b: { weapons: ['blaster', 'brand', 'blast', null] }, gap: 160 });
    run(state, 3, t => ({ 0: { attack: t === 0 } }));
    assert.equal(me.action, 'swing');
    run(state, 24, t => ({ 4: { attack: t === 0, aim: Math.PI } }));
    assert.ok(me.hp < 400, `${weapon} took the round`);
    assert.equal(events(state, 'unflinching').length > 0, unflinching, weapon);
  }
  // Rapier sweet spot: the same thrust at the tip of its reach deals 40% more.
  const thrust = gap => { const { state, foe } = duel({ a: { cls: 'recon', weapons: ['rapier', 'blaster', 'blast', null] }, gap }); run(state, 20, t => ({ 0: { attack: t === 0 } })); return { dealt: 400 - foe.hp, tip: state.events.some(e => e.type === 'sweetSpot') }; };
  const close = thrust(40), far = thrust(WEAPONS.rapier.combo[0].reach * .9);
  assert.equal(close.tip, false); assert.equal(far.tip, true);
  assert.equal(far.dealt, Math.round(WEAPONS.rapier.combo[0].damage * WEAPONS.rapier.sweetSpot.bonus));
  // Longshot Rifle: more damage the farther it flies.
  const shoot = gap => { const { state, foe } = duel({ mapId: 'temple', a: { cls: 'guardian', weapons: ['rifle', 'brand', 'blast', null] }, gap }); run(state, 50, t => ({ 0: { attack: t === 0 } })); return 400 - foe.hp; };
  const near = shoot(120), longer = shoot(600);
  assert.equal(near, WEAPONS.rifle.damage); assert.ok(longer >= near * 1.25, `${longer} vs ${near}`);
  // Maul: the second blow shakes the ground and hits a second knight beside the target.
  const { state, me, foe } = duel({ a: { cls: 'guardian', weapons: ['maul', 'blaster', 'blast', null] }, gap: 60, third: {} });
  state.players[5].x = foe.x; state.players[5].y = foe.y + 60;
  me.comboStep = 1; const blow = WEAPONS.maul.combo[1]; run(state, blow.startup + blow.active + 10, t => ({ 0: { attack: t === 0 } }));
  assert.ok(state.events.some(e => e.type === 'slam' && e.weapon === 'maul'));
  assert.ok(state.players[5].hp < 400, 'the shockwave reached the second knight');
});

test('guns bloom when fired back to back and settle when you pause', () => {
  const { state, me } = duel({ a: { weapons: ['blaster', 'brand', 'blast', null] }, gap: 300 });
  run(state, 40, t => ({ 0: { attack: t % 17 === 0 } }));
  const sprayed = me.bloom;
  assert.ok(sprayed > 0.05, `bloom built up (${sprayed})`);
  run(state, 120);
  assert.ok(me.bloom < sprayed / 2, 'settled after a pause');
  const rifle = duel({ a: { weapons: ['rifle', 'brand', 'blast', null] } });
  run(rifle.state, 2, t => ({ 0: { attack: t === 0 } }));
  assert.ok(rifle.me.bloom >= WEAPONS.rifle.bloom - .01, 'precise guns bloom hardest');
});

test('elemental guns and swords always set their effect off: the meter fills in a set number of hits', () => {
  const { BUILD } = L;
  const effect = (foe, status) => status === 'mark' ? foe.markTicks > 0 : foe.status[status] > 0;
  for (const weapon of Object.values(WEAPONS).filter(w => (w.build || w.onHit?.build) && w.family !== 'bomb')) {
    const status = weapon.status || weapon.onHit.status, need = Math.ceil(BUILD.full / (weapon.build || weapon.onHit.build));
    const { state, me, foe } = duel({ gap: weapon.family === 'gun' ? 160 : 50, a: { cls: 'recon', weapons: [weapon.id, null, null, null], slot: 0 }, b: { hp: 1e5, maxHp: 1e5, domeHp: 0, domeBroken: true } });
    let hits = 0, at = null;
    for (let t = 0; t < 3000 && at === null; t++) {
      if (me.clips?.[weapon.id] === 0) me.clips[weapon.id] = weapon.clip;
      run(state, 1, () => ({ 0: { attack: t % 4 === 0, aim: 0 } }));
      hits += events(state, 'damage').filter(event => event.playerId === 0 && event.targetId === foe.id && event.kind !== 'chain').length; state.events.length = 0;
      if (effect(foe, status)) at = hits;
      Object.assign(foe, { x: me.x + (weapon.family === 'gun' ? 160 : 50), y: me.y });
    }
    assert.equal(at, need, `${weapon.id}: ${status} on hit ${need}`);
  }
});
