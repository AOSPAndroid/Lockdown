#!/usr/bin/env node
/** Writes the knight's body and every reference the artist builds on, all from public/lockdown-skeleton.js:
 *   public/art/3d/models/knight/body.glb     the core skeleton: the body the game uses (and the bare look)
 *   docs/reference/knight_rig.glb            the same skeleton: build every piece on its parts and pivots
 *   docs/reference/fit_guide.glb             the skeleton with see-through volumes where each slot goes,
 *                                            the class shields and a sword in the right fist
 *   docs/reference/weapon_sizes.glb          every weapon template next to the skeleton
 *   docs/reference/templates/<type>.glb      a blockout per asset type with the node names to keep
 * Run: node tools/make-core-skeleton.mjs, then node tools/art3d-index.mjs. */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.min.js';
import { FIT, SHIELDS, GRIP, WEAPON_SIZES, rigNodes, skeletonParts, templates } from '../public/lockdown-skeleton.js';
import { writeGlb } from './glb.mjs';

const srgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const fit = (name, hex) => ({ name, color: srgb(hex), metal: 0, rough: 1, opacity: .3 });
const F = { helmet: fit('fit_helmet', '#ff5a5a'), armor: fit('fit_armor', '#4aa8ff'), pants: fit('fit_pants', '#5ae07a'), shoes: fit('fit_shoes', '#ffd84a'), cls: fit('fit_class', '#c78aff'), weapon: fit('fit_weapon', '#ffffff') };

// The fit guide: every slot's volumes, the Guardian shield and a sword in the right fist.
const guide = {};
const addTo = (part, add) => { const before = guide[part]; guide[part] = p => { before?.(p); add(p); }; };
for (const [slot, volumes] of Object.entries(FIT)) for (const [part, size, at] of volumes) addTo(part, p => p.box(...size, F[slot], { at }));
addTo('forearm_L', p => p.rod(SHIELDS.guardian.radius, .03, F.cls, { axis: 'z', segments: 32, at: SHIELDS.guardian.at }));
addTo('hand_R', p => p.box(WEAPON_SIZES.sword.length, .02, WEAPON_SIZES.sword.width, F.weapon, { at: [GRIP[0] + WEAPON_SIZES.sword.length / 2 - .08, GRIP[1], GRIP[2]] }));

// The weapon templates beside the skeleton, in the plane it faces (+X).
const list = templates();
const place = { sword: [.55, 1.32], sword_heavy: [.55, 1.18], sword_long: [.55, 1.04], sword_short: [.55, .92], maul: [.55, .74], gun: [.55, .46], gun_cannon: [.55, .16],
  gun_rifle: [1.75, 1.32], bomb: [1.75, 1.08], bomb_planted: [2.6, 0] };
const lineup = Object.entries(place).map(([name, [x, y]]) => ({ name: `size_${name}`, translation: [x, y, 0], parts: [], children: list[name] }));

const root = new URL('../', import.meta.url);
const write = (path, nodes) => { mkdirSync(new URL(path.replace(/[^/]+$/, ''), root), { recursive: true }); writeFileSync(new URL(path, root), writeGlb({ nodes })); console.log(`${path} written.`); };
write('public/art/3d/models/knight/body.glb', rigNodes());
write('docs/reference/knight_rig.glb', rigNodes());
write('docs/reference/fit_guide.glb', rigNodes(skeletonParts(), guide));
write('docs/reference/weapon_sizes.glb', [...rigNodes(), ...lineup]);
for (const [name, nodes] of Object.entries(list)) write(`docs/reference/templates/${name}.glb`, nodes);
