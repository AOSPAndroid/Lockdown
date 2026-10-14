import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../public/lockdown-engine.js';

const TILE = 48;
function dojo() {
  const state = L.createState({ mapId: 'dojo', seed: 7 });
  L.setConnected(state, 0, true, 'Trainee');
  L.setPlayerSetup(state, 0, { cls: 'striker', weapons: ['brand', 'blaster', 'blast', null] });
  L.startMatch(state, [0]);
  return state;
}
const hitsOn = (state, targetId) => state.events.filter(event => event.tick === state.tick && event.type === 'damage' && event.targetId === targetId);

test('the Dojo is a training map outside the match rotation', () => {
  assert.ok(L.MAPS.dojo.training);
  assert.ok(!L.MAP_IDS.includes('dojo'));
  const lobby = L.createState({ mapId: L.MAP_IDS[0] });
  assert.equal(lobby.mode, 'match');
  assert.equal(L.selectMap(lobby, 'dojo').ok, false);
});

test('the Dojo starts at once with four dummies and benches the other bots', () => {
  const state = dojo();
  assert.equal(state.mode, 'dojo');
  assert.equal(state.phase, 'fight');
  const dummies = state.players.filter(player => player.dummy);
  assert.deepEqual(dummies.map(player => player.dummy), L.DOJO_DUMMIES.map(spec => spec.kind));
  for (const player of dummies) {
    assert.equal(player.team, 1); assert.ok(player.alive); assert.equal(player.shieldTicks, 0);
    assert.ok(Math.hypot(player.x - player.home.x, player.y - player.home.y) < 1, `${player.name} stands on its mark`);
  }
  assert.equal(state.players.find(player => player.dummy === 'high').z, 1, 'one dummy stands on a gallery');
  const benched = state.players.filter(player => player.benched);
  assert.equal(benched.length, 3);
  for (let t = 0; t < 120 * 20; t++) L.step(state, []);
  assert.ok(benched.every(player => !player.alive), 'benched bots never come in');
  assert.ok(state.players.filter(player => player.dummy === 'still').every(player => Math.hypot(player.x - player.home.x, player.y - player.home.y) < 1), 'still dummies stay put');
});

test('loadouts change anywhere in the Dojo, and the match never scores or ends', () => {
  const state = dojo(), me = state.players[0];
  me.x = 15 * TILE; me.y = 9.5 * TILE;
  assert.ok(!L.inBase(state, me));
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'guardian', weapons: ['maul', 'rifle', null, null] }), { ok: true });
  assert.equal(me.cls, 'guardian'); assert.equal(me.weapons[0], 'maul');
  // Standing on the ring does nothing: no captures, no score, no clock.
  for (let t = 0; t < 120 * 30; t++) L.step(state, []);
  assert.deepEqual(state.scores, [0, 0]);
  assert.equal(state.phase, 'fight');
  assert.equal(state.timeLeftTicks, L.RULES.timeLimitTicks);
});

test('dummies refill when left alone and come back to their mark after a knockout', () => {
  const state = dojo(), me = state.players[0], dummy = state.players.find(player => player.dummy === 'still');
  dummy.hp = 20; dummy.lastHurtTick = state.tick;
  for (let t = 0; t < 120 * 2 + 5; t++) L.step(state, []);
  assert.equal(dummy.hp, dummy.maxHp);
  let knockedAt = null, backAt = null;
  for (let t = 0; t < 120 * 40 && backAt === null; t++) {
    if (dummy.alive && knockedAt === null) { me.x = dummy.x - 40; me.y = dummy.y; me.z = dummy.z; }
    L.step(state, [{ attack: t % 20 < 2, aim: Math.atan2(dummy.y - me.y, dummy.x - me.x) }]);
    for (const event of state.events) if (event.tick === state.tick && event.targetId === dummy.id && event.type === 'kill') knockedAt = state.tick;
    for (const event of state.events) if (event.tick === state.tick && event.playerId === dummy.id && event.type === 'respawn') backAt = state.tick;
  }
  assert.ok(knockedAt !== null, 'the dummy can be knocked out');
  assert.ok(backAt - knockedAt <= 120 * 2 + 2, 'and is back within two seconds');
  assert.ok(Math.hypot(dummy.x - dummy.home.x, dummy.y - dummy.home.y) < 1, 'on its mark');
});

test('a full charge on a dummy hits harder than a tap', () => {
  const state = dojo(), me = state.players[0], dummy = state.players.find(player => player.dummy === 'still' && player.cls === 'guardian');
  const strike = hold => {
    me.x = dummy.x - 44; me.y = dummy.y; me.z = dummy.z; dummy.hp = dummy.maxHp;
    const aim = Math.atan2(dummy.y - me.y, dummy.x - me.x);
    // Holding attack swings once, then charges; count only what lands from the release on.
    let dealt = 0, released = hold < 10;
    for (let t = 0; t < hold + 160; t++) {
      L.step(state, [{ attack: t < hold, aim }]);
      released ||= state.events.some(event => event.tick === state.tick && event.type === 'chargeRelease' && event.playerId === 0);
      if (released) dealt += hitsOn(state, dummy.id).reduce((sum, event) => sum + event.amount, 0);
    }
    for (let t = 0; t < 120 * 3; t++) L.step(state, []);
    return dealt;
  };
  const tap = strike(2), charged = strike(Math.ceil(L.chargeTicksFor(me, L.WEAPONS.brand) * 1.6) + 80);
  assert.ok(tap > 0, 'a tap lands');
  assert.ok(charged > tap * 1.5, `charge ${charged} vs tap ${tap}`);
});

test('the moving dummy walks back and forth; sparring makes it fight back', () => {
  const state = dojo(), me = state.players[0], mover = state.players.find(player => player.dummy === 'strafe');
  const rows = [];
  for (let t = 0; t < 120 * 10; t++) { L.step(state, []); rows.push(mover.y / TILE); }
  assert.ok(Math.max(...rows) - Math.min(...rows) > 4, 'it covers several tiles');
  assert.deepEqual(L.setDojoSpar(state, true), { ok: true });
  assert.equal(mover.dummy, 'spar');
  me.x = 15 * TILE; me.y = 9.5 * TILE;
  let taken = 0;
  for (let t = 0; t < 120 * 20; t++) { L.step(state, []); taken += hitsOn(state, 0).reduce((sum, event) => sum + event.amount, 0); }
  assert.ok(taken > 0, 'the sparring partner attacks');
  L.setDojoSpar(state, false);
  assert.equal(mover.dummy, 'strafe');
});
