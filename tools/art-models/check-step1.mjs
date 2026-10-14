/** Additional deliverable checks beyond the shared indexer: exact rig and body dimensions. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readGlb,triangleCount} from '../glb.mjs';
const reference=readGlb(readFileSync(new URL('../../docs/reference/knight_rig.glb',import.meta.url)));
const specs={'knight/body':4000,'helmet/none':2500,'class/striker':1500,'class/guardian':1500,'class/recon':1500};
for(const [file,budget] of Object.entries(specs)){
 const buffer=readFileSync(new URL(`../../public/art/3d/models/${file}.glb`,import.meta.url));const doc=readGlb(buffer);
 assert.equal(buffer.readUInt32LE(8),buffer.length);assert.equal(doc.skins?.length||0,0);assert.equal(doc.animations?.length||0,0);assert.equal(doc.images?.length||0,0);
 assert.ok(triangleCount(doc)<=budget);assert.ok(doc.materials.some(m=>m.name==='team'));assert.ok(doc.materials.every(m=>!m.emissiveFactor||m.emissiveFactor.every(v=>v===0)));
 if(file==='knight/body'){
  for(const ref of reference.nodes){const n=doc.nodes.find(n=>n.name===ref.name);assert.ok(n,ref.name);assert.deepEqual(n.translation,ref.translation,`${ref.name} pivot`);assert.deepEqual((n.children||[]).map(i=>doc.nodes[i].name),(ref.children||[]).map(i=>reference.nodes[i].name),`${ref.name} hierarchy`);}
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  const visit=(i,parent)=>{const n=doc.nodes[i],world=(n.translation||[0,0,0]).map((v,j)=>v+parent[j]);if(n.mesh!==undefined)for(const primitive of doc.meshes[n.mesh].primitives){const a=doc.accessors[primitive.attributes.POSITION];for(let j=0;j<3;j++){low[j]=Math.min(low[j],a.min[j]+world[j]);high[j]=Math.max(high[j],a.max[j]+world[j]);}}for(const child of n.children||[])visit(child,world);};
  for(const i of doc.scenes[0].nodes)visit(i,[0,0,0]);assert.ok(Math.abs(low[1])<.00001,'feet on ground');assert.ok(Math.abs(high[1]-1.3)<.00001,'1.3 unit height');
  console.log('Exact reference hierarchy and 11 pivots; Y bounds:',low[1].toFixed(5),high[1].toFixed(5));
 }else{for(const i of doc.scenes[0].nodes){const n=doc.nodes[i];assert.ok(['head','chest','arm_L'].includes(n.name));assert.deepEqual(n.translation,[0,0,0],'gear stays in local part space');}}
 console.log(`${file}: ${triangleCount(doc)}/${budget} triangles; no skins, clips, textures or baked emission.`);
}
