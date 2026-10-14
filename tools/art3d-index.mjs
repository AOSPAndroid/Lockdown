#!/usr/bin/env node
/** 3D art: checks the textures in public/art/3d/<theme>/ and lists them in public/art/3d/index.json,
 * which the 3D view reads to decide which painted textures replace its procedural ones.
 *   node tools/art3d-index.mjs
 * Slots per theme (see docs/LOOK.md): floor, wall, wall_top, cliff, each optionally with *_normal.
 * Every texture must be a square power of two (512 or 1024), fully opaque, free of smeared rows or
 * columns, and must repeat without a seam (wall faces repeat sideways only: their top is the cap). */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decodePng } from './lockdown-art-kit/png.mjs';
import { readGlb, nodeNames, triangleCount } from './glb.mjs';
import { WEAPONS } from '../public/lockdown-weapons.js';
import { HELMETS, ARMORS, PANTS, SHOES } from '../public/lockdown-equipment.js';

/** Model folders, the ids each may hold, and triangle budgets (see docs/MODELS.md). */
const RIG_PARTS = ['hips', 'chest', 'head', 'arm_L', 'hand_L', 'arm_R', 'hand_R', 'leg_L', 'foot_L', 'leg_R', 'foot_R'];
const MODEL_KINDS = {
  knight: { ids: ['body'], budget: 4000 },
  helmet: { ids: Object.keys(HELMETS), budget: 2500, gear: true },
  armor: { ids: Object.keys(ARMORS), budget: 3000, gear: true },
  pants: { ids: Object.keys(PANTS), budget: 2000, gear: true },
  shoes: { ids: Object.keys(SHOES), budget: 1500, gear: true },
  weapons: { ids: Object.keys(WEAPONS), budget: 1500 },
  bombs: { ids: Object.keys(WEAPONS).filter(id => WEAPONS[id].family === 'bomb'), budget: 1200 },
};

