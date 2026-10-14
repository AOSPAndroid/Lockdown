import sharp from 'sharp';
import {mkdir, writeFile} from 'node:fs/promises';

export const textureSizes = {
  'knight/body': 1024, 'armor/cobalt': 1024,
  'helmet/cobalt': 512, 'helmet/none': 512, 'pants/cobalt': 512,
  'class/guardian': 512, 'class/recon': 256,
  'weapons/brand': 512, 'weapons/blaster': 512,
  'weapons/blast': 512, 'bombs/blast': 512
};
const tileNames = {
  8: 'Stack cobalt paint', 9: 'Stack silver paint', 10: 'Stack leather',
  11: 'Stack cream cloth', 12: 'shared brass', 13: 'shared charcoal cloth',
  14: 'shared chestnut hair', 15: 'shared skin gradient'
};

// Export only swatches actually referenced by this model. Square swatches stay square;
// the small unused cells are solid padding, never another item's or direction's painting.
export async function packTexture(source, tiles, model) {
  const size = textureSizes[model];
  if (!size) throw Error('No texture budget for ' + model);
  tiles = [...new Set(tiles)].sort((a,b) => a-b);
  if (tiles.some(tile => !tileNames[tile])) throw Error(model + ': non-Stack source tile');
  const columns = Math.ceil(Math.sqrt(tiles.length)), cell = Math.floor(size / columns);
  const sourceMeta = await sharp(source).metadata(), swatch = sourceMeta.width / 4;
  if (swatch !== Math.floor(swatch) || sourceMeta.width !== sourceMeta.height) throw Error('Invalid source atlas');
  const regions = [], composite = [];
  for (const [i,tile] of tiles.entries()) {
    const left = i % columns * cell, top = Math.floor(i / columns) * cell;
    const pixels = await sharp(source)
      .extract({left:tile%4*swatch, top:Math.floor(tile/4)*swatch, width:swatch, height:swatch})
      .resize(cell, cell, {kernel:'lanczos3'}).removeAlpha().png().toBuffer();
    composite.push({input:pixels,left,top});
    regions.push({tile,name:tileNames[tile],left,top,width:cell,height:cell});
  }
  const data = await sharp({create:{width:size,height:size,channels:3,background:'#151c25'}})
    .composite(composite).jpeg({quality:90,chromaSubsampling:'4:4:4',mozjpeg:true}).toBuffer();
  const target = new URL('./packed-textures/' + model + '.jpg', import.meta.url);
  await mkdir(new URL('./',target), {recursive:true});
  await writeFile(target,data);
  return {data,size,regions,mimeType:'image/jpeg',quality:90};
}
