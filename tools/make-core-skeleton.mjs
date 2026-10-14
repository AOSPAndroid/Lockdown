#!/usr/bin/env node
/** Builds the knight's body, the core skeleton, from code, and the references the artist builds on:
 *   public/art/3d/models/knight/body.glb   the body the game uses (the bare robot frame)
 *   docs/reference/knight_rig.glb          the same skeleton: build armour on its parts and pivots
 *   docs/reference/fit_guide.glb           the skeleton with see-through volumes where each slot's armour goes,
 *                                          the class shields and a sword in the hand
 *   docs/reference/weapon_sizes.glb        every weapon size, side by side, next to the skeleton
 * Run: node tools/make-core-skeleton.mjs (then node tools/art3d-index.mjs). Sizes are in docs/MODELS.md. */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three/three.module.min.js';
import { writeGlb } from './glb.mjs';

// glTF colours are linear; these are picked as sRGB and converted.
const srgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const material = (name, hex, extra = {}) => ({ name, color: srgb(hex), metal: .6, rough: .4, ...extra });
const M = {
  // Low metalness: the game has no reflections to light metal, so painted values must carry the read.
  frame: material('frame_gunmetal', '#3a414c', { metal: .25, rough: .45 }),
  panel: material('frame_panel', '#5c6674', { metal: .25, rough: .45 }),
  piston: material('piston_steel', '#b4c3d3', { metal: .3, rough: .3 }),
  cap: material('joint_cap_silver', '#dfe4ea', { metal: .3, rough: .25 }),
  eye: material('eye_glow', '#ffd84a', { metal: 0, rough: .4, emissive: srgb('#ffc21a') }),
  team: material('team_stripe', '#e39a3b', { metal: .2, rough: .4 }),
};

/** Collects shapes for one part, grouped by material, in the part's own space. */
class Part {
  constructor() { this.byMaterial = new Map(); }
  add(geometry, mat, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geometry.clone(); g.applyMatrix4(matrix);
    const bucket = this.byMaterial.get(mat) || { positions: [], normals: [], indices: [], material: mat };
    const base = bucket.positions.length / 3, pos = g.attributes.position.array, nor = g.attributes.normal.array;
    bucket.positions.push(...pos); bucket.normals.push(...nor);
    const index = g.index ? g.index.array : [...Array(pos.length / 3).keys()];
    for (const i of index) bucket.indices.push(base + i);
    this.byMaterial.set(mat, bucket); return this;
  }
  box(w, h, d, mat, place) { return this.add(new THREE.BoxGeometry(w, h, d), mat, place); }
  ball(r, mat, place) { return this.add(new THREE.SphereGeometry(r, 12, 8), mat, place); }
  /** A cylinder along an axis: 'y' (default), 'x' or 'z'. */
  rod(r, length, mat, { axis = 'y', segments = 12, ...place } = {}) {
    const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return this.add(new THREE.CylinderGeometry(r, r, length, segments), mat, { rot, ...place });
  }
  /** A joint: a dark disc facing sideways (along Z) with a silver cap. */
  joint(r, at) { return this.rod(r, r * 1.5, M.frame, { axis: 'z', at }).rod(r * .55, r * 1.6, M.cap, { axis: 'z', at }); }
  get parts() { return [...this.byMaterial.values()]; }
}

