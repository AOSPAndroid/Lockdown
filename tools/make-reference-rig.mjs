#!/usr/bin/env node
/** Writes docs/reference/knight_rig.glb: the knight rig the game animates, as a box mannequin at final
 * size (1.3 units tall, feet at the origin, facing +X). Open it in Blender or any glTF viewer and build
 * the body and gear on these exact part names and pivots (docs/MODELS.md). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { writeGlb } from './glb.mjs';
const grey = (name, size, center) => ({ size, center, material: { name, color: [.75, .75, .75] } });
// A battle-robot frame, about five heads tall: a compact head, broad shoulders and chest, a narrow waist,
// long armoured legs and big wedge feet. Rigid parts on the joints the game turns.
const rig = [{ name: 'hips', translation: [0, .56, 0], box: grey('waist', [.18, .12, .24], [0, 0, 0]), children: [
  { name: 'leg_L', translation: [0, -.03, -.085], box: grey('leg', [.12, .43, .12], [0, -.215, 0]), children: [{ name: 'foot_L', translation: [0, -.43, 0], box: grey('foot', [.24, .1, .14], [.04, -.05, 0]) }] },
  { name: 'leg_R', translation: [0, -.03, .085], box: grey('leg', [.12, .43, .12], [0, -.215, 0]), children: [{ name: 'foot_R', translation: [0, -.43, 0], box: grey('foot', [.24, .1, .14], [.04, -.05, 0]) }] },
  { name: 'chest', translation: [0, .06, 0], box: grey('chest', [.26, .36, .42], [0, .2, 0]), children: [
    { name: 'head', translation: [0, .41, 0], box: grey('head', [.24, .26, .24], [0, .13, 0]) },
    { name: 'arm_L', translation: [0, .33, -.25], box: grey('arm', [.1, .38, .1], [0, -.19, 0]), children: [{ name: 'hand_L', translation: [0, -.38, 0], box: grey('hand', [.1, .1, .1], [0, 0, 0]) }] },
    { name: 'arm_R', translation: [.04, .26, .25], box: grey('arm', [.36, .1, .1], [.18, 0, 0]), children: [{ name: 'hand_R', translation: [.36, 0, 0], box: grey('hand', [.1, .1, .1], [0, 0, 0]) }] },
  ] },
] }];
mkdirSync(new URL('../docs/reference/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/reference/knight_rig.glb', import.meta.url), writeGlb({ nodes: rig }));
console.log('docs/reference/knight_rig.glb written.');
