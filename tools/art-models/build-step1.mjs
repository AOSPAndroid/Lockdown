/** Step 1 only: body, class insignia, bare-head hair. Run from any directory with Node 20+. */
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readGlb } from '../glb.mjs';
import { T, node, add, oval, loft, ring, strand, plate, geometry, material, exportGlb } from './mesh-kit.mjs';

const palette = {
  skin: material('warm_porcelain_skin', '#edbc96', .64), blush: material('rose_cheeks', '#cb7e72', .8),
  eye: material('glossy_espresso_eyes', '#26232c', .24), cream: material('cream_cotton', '#e9dfc6', .88),
  seam: material('cotton_seams', '#c7bda5', .92), shorts: material('charcoal_twill', '#343541', .9),
  shoe: material('soft_ink_leather', '#343039', .66), sole: material('rubber_soles', '#20232b', .96),
  team: material('team', '#b9bec4', .5), bronze: material('aged_bronze', '#aa8050', .5, .28),
  gold: material('brushed_pale_gold', '#ceb27b', .4, .55), darkBronze: material('bronze_recess', '#514439', .58, .35),
  hair: material('chestnut_hair', '#65402d', .78), lock: material('chestnut_lock', '#78503a', .76),
  scarf: material('midnight_wool', '#363e51', .94), scarfEdge: material('woven_scarf_edge', '#616d7e', .92),
};
const root = new URL('../../public/art/3d/models/', import.meta.url);
for (const folder of ['knight', 'helmet', 'class']) mkdirSync(new URL(folder + '/', root), { recursive: true });
const save = (file, roots, description, budget) => { const result = exportGlb(fileURLToPath(new URL(file, root)), roots, description); if (result.triangles > budget) throw new Error(`${file} exceeds ${budget}`); };

// The reference document is the source of truth: copy its names, hierarchy and exact pivots.
const reference = readGlb(readFileSync(new URL('../../docs/reference/knight_rig.glb', import.meta.url)));
const parts = {};
const cloneRig = i => { const src = reference.nodes[i], n = node(src.name, src.translation || [0, 0, 0]); parts[n.name] = n; n.children = (src.children || []).map(cloneRig); return n; };
const body = reference.scenes[reference.scene || 0].nodes.map(cloneRig);
const { hips, chest, head, arm_L, arm_R, hand_L, hand_R, leg_L, leg_R, foot_L, foot_R } = parts;

// Tailored egg-shaped shirt with a softly rolled hem. Its top fits under the neck.
add(chest, loft([[-.025,.162,.223],[0,.191,.253],[.06,.2,.262],[.24,.207,.265],[.30,.182,.236],[.345,.118,.161]], 16, .83), palette.cream);
add(chest, ring(.207,.269,.012,16,4), palette.team, [0,.018,0]);
add(chest, ring(.152,.198,.014,16,4), palette.team, [0,.326,0]);
add(chest, oval([.10,.065,.12],12,6), palette.skin, [0,.365,0]);
// A stitched chest pocket stays quiet at the gameplay camera distance.
add(chest, plate([[-.047,.048],[.047,.048],[.043,-.027],[0,-.045],[-.043,-.027]],.008,.006), palette.seam, [.202,.19,-.10], [0,Math.PI/2,0]);
add(chest, plate([[-.04,.04],[.04,.04],[.036,-.022],[0,-.035],[-.036,-.022]],.008,.004), palette.cream, [.212,.19,-.10], [0,Math.PI/2,0]);
add(hips, loft([[-.07,.142,.204],[.01,.166,.216],[.055,.162,.209]],12), palette.shorts);

