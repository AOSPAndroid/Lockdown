/** The knight's skeleton and every asset template, shared by the game (lockdown-renderer3d.js), the asset
 * checker (tools/art3d-index.mjs) and the tool that writes the body and the reference files
 * (tools/make-core-skeleton.mjs). One source, so they never drift apart.
 *
 * Units: 1 = one floor tile; the knight is 1.3 tall, faces +X, Y is up, origin between the feet. Every part
 * is rigid and pivots at its joint; the game animates the joints (hips, knees, ankles, shoulders, elbows,
 * wrists, waist, neck). Both arms hang down in the rest pose; weapons sit in the right fist. */
import * as THREE from './vendor/three/three.module.min.js';

/** Part name, pivot relative to its parent, children. */
export const RIG = Object.freeze(
  ['hips', [0, .56, 0], [
    ['leg_L', [0, -.03, -.085], [['shin_L', [0, -.215, 0], [['foot_L', [0, -.215, 0], []]]]]],
    ['leg_R', [0, -.03, .085], [['shin_R', [0, -.215, 0], [['foot_R', [0, -.215, 0], []]]]]],
    ['chest', [0, .06, 0], [
      ['head', [0, .41, 0], []],
      ['arm_L', [0, .33, -.25], [['forearm_L', [0, -.19, 0], [['hand_L', [0, -.19, 0], []]]]]],
      ['arm_R', [0, .33, .25], [['forearm_R', [0, -.19, 0], [['hand_R', [0, -.19, 0], []]]]]],
    ]],
  ]]);
export const RIG_PARTS = Object.freeze(['hips', 'chest', 'head', 'arm_L', 'forearm_L', 'hand_L', 'arm_R', 'forearm_R', 'hand_R', 'leg_L', 'shin_L', 'foot_L', 'leg_R', 'shin_R', 'foot_R']);
/** Weapons sit in the right fist: this far below the wrist (hand_R's pivot), pointing +X. */
export const GRIP = Object.freeze([0, -.045, 0]);
/** Which parts each gear slot may cover (its top-level nodes are named after them). */
export const GEAR_PARTS = Object.freeze({
  helmet: ['head'],
  armor: ['chest', 'arm_L', 'arm_R', 'forearm_L', 'forearm_R', 'hips'],
  pants: ['hips', 'leg_L', 'leg_R', 'shin_L', 'shin_R'],
  shoes: ['foot_L', 'foot_R'],
  class: ['forearm_L'],
});

// ---------- the core skeleton's look ----------
const srgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const material = (name, hex, extra = {}) => ({ name, color: srgb(hex), metal: .25, rough: .45, ...extra });
// Low metalness: the game has no reflections to light metal, so painted values carry the read.
export const SKELETON_MATERIALS = Object.freeze({
  frame: material('frame_gunmetal', '#3a414c'),
  panel: material('frame_panel', '#5c6674'),
  piston: material('piston_steel', '#b4c3d3', { metal: .3, rough: .3 }),
  cap: material('joint_cap_silver', '#dfe4ea', { metal: .3, rough: .25 }),
  eye: material('eye_glow', '#ffd84a', { metal: 0, rough: .4, emissive: srgb('#ffc21a') }),
  team: material('team_stripe', '#e39a3b', { metal: .2, rough: .4 }),
});
const M = SKELETON_MATERIALS;

