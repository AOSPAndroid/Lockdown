/** Local-only art workbench. The game server and renderer remain unchanged. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const publicRoot=fileURLToPath(new URL('../../public/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.css':'text/css'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const path=url.pathname==='/'?fileURLToPath(new URL('./preview.html',import.meta.url)):resolve(publicRoot,'.'+decodeURIComponent(url.pathname));if(url.pathname!=='/'&&!path.startsWith(publicRoot.endsWith(sep)?publicRoot:publicRoot+sep)){res.writeHead(403);res.end();return;}const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(3011,'127.0.0.1',()=>console.log('Art review: http://localhost:3011'));