for (const [leg, foot] of [[leg_L,foot_L],[leg_R,foot_R]]) {
  add(leg, loft([[-.14,.078,.086],[-.11,.093,.094],[-.015,.095,.094],[.035,.08,.08]],12,.8), palette.shorts);
  add(leg, ring(.080,.087,.007,12,4), palette.shorts, [0,-.125,0]);
  add(leg, oval([.068,.098,.066],10,6), palette.skin, [0,-.178,0]);
  add(foot, loft([[-.06,.115,.078,.035],[-.044,.137,.091,.037],[-.025,.135,.09,.037]],12,.58), palette.sole);
  add(foot, loft([[-.026,.13,.086,.037],[.015,.132,.086,.036],[.055,.096,.071,.01],[.065,.068,.064,-.015]],12,.7), palette.shoe);
  add(foot, oval([.044,.008,.052],10,4), palette.sole, [.035,.058,0]);
}
// Sleeve and forearm occupy the same rigid part; mittens are on the named wrist sockets.
add(arm_L, oval([.091,.105,.096],10,6), palette.cream, [0,-.032,0]);
add(arm_L, oval([.069,.096,.072],10,6), palette.skin, [0,-.122,0]);
add(arm_R, oval([.105,.088,.094],10,6), palette.cream, [.035,0,0]);
add(arm_R, oval([.103,.066,.071],10,6), palette.skin, [.143,0,0]);
add(hand_L, oval([.089,.091,.085],10,6), palette.skin, [.014,-.024,0]);
add(hand_L, oval([.045,.052,.048],10,6), palette.skin, [.071,-.011,.025]);
add(hand_R, oval([.084,.084,.083],10,6), palette.skin, [.018,0,0]);
add(hand_R, oval([.045,.049,.042],10,6), palette.skin, [.026,.058,-.024]);

// One continuous bald skull. Authored maximum y is exactly 1.300 in rig space.
const skull = oval([.292,.28,.318],20,12);
const sp = skull.attributes.position;
for (let i=0;i<sp.count;i++) { const y=sp.getY(i); if (y<-.07) sp.setZ(i,sp.getZ(i)*(1-.14*(-y-.07)/.21)); }
skull.computeVertexNormals(); add(head, skull, palette.skin, [0,.13,0]);
for (const side of [-1,1]) {
  add(head, oval([.054,.075,.046],10,6), palette.skin, [-.005,.072,side*.301]);
  add(head, oval([.015,.061,.041],12,8), palette.eye, [.274,.10,side*.115], [0,-side*.32,0]);
  add(head, oval([.008,.025,.043],12,6), palette.blush, [.254,.018,side*.177], [0,-side*.5,0]);
}
add(head, oval([.036,.028,.033],10,6), palette.skin, [.29,.046,0]);
const smile = new T.CatmullRomCurve3([new T.Vector3(.282,-.026,-.044),new T.Vector3(.290,-.037,0),new T.Vector3(.282,-.026,.044)]);
add(head,new T.TubeGeometry(smile,8,.006,4,false),palette.eye);
save('knight/body.glb',body,'Original rounded knight base. 1.3 units; +X forward; exact reference pivots; no skinning or animation.',4000);

// Hair is a separate helmet item, never baked into the body.
const hair = node('head'), hp = [], hi = [], seg = 24, rows = 8;
for(let r=0;r<=rows;r++) for(let j=0;j<=seg;j++) {
  const a=j/seg*Math.PI*2, front=(Math.cos(a)+1)/2;
  const edge=2.02-front*.89 + .035*Math.sin(3*a), t=.001+(edge-.001)*r/rows;
  hp.push(.304*Math.sin(t)*Math.cos(a), .132+.29*Math.cos(t), .329*Math.sin(t)*Math.sin(a));
}
for(let r=0;r<rows;r++) for(let j=0;j<seg;j++){const a=r*(seg+1)+j,b=a+seg+1;hi.push(a,a+1,b,a+1,b+1,b);}
add(hair,geometry(hp,hi),palette.hair);
// Broad sculpted locks, staggered across the brow rather than fine hair noise.
for(const [z, tip, sign] of [[-.22,.13,-1],[-.115,.19,1],[.005,.18,1],[.13,.20,1],[.235,.12,-1]]) {
  const x=.28*Math.sqrt(Math.max(.1,1-(z/.345)**2));
  add(hair,strand([[.025,.385,z*.65],[.16,.365,z*.85],[x,.286,z],[x+.021,.205,z+.023*sign],[x+.013,tip,z+.046*sign]],[.01,.05,.065,.04,.003],.053,8), z===.005?palette.lock:palette.hair);
}
for(const s of [-1,1]) add(hair,strand([[-.08,.32,s*.22],[-.16,.21,s*.30],[-.19,.09,s*.28],[-.20,.025,s*.22]],[.01,.045,.045,.003],.06,8),palette.hair);
add(hair,strand([[-.06,.36,.13],[-.065,.43,.14],[-.13,.475,.15],[-.21,.47,.15]],[.03,.043,.03,.003],.038,8),palette.lock);
add(hair,ring(.29,.324,.009,28,5),palette.team,[0,.178,0]);
save('helmet/none.glb',[hair],'Chestnut sculpted locks, offset cowlick and a thin recolorable hairband.',2500);

