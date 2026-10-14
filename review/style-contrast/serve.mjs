// Temporary art preview. Production game sources are served unchanged.
import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,extname,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),pub=resolve(root,'public'),review=resolve(root,'review/style-contrast'),old=resolve(root,'review/painted-directions'),refs=resolve(root,'docs/reference');
const modelMap={'knight/body.glb':'body','helmet/none.glb':'hair','helmet/cobalt.glb':'cobalt-helmet','helmet/sallet.glb':'sallet','armor/cobalt.glb':'cobalt-armor','armor/scout.glb':'scout','pants/cobalt.glb':'cobalt-pants','class/guardian.glb':'guardian','weapons/brand.glb':'brand'};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost:3000'),path=u.pathname,cookie=String(req.headers.cookie||'').match(/(?:^|;\s*)contrastStyle=(\w+)/)?.[1],style=['arc','cut','stack'].includes(cookie)?cookie:'arc';
if(path.startsWith('/contrast/select/')){const id=path.split('/').pop();if(!['arc','cut','stack'].includes(id))throw Error();res.writeHead(302,{'Set-Cookie':`contrastStyle=${id}; Path=/; SameSite=Lax`,'Location':'/lockdown.html?solo=1&dojo=1','Cache-Control':'no-store'});res.end();return;}
if(path==='/art/3d/index.json'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({models:Object.keys(modelMap),textures:{}}));return;}
let base=pub,rel=path==='/'?'/index.html':path;
if(path.startsWith('/art/3d/models/')){const key=path.slice('/art/3d/models/'.length);if(!modelMap[key])throw Error();base=review;rel=`/models/${style}-D/${modelMap[key]}.glb`;}
else if(path.startsWith('/contrast/')){base=review;rel=path.slice('/contrast'.length);}
else if(path.startsWith('/painted/')){base=old;rel=path.slice('/painted'.length);}
else if(path.startsWith('/reference/')){base=refs;rel=path.slice('/reference'.length);}
const file=resolve(base,'.'+decodeURIComponent(rel));if(!file.startsWith(base+sep))throw Error();const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch{res.writeHead(404);res.end('Not found');}}).listen(3000,'127.0.0.1',()=>console.log('D art directions: http://localhost:3000/contrast/styles.html'));