/** A piston limb segment along an axis: steel rod, ribbing rings and a dark strut. */
function piston(part, axis, from, to) {
  const length = Math.abs(to - from), mid = (from + to) / 2, at = v => axis === 'x' ? [v, 0, 0] : [0, v, 0];
  part.rod(.027, length, M.piston, { axis, at: at(mid) });
  for (const t of [.2, .5, .8]) part.rod(.034, .012, M.panel, { axis, at: at(from + (to - from) * t) });
  part.box(...(axis === 'x' ? [length * .9, .022, .022] : [.022, length * .9, .022]), M.frame, { at: axis === 'x' ? [mid, -.03, 0] : [-.03, mid, 0] });
}
/** One arm, hanging down (left) or pointing forward along +X (right, the weapon arm). */
function arm(forward) {
  const part = new Part(), along = v => forward ? [v, 0, 0] : [0, -v, 0], axis = forward ? 'x' : 'y', sign = forward ? 1 : -1;
  part.ball(.045, M.panel);
  part.box(...(forward ? [.14, .066, .066] : [.066, .14, .066]), M.frame, { at: along(.1) });
  part.box(...(forward ? [.1, .02, .05] : [.02, .1, .05]), M.panel, { at: forward ? [.1, .035, 0] : [.035, -.1, 0] });
  part.joint(.038, along(.19));
  piston(part, axis, sign * .22, sign * .34);
  part.ball(.028, M.frame, { at: along(.355) });
  return part;
}
function hand(forward) {
  const part = new Part();
  if (forward) part.box(.07, .075, .08, M.frame).box(.03, .055, .075, M.panel, { at: [.04, 0, 0] });
  else part.box(.075, .08, .07, M.frame, { at: [0, -.02, 0] }).box(.05, .05, .065, M.panel, { at: [.02, -.055, 0] });
  return part;
}
function leg() {
  const part = new Part();
  part.joint(.05, [0, 0, 0]);
  part.box(.085, .15, .085, M.frame, { at: [0, -.11, 0] });
  part.box(.02, .11, .05, M.panel, { at: [.046, -.11, 0] });
  part.joint(.045, [0, -.215, 0]);
  piston(part, 'y', -.245, -.385);
  part.ball(.032, M.frame, { at: [0, -.405, 0] });
  return part;
}
function foot() {
  return new Part()
    .box(.2, .07, .1, M.frame, { at: [.03, -.065, 0] })
    .box(.075, .05, .1, M.panel, { at: [.15, -.075, 0], rot: [0, 0, -.25] })
    .box(.05, .055, .1, M.panel, { at: [-.075, -.072, 0] });
}
function chest() {
  const part = new Part();
  piston(part, 'y', 0, .1);
  part.box(.13, .06, .17, M.frame, { at: [0, .11, 0] });
  part.box(.2, .2, .3, M.frame, { at: [0, .25, 0] });
  part.box(.18, .03, .27, M.panel, { at: [0, .365, 0] });
  // The X on the chest, a small core and the team stripe below it.
  for (const tilt of [.82, -.82]) part.box(.014, .24, .035, M.panel, { at: [.104, .255, 0], rot: [tilt, 0, 0] });
  part.rod(.028, .02, M.cap, { axis: 'x', at: [.112, .255, 0] });
  part.box(.012, .045, .17, M.team, { at: [.104, .155, 0] });
  for (const z of [-.2, .2]) part.joint(.055, [0, .33, z]);
  part.rod(.024, .05, M.piston, { at: [0, .385, 0] });
  return part;
}
function head() {
  const part = new Part();
  part.ball(.115, M.frame, { at: [0, .13, 0], scale: [1.05, 1.12, .98] });
  part.box(.16, .022, .03, M.panel, { at: [-.005, .255, 0] });
  for (const z of [-.042, .042]) part.box(.012, .02, .052, M.eye, { at: [.117, .15, z], rot: [z > 0 ? -.3 : .3, 0, 0] });
  for (const z of [-.118, .118]) part.rod(.03, .02, M.cap, { axis: 'z', at: [0, .12, z] });
  return part;
}

/** The rig: the same names, hierarchy and pivots as docs/MODELS.md. `extra` adds reference shapes per part. */
function skeleton(extra = {}) {
  const parts = { hips: new Part().box(.15, .09, .19, M.frame).box(.03, .07, .12, M.panel, { at: [.08, -.005, 0] }), leg_L: leg(), leg_R: leg(), foot_L: foot(), foot_R: foot(),
    chest: chest(), head: head(), arm_L: arm(false), arm_R: arm(true), hand_L: hand(false), hand_R: hand(true) };
  for (const [name, add] of Object.entries(extra)) add(parts[name]);
  const node = (name, translation, children = []) => ({ name, translation, parts: parts[name].parts, children });
  return [node('hips', [0, .56, 0], [
    node('leg_L', [0, -.03, -.085], [node('foot_L', [0, -.43, 0])]),
    node('leg_R', [0, -.03, .085], [node('foot_R', [0, -.43, 0])]),
    node('chest', [0, .06, 0], [
      node('head', [0, .41, 0]),
      node('arm_L', [0, .33, -.25], [node('hand_L', [0, -.38, 0])]),
      node('arm_R', [.04, .26, .25], [node('hand_R', [.36, 0, 0])]),
    ]),
  ])];
}