const dir = process.argv[2] ? resolve(process.argv[2]) : new URL('../public/art/3d/', import.meta.url).pathname;
const SLOTS = ['floor', 'wall', 'wall_top', 'cliff'];
const files = [], errors = [];
const at = (img, x, y) => (y * img.width + x) * 4;
const diff = (img, x1, y1, x2, y2) => { const a = at(img, x1, y1), b = at(img, x2, y2); let d = 0; for (let c = 0; c < 3; c++) d += Math.abs(img.data[a + c] - img.data[b + c]); return d / 3; };
const lum = (img, x, y) => { const i = at(img, x, y); return .3 * img.data[i] + .59 * img.data[i + 1] + .11 * img.data[i + 2]; };
function check(file, img, slot, normal) {
  const { width: w, height: h } = img, problems = [];
  if (w !== h || (w & (w - 1)) || w < 256) return [`${w}x${h}: must be square and a power of two (512 or 1024)`];
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) { problems.push('must be fully opaque'); break; }
  let inner = 0, n = 0; for (let y = 0; y < h; y += 2) for (let x = 0; x < w - 1; x += 2) { inner += diff(img, x, y, x + 1, y); n++; } inner /= n;
  let lr = 0; for (let y = 0; y < h; y++) lr += diff(img, 0, y, w - 1, y); lr /= h;
  let tb = 0; for (let x = 0; x < w; x++) tb += diff(img, x, 0, x, h - 1); tb /= w;
  if (lr > Math.max(10, inner * 2.5)) problems.push(`left and right edges do not match (seam ${lr.toFixed(0)} vs ${inner.toFixed(0)}): it repeats sideways`);
  if (slot !== 'wall' && tb > Math.max(10, inner * 2.5)) problems.push(`top and bottom edges do not match (seam ${tb.toFixed(0)} vs ${inner.toFixed(0)}): it repeats both ways`);
  if (!normal && slot !== 'wall') {
    const band = Math.max(2, Math.round(w / 128)); let ring = 0, rn = 0, all = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const l = lum(img, x, y); all += l; if (x < band || y < band || x >= w - band || y >= h - band) { ring += l; rn++; } }
    ring /= rn; all /= (w * h) / 4;
    if (ring < all * .93) problems.push(`edges are ${Math.round((1 - ring / all) * 100)}% darker than the middle: that draws a grid in game`);
  }
  const textured = values => { const mean = values.reduce((a, b) => a + b, 0) / values.length; return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) > 8; };
  let run = 0, best = 0;
  for (let y = 0; y < h - 1; y++) { let d = 0; for (let x = 0; x < w; x++) d += diff(img, x, y, x, y + 1); if (d / w < .35 && textured(Array.from({ length: w }, (_, x) => lum(img, x, y)))) best = Math.max(best, ++run); else run = 0; }
  if (best >= Math.max(4, w / 128)) problems.push(`${best + 1} identical rows: vertically smeared`);
  return problems;
}
for (const theme of readdirSync(dir).filter(name => statSync(join(dir, name)).isDirectory())) {
  for (const file of readdirSync(join(dir, theme)).filter(name => name.endsWith('.png'))) {
    const name = file.replace(/\.png$/, ''), normal = name.endsWith('_normal'), slot = normal ? name.slice(0, -7) : name;
    if (!SLOTS.includes(slot)) { errors.push(`${theme}/${file}: unknown slot (use ${SLOTS.join(', ')}, optionally with _normal)`); continue; }
    let img; try { img = decodePng(readFileSync(join(dir, theme, file))); } catch (problem) { errors.push(`${theme}/${file}: ${problem.message}`); continue; }
    const problems = check(file, img, slot, normal);
    for (const problem of problems) errors.push(`${theme}/${file}: ${problem}`);
    files.push(`${theme}/${file}`);
  }
}
// Models: public/art/3d/models/<kind>/<id>.glb
const models = [], modelDir = join(dir, 'models');
let kinds = []; try { kinds = readdirSync(modelDir).filter(name => statSync(join(modelDir, name)).isDirectory()); } catch { /* no models yet */ }
for (const kind of kinds) {
  const rule = MODEL_KINDS[kind];
  for (const file of readdirSync(join(modelDir, kind))) {
    const where = `models/${kind}/${file}`;
    if (!rule) { errors.push(`${where}: unknown model folder (use ${Object.keys(MODEL_KINDS).join(', ')})`); continue; }
    if (!file.endsWith('.glb')) { errors.push(`${where}: models must be binary glTF (.glb)`); continue; }
    const id = file.slice(0, -4);
    if (!rule.ids.includes(id)) { errors.push(`${where}: no ${kind} item is called "${id}"`); continue; }
    let gltf; try { gltf = readGlb(readFileSync(join(modelDir, kind, file))); } catch (problem) { errors.push(`${where}: ${problem.message}`); continue; }
    const names = nodeNames(gltf), strip = name => name.replace(/\.\d+$/, '');
    if (kind === 'knight') { const missing = RIG_PARTS.filter(part => !names.all.map(strip).includes(part)); if (missing.length) errors.push(`${where}: the body is missing rig parts ${missing.join(', ')}`); }
    if (rule.gear) { const stray = names.top.map(strip).filter(name => !RIG_PARTS.includes(name)); if (stray.length) errors.push(`${where}: top-level nodes must be named after rig parts; found ${stray.join(', ')}`); }
    const triangles = triangleCount(gltf);
    if (triangles > rule.budget) errors.push(`${where}: ${triangles} triangles, over the ${rule.budget} budget`);
    models.push(`${kind}/${file}`);
  }
}
writeFileSync(join(dir, 'index.json'), JSON.stringify({ files: files.sort(), models: models.sort() }, null, 2) + '\n');
console.log(`${files.length} textures and ${models.length} models listed in public/art/3d/index.json.`);
for (const error of errors) console.log(`ERROR ${error}`);
if (errors.length) { console.log(`\n${errors.length} errors: fix them before handing the art over.`); process.exitCode = 1; }
