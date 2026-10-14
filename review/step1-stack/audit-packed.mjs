import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import validator from 'gltf-validator';
import {readGlb,triangleCount} from '../../tools/glb.mjs';
import {textureSizes} from './pack-texture.mjs';

const repo=fileURLToPath(new URL('../../',import.meta.url)),report=[];
const reference=readGlb(readFileSync(new URL('../../docs/reference/knight_rig_4_heads.glb',import.meta.url)));
const check=(condition,message)=>{if(!condition)throw Error(message)};
function read(bytes){const doc=readGlb(bytes),start=28+bytes.readUInt32LE(12);return{doc,bin:bytes.subarray(start)}}
function values(glb,index){const a=glb.doc.accessors[index],view=glb.doc.bufferViews[a.bufferView],offset=(view.byteOffset||0)+(a.byteOffset||0),size={SCALAR:1,VEC2:2,VEC3:3}[a.type],bytes=a.componentType===5123?2:4,result=[];for(let i=0;i<a.count*size;i++)result.push(a.componentType===5126?glb.bin.readFloatLE(offset+i*bytes):a.componentType===5123?glb.bin.readUInt16LE(offset+i*bytes):glb.bin.readUInt32LE(offset+i*bytes));return result}
function expanded(glb,p,attribute,size){const raw=values(glb,p.attributes[attribute]);if(p.indices===undefined)return raw;return values(glb,p.indices).flatMap(i=>raw.slice(i*size,i*size+size))}

for(const [model,size]of Object.entries(textureSizes).sort()){
 const path=model+'.glb',bytes=readFileSync(new URL('../../public/art/3d/models/'+path,import.meta.url)),g=read(bytes),d=g.doc;
 const oldBytes=execFileSync('git',['show','42d60a7:public/art/3d/models/'+path],{cwd:repo,maxBuffer:8*1024*1024}),old=read(oldBytes);
 check(bytes.length<600000,path+' file budget');check(d.images.length===1&&d.textures.length===1,path+' must have one texture');
 const image=d.images[0],view=d.bufferViews[image.bufferView],data=g.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),meta=await sharp(data).metadata();
 check(image.mimeType==='image/jpeg'&&meta.format==='jpeg'&&!meta.hasAlpha,path+' opaque JPEG');
 check(meta.width===size&&meta.height===size,path+' resolution');
 check(!d.skins?.length&&!d.animations?.length,path+' must be rigid');
 const regions=image.extras.sourceRegions,used=new Set(d.materials.map(m=>m.extras.sourceTile));
 check(regions.length===used.size&&regions.every(r=>r.tile>=8&&r.tile<=15&&used.has(r.tile)),path+' must pack only used Stack/shared swatches');
 for(const mesh of d.meshes)for(const p of mesh.primitives){const material=d.materials[p.material],r=regions.find(r=>r.tile===material.extras.sourceTile),uv=values(g,p.attributes.TEXCOORD_0);check(material.pbrMetallicRoughness.baseColorTexture.index===0,path+' texture binding');for(let i=0;i<uv.length;i+=2)check(uv[i]>=r.left/size-1e-6&&uv[i]<=(r.left+r.width)/size+1e-6&&uv[i+1]>=r.top/size-1e-6&&uv[i+1]<=(r.top+r.height)/size+1e-6,path+' UV outside packed region')}
 // Lossless vertex indexing must leave approved silhouettes and shading intact.
 if(model!=='weapons/brand')for(let m=0;m<d.meshes.length;m++)for(let p=0;p<d.meshes[m].primitives.length;p++)for(const attr of['POSITION','NORMAL']){const now=expanded(g,d.meshes[m].primitives[p],attr,3),before=expanded(old,old.doc.meshes[m].primitives[p],attr,3);check(now.length===before.length&&now.every((n,i)=>Math.abs(n-before[i])<1e-6),path+' changed '+attr)}
 const validation=await validator.validateBytes(bytes,{uri:path,maxIssues:100});
 const row={file:path,triangles:triangleCount(d),bytes:bytes.length,previousBytes:oldBytes.length,texture:[meta.width,meta.height],mimeType:image.mimeType,textureBytes:data.length,sourceRegions:regions.map(r=>({tile:r.tile,name:r.name})),errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,messages:validation.issues.messages};
 if(model==='knight/body'){
  for(const ref of reference.nodes){const n=d.nodes.find(n=>n.name===ref.name);check(n&&JSON.stringify(n.translation)===JSON.stringify(ref.translation||[0,0,0]),'D pivot '+ref.name);check(JSON.stringify((n.children||[]).map(i=>d.nodes[i].name))===JSON.stringify((ref.children||[]).map(i=>reference.nodes[i].name)),'D hierarchy '+ref.name)}
  let low=Infinity,high=-Infinity;function bounds(k,y){const n=d.nodes[k],yy=y+(n.translation?.[1]||0);for(const p of d.meshes[n.mesh]?.primitives||[]){const a=d.accessors[p.attributes.POSITION];low=Math.min(low,yy+a.min[1]);high=Math.max(high,yy+a.max[1])}for(const c of n.children||[])bounds(c,yy)}for(const k of d.scenes[0].nodes)bounds(k,0);row.boundsY=[low,high];check(Math.abs(low)<1e-5&&Math.abs(high-1.3)<1e-5,'Body height');
 }
 if(model==='weapons/brand'){const all=d.meshes.flatMap(m=>m.primitives.map(p=>d.accessors[p.attributes.POSITION]));row.boundsX=[Math.min(...all.map(a=>a.min[0])),Math.max(...all.map(a=>a.max[0]))];check(Math.abs(row.boundsX[1]-.75)<1e-5,'Brand grip-to-tip length')}
 if(model==='class/recon')check(d.materials.some(m=>m.name.includes('lens')&&m.emissiveFactor?.some(n=>n>0)),'Recon lens');
 check(!row.errors&&!row.warnings,path+' glTF diagnostics');report.push(row);
 console.log(`${path}: ${(bytes.length/1024).toFixed(1)} KiB; ${size}² JPEG; ${row.triangles} triangles; 0 errors / warnings`);
}
writeFileSync(new URL('../../docs/screenshots/step1-stack/asset-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const before=report.reduce((n,r)=>n+r.previousBytes,0),after=report.reduce((n,r)=>n+r.bytes,0);
console.log(`${report.length} models: ${(after/1024/1024).toFixed(2)} MiB, ${(100*(1-after/before)).toFixed(1)}% smaller than the previous batch`);
