#!/usr/bin/env node
/** Weapon lab: every weapon against a standing dummy (docs/WEAPONS-AUDIT.md, Method 1). Prints JSON rows.  node tools/weapon-lab.mjs */
const L = await import('../public/lockdown-engine.js');
const { WEAPONS } = L;
function arena(weaponId, gap) {
  const state = L.createState({ mapId: 'temple', seed: 3 });
  L.setConnected(state, 0, true, 'A'); L.setConnected(state, 4, true, 'B'); L.startMatch(state, [0, 4]); state.phase = 'fight';
  for (const p of state.players) if (p.id !== 0 && p.id !== 4) Object.assign(p, { bot: false, alive: false, respawnTicks: 1e9 });
  const me = state.players[0], foe = state.players[4], pt = L.MAPS.temple.points[1];
  Object.assign(me, { cls: 'guardian', weapons: [weaponId, null, null, null], slot: 0, x: pt.x - gap / 2, y: pt.y + 96, aim: 0, shieldTicks: 0 });
  me.clips = WEAPONS[weaponId].family === 'gun' ? { [weaponId]: WEAPONS[weaponId].clip } : {};
  Object.assign(foe, { weapons: [null, null, null, null], x: pt.x + gap / 2, y: pt.y + 96, shieldTicks: 0, hp: 1e6, maxHp: 1e6 });
  return { state, me, foe };
}
function run({ state, me, foe }, ticks, control, gap, from = 0) {
  let dealt = 0, prev = {}; const hold = { x: foe.x, y: foe.y };
  for (let t = 0; t < ticks; t++) {
    Object.assign(foe, { x: hold.x, y: hold.y, hp: 1e6, stunTicks: 0 }); me.x = hold.x - gap; me.y = hold.y;
    const input = { ...L.emptyInput(0), ...control(t, me, prev) }; const inputs = []; inputs[0] = input; inputs[4] = L.emptyInput(Math.PI); prev = input;
    L.step(state, inputs);
    if (t >= from) for (const e of state.events) if (e.tick === state.tick && e.type === 'damage' && e.targetId === 4) dealt += e.amount;
  }
  return dealt;
}
const rows = [];
for (const [id, w] of Object.entries(WEAPONS)) {
  const row = { id, family: w.family, name: w.name };
  if (w.family === 'blade') {
    const reach = w.combo[0].reach, gap = Math.min(55, reach - 10);
    const T = 8 * 120;
    row.combo = run(arena(id, gap), T, t => ({ attack: t % 4 === 0 }), gap) / 8;
    row.cancel = run(arena(id, gap), T, (t, me, prev) => {
      const rec = me.action === 'swing' && me.actionTotal - me.actionTicks >= me.swingStartup + me.swingActive && me.hitIds.length;
      return rec ? { ability: !prev.ability } : { attack: t % 4 === 0 };
    }, gap) / 8;
    row.first = w.combo[0].damage; row.startup = w.combo[0].startup; row.reach = reach; row.hits = w.combo.length;
    { const hold = Math.ceil(w.chargeTicks * 1.6) + 80; row.charge = run(arena(id, 50), hold + 400, t => ({ attack: t < hold }), 50, hold); }
  } else if (w.family === 'gun') {
    const press = (t, me, prev) => ({ attack: !prev.attack && me.fireCooldown === 0 });
    row.near = run(arena(id, 150), 960, press, 150) / 8; row.far = run(arena(id, 450), 960, press, 450) / 8;
    row.shot = w.damage * (w.pellets || 1); row.clip = w.clip; row.range = w.range;
    { const hold = Math.ceil(w.chargeTicks * 1.3) + 40; row.charge = run(arena(id, 200), hold + 400, t => ({ attack: t < hold }), 200, hold); }
  } else {
    row.blast = run(arena(id, 40), w.chargeTicks + w.fuse + 700, t => ({ attack: t < w.chargeTicks + 2, left: t > w.chargeTicks + 4 && t < w.chargeTicks + 30 }), 40);
    row.delay = ((w.chargeTicks + w.fuse) / 120).toFixed(2) + 's';
  }
  rows.push(row);
}
console.log(JSON.stringify(rows));
