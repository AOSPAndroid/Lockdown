import{readFileSync,writeFileSync}from'node:fs';
const here=new URL('./',import.meta.url);
let js=readFileSync(new URL('sheets.js',here),'utf8').replaceAll('/painted/','/contrast/').replace("addCell(row,s,'B',o)","addCell(row,s,'D',o)");
writeFileSync(new URL('sheets.js',here),js);
let html=readFileSync(new URL('styles.html',here),'utf8').replaceAll('/painted/','/contrast/').replace('DESIGN EXPLORATION 02','DESIGN EXPLORATION 03').replace('Painted, layered, lean.','Three shapes. Three paint treatments.').replace('Three art directions on skeleton B · three heads tall · same outfits and Knight Brand','D proportions locked · four heads tall · same colours, outfits and Knight Brand').replace('<a href="/contrast/heights.html">Compare B, C and D →</a>','<a href="/contrast/dojo.html">Compare in the Dojo →</a>').replace('Choose the art style first.','Arc / Cut / Stack');
writeFileSync(new URL('styles.html',here),html);
