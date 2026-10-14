import * as T from '../../public/vendor/three/three.module.min.js';
import {readFileSync,writeFileSync} from 'node:fs';
export {T};
export function material(name,tile,{metal=.05,rough=.7,color=[1,1,1],emissive}={}){const m={name,tile,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:metal,roughnessFactor:rough,baseColorTexture:{index:0}}};if(emissive)m.emissiveFactor=emissive;return m;}
export function node(name,translation=[0,0,0],children=[]){return{name,translation,children,surfaces:[]};}
export function geometry(p,ix){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
export function loft(rows,n=12,exp=.68){const p=[],ix=[];for(const[y,rx,rz,cx=0,cz=0]of rows)for(let j=0;j<n;j++){const a=2*Math.PI*j/n,co=Math.cos(a),si=Math.sin(a);p.push(cx+rx*Math.sign(co)*Math.abs(co)**exp,y,cz+rz*Math.sign(si)*Math.abs(si)**exp);}for(let i=0;i<rows.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n;ix.push(a,a+n,b,b,a+n,b+n);}for(const[r,top]of[[0,false],[rows.length-1,true]]){const q=p.length/3;p.push(rows[r][3]||0,rows[r][0],rows[r][4]||0);for(let j=0;j<n;j++){const a=r*n+j,b=r*n+(j+1)%n;ix.push(q,top?b:a,top?a:b);}}return geometry(p,ix);}
export function plate(points,depth=.02,bevel=.008){const s=new T.Shape();s.moveTo(...points[0]);points.slice(1).forEach(p=>s.lineTo(...p));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSegments:1,bevelSize:bevel,bevelThickness:bevel,steps:1,curveSegments:4});g.translate(0,0,-depth/2);return g;}
export function box(x,y,z,b=.006){return plate([[-x/2,-y/2],[x/2,-y/2],[x/2,y/2],[-x/2,y/2]],z-2*b,b);}
export const oval=(r,n=12,k=8)=>new T.SphereGeometry(1,n,k).scale(...r);
export function ring(rx,rz,t=.007,n=20){const g=new T.TorusGeometry(1,t,5,n);g.rotateX(Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),d=Math.hypot(x,z)-1;p.setXYZ(i,(rx+d)*Math.cos(a),p.getY(i),(rz+d)*Math.sin(a));}g.computeVertexNormals();return g;}
export function add(part,g,m,pos=[0,0,0],rot=[0,0,0],uvMode='box',inset=.035){
 // Local material-space UVs. Each piece receives a complete painted swatch, including its seams.
 g=g.index?g.toNonIndexed():g.clone();g.computeBoundingBox();const b=g.boundingBox,p=g.attributes.position,n=g.attributes.normal,uv=[];const extent=b.getSize(new T.Vector3());
 const axes=[['z','y'],['x','z'],['x','y']];
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),no=new T.Vector3().fromBufferAttribute(n,i);let a;
  if(uvMode==='front')a=['z','y'];else if(uvMode==='blade')a=['x','z'];else if(uvMode==='xy')a=['x','y'];else {const av=[Math.abs(no.x),Math.abs(no.y),Math.abs(no.z)];a=axes[av.indexOf(Math.max(...av))];}
  const u=(v[a[0]]-b.min[a[0]])/(extent[a[0]]||1),vv=(v[a[1]]-b.min[a[1]])/(extent[a[1]]||1),col=m.tile%4,row=Math.floor(m.tile/4);
  // glTF UV origin is at the top left of the image.
  uv.push((col+inset+u*(1-2*inset))/4,(row+inset+(1-vv)*(1-2*inset))/4);
 }
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rot)));g.translate(...pos);part.surfaces.push({geo:g,mat:m});
}
export function referenceRig(file){const b=readFileSync(file),doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());const parts={};function walk(i){const r=doc.nodes[i],q=node(r.name,r.translation||[0,0,0]);parts[q.name]=q;q.children=(r.children||[]).map(walk);return q;}const roots=doc.scenes[doc.scene||0].nodes.map(walk);return{roots,parts};}
export function writeGlb(path,roots,atlas,description){
 const doc={asset:{version:'2.0',generator:'Lockdown temporary painted design studies',extras:{description}},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],images:[],accessors:[],bufferViews:[],buffers:[]};let offset=0;const chunks=[],mats=new Map();
 function bytes(data,target){const view=doc.bufferViews.length,v={buffer:0,byteOffset:offset,byteLength:data.length};if(target)v.target=target;doc.bufferViews.push(v);chunks.push(data);const pad=(4-data.length%4)%4;chunks.push(Buffer.alloc(pad));offset+=data.length+pad;return view;}
 function accessor(values,type,target,integer=false){const arr=integer?new Uint32Array(values):new Float32Array(values),view=bytes(Buffer.from(arr.buffer),target);const size={SCALAR:1,VEC2:2,VEC3:3}[type],o={bufferView:view,componentType:integer?5125:5126,count:values.length/size,type};if(type==='VEC3'){o.min=Array(3).fill(Infinity);o.max=Array(3).fill(-Infinity);values.forEach((v,i)=>{o.min[i%3]=Math.min(o.min[i%3],v);o.max[i%3]=Math.max(o.max[i%3],v)});}return doc.accessors.push(o)-1;}
 const img=bytes(readFileSync(atlas));doc.images.push({bufferView:img,mimeType:'image/png',name:'Original painted material atlas'});
 function walk(q){const id=doc.nodes.length,out={name:q.name,translation:q.translation};doc.nodes.push(out);const groups=new Map();for(const{geo,mat}of q.surfaces){let v=groups.get(mat.name);if(!v){v={p:[],n:[],uv:[],mat};groups.set(mat.name,v);}v.p.push(...geo.attributes.position.array);v.n.push(...geo.attributes.normal.array);v.uv.push(...geo.attributes.uv.array);}if(groups.size){const prim=[];for(const v of groups.values()){if(!mats.has(v.mat.name)){const{tile,...m}=v.mat;mats.set(m.name,doc.materials.push(m)-1);}prim.push({attributes:{POSITION:accessor(v.p,'VEC3',34962),NORMAL:accessor(v.n,'VEC3',34962),TEXCOORD_0:accessor(v.uv,'VEC2',34962)},material:mats.get(v.mat.name)});}out.mesh=doc.meshes.push({name:q.name+'_painted',primitives:prim})-1;}if(q.children.length)out.children=q.children.map(walk);return id;}
 doc.scenes[0].nodes=roots.map(walk);doc.buffers.push({byteLength:offset});let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),head=Buffer.alloc(12);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);function chunk(data,type){const h=Buffer.alloc(8);h.writeUInt32LE(data.length);h.writeUInt32LE(type,4);return Buffer.concat([h,data]);}writeFileSync(path,Buffer.concat([head,chunk(json,0x4e4f534a),chunk(bin,0x004e4942)]));
}
