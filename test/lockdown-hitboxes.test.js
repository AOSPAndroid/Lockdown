import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { levelAt } from '../public/lockdown-maps.js';

const { RULES, WEAPONS, MAPS, TILE } = L;

/** Seat 0 (Amber) against seats 4 and 5 (Cyan) on the given map; every other seat sits out. */
function arena({ mapId = 'temple', me = {}, foes = [{}] } = {}) {
  const state = L.createState({ mapId, seed: 3 });
  const seats = [0, ...foes.map((_, i) => 4 + i)];
  L.setConnected(state, 0, true, 'Ada'); for (const seat of seats.slice(1)) L.setConnected(state, seat, true, `Foe ${seat}`);
  L.startMatch(state, seats); state.phase = 'fight'; state.phaseTicks = 0;
  for (const player of state.players) if (!seats.includes(player.id)) Object.assign(player, { bot: false, human: false, alive: false, respawnTicks: 1e9 });
  const point = MAPS[mapId].points[1];
  const knights = seats.map((seat, i) => Object.assign(state.players[seat], { x: point.x, y: point.y, aim: 0, shieldTicks: 0, slot: 0, bot: false, hp: 400, maxHp: 400 }, i ? foes[i - 1] : me));
  for (const knight of knights) knight.clips = Object.fromEntries(knight.weapons.filter(id => WEAPONS[id]?.family === 'gun').map(id => [id, WEAPONS[id].clip]));
  state.events = [];
  return { state, me: knights[0], foes: knights.slice(1) };
}
function run(state, ticks, controls = () => ({})) {
  for (let t = 0; t < ticks; t++) {
    const c = controls(t), inputs = [];
    for (const player of state.players) inputs[player.id] = { ...L.emptyInput(player.aim), aim: player.aim, ...(c[player.id] || {}) };
    L.step(state, inputs);
  }
}
const at = (col, row) => ({ x: (col + .5) * TILE, y: (row + .5) * TILE });

test('a round hits a knight pressed right up against the muzzle', () => {
  const { state, me, foes: [foe] } = arena({ me: { weapons: ['blaster', null, null, null] } });
  Object.assign(foe, { x: me.x + 2, y: me.y + 1 });
  run(state, 1, () => ({ 0: { attack: true } })); run(state, 30);
  assert.ok(foe.hp < 400, 'point blank still hits');
});

test('a round stops on the first knight in its path', () => {
  const { state, me, foes: [far, near] } = arena({ me: { weapons: ['blaster', null, null, null] }, foes: [{}, {}] });
  // The farther knight has the lower seat, so a plain seat-order check would pick it.
  Object.assign(near, { x: me.x + 60, y: me.y + 12 }); Object.assign(far, { x: me.x + 68, y: me.y - 12 });
  run(state, 1, () => ({ 0: { attack: true } })); run(state, 30);
  assert.ok(near.hp < 400, 'the nearer knight takes the round'); assert.equal(far.hp, 400, 'and it stops there');
});

test("a sword slam stays on the swinger's floor; it does not reach down a cliff", () => {
  const charge = (mapId, mine, theirs) => {
    const { state, me, foes: [foe] } = arena({ mapId, me: { weapons: ['cleaver', null, null, null], ...mine, aim: Math.PI / 2 }, foes: [theirs] });
    const hold = L.chargeTicksFor(me, WEAPONS.cleaver) * 2;
    run(state, hold, () => ({ 0: { attack: true } })); run(state, 60);
    return { foe, state };
  };
  const map = MAPS.ramparts, top = at(7, 5), below = at(7, 6);
  assert.equal(levelAt(map, top.x, top.y), 1); assert.equal(levelAt(map, below.x, below.y), 0);
  const across = charge('ramparts', top, { ...below, x: below.x + 10 });
  assert.ok(L.lineOfSight(map, { ...top, z: 1 }, below), 'in plain sight of each other');
  assert.equal(across.foe.hp, 400, 'the knight below the rampart is untouched');
  assert.ok(across.state.events.some(event => event.type === 'slam'), 'the slam did happen');
  // The same slam on one floor lands.
  const same = charge('temple', {}, {});
  same.foe.hp = 400; const { state, me, foes: [foe] } = arena({ me: { weapons: ['cleaver', null, null, null], aim: Math.PI / 2 } });
  Object.assign(foe, { x: me.x, y: me.y + 48 });
  run(state, L.chargeTicksFor(me, WEAPONS.cleaver) * 2, () => ({ 0: { attack: true } })); run(state, 60);
  assert.ok(foe.hp < 400, 'on one floor the slam hits');
});

test("knights don't settle inside each other, yet you still walk straight through one", () => {
  const { state, me, foes: [foe] } = arena();
  Object.assign(foe, { x: me.x + 4, y: me.y });
  run(state, 120);
  assert.ok(Math.hypot(foe.x - me.x, foe.y - me.y) >= RULES.radius - 1, 'they ease apart');
  // Walking straight through still works: the push is soft.
  Object.assign(foe, { x: me.x + 40, y: me.y });
  run(state, 60, () => ({ 0: { right: true } }));
  assert.ok(me.x > foe.x, 'you can still walk past a knight');
});

test('every sword reaches about as far as its blade is drawn: no cut hits much past the steel', () => {
  // The renderer sizes each sword to its reach; the reaches themselves stay in a sane band.
  for (const weapon of Object.values(WEAPONS)) if (weapon.family === 'blade') for (const move of weapon.combo) {
    if (move.kind === 'spin') continue;
    assert.ok(move.reach >= 60 && move.reach <= 115, `${weapon.id} ${move.kind} reach ${move.reach}`);
  }
});
