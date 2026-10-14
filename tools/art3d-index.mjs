#!/usr/bin/env node
/** Lists the 3D art in public/art/3d/ (theme folders of PNG textures) into public/art/3d/index.json,
 * which the 3D view reads to decide which painted textures replace its procedural ones.
 * Checks each texture is square and a power of two. Run after adding art: node tools/art3d-index.mjs */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const dir = new URL('../public/art/3d/', import.meta.url).pathname;
const files = [], problems = [];
for (const theme of readdirSync(dir).filter(name => statSync(join(dir, name)).isDirectory())) {
  for (const file of readdirSync(join(dir, theme)).filter(name => name.endsWith('.png'))) {
    const buffer = readFileSync(join(dir, theme, file)), width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
    const pow2 = n => n > 0 && (n & (n - 1)) === 0;
    if (width !== height || !pow2(width)) problems.push(`${theme}/${file}: ${width}x${height}, must be square and a power of two (512 or 1024)`);
    else files.push(`${theme}/${file}`);
  }
}
writeFileSync(join(dir, 'index.json'), JSON.stringify({ files: files.sort() }, null, 2) + '\n');
console.log(`${files.length} textures listed.`); for (const problem of problems) console.log(`skipped ${problem}`);
