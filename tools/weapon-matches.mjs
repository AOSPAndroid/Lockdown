#!/usr/bin/env node
/** Fair weapon matches (docs/WEAPONS-AUDIT.md, Method 2): loadouts rotate so every weapon gets equal seats, and
 * damage and kills are credited to the weapon in the attacker's hand. Run parts in parallel, e.g.
 *   node tools/weapon-matches.mjs 0 4 > part0.json   then   node tools/weapon-report.mjs part*.json */
const L = await import('../public/lockdown-engine.js');
const [part = 0, parts = 1] = process.argv.slice(2).map(Number);
const ids = family => L.WEAPON_IDS.filter(id => L.WEAPONS[id].family === family);
const blades = ids('blade'), guns = ids('gun'), bombs = ids('bomb');
const stats = Object.fromEntries(L.WEAPON_IDS.map(id => [id, { held: 0, dealt: 0, kills: 0 }]));
let match = 0;
for (const seed of [11, 12, 13, 14, 15, 16]) for (const mapId of L.MAP_IDS) {
  if (match++ % parts !== part) continue;
  const state = L.createState({ mapId, seed }); L.startMatch(state, []);
  state.players.forEach((p, i) => { const k = match * 8 + i; p.weapons = [blades[k % blades.length], guns[(k * 7 + 3) % guns.length], bombs[(k * 3 + 1) % bombs.length], null]; p.clips = { [p.weapons[1]]: L.WEAPONS[p.weapons[1]].clip }; });
  let ticks = 0;
  while (state.phase !== 'matchEnd' && ticks < 80000) {
    L.step(state, []); ticks++;
    if (state.phase !== 'fight') continue;
    for (const p of state.players) if (p.alive && p.weapons[p.slot]) stats[p.weapons[p.slot]].held++;
    for (const e of state.events) if (e.tick === state.tick) {
      const owner = state.players[e.playerId]; const held = owner?.weapons[owner.slot];
      if (!held) continue;
      if (e.type === 'damage' && e.targetId !== e.playerId) stats[held].dealt += e.amount;
      if (e.type === 'kill') stats[held].kills++;
    }
  }
}
console.log(JSON.stringify(stats));
