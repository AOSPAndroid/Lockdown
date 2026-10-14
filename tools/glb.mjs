/** Minimal glTF binary (.glb) reading and writing, enough to check models and to make test boxes.
 * writeGlb({ nodes }) where a node is { name, translation?, box?: { size: [x, y, z], center?: [x, y, z], material: { name, color: [r, g, b] } }, children? }. */
export function readGlb(buffer) {
  if (buffer.toString('latin1', 0, 4) !== 'glTF') throw new Error('not a .glb file (binary glTF)');
  const length = buffer.readUInt32LE(12), type = buffer.toString('latin1', 16, 20);
  if (type !== 'JSON') throw new Error('first chunk is not JSON');
  return JSON.parse(buffer.toString('utf8', 20, 20 + length));
}
/** Every node name in the default scene, and the top-level ones. */
export function nodeNames(gltf) {
  const scene = gltf.scenes?.[gltf.scene ?? 0], all = [], walk = index => { const node = gltf.nodes[index]; all.push(node.name || ''); for (const child of node.children || []) walk(child); };
  for (const index of scene?.nodes || []) walk(index);
  return { all, top: (scene?.nodes || []).map(index => gltf.nodes[index].name || '') };
}
export function triangleCount(gltf) {
  let total = 0;
  for (const mesh of gltf.meshes || []) for (const primitive of mesh.primitives) {
    const accessor = gltf.accessors[primitive.indices ?? primitive.attributes.POSITION];
    total += Math.floor(accessor.count / 3);
  }
  return total;
}
export function writeGlb({ nodes }) {
  const gltf = { asset: { version: '2.0', generator: 'lockdown tools/glb.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  const chunks = []; let offset = 0;
  const view = (array, target) => { const bytes = Buffer.from(array.buffer); const padded = Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4)]); gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target }); chunks.push(padded); offset += padded.length; return gltf.bufferViews.length - 1; };
  const materialIndex = new Map();
  function box({ size, center = [0, 0, 0], material }) {
    const [sx, sy, sz] = size.map(v => v / 2), [cx, cy, cz] = center, positions = [], normals = [], indices = [];
    const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    for (const [n, u, v] of faces) {
      const base = positions.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) positions.push(cx + (n[0] + u[0] * a + v[0] * b) * sx, cy + (n[1] + u[1] * a + v[1] * b) * sy, cz + (n[2] + u[2] * a + v[2] * b) * sz), normals.push(...n);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const p = new Float32Array(positions), min = [0, 1, 2].map(i => Math.min(...positions.filter((_, k) => k % 3 === i))), max = [0, 1, 2].map(i => Math.max(...positions.filter((_, k) => k % 3 === i)));
    gltf.accessors.push({ bufferView: view(p, 34962), componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max });
    gltf.accessors.push({ bufferView: view(new Float32Array(normals), 34962), componentType: 5126, count: normals.length / 3, type: 'VEC3' });
    gltf.accessors.push({ bufferView: view(new Uint16Array(indices), 34963), componentType: 5123, count: indices.length, type: 'SCALAR' });
    const key = material.name;
    if (!materialIndex.has(key)) { gltf.materials.push({ name: material.name, pbrMetallicRoughness: { baseColorFactor: [...material.color, 1], metallicFactor: material.metal ?? .3, roughnessFactor: .5 } }); materialIndex.set(key, gltf.materials.length - 1); }
    const a = gltf.accessors.length;
    gltf.meshes.push({ primitives: [{ attributes: { POSITION: a - 3, NORMAL: a - 2 }, indices: a - 1, material: materialIndex.get(key) }] });
    return gltf.meshes.length - 1;
  }
  function add(node) {
    const out = { name: node.name }; if (node.translation) out.translation = node.translation;
    if (node.box) out.mesh = box(node.box);
    gltf.nodes.push(out); const index = gltf.nodes.length - 1;
    if (node.children?.length) out.children = node.children.map(add);
    return index;
  }
  gltf.scenes[0].nodes = nodes.map(add);
  const bin = Buffer.concat(chunks); gltf.buffers.push({ byteLength: bin.length });
  let json = Buffer.from(JSON.stringify(gltf)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(12); header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const chunk = (data, type) => { const head = Buffer.alloc(8); head.writeUInt32LE(data.length, 0); head.write(type, 4, 'latin1'); return Buffer.concat([head, data]); };
  return Buffer.concat([header, chunk(json, 'JSON'), chunk(bin, 'BIN\0')]);
}