/** Shapes for one part, grouped by material, in the part's own space. */
export class Part {
  constructor() { this.byMaterial = new Map(); }
  add(geometry, mat, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geometry.clone(); g.applyMatrix4(matrix);
    const bucket = this.byMaterial.get(mat) || { positions: [], normals: [], indices: [], material: mat };
    const base = bucket.positions.length / 3, pos = g.attributes.position.array, nor = g.attributes.normal.array;
    for (const v of pos) bucket.positions.push(v);
    for (const v of nor) bucket.normals.push(v);
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
  joint(r, at = [0, 0, 0]) { return this.rod(r, r * 1.5, M.frame, { axis: 'z', at }).rod(r * .55, r * 1.6, M.cap, { axis: 'z', at }); }
  get parts() { return [...this.byMaterial.values()]; }
}

/** A piston limb segment down -Y: steel rod, ribbing rings and a dark strut. */
function piston(part, from, to) {
  const length = Math.abs(to - from), mid = (from + to) / 2;
  part.rod(.027, length, M.piston, { at: [0, mid, 0] });
  for (const t of [.2, .5, .8]) part.rod(.034, .012, M.panel, { at: [0, from + (to - from) * t, 0] });
  part.box(.022, length * .9, .022, M.frame, { at: [-.03, mid, 0] });
}
/** The core skeleton, part by part (each in its own space). */
export function skeletonParts() {
  const upperArm = () => new Part().ball(.045, M.panel).box(.066, .14, .066, M.frame, { at: [0, -.095, 0] }).box(.02, .1, .05, M.panel, { at: [.035, -.095, 0] });
  const forearm = () => { const p = new Part().joint(.038); piston(p, -.035, -.15); return p.ball(.028, M.frame, { at: [0, -.17, 0] }); };
  const hand = () => new Part().box(.072, .08, .07, M.frame, { at: [0, -.045, 0] }).box(.05, .04, .066, M.panel, { at: [.022, -.075, 0] });
  const thigh = () => new Part().joint(.05).box(.085, .15, .085, M.frame, { at: [0, -.11, 0] }).box(.02, .11, .05, M.panel, { at: [.046, -.11, 0] });
  const shin = () => { const p = new Part().joint(.045); piston(p, -.03, -.17); return p.ball(.032, M.frame, { at: [0, -.19, 0] }); };
  const foot = () => new Part().box(.2, .07, .1, M.frame, { at: [.03, -.065, 0] }).box(.075, .05, .1, M.panel, { at: [.15, -.075, 0], rot: [0, 0, -.25] }).box(.05, .055, .1, M.panel, { at: [-.075, -.072, 0] });
  const chest = new Part();
  piston(chest, 0, .1);
  chest.box(.13, .06, .17, M.frame, { at: [0, .11, 0] }).box(.2, .2, .3, M.frame, { at: [0, .25, 0] }).box(.18, .03, .27, M.panel, { at: [0, .365, 0] });
  for (const tilt of [.82, -.82]) chest.box(.014, .24, .035, M.panel, { at: [.104, .255, 0], rot: [tilt, 0, 0] });
  chest.rod(.028, .02, M.cap, { axis: 'x', at: [.112, .255, 0] }).box(.012, .045, .17, M.team, { at: [.104, .155, 0] });
  for (const z of [-.2, .2]) chest.joint(.055, [0, .33, z]);
  chest.rod(.024, .05, M.piston, { at: [0, .385, 0] });
  const head = new Part().ball(.115, M.frame, { at: [0, .13, 0], scale: [1.05, 1.12, .98] }).box(.16, .022, .03, M.panel, { at: [-.005, .255, 0] });
  for (const z of [-.042, .042]) head.box(.012, .02, .052, M.eye, { at: [.117, .15, z], rot: [z > 0 ? -.3 : .3, 0, 0] });
  for (const z of [-.118, .118]) head.rod(.03, .02, M.cap, { axis: 'z', at: [0, .12, z] });
  return { hips: new Part().box(.15, .09, .19, M.frame).box(.03, .07, .12, M.panel, { at: [.08, -.005, 0] }), chest, head,
    arm_L: upperArm(), forearm_L: forearm(), hand_L: hand(), arm_R: upperArm(), forearm_R: forearm(), hand_R: hand(),
    leg_L: thigh(), shin_L: shin(), foot_L: foot(), leg_R: thigh(), shin_R: shin(), foot_R: foot() };
}
/** The rig as nested nodes ({ name, translation, parts, children }) for writing a .glb. `extra` adds shapes
 * to parts by name (fit volumes, blockouts). */
export function rigNodes(parts = skeletonParts(), extra = {}) {
  for (const [name, add] of Object.entries(extra)) add(parts[name] ||= new Part());
  const build = ([name, translation, children]) => ({ name, translation, parts: parts[name]?.parts || [], children: children.map(build) });
  return [build(RIG)];
}

// ---------- where armour goes, and how big things are (docs/ASSETS-BRIEF.md has the same numbers) ----------
/** See-through volumes per slot, in each part's own space: [part, size w×h×d, centre]. */
export const FIT = Object.freeze({
  helmet: [['head', [.3, .3, .3], [0, .15, 0]], ['head', [.24, .12, .06], [-.02, .36, 0]]],
  armor: [['chest', [.28, .32, .42], [0, .25, 0]], ['arm_L', [.15, .11, .15], [0, 0, 0]], ['arm_R', [.15, .11, .15], [0, 0, 0]],
    ['forearm_L', [.08, .13, .08], [0, -.09, 0]], ['forearm_R', [.08, .13, .08], [0, -.09, 0]]],
  pants: [['hips', [.22, .13, .3], [0, -.01, 0]], ['leg_L', [.12, .17, .12], [0, -.1, 0]], ['leg_R', [.12, .17, .12], [0, -.1, 0]],
    ['shin_L', [.12, .17, .12], [0, -.1, 0]], ['shin_R', [.12, .17, .12], [0, -.1, 0]]],
  shoes: [['foot_L', [.26, .09, .14], [.03, -.055, 0]], ['foot_R', [.26, .09, .14], [.03, -.055, 0]]],
});
/** The class shields on the left forearm: radius and centre (they face out, along −Z). */
export const SHIELDS = Object.freeze({ guardian: { radius: .35, at: [.03, -.1, -.08] }, recon: { radius: .11, at: [.02, -.09, -.055] } });
/** Weapon sizes from the grip (docs/CATALOG.md has each item's own size). */
export const WEAPON_SIZES = Object.freeze({
  sword: { length: .75, width: .12, guard: .24 }, heavy: { length: .95, width: .18, guard: .3 }, long: { length: .9, width: .06, guard: .2 }, short: { length: .6, width: .1, guard: .2 },
  maul: { length: .75, head: [.28, .28, .36] }, pistol: { length: .5, height: .25 }, cannon: { length: .65, height: .3 }, rifle: { length: 1, height: .14 },
  bomb: { across: .28 }, planted: { height: .4 },
});

// ---------- templates: a blockout per asset type, with the node names the game animates ----------
const blockout = material('blockout', '#c9d2dc', { metal: .1, rough: .7 });
const blockoutDark = material('blockout_dark', '#5c6674', { metal: .1, rough: .7 });
const trim = material('team_trim', '#e39a3b', { metal: .2, rough: .4 });
const glow = material('glow_core', '#7fd8ff', { metal: 0, rough: .4, emissive: srgb('#4fc8ff') });
const lens = material('lens_glow', '#c9a2ff', { metal: 0, rough: .3, emissive: srgb('#a070ff') });
const fuse = material('fuse_glow', '#ffb347', { metal: 0, rough: .4, emissive: srgb('#ff8a1a') });
const node = (name, part, translation = [0, 0, 0], children = []) => ({ name, translation, parts: part?.parts || [], children });

/** Each template is a list of top-level nodes. Gear templates are the fit volumes as blocks on the right parts;
 * weapon templates name the parts the game animates. */
export function templates() {
  const gear = slot => {
    const byPart = new Map();
    for (const [part, size, at] of FIT[slot]) (byPart.get(part) || byPart.set(part, new Part()).get(part)).box(...size, blockout, { at });
    if (slot === 'armor') byPart.get('chest').box(.012, .05, .2, trim, { at: [.142, .17, 0] });
    if (slot === 'helmet') byPart.get('head').box(.012, .03, .2, trim, { at: [.152, .09, 0] });
    return [...byPart].map(([name, part]) => node(name, part));
  };
  const sword = ({ length, width, guard }) => [node('sword', null, [0, 0, 0], [
    node('grip', new Part().rod(.02, .16, blockoutDark, { axis: 'x', at: [-.02, 0, 0] })),
    node('guard', new Part().box(.04, .035, guard, blockout), [.08, 0, 0]),
    node('blade', new Part().box(length - .14, .025, width, blockout, { at: [(length - .14) / 2, 0, 0] }), [.1, 0, 0]),
    node('tip', null, [length, 0, 0]),
  ])];
  const gun = ({ length, height }) => [node('gun', null, [0, 0, 0], [
    node('body', new Part().box(length * .55, height * .6, .1, blockout, { at: [length * .2, height * .2, 0] }).box(.06, height * .55, .07, blockoutDark, { at: [0, -height * .2, 0] })),
    node('barrel', new Part().rod(height * .2, length * .45, blockoutDark, { axis: 'x', at: [length * .225, 0, 0] }), [length * .45, height * .2, 0]),
    node('core', new Part().ball(.035, glow), [length * .2, height * .55, 0]),
    node('muzzle', null, [length, height * .2, 0]),
  ])];
  return {
    helmet: gear('helmet'), armor: gear('armor'), pants: gear('pants'), shoes: gear('shoes'),
    shield_guardian: [node('forearm_L', null, [0, 0, 0], [node('plate', new Part().rod(SHIELDS.guardian.radius, .04, blockout, { axis: 'z', segments: 32 }).rod(SHIELDS.guardian.radius * .9, .045, trim, { axis: 'z', segments: 32, scale: [1, .2, 1] }), SHIELDS.guardian.at)])],
    shield_recon: [node('forearm_L', null, [0, 0, 0], [node('buckler', new Part().rod(SHIELDS.recon.radius, .03, blockout, { axis: 'z', segments: 20 }), SHIELDS.recon.at, [node('lens', new Part().ball(.035, lens), [0, 0, -.02])])])],
    sword: sword(WEAPON_SIZES.sword), sword_heavy: sword(WEAPON_SIZES.heavy), sword_long: sword(WEAPON_SIZES.long), sword_short: sword(WEAPON_SIZES.short),
    maul: [node('maul', null, [0, 0, 0], [node('grip', new Part().rod(.022, WEAPON_SIZES.maul.length, blockoutDark, { axis: 'x', at: [WEAPON_SIZES.maul.length / 2 - .08, 0, 0] })), node('head', new Part().box(...WEAPON_SIZES.maul.head, blockout), [WEAPON_SIZES.maul.length - .08, 0, 0]), node('tip', null, [WEAPON_SIZES.maul.length + .1, 0, 0])])],
    gun: gun(WEAPON_SIZES.pistol), gun_cannon: gun(WEAPON_SIZES.cannon), gun_rifle: gun(WEAPON_SIZES.rifle),
    bomb: [node('bomb', null, [0, 0, 0], [node('body', new Part().ball(WEAPON_SIZES.bomb.across / 2, blockoutDark), [.14, 0, 0]), node('fuse', new Part().rod(.015, .05, fuse), [.14, .16, 0])])],
    bomb_planted: [node('bomb', null, [0, 0, 0], [node('body', new Part().add(new THREE.CylinderGeometry(.16, .18, .34, 16), blockoutDark), [0, .17, 0]), node('fuse', new Part().rod(.018, .06, fuse), [0, .37, 0])])],
  };
}
