// Old-size visual reference only. The normal game on :3000 always uses production assets.
// Proxy the same game, overriding exactly one GLB with the original oversized Knight Brand.
import {createServer, request} from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const before='42d60a7';
const oldBrand=execFileSync('git',['show',before+':public/art/3d/models/weapons/brand.glb'],{cwd:root,maxBuffer:4*1024*1024});
createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost:3013').pathname;
 if(path==='/comparison/'||/^\/comparison\/[a-z-]+\.jpg$/.test(path)){
  try{
   const file=path==='/comparison/'?new URL('./brand-size.html',import.meta.url):new URL('../../docs/screenshots/brand-size/'+path.split('/').pop(),import.meta.url);
   res.writeHead(200,{'Content-Type':path.endsWith('.jpg')?'image/jpeg':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(file));
  }catch{res.writeHead(404);res.end('Not found');}
  return;
 }
 if(path==='/art/3d/models/weapons/brand.glb'){
  res.writeHead(200,{'Content-Type':'model/gltf-binary','Cache-Control':'no-store'});res.end(oldBrand);return;
 }
 const proxy=request({hostname:'127.0.0.1',port:3000,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:3000'}},upstream=>{
  res.writeHead(upstream.statusCode,{...upstream.headers,'cache-control':'no-store'});upstream.pipe(res);
 });
 proxy.on('error',()=>{res.writeHead(502);res.end('Start the normal game with npm start first.');});
 req.pipe(proxy);
}).listen(3013,'127.0.0.1',()=>console.log('Old sword Dojo reference: http://localhost:3013/lockdown.html?solo=1&dojo=1'));
