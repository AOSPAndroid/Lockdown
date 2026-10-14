/** Small, deterministic art-authoring helpers. No runtime dependency is added to the game. */
import * as T from '../../public/vendor/three/three.module.min.js';
import { writeFileSync } from 'node:fs';
export { T };

export const material = (name, hex, roughness = .7, metalness = 0) => ({
  name, pbrMetallicRoughness: { baseColorFactor: [...new T.Color(hex).toArray(), 1], roughnessFactor: roughness, metallicFactor: metalness },
});
export function node(name, translation = [0, 0, 0], children = []) { return { name, translation, children, surfaces: [] }; }
export function add(part, geo, mat, position = [0, 0, 0], rotation = [0, 0, 0]) {
  geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rotation)));
  geo.translate(...position);
  part.surfaces.push({ geo, mat });
}
export function oval(radii, segments = 16, rings = 10) {
  return new T.SphereGeometry(1, segments, rings).scale(...radii);
}
/** Rounded rectangular sections, useful for tailored cloth and molded soles. */
export function loft(sections, sides = 16, exponent = .65) {
  const positions = [], indices = [];
  for (const [y, rx, rz, cx = 0, cz = 0] of sections) {
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      positions.push(cx + rx * Math.sign(c) * Math.abs(c) ** exponent, y, cz + rz * Math.sign(s) * Math.abs(s) ** exponent);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + (j + 1) % sides, c = a + sides, d = b + sides;
    indices.push(a, c, b, b, c, d);
  }
  for (const [row, flip] of [[0, false], [sections.length - 1, true]]) {
    const [y, , , cx = 0, cz = 0] = sections[row], center = positions.length / 3;
    positions.push(cx, y, cz);
    for (let j = 0; j < sides; j++) { const a = row * sides + j, b = row * sides + (j + 1) % sides; indices.push(center, flip ? b : a, flip ? a : b); }
  }
  return geometry(positions, indices);
}
export function geometry(positions, indices) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
export function ring(rx, rz, tube = .015, segments = 24, sides = 6) {
  const g = new T.TorusGeometry(1, tube, sides, segments); g.rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), radial = Math.hypot(x, z) - 1;
    p.setXYZ(i, (rx + radial) * Math.cos(a), p.getY(i), (rz + radial) * Math.sin(a));
  }
  g.computeVertexNormals(); return g;
}
/** Sculpted, tapered strand/ribbon with a smooth elliptical section. */
export function strand(points, widths, depth, sides = 8) {
  const ps = [], ix = [];
  for (let i = 0; i < points.length; i++) {
    const tangent = new T.Vector3(...points[Math.min(i + 1, points.length - 1)]).sub(new T.Vector3(...points[Math.max(i - 1, 0)])).normalize();
    const u = new T.Vector3(0, 0, 1).cross(tangent).normalize(), v = tangent.clone().cross(u).normalize();
    for (let j = 0; j < sides; j++) { const a = j * Math.PI * 2 / sides, p = new T.Vector3(...points[i]).addScaledVector(u, Math.cos(a) * widths[i]).addScaledVector(v, Math.sin(a) * depth * Math.min(1, widths[i] / .035)); ps.push(...p.toArray()); }
  }
  for (let i = 0; i < points.length - 1; i++) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides; ix.push(a, b, a + sides, b, b + sides, a + sides); }
  // Close both ends with fans; endpoint widths remain tiny but nonzero.
  for (const [row, flip] of [[0, true], [points.length - 1, false]]) { const c = ps.length / 3; ps.push(...points[row]); for (let j = 0; j < sides; j++) { const a = row * sides + j, b = row * sides + (j + 1) % sides; ix.push(c, flip ? b : a, flip ? a : b); } }
  return geometry(ps, ix);
}
export function plate(points, depth = .04, bevel = .015) {
  const shape = new T.Shape(); shape.moveTo(...points[0]); for (const p of points.slice(1)) shape.lineTo(...p); shape.closePath();
  const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 6 });
  g.translate(0, 0, -depth / 2); return g;
}

/** Merge by part and surface type, preserve pivots, write embedded glTF 2.0. */
export function exportGlb(path, roots, description) {
  const doc = { asset: { version: '2.0', generator: 'Lockdown original art / tools/art-models', extras: { description } }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  const chunks = [], materials = new Map(); let offset = 0, triangles = 0;
  function accessor(values, type, target, componentType = 5126) {
    const data = componentType === 5126 ? new Float32Array(values) : new Uint16Array(values), bytes = Buffer.from(data.buffer);
    const view = doc.bufferViews.length; doc.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    const padding = (4 - bytes.length % 4) % 4; chunks.push(bytes, Buffer.alloc(padding)); offset += bytes.length + padding;
    const size = type === 'VEC3' ? 3 : 1, item = { bufferView: view, componentType, count: values.length / size, type };
    if (type === 'VEC3') { item.min = [Infinity, Infinity, Infinity]; item.max = [-Infinity, -Infinity, -Infinity]; values.forEach((v, i) => { item.min[i % 3] = Math.min(item.min[i % 3], v); item.max[i % 3] = Math.max(item.max[i % 3], v); }); }
    doc.accessors.push(item); return doc.accessors.length - 1;
  }
  function walk(part) {
    const id = doc.nodes.length, out = { name: part.name, translation: part.translation }; doc.nodes.push(out);
    const groups = new Map();
    for (const { geo, mat } of part.surfaces) {
      if (!groups.has(mat.name)) groups.set(mat.name, { p: [], n: [], i: [], mat });
      const group = groups.get(mat.name), remap = new Map(), p = geo.attributes.position, n = geo.attributes.normal;
      // Drop unreferenced pole/seam vertices, including the zero normals left by sphere welding.
      const indices = geo.index ? [...geo.index.array] : Array.from({ length: p.count }, (_, i) => i);
      for (const old of indices) {
        if (!remap.has(old)) { remap.set(old, group.p.length / 3); group.p.push(p.getX(old), p.getY(old), p.getZ(old)); group.n.push(n.getX(old), n.getY(old), n.getZ(old)); }
        group.i.push(remap.get(old));
      }
    }
    if (groups.size) {
      const primitives = [];
      for (const { p, n, i, mat } of groups.values()) {
        if (!materials.has(mat.name)) { materials.set(mat.name, doc.materials.length); doc.materials.push(mat); }
        if (p.length / 3 > 65535) throw new Error('16-bit vertex budget exceeded');
        const position = accessor(p, 'VEC3', 34962), normal = accessor(n, 'VEC3', 34962), indices = accessor(i, 'SCALAR', 34963, 5123);
        primitives.push({ attributes: { POSITION: position, NORMAL: normal }, indices, material: materials.get(mat.name) }); triangles += i.length / 3;
      }
      out.mesh = doc.meshes.length; doc.meshes.push({ name: part.name + '_surfaces', primitives });
    }
    if (part.children.length) out.children = part.children.map(walk);
    return id;
  }
  doc.scenes[0].nodes = roots.map(walk); doc.buffers.push({ byteLength: offset });
  let json = Buffer.from(JSON.stringify(doc)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const bin = Buffer.concat(chunks), header = Buffer.alloc(12); header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
  const chunk = (b, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(b.length); h.writeUInt32LE(type, 4); return Buffer.concat([h, b]); };
  writeFileSync(path, Buffer.concat([header, chunk(json, 0x4e4f534a), chunk(bin, 0x004e4942)]));
  console.log(`${path.split(/[\\/]/).slice(-2).join('/')}: ${triangles} triangles, ${doc.materials.length} materials`);
  return { triangles, doc };
}