// Striker: swept ceramic fin, rounded brass shoe, paired shoulder chevrons.
const strikerHead=node('head'),strikerChest=node('chest');
add(strikerHead,oval([.19,.037,.067],16,6),palette.bronze,[-.035,.415,0]);
add(strikerHead,plate([[.105,.423],[.095,.478],[-.075,.535],[-.265,.615],[-.247,.535],[-.15,.434]],.056,.014),palette.team);
add(strikerHead,plate([[.07,.428],[-.14,.44],[-.235,.538],[-.08,.48]],.059,.005),palette.gold);
for(const s of [-1,1]) for(let i=0;i<2;i++) {
  add(strikerChest,plate([[-.046,.03],[.018,.054],[.065,.018],[.052,-.004],[.016,.027],[-.039,.006]],.012,.006),palette.gold,[.055-i*.062,.281,s*.244],[Math.PI/2,0,Math.PI/2]);
}
save('class/striker.glb',[strikerHead,strikerChest],'Swept-back team fin with pale-gold shoulder chevrons.',1500);

// Guardian: bronze shield on the outside of the left arm, robust rolled rim and rivets.
const guardianHead=node('head'),guardianArm=node('arm_L');
add(guardianHead,oval([.104,.027,.104],16,6),palette.bronze,[-.035,.423,0]);
add(guardianHead,oval([.087,.082,.087],12,8),palette.team,[-.035,.483,0]);
add(guardianHead,ring(.065,.065,.008,12,4),palette.gold,[-.035,.445,0]);
const shieldCenter=[.026,-.075,-.147];
add(guardianArm,oval([.236,.236,.045],20,8),palette.bronze,shieldCenter);
add(guardianArm,new T.TorusGeometry(.229,.024,5,20),palette.gold,[.026,-.075,-.17]);
add(guardianArm,new T.TorusGeometry(.184,.008,3,20),palette.darkBronze,[.026,-.075,-.186]);
add(guardianArm,oval([.068,.068,.035],12,6),palette.gold,[.026,-.075,-.195]);
for(let i=0;i<8;i++){const a=i*Math.PI/4;add(guardianArm,oval([.014,.014,.009],6,3),palette.gold,[.026+.201*Math.cos(a),-.075+.201*Math.sin(a),-.192]);}
// Restrained team lozenges on the shield face.
for(const s of [-1,1]) add(guardianArm,plate([[0,.045],[.022,0],[0,-.045],[-.022,0]],.006,.004),palette.team,[.026+s*.124,-.075,-.191]);
save('class/guardian.glb',[guardianHead,guardianArm],'Team crest knob and riveted, domed bronze left-arm shield.',1500);

// Recon: short hood-tip crest and a thick folded scarf, both rigid attachments.
const reconHead=node('head'),reconChest=node('chest');
add(reconHead,loft([[.402,.074,.078],[.438,.078,.075,-.015],[.487,.055,.051,-.045],[.531,.022,.024,-.09],[.54,.003,.003,-.124]],10,.85),palette.team);
add(reconHead,ring(.07,.074,.009,14,4),palette.scarf,[0,.413,0]);
add(reconChest,ring(.178,.214,.036,24,8),palette.scarf,[0,.329,0]);
add(reconChest,ring(.186,.222,.008,24,5),palette.scarfEdge,[0,.311,0]);
add(reconChest,oval([.057,.048,.072],12,6),palette.scarf,[-.176,.332,.13]);
add(reconChest,strand([[-.17,.337,.12],[-.27,.30,.13],[-.38,.253,.13],[-.47,.27,.13],[-.53,.303,.13]],[.035,.075,.074,.064,.006],.026,8),palette.scarf);
add(reconChest,strand([[-.18,.324,.07],[-.27,.246,.05],[-.38,.195,.03],[-.44,.20,.03]],[.035,.057,.052,.003],.022,8),palette.scarfEdge);
save('class/recon.glb',[reconHead,reconChest],'Short team hood-tip and folded midnight scarf with two trailing points.',1500);
