#!/usr/bin/env node
/** Writes docs/reference/knight_rig.glb: the knight rig the game animates, as a box mannequin at final
 * size (1.3 units tall, feet at the origin, facing +X). Open it in Blender or any glTF viewer and build
 * the body and gear on these exact part names and pivots (docs/MODELS.md). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { writeGlb } from './glb.mjs';
const grey = (name, size, center) => ({ size, center, material: { name, color: [.75, .75, .75] } });
// About three heads tall: a big head on a slim, heroic body (tapered torso, defined waist, slender limbs).
const rig = [{ name: 'hips', translation: [0, .46, 0], box: grey('shorts', [.2, .12, .26], [0, 0, 0]), children: [
  { name: 'leg_L', translation: [0, -.02, -.075], box: grey('leg', [.09, .36, .09], [0, -.18, 0]), children: [{ name: 'foot_L', translation: [0, -.36, 0], box: grey('boot', [.17, .08, .1], [.03, -.04, 0]) }] },
  { name: 'leg_R', translation: [0, -.02, .075], box: grey('leg', [.09, .36, .09], [0, -.18, 0]), children: [{ name: 'foot_R', translation: [0, -.36, 0], box: grey('boot', [.17, .08, .1], [.03, -.04, 0]) }] },
  { name: 'chest', translation: [0, .06, 0], box: grey('shirt', [.22, .3, .32], [0, .15, 0]), children: [
    { name: 'head', translation: [0, .36, 0], box: grey('head', [.44, .42, .46], [0, .21, 0]) },
    { name: 'arm_L', translation: [0, .27, -.19], box: grey('arm', [.08, .3, .08], [0, -.14, 0]), children: [{ name: 'hand_L', translation: [0, -.3, 0], box: grey('hand', [.08, .08, .08], [0, 0, 0]) }] },
    { name: 'arm_R', translation: [.04, .2, .19], box: grey('arm', [.3, .08, .08], [.14, 0, 0]), children: [{ name: 'hand_R', translation: [.3, 0, 0], box: grey('hand', [.08, .08, .08], [0, 0, 0]) }] },
  ] },
] }];
mkdirSync(new URL('../docs/reference/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/reference/knight_rig.glb', import.meta.url), writeGlb({ nodes: rig }));
console.log('docs/reference/knight_rig.glb written.');
