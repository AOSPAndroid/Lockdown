import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createImage, encodePng } from '../tools/lockdown-art-kit/png.mjs';

const tool = new URL('../tools/art3d-index.mjs', import.meta.url).pathname;
const paint = (size, colour) => { const img = createImage(size, size); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) img.data.set(colour(x, y), (y * size + x) * 4); return img; };
const grain = (x, y) => ((x * 73856093) ^ (y * 19349663)) % 13;
const wave = (x, y, s) => 120 + grain(x, y) + Math.round(40 * Math.sin(x / s * Math.PI * 4) * Math.cos(y / s * Math.PI * 2));

test('the 3D art tool lists clean textures and rejects seams, grids, bad sizes and unknown slots', () => {
  const dir = mkdtempSync(join(tmpdir(), 'art3d-')), theme = join(dir, 'castle');
  mkdirSync(theme);
  const save = (name, img) => writeFileSync(join(theme, name), encodePng(img));
  save('floor.png', paint(256, (x, y) => { const v = wave(x, y, 256); return [v, v - 8, v - 16, 255]; }));
  save('wall_top.png', paint(256, (x, y) => { const v = wave(x, y, 256) - (x < 3 || y < 3 || x > 252 || y > 252 ? 70 : 0); return [v, v, v, 255]; }));
  save('cliff.png', paint(256, (x, y) => { const v = 60 + grain(x, y) + Math.round(x / 2); return [v, v, v, 255]; }));
  save('wall.png', paint(256, (x, y) => { const v = wave(x, y, 256) - (y < 30 ? -40 : 0); return [v, v, v, 255]; }));
  save('roof.png', paint(256, () => [10, 10, 10, 255]));
  writeFileSync(join(theme, 'floor_normal.png'), encodePng(createImage(300, 300, [128, 128, 255, 255])));
  const run = spawnSync(process.execPath, [tool, dir], { encoding: 'utf8' });
  const errorsFor = file => run.stdout.split('\n').filter(line => line.startsWith(`ERROR castle/${file}`));
  assert.equal(run.status, 1);
  assert.deepEqual(errorsFor('floor.png'), []);
  assert.deepEqual(errorsFor('wall.png'), [], 'a wall face only repeats sideways; its cap band may differ from its foot');
  assert.match(errorsFor('wall_top.png').join(), /darker/);
  assert.match(errorsFor('cliff.png').join(), /left and right/);
  assert.match(errorsFor('roof.png').join(), /unknown slot/);
  assert.match(errorsFor('floor_normal.png').join(), /power of two/);
  assert.ok(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')).files.includes('castle/floor.png'));
});

test('the 3D art tool checks models: rig parts, gear nodes, item ids and triangle budgets', async () => {
  const { writeGlb } = await import('../tools/glb.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'models-')), models = join(dir, 'models');
  for (const kind of ['knight', 'helmet', 'weapons', 'shoes']) mkdirSync(join(models, kind), { recursive: true });
  const box = name => ({ size: [.2, .2, .2], material: { name, color: [.5, .5, .5] } });
  const rig = readFileSync(new URL('../docs/reference/knight_rig.glb', import.meta.url));
  writeFileSync(join(models, 'knight', 'body.glb'), rig);
  writeFileSync(join(models, 'helmet', 'sallet.glb'), writeGlb({ nodes: [{ name: 'head', box: box('steel') }] }));
  writeFileSync(join(models, 'helmet', 'crown.glb'), writeGlb({ nodes: [{ name: 'head', box: box('gold') }] }));
  writeFileSync(join(models, 'shoes', 'sneakers.glb'), writeGlb({ nodes: [{ name: 'foot_L', box: box('rubber') }, { name: 'ankle', box: box('rubber') }] }));
  writeFileSync(join(models, 'weapons', 'brand.glb'), writeGlb({ nodes: [{ name: 'brand', box: box('steel') }] }));
  const run = spawnSync(process.execPath, [tool, dir], { encoding: 'utf8' });
  const errorsFor = file => run.stdout.split('\n').filter(line => line.startsWith(`ERROR models/${file}`));
  assert.deepEqual(errorsFor('knight/body.glb'), [], 'the reference rig is a valid body');
  assert.deepEqual(errorsFor('helmet/sallet.glb'), []); assert.deepEqual(errorsFor('weapons/brand.glb'), []);
  assert.match(errorsFor('helmet/crown.glb').join(), /no helmet item/);
  assert.match(errorsFor('shoes/sneakers.glb').join(), /ankle/);
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  assert.ok(index.models.includes('knight/body.glb') && index.models.includes('helmet/sallet.glb'));
});

test('every item has a look and the catalogue is up to date (node tools/catalog.mjs)', async () => {
  const { WEAPONS, CLASSES } = await import('../public/lockdown-engine.js');
  const { HELMETS, ARMORS, PANTS, SHOES } = await import('../public/lockdown-equipment.js');
  const { GEAR_LOOKS, WEAPON_LOOKS, CLASS_LOOKS } = await import('../public/lockdown-looks.js');
  for (const [slot, table] of [['helmet', HELMETS], ['armor', ARMORS], ['pants', PANTS], ['shoes', SHOES]]) for (const id of Object.keys(table)) assert.ok(GEAR_LOOKS[slot][id], `${slot} ${id} has a look`);
  for (const id of Object.keys(WEAPONS)) assert.ok(WEAPON_LOOKS[id], `${id} has a look`);
  for (const id of Object.keys(CLASSES)) assert.ok(CLASS_LOOKS[id], `${id} has a look`);
  const before = readFileSync(new URL('../docs/CATALOG.md', import.meta.url), 'utf8');
  spawnSync(process.execPath, [new URL('../tools/catalog.mjs', import.meta.url).pathname]);
  assert.equal(readFileSync(new URL('../docs/CATALOG.md', import.meta.url), 'utf8'), before, 'docs/CATALOG.md matches the game data');
});

test('the 3D art tool keeps model downloads small: file size and embedded texture size', () => {
  // A hand-built .glb holding one embedded PNG (only its header matters) padded to `kb`.
  const glbWithImage = (width, height, kb) => {
    const png = Buffer.alloc(kb * 1024); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png); png.writeUInt32BE(width, 16); png.writeUInt32BE(height, 20);
    const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'brand' }], images: [{ bufferView: 0, mimeType: 'image/png' }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: png.length }], buffers: [{ byteLength: png.length }] }));
    const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]), header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
    jh.writeUInt32LE(jsonChunk.length, 0); jh.write('JSON', 4, 'latin1'); bh.writeUInt32LE(png.length, 0); bh.write('BIN\0', 4, 'latin1');
    header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + png.length, 8);
    return Buffer.concat([header, jh, jsonChunk, bh, png]);
  };
  const dir = mkdtempSync(join(tmpdir(), 'models-')), weapons = join(dir, 'models', 'weapons');
  mkdirSync(weapons, { recursive: true });
  writeFileSync(join(weapons, 'brand.glb'), glbWithImage(512, 512, 200));
  writeFileSync(join(weapons, 'blaster.glb'), glbWithImage(1254, 1254, 1900));
  const run = spawnSync(process.execPath, [tool, dir], { encoding: 'utf8' });
  const errorsFor = file => run.stdout.split('\n').filter(line => line.startsWith(`ERROR models/${file}`)).join('\n');
  assert.equal(errorsFor('weapons/brand.glb'), '', 'a 200 KB model with a 512² texture is fine');
  assert.match(errorsFor('weapons/blaster.glb'), /over the 600 KB limit/);
  assert.match(errorsFor('weapons/blaster.glb'), /1254×1254: use a power of two/);
});
