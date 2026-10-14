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
