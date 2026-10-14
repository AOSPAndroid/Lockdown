#!/usr/bin/env node
/** Writes docs/reference/knight_rig.glb: the knight rig the game animates, as a box mannequin at final
 * size (1.3 units tall, feet at the origin, facing +X). Open it in Blender or any glTF viewer and build
 * the body and gear on these exact part names and pivots (docs/MODELS.md). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { writeGlb } from './glb.mjs';
const grey = (name, size, center) => ({ size, center, material: { name, color: [.75, .75, .75] } });
const rig = [{ name: 'hips', translation: [0, .31, 0], box: grey('shorts', [.3, .14, .4], [0, 0, 0]), children: [
  { name: 'leg_L', translation: [0, 0, -.14], box: grey('leg', [.13, .25, .13], [0, -.12, 0]), children: [{ name: 'foot_L', translation: [0, -.25, 0], box: grey('shoe', [.28, .1, .18], [.04, -.03, 0]) }] },
  { name: 'leg_R', translation: [0, 0, .14], box: grey('leg', [.13, .25, .13], [0, -.12, 0]), children: [{ name: 'foot_R', translation: [0, -.25, 0], box: grey('shoe', [.28, .1, .18], [.04, -.03, 0]) }] },
  { name: 'chest', translation: [0, .08, 0], box: grey('shirt', [.5, .42, .58], [0, .15, 0]), children: [
    { name: 'head', translation: [0, .5, 0], box: grey('head', [.62, .6, .66], [0, .02, 0]) },
    { name: 'arm_L', translation: [.03, .28, -.35], box: grey('arm', [.14, .28, .14], [0, -.12, 0]), children: [{ name: 'hand_L', translation: [0, -.2, 0], box: grey('hand', [.1, .1, .1], [0, 0, 0]) }] },
    { name: 'arm_R', translation: [.07, .14, .34], box: grey('arm', [.28, .14, .14], [.12, 0, 0]), children: [{ name: 'hand_R', translation: [.25, 0, 0], box: grey('hand', [.1, .1, .1], [0, 0, 0]) }] },
  ] },
] }];
mkdirSync(new URL('../docs/reference/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/reference/knight_rig.glb', import.meta.url), writeGlb({ nodes: rig }));
console.log('docs/reference/knight_rig.glb written.');
