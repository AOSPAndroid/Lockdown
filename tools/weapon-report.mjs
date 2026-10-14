#!/usr/bin/env node
/** Sums weapon-matches parts and prints damage and kills per minute held, relative to the family average.
 *   node tools/weapon-report.mjs part0.json part1.json … */
import { readFileSync } from 'node:fs';
const L = await import('../public/lockdown-engine.js');
const total = {};
for (const file of process.argv.slice(2)) for (const [id, s] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) { const t = total[id] ||= { held: 0, dealt: 0, kills: 0 }; for (const key in t) t[key] += s[key]; }
for (const family of ['blade', 'gun']) {
  const rows = L.WEAPON_IDS.filter(id => L.WEAPONS[id].family === family && total[id]?.held).map(id => { const s = total[id], minutes = s.held / 7200; return [L.WEAPONS[id].name, s.dealt / minutes, s.kills / minutes]; }).sort((a, b) => b[1] - a[1]);
  const average = rows.reduce((sum, row) => sum + row[1], 0) / rows.length;
  console.log(`== ${family}: damage per minute held (vs average), kills per minute held`);
  for (const [name, dealt, kills] of rows) console.log(`${name.padEnd(22)} ${dealt.toFixed(0).padStart(5)} (${((dealt / average - 1) * 100).toFixed(0).padStart(4)}%) ${kills.toFixed(2).padStart(6)}`);
}