// See-through volumes: where each slot's armour sits (docs/MODELS.md lists the same numbers).
const fit = (name, hex) => material(name, hex, { metal: 0, rough: 1, opacity: .3 });
const F = { helmet: fit('fit_helmet', '#ff5a5a'), armor: fit('fit_armor', '#4aa8ff'), pants: fit('fit_pants', '#5ae07a'), shoes: fit('fit_shoes', '#ffd84a'), cls: fit('fit_class', '#c78aff'), weapon: fit('fit_weapon', '#ffffff') };
const fitGuide = {
  head: p => p.box(.3, .3, .3, F.helmet, { at: [0, .15, 0] }).box(.24, .12, .06, F.helmet, { at: [-.02, .36, 0] }),
  chest: p => p.box(.28, .32, .42, F.armor, { at: [0, .25, 0] }),
  arm_L: p => p.box(.15, .11, .15, F.armor).box(.08, .13, .08, F.armor, { at: [0, -.28, 0] }).rod(.35, .03, F.cls, { axis: 'z', segments: 32, at: [.05, -.22, -.1] }),
  arm_R: p => p.box(.15, .11, .15, F.armor).box(.13, .08, .08, F.armor, { at: [.28, 0, 0] }),
  hips: p => p.box(.22, .13, .3, F.pants, { at: [0, -.01, 0] }),
  leg_L: p => p.box(.12, .17, .12, F.pants, { at: [0, -.11, 0] }).box(.12, .17, .12, F.pants, { at: [0, -.31, 0] }),
  leg_R: p => p.box(.12, .17, .12, F.pants, { at: [0, -.11, 0] }).box(.12, .17, .12, F.pants, { at: [0, -.31, 0] }),
  foot_L: p => p.box(.26, .09, .14, F.shoes, { at: [.03, -.055, 0] }),
  foot_R: p => p.box(.26, .09, .14, F.shoes, { at: [.03, -.055, 0] }),
  hand_R: p => p.box(.75, .02, .12, F.weapon, { at: [.255, 0, 0] }),
};

// Every weapon size from docs/CATALOG.md, laid out in a row along -Z, grip (or base) at each item's origin.
const W = material('size_block', '#c9d2dc', { metal: .2, rough: .6 });
const sizes = [
  ['sword_normal_0.75', p => p.box(.75, .03, .12, W, { at: [.375, 0, 0] })],
  ['sword_heavy_0.95', p => p.box(.95, .04, .18, W, { at: [.475, 0, 0] })],
  ['sword_long_0.9', p => p.box(.9, .02, .06, W, { at: [.45, 0, 0] })],
  ['sword_short_0.6', p => p.box(.6, .03, .1, W, { at: [.3, 0, 0] })],
  ['maul_0.75', p => p.box(.75, .04, .04, W, { at: [.375, 0, 0] }).box(.28, .28, .36, W, { at: [.75, 0, 0] })],
  ['pistol_0.5', p => p.box(.5, .25, .12, W, { at: [.25, 0, 0] })],
  ['cannon_0.65', p => p.box(.65, .3, .15, W, { at: [.325, 0, 0] })],
  ['rifle_1.0', p => p.box(1, .14, .08, W, { at: [.5, 0, 0] })],
  ['bomb_held_0.28', p => p.ball(.14, W, { at: [.14, 0, 0] })],
  ['bomb_planted_0.4', p => p.add(new THREE.CylinderGeometry(.16, .18, .4, 16), W, { at: [.18, .2, 0] })],
  ['guardian_shield_0.7', p => p.rod(.35, .04, W, { axis: 'z', segments: 32, at: [.35, 0, 0] })],
  ['recon_shield_0.22', p => p.rod(.11, .03, W, { axis: 'z', segments: 20, at: [.11, 0, 0] })],
];
// Laid out beside the skeleton, in the plane it faces (+X), so a side view shows every length.
const place = { sword_normal: [.55, 1.32], sword_heavy: [.55, 1.18], sword_long: [.55, 1.04], sword_short: [.55, .92], maul: [.55, .74], pistol: [.55, .46], cannon: [.55, .16],
  rifle: [1.75, 1.32], bomb_held: [1.75, 1.08], recon_shield: [2.3, 1.08], guardian_shield: [1.75, .55], bomb_planted: [2.6, 0] };
const lineup = sizes.map(([name, make]) => { const key = name.replace(/_[\d.]+$/, ''), [x, y] = place[key]; return { name: `size_${key}`, translation: [x, y, 0], parts: make(new Part()).parts }; });

const root = new URL('../', import.meta.url);
const write = (path, nodes) => { mkdirSync(new URL(path.replace(/[^/]+$/, ''), root), { recursive: true }); writeFileSync(new URL(path, root), writeGlb({ nodes })); console.log(`${path} written.`); };
write('public/art/3d/models/knight/body.glb', skeleton());
write('docs/reference/knight_rig.glb', skeleton());
write('docs/reference/fit_guide.glb', skeleton(fitGuide));
write('docs/reference/weapon_sizes.glb', [...skeleton(), ...lineup]);
