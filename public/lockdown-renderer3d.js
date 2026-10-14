/** Lockdown in real 3D (three.js): the Spiral Knights look — a ¾ perspective camera over chunky
 * bevelled blocks floating above a dark void, framed floor plates, glowing lamps, a mechanical
 * capture platform, heart pads and chibi knights with team rings at their feet.
 *
 * It draws the same deterministic state as the 2D renderer and has the same interface
 * (render, resize, screenToWorld, aimHeight). All geometry is built in code from the map grid, so
 * the game needs no models; materials are painted procedurally per theme. Scene units: one map
 * tile = 1, x east, z south (the engine's y), y up. */
import * as THREE from './vendor/three/three.module.min.js';
import { EffectComposer } from './vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/addons/postprocessing/OutputPass.js';
import { MAPS, TILE, isWall, levelCell, levelAt, STAIRS } from './lockdown-maps.js';
import { WEAPONS, RULES, GUARD, ABILITIES, STATUS_IDS, chargeTicksFor } from './lockdown-engine.js';
import { TEAM_COLORS } from './lockdown-renderer.js';
import { RIG, RIG_PARTS, GEAR_PARTS, GRIP, SHIELDS, skeletonParts } from './lockdown-skeleton.js';
export { RIG_PARTS };

const U = 1 / TILE;
const STOREY = .8;          // height of the raised floor
const WALL = 1.3;           // walls stand this high above their floor
const DEPTH = 2.6;          // how far the map's cliffs drop into the void
const BEVEL = .1;           // chamfer on the top edges of wall blocks
const KNIGHT = 1.3;          // knight height as drawn
const FEET_RING = .3;       // team ring radius under each knight (before scaling)
const CHARGE_SEGMENTS = 48;
const TRAIL_POINTS = 64;    // samples in the Striker's neon trail // pieces of the charge ring, filled one by one
const KNIGHT_SCALE = 1.4;   // chunky, readable knights

const THEMES = Object.freeze({
  castle: { bg: '#0d1117', sky: '#b9c8d8', ground: '#2a2420', floor: ['#8e9088', '#9a9b91', '#84867e'], grout: '#5f615b', wall: '#8a7f6e', wallDark: '#5a5145', wallTop: '#b9ae97', trim: '#d8cdb4', cliff: '#4a4038', pit: 'water', pitColor: '#1d5f7e', lamp: '#ffcf86', style: 'flagstone' },
  maze: { bg: '#0b1410', sky: '#d8f0c0', ground: '#1f2a16', floor: ['#6fa042', '#78aa48', '#669a3c'], grout: '#57843a', wall: '#3f8a2c', wallDark: '#2a5e1e', wallTop: '#8fd14c', trim: '#a8e05a', cliff: '#5a4a32', pit: 'bog', pitColor: '#2e4a24', lamp: '#fff0a0', style: 'grass', hedge: true },
  foundry: { bg: '#0b0a12', sky: '#c8b8d8', ground: '#1a1420', floor: ['#4e5763', '#556070', '#48515c'], grout: '#363d47', wall: '#b23e36', wallDark: '#6e2622', wallTop: '#d0584a', trim: '#e2b04a', cliff: '#3a2e3c', pit: 'lava', pitColor: '#ff6a1a', lamp: '#ffe2a6', style: 'metal' },
  ruins: { exposure: .9, bloom: .96, bg: '#0c1214', sky: '#e8dcc0', ground: '#2a2418', floor: ['#cdb88e', '#d6c299', '#c3ad83'], grout: '#a8946c', wall: '#cdb990', wallDark: '#8e7b58', wallTop: '#e6d6b0', trim: '#f2e6c6', cliff: '#7a6648', pit: 'water', pitColor: '#1f8a8a', lamp: '#ffe0a0', style: 'sandstone' },
  graveyard: { bg: '#0a0a12', sky: '#9a9ab8', ground: '#16141e', floor: ['#4a4e58', '#52566a', '#444852'], grout: '#33363f', wall: '#5c5a6c', wallDark: '#38364a', wallTop: '#7c7a90', trim: '#9a98b0', cliff: '#2c2a38', pit: 'chasm', pitColor: '#1a1428', lamp: '#b8a8ff', style: 'slate' },
  skyway: { exposure: .72, bloom: .98, bg: '#5f8fcc', sky: '#e8f0ff', ground: '#6a84a8', floor: ['#cfc8b6', '#d8d1c0', '#c5bead'], grout: '#b8ae96', wall: '#e8e2d2', wallDark: '#b0a68e', wallTop: '#f6f1e4', trim: '#d8b45a', cliff: '#9a8c74', pit: 'sky', pitColor: '#8ab8ec', lamp: '#fff2c0', style: 'marble' },
});
const ELEMENT = Object.freeze({ holy: '#fff2a0', burn: '#ff7a2a', chill: '#7cc8ff', freeze: '#bfeaff', shock: '#8fe0ff', poison: '#6ee05a', curse: '#b26bff', drain: '#ff4d6d' });
const STATUS_COLOR = Object.freeze({ burn: '#ff8a3d', poison: '#7bd65a', shock: '#7fc8ff', freeze: '#bfeaff', chill: '#6fb6ff', curse: '#b26bff' });
/** The named parts of a knight rig (docs/MODELS.md). */
/** Models listed in public/art/3d/index.json load once; instances get their own materials, and
 * materials named "team..." take the knight's team colour. */
class ModelLibrary {
  constructor(onChange) {
    this.scenes = new Map(); this.version = 0;
    if (typeof fetch !== 'function') return;
    fetch('/art/3d/index.json').then(response => response.ok ? response.json() : {}).then(async data => {
      const list = data.models || [];
      if (!list.length) return;
      const { GLTFLoader } = await import('./vendor/three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      for (const file of list) loader.load(`/art/3d/models/${file}`, gltf => { this.scenes.set(file, gltf.scene); this.version++; onChange?.(); }, undefined, problem => console.warn(`model ${file} failed to load`, problem));
    }).catch(() => {});
  }
  instance(file, team = null) {
    const source = this.scenes.get(file); if (!source) return null;
    const copy = source.clone(true);
    copy.traverse(node => {
      if (!node.isMesh) return;
      node.material = Array.isArray(node.material) ? node.material.map(material => material.clone()) : node.material.clone();
      for (const material of [node.material].flat()) if (team && /^team/i.test(material.name || '')) { material.color = team.clone(); if (material.emissive) { material.emissive = team.clone(); material.emissiveIntensity = .35; } }
    });
    return copy;
  }
}
const CALLOUTS = Object.freeze({
  counter: ['COUNTER', '#ffb347', 'target'], riposte: ['RIPOSTE', '#ffe680', 'target'], perfectDodge: ['PERFECT', '#9ff0ff', 'player'],
  clash: ['CLASH', '#ffffff', 'player'], steady: ['STEADY', '#c9d6ff', 'player'], interrupt: ['INTERRUPTED', '#ff8a7a', 'player'],
  whiff: ['MISS', '#b8b8b8', 'player'], sweetSpot: ['TIP', '#ffe680', 'target'], ambush: ['AMBUSH', '#d29bff', 'target'],
  guardBreak: ['GUARD BREAK', '#ffffff', 'player'], evade: ['DODGE', '#ffffff', 'player'],
});
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
const colour = value => new THREE.Color(value);

// ---------- procedural textures ----------
function canvasTexture(size, paint, { repeat = true } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
function shadeHex(hex, amount) { const c = colour(hex); c.offsetHSL(0, 0, amount); return `#${c.getHexString()}`; }
/** Fine grain so no surface reads as flat plastic. */
function grain(ctx, size, strength = 10, seed = 1) {
  const image = ctx.getImageData(0, 0, size, size), data = image.data;
  for (let i = 0; i < data.length; i += 4) { const n = (hash(i >> 2, seed) - .5) * strength; data[i] += n; data[i + 1] += n; data[i + 2] += n; }
  ctx.putImageData(image, 0, 0);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
/** Floor: four tiles across, so the paving is broader than the collision grid. */
function floorTexture(theme) {
  const t = THEMES[theme];
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = t.grout; ctx.fillRect(0, 0, s, s);
    if (t.style === 'grass') {
      ctx.fillStyle = t.floor[0]; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) { const x = hash(i, 3) * s, y = hash(i, 4) * s, l = 6 + hash(i, 5) * 10; ctx.strokeStyle = hash(i, 6) < .5 ? t.floor[1] : t.grout; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hash(i, 7) - .5) * 6, y - l); ctx.stroke(); }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,200,.06)'; ctx.beginPath(); ctx.arc(hash(i, 8) * s, hash(i, 9) * s, 20 + hash(i, 10) * 40, 0, Math.PI * 2); ctx.fill(); }
      grain(ctx, s, 8, 2); return;
    }
    const cell = s / 4, gap = t.style === 'metal' ? 6 : 5, r = t.style === 'metal' ? 6 : 14;
    const slabs = [];
    // Flagstones and slate mix big and small slabs; metal and marble keep a strict grid.
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      if (slabs.some(slab => slab.cells.includes(`${col},${row}`))) continue;
      const wide = t.style !== 'metal' && t.style !== 'marble' && col < 3 && hash(col, row + 9) < .35 && !slabs.some(slab => slab.cells.includes(`${col + 1},${row}`));
      const tall = !wide && t.style === 'sandstone' && row < 3 && hash(col + 4, row) < .3;
      slabs.push({ x: col * cell, y: row * cell, w: cell * (wide ? 2 : 1), h: cell * (tall ? 2 : 1), cells: [`${col},${row}`, ...(wide ? [`${col + 1},${row}`] : []), ...(tall ? [`${col},${row + 1}`] : [])] });
    }
    slabs.forEach((slab, i) => {
      const base = t.floor[Math.floor(hash(i, 11) * t.floor.length)], x = slab.x + gap / 2, y = slab.y + gap / 2, w = slab.w - gap, h = slab.h - gap;
      roundRect(ctx, x, y, w, h, r); ctx.fillStyle = base; ctx.fill();
      // Soft bevel: lit top-left rim, shaded bottom-right rim.
      const light = ctx.createLinearGradient(x, y, x + w, y + h); light.addColorStop(0, 'rgba(255,255,255,.18)'); light.addColorStop(.45, 'rgba(255,255,255,0)'); light.addColorStop(1, 'rgba(0,0,0,.18)');
      ctx.fillStyle = light; ctx.fill();
      roundRect(ctx, x + 7, y + 7, w - 14, h - 14, Math.max(2, r - 6)); ctx.fillStyle = shadeHex(base, .015); ctx.fill();
      if (t.style === 'metal') {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; for (const [rx, ry] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) { ctx.beginPath(); ctx.arc(x + rx, y + ry, 3.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 12, y + k * h / 4); ctx.lineTo(x + w - 12, y + k * h / 4); ctx.stroke(); }
      }
      if (t.style === 'marble') { ctx.strokeStyle = 'rgba(200,160,70,.55)'; ctx.lineWidth = 3; roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 6); ctx.stroke(); }
      if (hash(i, 12) < .22) {
        // A carved swirl, as on Spiral Knights' plates.
        ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 4; ctx.beginPath();
        const cx = x + w / 2, cy = y + h / 2; for (let a = 0; a < Math.PI * 5; a += .2) { const rr = 3 + a * 3.2; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.stroke();
      } else if (hash(i, 13) < .25) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; ctx.beginPath(); let px = x + w * .3, py = y + h * .2; ctx.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (hash(i, k) - .3) * 22; py += 14; ctx.lineTo(px, py); } ctx.stroke(); }
    });
    grain(ctx, s, 9, 3);
  });
}
/** Wall faces: v = 0 at the wall's top, so the lit cap band always sits on top. */
function wallTexture(theme) {
  const t = THEMES[theme];
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = t.wall; ctx.fillRect(0, 0, s, s);
    if (t.hedge) {
      for (let i = 0; i < 260; i++) { const x = hash(i, 1) * s, y = hash(i, 2) * s, r = 10 + hash(i, 3) * 18; ctx.fillStyle = hash(i, 4) < .5 ? t.wallDark : shadeHex(t.wall, .06); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      grain(ctx, s, 14, 5); return;
    }
    // Cap band, then panels or courses of blocks below it.
    ctx.fillStyle = t.trim; ctx.fillRect(0, 0, s, 30); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 30, s, 6);
    if (t.style === 'metal') {
      ctx.fillStyle = t.wallDark; for (const x of [16, 144]) { roundRect(ctx, x, 56, 96, 150, 8); ctx.fill(); }
      ctx.strokeStyle = t.trim; ctx.lineWidth = 6; for (const x of [16, 144]) { ctx.beginPath(); ctx.moveTo(x + 10, 70); ctx.lineTo(x + 86, 190); ctx.moveTo(x + 86, 70); ctx.lineTo(x + 10, 190); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,.3)'; for (let x = 8; x < s; x += 32) { ctx.beginPath(); ctx.arc(x, 44, 4, 0, Math.PI * 2); ctx.fill(); }
    } else {
      const course = 46;
      for (let row = 0, y = 40; y < s; row++, y += course) for (let x = row % 2 ? -64 : 0; x < s; x += 128) {
        roundRect(ctx, x + 4, y + 4, 120, course - 8, 9); ctx.fillStyle = hash(x + 300, row) < .5 ? t.wall : shadeHex(t.wall, -.04); ctx.fill();
        const g = ctx.createLinearGradient(0, y, 0, y + course); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); ctx.fillStyle = g; ctx.fill();
      }
    }
    // A darker plinth where the wall meets the floor.
    const foot = ctx.createLinearGradient(0, s - 34, 0, s); foot.addColorStop(0, 'rgba(0,0,0,0)'); foot.addColorStop(.35, 'rgba(0,0,0,.3)'); foot.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = foot; ctx.fillRect(0, s - 34, s, 34);
    grain(ctx, s, 10, 6);
  });
}
function plainTexture(base, { dark = null, blobs = 0, strength = 10, seed = 7 } = {}) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < blobs; i++) { ctx.fillStyle = hash(i, seed) < .5 ? dark : shadeHex(base, .05); roundRect(ctx, hash(i, seed + 1) * s, hash(i, seed + 2) * s, 30 + hash(i, seed + 3) * 60, 18 + hash(i, seed + 4) * 30, 10); ctx.fill(); }
    grain(ctx, s, strength, seed);
  });
}
/** The capture court painted on the floor: a hazard-striped frame and a soft inner field. */
function courtTexture() {
  return canvasTexture(512, (ctx, s) => {
    const c = s / 2;
    ctx.clearRect(0, 0, s, s);
    const field = ctx.createRadialGradient(c, c, c * .2, c, c, c * .95); field.addColorStop(0, 'rgba(255,255,255,.08)'); field.addColorStop(1, 'rgba(255,255,255,.02)');
    ctx.fillStyle = field; ctx.beginPath(); ctx.arc(c, c, c * .95, 0, Math.PI * 2); ctx.fill();
    // Hazard stripes around the edge, between two brass rims.
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, c * .98, 0, Math.PI * 2); ctx.arc(c, c, c * .86, 0, Math.PI * 2, true); ctx.clip();
    ctx.fillStyle = '#1e1e22'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#f2b632'; for (let i = 0; i < 64; i++) { ctx.save(); ctx.translate(c, c); ctx.rotate(i / 64 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(c * .84, -8); ctx.lineTo(c, -22); ctx.lineTo(c, -2); ctx.lineTo(c * .84, 12); ctx.fill(); ctx.restore(); }
    ctx.restore();
    ctx.strokeStyle = '#c99a3c'; ctx.lineWidth = 6; for (const r of [.86, .98]) { ctx.beginPath(); ctx.arc(c, c, c * r, 0, Math.PI * 2); ctx.stroke(); }
  }, { repeat: false });
}
function glowTexture() {
  return canvasTexture(128, (ctx, s) => { const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); }, { repeat: false });
}
function liquidTexture(theme) {
  const t = THEMES[theme];
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = t.pitColor; ctx.fillRect(0, 0, s, s);
    if (t.pit === 'lava') {
      for (let i = 0; i < 60; i++) { ctx.fillStyle = hash(i, 1) < .5 ? '#ffb040' : '#c83a10'; ctx.beginPath(); ctx.ellipse(hash(i, 2) * s, hash(i, 3) * s, 14 + hash(i, 4) * 26, 8 + hash(i, 5) * 14, hash(i, 6) * 3, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(40,10,0,.55)'; ctx.beginPath(); ctx.ellipse(hash(i, 7) * s, hash(i, 8) * s, 10 + hash(i, 9) * 20, 6 + hash(i, 10) * 10, hash(i, 11) * 3, 0, Math.PI * 2); ctx.fill(); }
    } else if (t.pit === 'sky') {
      for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(hash(i, 1) * s, hash(i, 2) * s, 10 + hash(i, 3) * 24, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3;
      for (let i = 0; i < 40; i++) { const x = hash(i, 1) * s, y = hash(i, 2) * s; ctx.beginPath(); ctx.arc(x, y, 8 + hash(i, 3) * 20, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    }
    grain(ctx, s, 6, 9);
  });
}

// ---------- geometry ----------
/** Collects quads into one buffer (positions, normals, uvs, vertex colours). */
class Builder {
  constructor() { this.position = []; this.normal = []; this.uv = []; this.color = []; this.index = []; }
  quad(points, normal, uvs, tint = [1, 1, 1]) {
    const base = this.position.length / 3;
    for (let i = 0; i < 4; i++) { this.position.push(...points[i]); this.normal.push(...normal); this.uv.push(...uvs[i]); this.color.push(...tint); }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setIndex(this.index);
    return geometry;
  }
  get empty() { return !this.index.length; }
}
/** A flat sector of a ring in the floor plane (angles are world headings: 0 east, π/2 south). */
function arcGeometry(inner, outer, from, to, segments = 24) {
  const position = [], index = [];
  for (let i = 0; i <= segments; i++) {
    const a = from + (to - from) * i / segments;
    position.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * outer, 0, Math.sin(a) * outer);
    if (i < segments) { const k = i * 2; index.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Lockdown3DRenderer {
  constructor(overlayCanvas, assets, overlay2d) {
    // The WebGL canvas sits under the existing canvas, which stays on top for input and the 2D overlay.
    this.overlayCanvas = overlayCanvas; this.overlay = overlay2d; this.ctx = overlayCanvas.getContext('2d'); this.assets = assets;
    this.canvas = document.createElement('canvas'); this.canvas.className = 'ld-arena3d';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    overlayCanvas.parentNode.insertBefore(this.canvas, overlayCanvas);
    // ?quality=low drops shadows and glow for slower machines.
    this.quality = new URLSearchParams(globalThis.location?.search || '').get('quality') === 'low' ? 'low' : 'high';
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.shadowMap.enabled = this.quality === 'high'; this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.camera3 = new THREE.PerspectiveCamera(34, 16 / 9, .5, 120);
    this.target = new THREE.Vector3(); this.cameraReady = false;
    this.glow = glowTexture();
    this.hemi = new THREE.HemisphereLight('#c8d4ff', '#2a2420', 1.6); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3e0', 2.4); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    this.sun.shadow.bias = -.0006; this.sun.shadow.normalBias = .03;
    this.scene.add(this.sun, this.sun.target);
    this.mapGroup = null; this.mapId = null;
    this.knights = new Map(); this.shots = new Map(); this.bombs = new Map(); this.hearts = new Map(); this.clouds = new Map();
    this.effects = []; this.texts = []; this.seenEvents = new Set(); this.eventOrder = []; this.localId = null; this.shake = 0;
    this.camera = { x: 0, y: 0, zoom: 1 }; // kept for callers that read it
    this.raycaster = new THREE.Raycaster();
    this.models = new ModelLibrary();
    // Glow: lamps, crystals, shots, team rings and slashes bloom softly, as in Spiral Knights.
    if (this.quality === 'high') {
      this.composer = new EffectComposer(this.gl);
      this.composer.addPass(new RenderPass(this.scene, this.camera3));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), .5, .5, .85);
      this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    }
    this.resize();
  }
  resize() {
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1), rect = this.overlayCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    this.gl.setPixelRatio(ratio); this.gl.setSize(width, height, false);
    if (this.composer) { this.composer.setPixelRatio(ratio); this.composer.setSize(width, height); }
    this.camera3.aspect = width / height; this.camera3.updateProjectionMatrix();
    this.overlay?.resize();
  }
  /** Height (scene units) of the plane the pointer aims on: a knight's chest, on their floor. */
  aimHeight(player) { const map = MAPS[this.mapId]; return (map ? levelAt(map, player.x, player.y) * STOREY : 0) + KNIGHT * .45; }
  get aimLift() { return 0; }
  /** Screen pixel → world position on the horizontal plane at `height` scene units. */
  screenToWorld(px, py, height = 0) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(px / Math.max(1, rect.width) * 2 - 1, -(py / Math.max(1, rect.height)) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera3);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hit)) return { x: this.target.x / U, y: this.target.z / U };
    return { x: hit.x / U, y: hit.z / U };
  }
  /** World position (engine units, plus a height in scene units) → overlay pixel. */
  project(x, y, height) {
    const v = new THREE.Vector3(x * U, height, y * U).project(this.camera3), rect = this.overlayCanvas.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height, visible: v.z < 1 };
  }

  // ---------- the static arena ----------
  buildMap(map) {
    if (this.mapId === map.id && this.mapGroup) return;
    if (this.mapGroup) { this.scene.remove(this.mapGroup); this.mapGroup.traverse(node => { node.geometry?.dispose(); }); }
    this.mapId = map.id;
    const theme = THEMES[map.theme] ? map.theme : 'castle', t = THEMES[theme], group = new THREE.Group();
    this.theme = t; this.mapGroup = group; this.scene.add(group);
    this.scene.background = colour(t.bg);
    this.scene.fog = theme === 'skyway' ? new THREE.Fog(t.bg, 30, 70) : new THREE.Fog(t.bg, 24, 46);
    this.hemi.color = colour(t.sky); this.hemi.groundColor = colour(t.ground);
    // Pale themes need less light and a higher glow threshold, or the whole floor blooms.
    this.gl.toneMappingExposure = t.exposure ?? 1.15;
    if (this.bloom) this.bloom.threshold = t.bloom ?? .85;
    const tex = { floor: floorTexture(theme), wall: wallTexture(theme), top: plainTexture(t.wallTop, { dark: shadeHex(t.wallTop, -.05), blobs: t.hedge ? 0 : 10 }), cliff: plainTexture(t.cliff, { dark: shadeHex(t.cliff, -.06), blobs: 24, strength: 14 }) };
    const material = {
      floor: new THREE.MeshStandardMaterial({ map: tex.floor, vertexColors: true, roughness: t.style === 'marble' ? .55 : .9, metalness: t.style === 'metal' ? .25 : 0 }),
      wall: new THREE.MeshStandardMaterial({ map: tex.wall, vertexColors: true, roughness: .85 }),
      top: new THREE.MeshStandardMaterial({ map: tex.top, vertexColors: true, roughness: .8 }),
      cliff: new THREE.MeshStandardMaterial({ map: tex.cliff, vertexColors: true, roughness: 1 }),
    };
    const cell = (col, row) => (row < 0 || col < 0 || row >= map.rows || col >= map.cols) ? 'out' : map.grid[row][col] === '#' ? 'wall' : map.grid[row][col] === '~' ? 'pit' : 'floor';
    const base = (col, row) => levelCell(map, col, row) === '1' ? STOREY : 0;
    const stair = (col, row) => STAIRS[levelCell(map, col, row)] || null;
    const top = (col, row) => { const kind = cell(col, row); return kind === 'out' || kind === 'pit' ? -DEPTH : kind === 'wall' ? base(col, row) + WALL : stair(col, row) ? null : base(col, row); };
    const floors = new Builder(), walls = new Builder(), tops = new Builder(), cliffs = new Builder();
    const spawnTint = [new Set(map.spawns[0].map(p => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`)), new Set(map.spawns[1].map(p => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`))];
    const teamTint = team => { const c = colour(TEAM_COLORS[team].main); return [1.35 + c.r * .25, 1.3 + c.g * .25, 1.2 + c.b * .25]; };
    /** A vertical face along one cell edge, from y0 down to y1, facing (dx, dz). v runs down from `vTop`. */
    const side = (builder, col, row, dx, dz, y0, y1, tint = [1, 1, 1], vTop = y0, vScale = 1) => {
      if (y0 <= y1 + 1e-4) return;
      let a, b;
      if (dx === 1) { a = [col + 1, row + 1]; b = [col + 1, row]; } else if (dx === -1) { a = [col, row]; b = [col, row + 1]; }
      else if (dz === 1) { a = [col, row + 1]; b = [col + 1, row + 1]; } else { a = [col + 1, row]; b = [col, row]; }
      const along = dx ? row : col;
      builder.quad([[a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], [b[0], y0, b[1]]], [dx, 0, dz], [[along, (vTop - y0) * vScale], [along, (vTop - y1) * vScale], [along + 1, (vTop - y1) * vScale], [along + 1, (vTop - y0) * vScale]], tint);
    };
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      const kind = cell(col, row);
      if (kind === 'pit') continue;
      const steps = stair(col, row);
      if (kind === 'floor' && steps) { this.buildStairs(map, col, row, steps, floors, cliffs, top); continue; }
      const h = top(col, row), shade = 1 - hash(col, row) * .06;
      if (kind === 'floor') {
        const team = spawnTint[0].has(`${col},${row}`) ? 0 : spawnTint[1].has(`${col},${row}`) ? 1 : null;
        // Bases are bright courts, warmed a touch by their team's colour.
        const tint = team !== null ? teamTint(team) : h > 0 ? [1.06, 1.05, 1.02] : [shade, shade, shade];
        floors.quad([[col, h, row], [col, h, row + 1], [col + 1, h, row + 1], [col + 1, h, row]], [0, 1, 0], [[col / 4, row / 4], [col / 4, (row + 1) / 4], [(col + 1) / 4, (row + 1) / 4], [(col + 1) / 4, row / 4]], tint);
        for (const [dx, dz] of SIDES) {
          const other = top(col + dx, row + dz);
          if (other === null) continue; // a stair builds its own sides
          side(cliffs, col, row, dx, dz, h, other, [.9, .9, .9], h);
        }
      } else {
        const floorH = base(col, row), B = BEVEL;
        const neighbour = (dx, dz) => { const otherKind = cell(col + dx, row + dz); return otherKind === 'wall' ? top(col + dx, row + dz) : otherKind === 'out' || otherKind === 'pit' ? -DEPTH : (top(col + dx, row + dz) ?? 0); };
        const open = { px: neighbour(1, 0) < h, nx: neighbour(-1, 0) < h, pz: neighbour(0, 1) < h, nz: neighbour(0, -1) < h };
        // The cap is inset where the block has an edge, and a mitred chamfer runs down to the face:
        // the chunky bevelled look of Spiral Knights' blocks.
        const x0 = col + (open.nx ? B : 0), x1 = col + 1 - (open.px ? B : 0), z0 = row + (open.nz ? B : 0), z1 = row + 1 - (open.pz ? B : 0), hb = h - B;
        const tint = [shade, shade, shade];
        tops.quad([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], [0, 1, 0], [[x0, z0], [x0, z1], [x1, z1], [x1, z0]], tint);
        const k = Math.SQRT1_2, lit = [shade * 1.12, shade * 1.1, shade * 1.06];
        if (open.px) tops.quad([[x1, h, z1], [col + 1, hb, row + 1], [col + 1, hb, row], [x1, h, z0]], [k, k, 0], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        if (open.nx) tops.quad([[x0, h, z0], [col, hb, row], [col, hb, row + 1], [x0, h, z1]], [-k, k, 0], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        if (open.pz) tops.quad([[x0, h, z1], [col, hb, row + 1], [col + 1, hb, row + 1], [x1, h, z1]], [0, k, k], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        if (open.nz) tops.quad([[x1, h, z0], [col + 1, hb, row], [col, hb, row], [x0, h, z0]], [0, k, -k], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        // A chamfer only on one side of a corner leaves a small notch; fill it with the neighbour's slope.
        for (const [dx, dz] of SIDES) {
          const other = neighbour(dx, dz);
          if (other >= h) continue;
          // Masonry down to the floor it stands on, cliff below that (into a pit or off the map).
          // One wall texture spans exactly one wall face, cap band at the top, foot at the floor.
          side(walls, col, row, dx, dz, hb, Math.max(other, floorH), [1, 1, 1], h, 1 / WALL);
          side(cliffs, col, row, dx, dz, Math.min(hb, floorH), other, [.8, .8, .8], floorH);
        }
      }
    }
    this.applyArt(theme, material);
    const add = (builder, mat, { cast = true, receive = true } = {}) => { if (builder.empty) return; const mesh = new THREE.Mesh(builder.build(), mat); mesh.castShadow = cast; mesh.receiveShadow = receive; group.add(mesh); return mesh; };
    add(floors, material.floor, { cast: false }); add(walls, material.wall); add(tops, material.top); add(cliffs, material.cliff);
    this.buildPits(map, group, theme);
    if (t.hedge) this.buildHedges(map, group, t, top);
    this.buildLamps(map, group, t, cell, base);
    this.buildRailings(map, group, t, cell, top);
    this.buildPillars(map, group, t, cell, top);
    this.buildBanners(map, group, top);
    this.buildBases(map, group);
    this.buildPoints(map, group);
  }
  /** Painted art replaces the procedural materials wherever a file exists (see docs/LOOK.md):
   * public/art/3d/<theme>/{floor,wall,wall_top,cliff}.png, each with an optional *_normal.png.
   * public/art/3d/index.json lists what is there (node tools/art3d-index.mjs writes it). */
  applyArt(theme, material) {
    const slots = { floor: material.floor, wall: material.wall, wall_top: material.top, cliff: material.cliff };
    const index = Lockdown3DRenderer.artIndex ||= fetch('/art/3d/index.json').then(response => response.ok ? response.json() : { files: [] }).then(data => new Set(data.files || [])).catch(() => new Set());
    const loader = new THREE.TextureLoader();
    index.then(files => {
      for (const [slot, target] of Object.entries(slots)) {
        const file = `${theme}/${slot}.png`, normal = `${theme}/${slot}_normal.png`;
        if (files.has(file)) loader.load(`/art/3d/${file}`, texture => {
          texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
          target.map = texture; target.needsUpdate = true;
        });
        if (files.has(normal)) loader.load(`/art/3d/${normal}`, texture => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; target.normalMap = texture; target.needsUpdate = true; });
      }
    });
  }
  /** Stairs: four steps climbing one storey toward the arrow, with side walls down to the ground. */
  buildStairs(map, col, row, [dx, dz], floors, cliffs, top) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y = (i + 1) / n * STOREY, f0 = i / n, f1 = (i + 1) / n;
      // The step's footprint along the climb (from the low end) and across.
      const along = (f, s) => dx ? [dx > 0 ? col + f : col + 1 - f, row + s] : [col + s, dz > 0 ? row + f : row + 1 - f];
      const p = [along(f0, 0), along(f0, 1), along(f1, 1), along(f1, 0)];
      const quadTop = [[p[0][0], y, p[0][1]], [p[1][0], y, p[1][1]], [p[2][0], y, p[2][1]], [p[3][0], y, p[3][1]]];
      const up = dx > 0 || dz > 0;
      floors.quad(up ? quadTop : [quadTop[0], quadTop[3], quadTop[2], quadTop[1]], [0, 1, 0], [[p[0][0] / 4, p[0][1] / 4], [p[1][0] / 4, p[1][1] / 4], [p[2][0] / 4, p[2][1] / 4], [p[3][0] / 4, p[3][1] / 4]], [1.04, 1.03, 1]);
      // Riser facing downhill.
      const r0 = p[0], r1 = p[1], y0 = y - STOREY / n, facing = [-dx, 0, -dz];
      const riser = [[r0[0], y, r0[1]], [r0[0], y0, r0[1]], [r1[0], y0, r1[1]], [r1[0], y, r1[1]]];
      cliffs.quad(dx > 0 || dz < 0 ? riser : [riser[3], riser[2], riser[1], riser[0]], facing, [[0, 0], [0, .2], [1, .2], [1, 0]], [.95, .95, .95]);
      if (i === 0) {
        const low = [[r0[0], y0, r0[1]], [r0[0], 0, r0[1]], [r1[0], 0, r1[1]], [r1[0], y0, r1[1]]];
        cliffs.quad(dx > 0 || dz < 0 ? low : [low[3], low[2], low[1], low[0]], facing, [[0, 0], [0, .1], [1, .1], [1, 0]]);
      }
    }
    // Side walls of the flight, down to whatever lies beside it.
    for (const [sx, sz] of SIDES) {
      if (sx === dx && sz === dz || sx === -dx && sz === -dz) continue;
      const other = top(col + sx, row + sz) ?? 0;
      for (let i = 0; i < n; i++) {
        const y = (i + 1) / n * STOREY; if (y <= other) continue;
        const f0 = i / n, f1 = (i + 1) / n;
        let a, b;
        if (sx) { const x = sx > 0 ? col + 1 : col; const z0 = dz > 0 ? row + f0 : dz < 0 ? row + 1 - f0 : row, z1 = dz > 0 ? row + f1 : dz < 0 ? row + 1 - f1 : row + 1; a = [x, z0]; b = [x, z1]; }
        else { const z = sz > 0 ? row + 1 : row; const x0 = dx > 0 ? col + f0 : dx < 0 ? col + 1 - f0 : col, x1 = dx > 0 ? col + f1 : dx < 0 ? col + 1 - f1 : col + 1; a = [x0, z]; b = [x1, z]; }
        const quad = [[a[0], y, a[1]], [a[0], other, a[1]], [b[0], other, b[1]], [b[0], y, b[1]]];
        // Wind the face outward.
        const cross = (b[0] - a[0]) * sz - (b[1] - a[1]) * sx;
        cliffs.quad(cross > 0 ? [quad[3], quad[2], quad[1], quad[0]] : quad, [sx, 0, sz], [[0, 0], [0, y - other], [.2, y - other], [.2, 0]], [.9, .9, .9]);
      }
    }
  }
  buildPits(map, group, theme) {
    const t = THEMES[theme], liquid = new Builder();
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.grid[row][col] === '~') {
      liquid.quad([[col, -.35, row], [col, -.35, row + 1], [col + 1, -.35, row + 1], [col + 1, -.35, row]], [0, 1, 0], [[col / 3, row / 3], [col / 3, (row + 1) / 3], [(col + 1) / 3, (row + 1) / 3], [(col + 1) / 3, row / 3]]);
    }
    if (t.pit === 'water' || t.pit === 'lava' || t.pit === 'bog') {
      const texture = liquidTexture(theme);
      const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: t.pit === 'water' ? .15 : .7, metalness: t.pit === 'water' ? .2 : 0, transparent: t.pit === 'water', opacity: .9,
        emissive: t.pit === 'lava' ? colour('#ff5a10') : colour('#000000'), emissiveMap: t.pit === 'lava' ? texture : null, emissiveIntensity: t.pit === 'lava' ? 1.4 : 0 });
      const mesh = new THREE.Mesh(liquid.build(), mat); mesh.receiveShadow = true; group.add(mesh); this.liquid = texture;
      if (t.pit === 'lava') for (let i = 0; i < 6; i++) { const light = new THREE.PointLight('#ff6a20', 3, 6, 1.6); const spot = this.pitSpot(map, i); light.position.set(spot.x, .3, spot.z); group.add(light); }
    } else this.liquid = null;
    // Far below the arena: clouds for the sky bridges, mist for the chasms.
    if (t.pit === 'sky' || t.pit === 'chasm') {
      const texture = liquidTexture(theme); texture.repeat.set(8, 8);
      const deep = new THREE.Mesh(new THREE.PlaneGeometry(map.cols * 3, map.rows * 3), new THREE.MeshBasicMaterial({ map: texture, color: t.pit === 'sky' ? '#ffffff' : '#3a2e58', transparent: true, opacity: t.pit === 'sky' ? .9 : .6, fog: false }));
      deep.rotation.x = -Math.PI / 2; deep.position.set(map.cols / 2, t.pit === 'sky' ? -9 : -6, map.rows / 2); group.add(deep); this.liquid = texture;
    }
  }
  pitSpot(map, i) {
    const pits = []; for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.grid[row][col] === '~') pits.push({ x: col + .5, z: row + .5 });
    return pits[Math.floor(pits.length * (i + .5) / 6)] || { x: 0, z: 0 };
  }
  /** Hedge walls get round leafy bushes on top, like Spiral Knights' garden mazes. */
  buildHedges(map, group, t, top) {
    const cells = []; for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (isWall(map, col, row) && row > 0 && col > 0 && row < map.rows - 1 && col < map.cols - 1) cells.push([col, row]);
    const geometry = new THREE.SphereGeometry(.42, 12, 9), mat = new THREE.MeshStandardMaterial({ color: t.wallTop, roughness: .9 });
    const mesh = new THREE.InstancedMesh(geometry, mat, cells.length * 2); mesh.castShadow = true; mesh.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    cells.forEach(([col, row], i) => {
      for (let k = 0; k < 2; k++) {
        const s = .9 + hash(col * 2 + k, row) * .35;
        m.compose(new THREE.Vector3(col + .3 + k * .4, top(col, row) + .05, row + .35 + hash(col, row + k) * .3), q, new THREE.Vector3(s, s * .75, s));
        mesh.setMatrixAt(i * 2 + k, m); mesh.setColorAt(i * 2 + k, c.set(t.wallTop).offsetHSL(0, 0, (hash(col, row * 3 + k) - .5) * .08));
      }
    });
    group.add(mesh);
  }
  /** Floor lamps along the walls: a short post with a glowing cap. */
  buildLamps(map, group, t, cell, base) {
    const postGeo = new THREE.CylinderGeometry(.12, .16, .26, 8), capGeo = new THREE.SphereGeometry(.13, 12, 10);
    const postMat = new THREE.MeshStandardMaterial({ color: '#4a4a52', roughness: .6, metalness: .4 }), capMat = new THREE.MeshStandardMaterial({ color: t.lamp, emissive: t.lamp, emissiveIntensity: 2.2 });
    const glowMat = new THREE.SpriteMaterial({ map: this.glow, color: t.lamp, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending });
    let placed = 0;
    for (let row = 1; row < map.rows - 1; row++) for (let col = 1; col < map.cols - 1; col++) {
      if (cell(col, row) !== 'floor' || STAIRS[levelCell(map, col, row)]) continue;
      if (!(isWall(map, col, row - 1) && (col + row * 3) % 5 === 0)) continue;
      const y = base(col, row), post = new THREE.Mesh(postGeo, postMat); post.position.set(col + .5, y + .11, row + .14); post.castShadow = true;
      const cap = new THREE.Mesh(capGeo, capMat); cap.position.set(col + .5, y + .26, row + .14);
      const glow = new THREE.Sprite(glowMat); glow.scale.set(1.5, 1.5, 1.5); glow.position.copy(cap.position);
      group.add(post, cap, glow); placed++;
    }
    this.lampCount = placed;
  }
  /** Glass barriers along raised edges that drop to lower ground, with brass posts topped by balls. */
  buildRailings(map, group, t, cell, top) {
    const glass = new Builder(), posts = new Map(), H = .5;
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      if (cell(col, row) !== 'floor' || STAIRS[levelCell(map, col, row)]) continue;
      const h = top(col, row); if (!(h > 0)) continue;
      for (const [dx, dz] of SIDES) {
        const kind = cell(col + dx, row + dz), other = top(col + dx, row + dz);
        if (kind !== 'floor' || other === null || other >= h) continue;
        let a, b;
        if (dx === 1) { a = [col + 1, row]; b = [col + 1, row + 1]; } else if (dx === -1) { a = [col, row]; b = [col, row + 1]; }
        else if (dz === 1) { a = [col, row + 1]; b = [col + 1, row + 1]; } else { a = [col, row]; b = [col + 1, row]; }
        const inset = .04, ax = a[0] - dx * inset, az = a[1] - dz * inset, bx = b[0] - dx * inset, bz = b[1] - dz * inset;
        glass.quad([[ax, h + H, az], [ax, h, az], [bx, h, bz], [bx, h + H, bz]], [dx, 0, dz], [[0, 0], [0, 1], [1, 1], [1, 0]]);
        for (const [x, z] of [[ax, az], [bx, bz]]) posts.set(`${x.toFixed(2)},${z.toFixed(2)}`, [x, h, z]);
      }
    }
    if (glass.empty) return;
    const pane = new THREE.Mesh(glass.build(), new THREE.MeshStandardMaterial({ color: '#a8dcff', emissive: '#3a8cff', emissiveIntensity: .35, transparent: true, opacity: .28, roughness: .1, metalness: .2, side: THREE.DoubleSide, depthWrite: false }));
    group.add(pane);
    const list = [...posts.values()], postGeo = new THREE.CylinderGeometry(.05, .06, H + .08, 8), ballGeo = new THREE.SphereGeometry(.09, 12, 10), brass = new THREE.MeshStandardMaterial({ color: t.trim || '#d8b45a', roughness: .3, metalness: .8 });
    const postMesh = new THREE.InstancedMesh(postGeo, brass, list.length), ballMesh = new THREE.InstancedMesh(ballGeo, brass, list.length), m = new THREE.Matrix4();
    list.forEach(([x, h, z], i) => { postMesh.setMatrixAt(i, m.makeTranslation(x, h + (H + .08) / 2, z)); ballMesh.setMatrixAt(i, m.makeTranslation(x, h + H + .12, z)); });
    postMesh.castShadow = ballMesh.castShadow = true; group.add(postMesh, ballMesh);
  }
  /** Where a wall line ends, a stout pillar with a ball on top marks it. */
  buildPillars(map, group, t, cell, top) {
    const spots = [];
    for (let row = 1; row < map.rows - 1; row++) for (let col = 1; col < map.cols - 1; col++) {
      if (cell(col, row) !== 'wall') continue;
      const around = SIDES.filter(([dx, dz]) => cell(col + dx, row + dz) === 'wall').length;
      if (around <= 1) spots.push([col + .5, top(col, row), row + .5]);
    }
    if (!spots.length) return;
    const capGeo = new THREE.CylinderGeometry(.4, .44, .16, 16), ballGeo = new THREE.SphereGeometry(.2, 16, 12);
    const capMat = new THREE.MeshStandardMaterial({ color: t.wallTop, roughness: .6 }), ballMat = new THREE.MeshStandardMaterial({ color: t.hedge ? '#d8c890' : '#e6c27a', roughness: .3, metalness: .7 });
    const caps = new THREE.InstancedMesh(capGeo, capMat, spots.length), balls = new THREE.InstancedMesh(ballGeo, ballMat, spots.length), m = new THREE.Matrix4();
    spots.forEach(([x, y, z], i) => { caps.setMatrixAt(i, m.makeTranslation(x, y + .08, z)); balls.setMatrixAt(i, m.makeTranslation(x, y + .34, z)); });
    caps.castShadow = balls.castShadow = true; group.add(caps, balls);
  }
  /** Team banners hang on the walls around each base, facing the camera. */
  buildBanners(map, group, top) {
    map.spawns.forEach((spots, team) => {
      const cols = spots.map(p => Math.floor(p.x / TILE)), rows = spots.map(p => Math.floor(p.y / TILE));
      const c0 = Math.min(...cols), c1 = Math.max(...cols), r0 = Math.min(...rows);
      const texture = canvasTexture(128, (ctx, s) => {
        ctx.fillStyle = TEAM_COLORS[team].main; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(s - 8, 0); ctx.lineTo(s - 8, s * .82); ctx.lineTo(s / 2, s); ctx.lineTo(8, s * .82); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(s / 2, s * .42, s * .2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = TEAM_COLORS[team].main; ctx.beginPath(); ctx.moveTo(s / 2, s * .28); ctx.lineTo(s * .6, s * .5); ctx.lineTo(s * .4, s * .5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e6c27a'; ctx.fillRect(8, 0, s - 16, 8);
      }, { repeat: false });
      const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, roughness: .8, emissive: TEAM_COLORS[team].main, emissiveIntensity: .15 });
      // On the south face of the wall row above the base.
      for (let col = c0; col <= c1; col++) {
        if (!isWall(map, col, r0 - 1) || (col - c0) % 2) continue;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(.62, .9), material);
        banner.position.set(col + .5, top(col, r0 - 1) - .62, r0 + .02); group.add(banner);
      }
    });
  }
  /** Bases: three heart pads against the back wall of each spawn room. */
  buildBases(map, group) {
    this.pads = [];
    const padGeo = new THREE.BoxGeometry(.62, .1, .62), rimGeo = new THREE.TorusGeometry(.24, .04, 8, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: .4, metalness: .6 }), rimMat = new THREE.MeshStandardMaterial({ color: '#ffd36b', emissive: '#ffb020', emissiveIntensity: 1.4 });
    const heartGeo = this.heartGeometry(), heartMat = new THREE.MeshStandardMaterial({ color: '#ff3a5a', emissive: '#ff2040', emissiveIntensity: .6, roughness: .35 });
    map.spawns.forEach((spots, team) => {
      const xs = spots.map(p => p.x / TILE), zs = spots.map(p => p.y / TILE);
      const edge = team === 0 ? Math.min(...xs) : Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      for (let i = 0; i < 3; i++) {
        const z = lerp(z0, z1, i / 2), x = edge, y = levelCell(map, Math.floor(x), Math.floor(z)) === '1' ? STOREY : 0;
        const pad = new THREE.Mesh(padGeo, padMat); pad.position.set(x, y + .05, z); pad.receiveShadow = true; pad.castShadow = true;
        const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = -Math.PI / 2; rim.position.set(x, y + .11, z);
        const heart = new THREE.Mesh(heartGeo, heartMat); heart.position.set(x, y + .55, z); heart.castShadow = true;
        group.add(pad, rim, heart); this.pads.push(heart);
      }
      const light = new THREE.PointLight(TEAM_COLORS[team].main, 4, 7, 1.5); light.position.set(lerp(Math.min(...xs), Math.max(...xs), .5), 1.6, lerp(z0, z1, .5)); group.add(light);
    });
  }
  heartGeometry() {
    const shape = new THREE.Shape(), s = .16;
    shape.moveTo(0, -s * 1.1); shape.bezierCurveTo(-s * 2, -s * .1, -s * 1.2, s * 1.4, 0, s * .55); shape.bezierCurveTo(s * 1.2, s * 1.4, s * 2, -s * .1, 0, -s * 1.1);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 3 }); geometry.center();
    return geometry;
  }
  /** Control points: a round mechanical platform ringed with lamps, a floating crystal, and the capture ring. */
  buildPoints(map, group) {
    this.pointViews = map.points.map(point => {
      const x = point.x * U, z = point.y * U, radius = RULES.pointRadius * U, view = new THREE.Group(); view.position.set(x, 0, z);
      const court = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshStandardMaterial({ map: this.courtMap ||= courtTexture(), transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      court.rotation.x = -Math.PI / 2; court.position.y = .012; court.receiveShadow = true; view.add(court);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(radius * .5, radius * .56, .22, 40), new THREE.MeshStandardMaterial({ color: '#b08a5a', roughness: .4, metalness: .65 }));
      plate.position.y = .11; plate.receiveShadow = true; plate.castShadow = true;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius * .36, radius * .38, .1, 32), new THREE.MeshStandardMaterial({ color: '#5a6878', roughness: .35, metalness: .7 })); inner.position.y = .25; inner.receiveShadow = true;
      const studMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6 }), studs = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, stud = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .08, 12), studMat); stud.position.set(Math.cos(a) * radius * .46, .25, Math.sin(a) * radius * .46); studs.push(stud); view.add(stud); }
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, .5, 10), new THREE.MeshStandardMaterial({ color: '#8a7a5a', roughness: .4, metalness: .7 })); pedestal.position.y = .5; pedestal.castShadow = true;
      const crystalMat = new THREE.MeshStandardMaterial({ color: '#e8f4ff', emissive: '#a0c8ff', emissiveIntensity: .9, roughness: .15, metalness: .1 });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.32, 0), crystalMat); crystal.scale.set(1, 1.7, 1); crystal.position.y = 1.25; crystal.castShadow = true;
      const crystalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: '#a0c8ff', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending })); crystalGlow.scale.set(2.4, 2.4, 1); crystalGlow.position.y = 1.25;
      // The capture zone: a thin outline on the floor, and an arc that fills with the capturing team's colour.
      const zone = new THREE.Mesh(arcGeometry(radius + .02, radius + .1, 0, Math.PI * 2, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .35, depthWrite: false })); zone.position.y = .03;
      const fill = new THREE.Mesh(arcGeometry(radius + .02, radius + .22, 0, Math.PI * 2, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending })); fill.position.y = .04;
      const light = new THREE.PointLight('#a0c8ff', 5, 6, 1.4); light.position.y = 1.4;
      view.add(plate, inner, pedestal, crystal, crystalGlow, zone, fill, light); group.add(view);
      return { point, view, crystal, crystalMat, crystalGlow, fill, zone, light, studs, studMat, radius, progressShown: null };
    });
  }

  // ---------- knights ----------
  /** Knights are a rig of named parts (see docs/MODELS.md): hips > chest > head / arm_L > hand_L /
   * arm_R > hand_R, and hips > leg_L > foot_L / leg_R > foot_R. The body model (or the temporary one
   * built here) provides the parts; each gear piece adds meshes to parts by name; the weapon sits in
   * hand_R. The game animates the parts itself, so models need no skinning or animation clips. */
  makeKnight(player) {
    const group = new THREE.Group(), team = colour(TEAM_COLORS[player.team].main), body = new THREE.Group(); group.add(body);
    const { rig, parts } = this.knightRig(team);
    body.add(rig);
    // Gear: a model per piece adds its meshes to the parts it names. Without one, the piece shows as a
    // tinted shell over the skeleton's own parts, so every choice shows while models arrive one by one.
    for (const slot of ['helmet', 'armor', 'pants', 'shoes']) {
      const id = player[slot] || 'none', model = this.models.instance(`${slot}/${id}.glb`, team);
      if (model) this.attachGear(model, parts); else this.shellGear(slot, id, parts);
    }
    // Class pieces (the Guardian's big shield, the Recon's tiny shield) go on the left forearm.
    const classModel = this.models.instance(`class/${player.cls}.glb`, team);
    if (classModel) this.attachGear(classModel, parts); else this.classMarks(player, team, parts);
    // Team ring at the feet: bright, so allies and enemies read at a glance.
    const ringRadius = FEET_RING * KNIGHT_SCALE;
    const ring = new THREE.Mesh(arcGeometry(ringRadius - .07, ringRadius, 0, Math.PI * 2, 40), new THREE.MeshBasicMaterial({ color: team, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = .03; group.add(ring);
    const ringGlow = new THREE.Mesh(new THREE.CircleGeometry(ringRadius, 32), new THREE.MeshBasicMaterial({ color: team, transparent: true, opacity: .18, depthWrite: false, blending: THREE.AdditiveBlending }));
    ringGlow.rotation.x = -Math.PI / 2; ringGlow.position.y = .02; group.add(ringGlow);
    // Charge ring: a gold band round the feet that fills from the front while you hold attack and
    // pulses white when the charge is ready.
    const chargeRing = new THREE.Mesh(arcGeometry(ringRadius + .08, ringRadius + .3, 0, Math.PI * 2, CHARGE_SEGMENTS), new THREE.MeshBasicMaterial({ color: '#ffc94a', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    chargeRing.position.y = .04; chargeRing.visible = false; group.add(chargeRing);
    const chargeFloor = new THREE.Mesh(new THREE.CircleGeometry(ringRadius + .3, 40), new THREE.MeshBasicMaterial({ color: '#ffc94a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    chargeFloor.rotation.x = -Math.PI / 2; chargeFloor.position.y = .025; chargeFloor.visible = false; group.add(chargeFloor);
    rig.traverse(node => { if (node.isMesh) node.castShadow = true; });
    this.scene.add(group);
    // The weapon socket: the centre of the right fist, the weapon pointing +X.
    const hand = new THREE.Group(); hand.position.set(...GRIP); (parts.hand_R || rig).add(hand);
    const chargeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: '#ffd36b', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); chargeGlow.position.x = .5; hand.add(chargeGlow);
    // Arms pitch, then yaw (so a raised arm sweeps across a swing); the rest bend in their own plane.
    for (const name of ['arm_L', 'arm_R']) if (parts[name]) parts[name].rotation.order = 'YZX';
    const boostTrail = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: '#ffd36b', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); boostTrail.scale.set(2, 1, 1); boostTrail.position.set(-.6, .5, 0); group.add(boostTrail);
    const view = { group, body, parts, hand, chargeGlow, chargeRing, chargeFloor, boostTrail, ring, weaponId: null, weapon: null, lastX: player.x, lastY: player.y, key: this.knightKey(player), materials: [], pose: {}, gait: { phase: 0, speed: 0, run: 0 } };
    group.traverse(node => { if (node.material) view.materials.push(node.material); });
    return view;
  }
  knightKey(player) { return [player.team, player.cls, player.armor, player.helmet, player.pants, player.shoes, this.models.version].join('|'); }
  /** Gear model: each top-level node named after a rig part moves onto that part, keeping its offset. */
  attachGear(model, parts) {
    for (const child of [...model.children]) {
      const part = parts[child.name.replace(/\.\d+$/, '')];
      child.userData.gear = true;
      if (part) part.add(child); else console.warn(`gear node "${child.name}" names no rig part`);
    }
  }
  /** Gear with no model yet, on a body model: a tinted, slightly larger copy of the body's own shapes on
   * the parts that piece covers, so every choice still shows while models arrive one by one. */
  shellGear(slot, id, parts) {
    if (id === 'none') return; // the body model already wears the T-shirt, shorts and shoes (and a bare head)
    const material = new THREE.MeshStandardMaterial({ color: this.armorColour(id), roughness: .35, metalness: .6 });
    for (const name of GEAR_PARTS[slot]) {
      const part = parts[name]; if (!part) continue;
      for (const child of [...part.children]) {
        if (RIG_PARTS.includes(child.name.replace(/\.\d+$/, '')) || child.userData.gear) continue;
        const shell = child.clone(); shell.userData.gear = true;
        shell.traverse(node => { if (node.isMesh) node.material = material; });
        shell.scale.multiplyScalar(slot === 'helmet' ? 1.14 : 1.1); part.add(shell);
      }
    }
  }
  /** The body: its model, or the core skeleton built from public/lockdown-skeleton.js (the same shapes). */
  knightRig(team) {
    const model = this.models.instance('knight/body.glb', team);
    if (model) return { rig: model, parts: Object.fromEntries(RIG_PARTS.map(name => [name, model.getObjectByName(name) || null])) };
    this.skeletonMaterials ||= new Map();
    const shapes = skeletonParts(), parts = {};
    const materialFor = spec => {
      const key = spec.name === 'team_stripe' ? `${spec.name}:${team.getHexString()}` : spec.name;
      if (!this.skeletonMaterials.has(key)) {
        const material = new THREE.MeshStandardMaterial({ name: spec.name, metalness: spec.metal, roughness: spec.rough });
        material.color.setRGB(...spec.color); if (spec.emissive) { material.emissive.setRGB(...spec.emissive); material.emissiveIntensity = 1.2; }
        if (spec.name === 'team_stripe') material.color.copy(team);
        this.skeletonMaterials.set(key, material);
      }
      return this.skeletonMaterials.get(key).clone();
    };
    const build = ([name, [x, y, z], children]) => {
      const node = new THREE.Group(); node.name = name; node.position.set(x, y, z); parts[name] = node;
      for (const { positions, normals, indices, material } of shapes[name]?.parts || []) {
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(indices);
        node.add(new THREE.Mesh(geometry, materialFor(material)));
      }
      for (const child of children) node.add(build(child));
      return node;
    };
    return { rig: build(RIG), parts };
  }
  /** Class marks without a model: the Guardian's big round shield and the Recon's tiny cloaking shield, on
   * the left forearm (SHIELDS in lockdown-skeleton.js). The Striker's mark is its neon trail. */
  classMarks(player, team, parts) {
    const arm = parts.forearm_L; if (!arm) return;
    if (player.cls === 'guardian') {
      const { radius, at } = SHIELDS.guardian, gold = new THREE.MeshStandardMaterial({ color: '#d8b45a', metalness: .5, roughness: .3 });
      const shield = new THREE.Group(); shield.position.set(...at); shield.userData.gear = true; arm.add(shield);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .04, 32), new THREE.MeshStandardMaterial({ color: '#4a5a9e', metalness: .3, roughness: .4 })); plate.rotation.x = Math.PI / 2; shield.add(plate);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(radius, .03, 8, 36), gold); shield.add(edge);
      const band = new THREE.Mesh(new THREE.TorusGeometry(radius * .85, .014, 6, 36), new THREE.MeshStandardMaterial({ color: team, emissive: team, emissiveIntensity: .3 })); band.position.z = -.025; shield.add(band);
      const boss = new THREE.Mesh(new THREE.ConeGeometry(.07, .14, 12), gold); boss.rotation.x = -Math.PI / 2; boss.position.z = -.09; shield.add(boss);
    }
    if (player.cls === 'recon') {
      const { radius, at } = SHIELDS.recon;
      const buckler = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .03, 18), new THREE.MeshStandardMaterial({ color: '#8a929e', metalness: .5, roughness: .3 })); buckler.rotation.x = Math.PI / 2; buckler.position.set(...at); buckler.userData.gear = true; arm.add(buckler);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(.04, 12, 8), new THREE.MeshStandardMaterial({ color: '#c9a2ff', emissive: '#a070ff', emissiveIntensity: 1.6 })); lens.position.y = -.025; lens.scale.y = .5; lens.userData.cloakLens = true; buckler.add(lens);
    }
  }
  armorColour(id) {
    if (!id || id === 'none') return '#9fb0c2'; // the core skeleton's pale piston limbs
    const palette = ['#9aa4b2', '#c08a4a', '#5a6270', '#a8483e', '#4e7a52', '#e4dcc8', '#6e5a8e', '#3e6e8a', '#b49a5a', '#7a3e5a'];
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return palette[Math.abs(h) % palette.length];
  }
  /** A weapon in hand: its model (grip at the origin, pointing +X) or a temporary one. */
  makeWeapon(id) {
    const model = id && this.models.instance(`weapons/${id}.glb`);
    if (model) { model.traverse(node => { if (node.isMesh) node.castShadow = true; }); return model; }
    // The temporary weapons are drawn small and scaled up to their catalogue sizes.
    const group = this.temporaryWeapon(id); group.scale.setScalar(KNIGHT_SCALE);
    return group;
  }
  temporaryWeapon(id) {
    const weapon = WEAPONS[id], group = new THREE.Group();
    if (!weapon) return group;
    const glow = weapon.element ? colour(ELEMENT[weapon.element] || '#ffffff') : null;
    const metal = new THREE.MeshStandardMaterial({ color: '#d8dde6', roughness: .25, metalness: .85, emissive: glow || '#000000', emissiveIntensity: glow ? .55 : 0 });
    const brass = new THREE.MeshStandardMaterial({ color: '#b8893a', roughness: .35, metalness: .8 }), grip = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: .8 });
    if (weapon.family === 'blade') {
      // Sized to the catalogue (sword ≈ 0.75, heavy ≈ 0.95, long ≈ 0.9 from grip to tip), before KNIGHT_SCALE.
      const heavy = !!weapon.heavy, length = id === 'maul' ? .42 : heavy ? .47 : ['rapier', 'leviathan'].includes(id) ? .43 : ['spur', 'voltedge'].includes(id) ? .22 : .33, width = id === 'rapier' ? .03 : heavy ? .13 : .085;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .18, 6), grip); handle.rotation.z = Math.PI / 2; handle.position.x = .02;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(.04, .035, .17), brass); guard.position.x = .12;
      if (id === 'maul') { const head = new THREE.Mesh(new THREE.BoxGeometry(.24, .24, .34), new THREE.MeshStandardMaterial({ color: '#7a7066', roughness: .5, metalness: .5 })); head.position.x = .12 + length; const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, length, 6), grip); shaft.rotation.z = Math.PI / 2; shaft.position.x = .12 + length / 2; group.add(handle, shaft, head); }
      else { const blade = new THREE.Mesh(new THREE.BoxGeometry(length, .03, width), metal); blade.position.x = .14 + length / 2; const tip = new THREE.Mesh(new THREE.ConeGeometry(width / 2, .1, 4), metal); tip.rotation.z = -Math.PI / 2; tip.position.x = .14 + length + .05; tip.scale.z = .3; group.add(handle, guard, blade, tip); }
    } else if (weapon.family === 'gun') {
      const long = id === 'rifle' ? .6 : ['magnus', 'grimcannon', 'scatter'].includes(id) ? .36 : .3, wide = id === 'scatter' ? .07 : .045;
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(.24, .13, .12), brass); bodyMesh.position.x = .08;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(wide, wide + .01, long, 10), new THREE.MeshStandardMaterial({ color: '#5a6070', roughness: .3, metalness: .8 })); barrel.rotation.z = Math.PI / 2; barrel.position.x = .18 + long / 2;
      const core = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), new THREE.MeshStandardMaterial({ color: glow || '#7fd0ff', emissive: glow || '#7fd0ff', emissiveIntensity: 2 })); core.position.set(.08, .07, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .07), grip); handle.position.set(0, -.08, 0); handle.rotation.z = .3;
      group.add(bodyMesh, barrel, core, handle);
    } else if (weapon.family === 'bomb') {
      const big = id === 'nitro' ? 1.4 : 1;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.13 * big, 14, 10), new THREE.MeshStandardMaterial({ color: '#3a3e48', roughness: .4, metalness: .6 })); ball.position.x = .12;
      const band = new THREE.Mesh(new THREE.TorusGeometry(.13 * big, .02, 6, 18), new THREE.MeshStandardMaterial({ color: glow || '#ffb347', emissive: glow || '#ffb347', emissiveIntensity: 1.5 })); band.position.x = .12; band.rotation.y = Math.PI / 2;
      group.add(ball, band);
    }
    group.traverse(node => { if (node.isMesh) node.castShadow = true; });
    return group;
  }
  /** Procedural animation on the skeleton's joints (rotations about Z swing a limb forward, about X out to the
   * side, about Y turn it). A gait from how far the knight really moved: walking blends into running, thighs
   * swing, knees bend on the forward swing, feet stay flat then push off, the body bobs, sways and leans, the
   * chest counter-twists and the arms swing against the legs. Standing still breathes and shifts weight with
   * the weapon held loosely. Actions take over: sword swings run through shoulder, elbow and wrist with the
   * torso, lunges, slams, spins, charges, aiming, guarding, dodges, stuns and a recoil when hit. Every joint
   * eases toward its target, so nothing snaps. Returns the direction the knight faces. */
  animateKnight(view, player, weapon, now) {
    const parts = view.parts, gait = view.gait, T = {};
    const dt = Math.min(.05, Math.max(.001, (now - (view.lastNow ?? now - 16)) / 1000)); view.lastNow = now;
    const ease = t => t * t * (3 - 2 * t), easeOut = t => 1 - (1 - t) ** 3;
    const action = player.action || 'idle', family = weapon?.family || 'none';
    let facing = player.aim;
    if (['swing', 'lunge', 'lungeBurst', 'slam'].includes(action)) facing = player.swingAim ?? facing;
    // ---- gait ----
    const dx = (player.x - view.lastX) * U, dz = (player.y - view.lastY) * U; view.lastX = player.x; view.lastY = player.y;
    const step = Math.hypot(dx, dz) < .6 ? Math.hypot(dx, dz) : 0; // a respawn is a jump, not a step
    gait.speed = lerp(gait.speed, step / dt, 1 - Math.exp(-dt * 10));
    const ahead = step > 1e-5 ? (dx * Math.cos(facing) + dz * Math.sin(facing)) / step : 1, backwards = ahead < -.3;
    const m = Math.min(1, gait.speed / .7);
    gait.run = lerp(gait.run, Math.min(1, Math.max(0, (gait.speed - 1.4) / 2.2)), 1 - Math.exp(-dt * 6));
    const r = gait.run, ph = (gait.phase += step / lerp(.8, 1.5, r) * Math.PI * 2 * (backwards ? -1 : 1));
    const hipAmp = lerp(.42, .75, r) * m, kneeAmp = lerp(.6, 1.35, r) * m;
    for (const [side, offset] of [['L', 0], ['R', Math.PI]]) {
      const a = ph + offset, thigh = hipAmp * Math.sin(a);
      const knee = -(lerp(.05, .14, r) * m + kneeAmp * Math.max(0, Math.sin(a + 1.05)) ** 1.6);
      const toeOff = -lerp(.35, .7, r) * m * Math.max(0, -Math.sin(a)) * Math.max(0, Math.cos(a)) * 2;
      const heel = .2 * m * Math.max(0, Math.sin(a)) * Math.max(0, -Math.cos(a)) * 2;
      T[`leg_${side}`] = [0, 0, thigh]; T[`shin_${side}`] = [0, 0, knee]; T[`foot_${side}`] = [0, 0, -(thigh + knee) * .85 + toeOff + heel];
    }
    const armSwing = lerp(.35, .85, r) * m, breath = Math.sin(now / 650), idle = 1 - m;
    const body = { y: m * (lerp(.012, .04, r) * Math.abs(Math.cos(ph)) - .02 * r) + idle * .006 * breath, x: m * lerp(.035, .05, r) * Math.sin(ph), z: -(lerp(.05, .2, r) * m + (player.boosting ? .14 : 0)) * (backwards ? -.6 : 1) };
    const sway = idle * .025 * Math.sin(now / 1900), hipTwist = -.08 * m * Math.sin(ph);
    T.hips = [sway, hipTwist, 0];
    T.leg_L[0] -= sway; T.leg_R[0] -= sway;
    T.chest = [0, .14 * m * Math.sin(ph) - hipTwist, idle * .025 * breath];
    T.head = [.03 * m * Math.sin(ph * 2), idle * .12 * Math.sin(now / 2300), -body.z * .5 + .02 * m * Math.sin(ph * 2)];
    T.arm_L = [.07, 0, -armSwing * Math.sin(ph) + .05 + idle * .02 * breath]; T.forearm_L = [0, 0, lerp(.25, 1.3, r) * m * (.75 + .25 * Math.sin(ph)) + .18]; T.hand_L = [0, 0, -.1];
    // ---- the weapon arm, by weapon ----
    // Recoil: a sharp kick on each shot that springs back with a slight overshoot, scaled by how hard the gun hits.
    const sinceShot = now - (view.recoilAt || -1e9), recoil = sinceShot < 400 ? (view.recoilPower || .6) * (Math.exp(-sinceShot / 70) - .18 * Math.sin(Math.min(Math.PI, sinceShot / 70)) * Math.exp(-sinceShot / 160)) : 0;
    const reloading = family === 'gun' && player.reloadTicks?.[weapon.id] > 0;
    const aiming = family === 'gun' && !reloading && (player.fireCooldown > 0 || player.charging || sinceShot < 900);
    let arm = [-.07, 0, .1 + armSwing * .5 * Math.sin(ph)], elbow = .45 + .5 * r * m, pitch = -.5 + .04 * Math.sin(now / 900) * idle;
    let twist = 0, snap = false;
    if (family === 'gun') {
      // Pistols are held out one-handed; cannons and the scattergun two-handed and braced; the rifle is shouldered.
      const grip = weapon.id === 'rifle' ? 'rifle' : ['magnus', 'grimcannon', 'scatter'].includes(weapon.id) ? 'cannon' : 'pistol';
      if (reloading) {
        // Tip the gun up, slap a fresh charge in with the off hand half way through, snap back.
        const p = 1 - player.reloadTicks[weapon.id] / Math.max(1, weapon.reload), slap = Math.exp(-(((p - .55) / .08) ** 2));
        arm = [-.05, .35, .75]; elbow = 1.15; pitch = .7 - .25 * slap;
        T.arm_L = [-.45, 0, .85 + .25 * slap]; T.forearm_L = [0, 0, 1.05 - .3 * slap]; T.hand_L = [0, 0, -.3];
        T.head[0] -= .1; T.head[2] -= .18; twist -= .15;
      } else if (aiming) {
        if (grip === 'rifle') { arm = [-.05, .3, .95]; elbow = 1.05; pitch = 0; T.arm_L = [-.5, 0, 1.35]; T.forearm_L = [0, 0, .35]; T.head[0] -= .12; T.head[2] -= .08; twist -= .18; }
        else if (grip === 'cannon') { arm = [-.05, .1, 1.25]; elbow = .35; pitch = 0; T.arm_L = [-.45, 0, 1.2]; T.forearm_L = [0, 0, .7]; T.leg_L[2] += .2; T.leg_R[2] -= .15; T.shin_L[2] -= .15; T.shin_R[2] -= .2; }
        else { arm = [-.05, 0, 1.5]; elbow = .06; pitch = 0; T.arm_L = [.18, 0, .25]; T.forearm_L = [0, 0, .7]; twist += .12; }
        // The kick: the muzzle climbs, the elbow gives, the shoulder rocks back and the body leans away.
        arm[2] += .4 * recoil; elbow += (grip === 'pistol' ? .7 : .4) * recoil; pitch += .55 * recoil;
        twist -= (grip === 'rifle' ? .25 : .14) * recoil; body.z += (grip === 'pistol' ? .08 : .14) * recoil; T.head[0] += .08 * recoil;
        if (grip !== 'pistol') { T.forearm_L[2] += .3 * recoil; T.arm_L[2] += .2 * recoil; }
        if (Math.abs(recoil) > .03) snap = true; // a kick is instant; easing would swallow it
      } else { arm = [-.05, 0, .55 + armSwing * .15 * Math.sin(ph)]; elbow = 1; pitch = -.12; }
    } else if (family === 'bomb') { arm = [-.06, 0, .35 + armSwing * .4 * Math.sin(ph)]; elbow = .75; pitch = -.2; }
    else if (family === 'none') { arm = [-.07, 0, armSwing * Math.sin(ph) + .05]; elbow = .2 + .9 * r * m; pitch = -1.2; }
    const total = player.actionTotal || 1, elapsed = total - (player.actionTicks || 0);
    if (action === 'swing') {
      // Wind up across the body, cut through the arc with the elbow snapping straight, follow through, settle.
      const startup = player.swingStartup || 1, active = player.swingActive || 1, dir = player.swingDir || 1, arc = player.swingArc || 1.6;
      const from = -dir * arc / 2 * 1.15, to = dir * arc / 2 * 1.1;
      let yaw;
      if (elapsed < startup) { const w = easeOut(elapsed / startup); yaw = from * w; arm = [-.05, 0, lerp(.5, 1.35, w)]; elbow = lerp(.5, 1.05, w); pitch = lerp(-.2, .25, w); }
      else if (elapsed < startup + active) { const p = easeOut((elapsed - startup) / active); yaw = lerp(from, to, p); arm = [-.05, 0, 1.45 - .12 * Math.sin(p * Math.PI)]; elbow = lerp(1.05, .08, Math.min(1, p * 1.6)); pitch = lerp(.25, -.05, p); body.z -= .12; }
      else { const q = ease(Math.min(1, (elapsed - startup - active) / Math.max(1, total - startup - active))); yaw = lerp(to, 0, q); arm = [-.05, 0, lerp(1.45, .5, q)]; elbow = lerp(.08, .45, q); pitch = lerp(-.05, -.5, q); }
      twist = -yaw * .3; arm[1] = -yaw * .7; snap = true;
      T.leg_L[2] += .25; T.leg_R[2] -= .2; T.shin_L[2] -= .2; T.shin_R[2] -= .25;
      T.arm_L = [.25, 0, .5]; T.forearm_L = [0, 0, .6];
    } else if (action === 'lunge' || action === 'lungeBurst') {
      arm = [-.05, 0, 1.5]; elbow = .05; pitch = 0; body.z -= .32; snap = true;
      T.leg_L = [0, 0, .75]; T.shin_L = [0, 0, -.25]; T.foot_L = [0, 0, -.5]; T.leg_R = [0, 0, -.55]; T.shin_R = [0, 0, -.5]; T.foot_R = [0, 0, .5];
      T.arm_L = [.2, 0, -.6]; T.forearm_L = [0, 0, .4];
    } else if (action === 'spin') {
      twist = (now / 55) % (Math.PI * 2); arm = [-.05, 0, 1.45]; elbow = .1; pitch = 0; snap = true;
      for (const side of ['L', 'R']) { T[`leg_${side}`][2] += .25; T[`shin_${side}`] = [0, 0, -.5]; }
    } else if (action === 'slam') {
      const rising = player.actionTicks > total - (player.chargeMoveTicks || 0);
      if (rising) { arm = [0, 0, 2.9]; elbow = .4; pitch = 1.2; body.z += .1; T.arm_L = [-.2, 0, 2.6]; T.forearm_L = [0, 0, .5]; }
      else { arm = [0, 0, .7]; elbow = .1; pitch = -.55; body.z -= .35; body.y -= .08; T.arm_L = [-.2, 0, .7]; T.forearm_L = [0, 0, .2]; for (const side of ['L', 'R']) { T[`leg_${side}`] = [0, 0, .45]; T[`shin_${side}`] = [0, 0, -.8]; T[`foot_${side}`] = [0, 0, .35]; } }
      snap = true;
    } else if (action === 'cast') {
      arm = [-.05, 0, .3]; elbow = .5; pitch = -1; body.z -= .2; body.y -= .05;
      for (const side of ['L', 'R']) { T[`leg_${side}`][2] += .3; T[`shin_${side}`] = [0, 0, -.55]; T[`foot_${side}`] = [0, 0, .25]; }
    } else if (player.charging) {
      const tremble = Math.sin(now / 35) * .03 * (player.chargeTicks >= chargeTicksFor(player, weapon) ? 1 : .4);
      if (family === 'bomb') { arm = [-.2, 0, 2.6 + tremble]; elbow = .55; pitch = 1.2; }
      else if (family === 'blade') { arm = [-.1, .7, 1.15 + tremble]; elbow = 1.15; pitch = .45; twist = -.3; T.leg_L[2] += .3; T.leg_R[2] -= .25; T.shin_L[2] -= .25; T.shin_R[2] -= .25; }
      else if (family === 'gun') arm[2] += tremble;
    }
    if (player.guarding) { T.arm_L = [-.3, 0, 1.35]; T.forearm_L = [0, 0, .55]; twist -= .2; body.z += .06; }
    if (player.dodgeTicks > 0) { body.z -= .4; body.y -= .06; T.leg_L = [0, 0, .5]; T.leg_R = [0, 0, -.3]; T.shin_L = [0, 0, -.9]; T.shin_R = [0, 0, -.9]; T.arm_L = [.2, 0, -.5]; if (!snap) arm[2] -= .3; }
    if (player.stunTicks > 0) { T.head[2] += .3 * Math.sin(now / 80); T.head[0] += .2 * Math.sin(now / 110); body.x += .08 * Math.sin(now / 150); T.arm_L = [.1, 0, 0]; }
    const flash = this.flashes?.get(player.id), hurt = flash ? Math.max(0, 1 - (now - flash) / 180) : 0;
    if (hurt) { body.z += .22 * hurt; T.head[0] -= .15 * hurt; }
    T.chest[1] += twist; T.arm_R = arm; T.forearm_R = [0, 0, elbow]; T.hand_R = [0, 0, pitch - arm[2] - elbow];
    // ---- apply, easing every joint toward its target (frozen knights and hit-stop hold the pose) ----
    if (player.status?.freeze > 0 || player.hitStop > 0) return facing;
    const k = 1 - Math.exp(-dt * 16), pose = view.pose;
    for (const [name, target] of Object.entries(T)) {
      const part = parts[name]; if (!part) continue;
      const fast = snap && ['arm_R', 'forearm_R', 'hand_R', 'chest'].includes(name) ? 1 : k, now3 = pose[name] || (pose[name] = [0, 0, 0]);
      for (let i = 0; i < 3; i++) now3[i] = lerp(now3[i], target[i], fast);
      part.rotation.set(now3[0], now3[1], now3[2]);
    }
    const b = pose.body || (pose.body = { y: 0, x: 0, z: 0 });
    for (const key of ['y', 'x', 'z']) b[key] = lerp(b[key], body[key], k);
    view.body.position.y = b.y; view.body.rotation.x = b.x; view.body.rotation.z = b.z;
    // Gun barrels kick back when they fire.
    const barrel = view.weapon?.getObjectByName?.('barrel');
    if (barrel) { barrel.userData.x0 ??= barrel.position.x; barrel.position.x = barrel.userData.x0 - .06 * Math.max(0, recoil); }
    const fuse = view.weapon?.getObjectByName?.('fuse');
    if (fuse) fuse.traverse(node => { if (node.material?.emissive) node.material.emissiveIntensity = player.charging ? 1.5 + Math.sin(now / 30) : .6; });
    return facing;
  }
  updateKnight(view, player, map, now, viewer) {
    const x = player.x * U, z = player.y * U, ground = levelAt(map, player.x, player.y) * STOREY, parts = view.parts;
    view.group.position.set(x, ground, z);
    // Weapon in hand follows the selected slot.
    const weaponId = player.weapons?.[player.slot] || null;
    if (weaponId !== view.weaponId) { if (view.weapon) view.hand.remove(view.weapon); view.weaponId = weaponId; view.weapon = this.makeWeapon(weaponId); view.hand.add(view.weapon); view.weapon.traverse(node => { if (node.material) view.materials.push(node.material); }); }
    const weapon = WEAPONS[weaponId], facing = this.animateKnight(view, player, weapon, now);
    const chargeLevel = player.charging && weapon ? Math.min(1, player.chargeTicks / Math.max(1, chargeTicksFor(player, weapon))) : 0;
    // A charge glows on the weapon and burns gold when it is ready; Boost leaves a streak.
    view.chargeGlow.material.opacity = chargeLevel * (chargeLevel >= 1 ? .9 + .1 * Math.sin(now / 50) : .5);
    view.chargeRing.visible = view.chargeFloor.visible = chargeLevel > 0;
    if (chargeLevel > 0) {
      view.chargeFloor.material.opacity = chargeLevel >= 1 ? .4 + .12 * Math.sin(now / 45) : chargeLevel * .22;
      view.chargeRing.geometry.setDrawRange(0, Math.ceil(chargeLevel * CHARGE_SEGMENTS) * 6);
      const ready = chargeLevel >= 1, pulse = ready ? 1 + .1 * Math.sin(now / 45) : 1;
      view.chargeRing.material.color.set(ready ? '#fff4c8' : '#ffc94a');
      view.chargeRing.scale.setScalar(pulse);
    }
    view.chargeGlow.scale.setScalar((.5 + chargeLevel * .8) * KNIGHT_SCALE);
    view.boostTrail.material.opacity = player.boosting ? .55 + .2 * Math.sin(now / 40) : 0;
    // The Recon's tiny shield is the cloaking device: its lens flares while cloaked.
    if (player.cls === 'recon') {
      if (view.lens === undefined) { view.lens = null; view.group.traverse(node => { if (node.userData.cloakLens || /lens/i.test(node.material?.name || '') && node.material.emissive) view.lens ??= node; }); }
      if (view.lens) view.lens.material.emissiveIntensity = player.cloakTicks > 0 ? 4 + Math.sin(now / 60) : 1.6;
    }
    view.group.rotation.y = -facing;
    // Cloak, spawn shield and hit flash.
    const cloaked = player.cloakTicks > 0, alpha = cloaked ? .3 : 1;
    for (const material of view.materials) { if (material.blending === THREE.AdditiveBlending) continue; if (material.transparent !== (alpha < 1)) { material.transparent = alpha < 1; material.needsUpdate = true; } material.opacity = alpha; }
    const flash = this.flashes?.get(player.id), hit = flash && now - flash < 110;
    if (hit !== view.hit) { view.hit = hit; view.body.traverse(node => { if (node.isMesh && node.material.emissive) { if (hit) { node.material.userData.saved ??= [node.material.emissive.clone(), node.material.emissiveIntensity]; node.material.emissive.set('#ffffff'); node.material.emissiveIntensity = .9; } else if (node.material.userData.saved) { node.material.emissive.copy(node.material.userData.saved[0]); node.material.emissiveIntensity = node.material.userData.saved[1]; } } }); }
    view.ring.material.opacity = player.id === viewer ? 1 : .8;
    view.group.visible = true;
  }

  // ---------- frame ----------
  render(state, { localId = null, now = performance.now(), focus = null, pointer = null } = {}) {
    const map = MAPS[state.mapId]; if (!map) return;
    this.buildMap(map);
    this.localId = localId;
    const local = state.players[localId ?? -1];
    this.viewer = local?.alive ? local : null;
    this.consumeEvents(state, now);
    // Camera: a steep ¾ perspective behind and above the knight, easing after them.
    const goal = focus ? { x: focus.x, y: focus.y } : local ? { x: local.x, y: local.y } : { x: map.width / 2, y: map.height / 2 };
    const goalHeight = local && !focus ? levelAt(map, local.x, local.y) * STOREY : 0;
    const wanted = new THREE.Vector3(goal.x * U, goalHeight, goal.y * U);
    if (!this.cameraReady) { this.target.copy(wanted); this.cameraReady = true; } else this.target.lerp(wanted, .14);
    const shakeX = this.shake ? (Math.random() - .5) * this.shake * .02 : 0, shakeZ = this.shake ? (Math.random() - .5) * this.shake * .02 : 0;
    this.shake = this.shake > .2 ? this.shake * .86 : 0;
    this.camera3.position.set(this.target.x + shakeX, this.target.y + 12.6, this.target.z + 11.2 + shakeZ);
    this.camera3.lookAt(this.target.x + shakeX, this.target.y, this.target.z + shakeZ);
    // The sun's shadow box follows the camera target.
    this.sun.position.set(this.target.x - 7, this.target.y + 16, this.target.z - 4); this.sun.target.position.copy(this.target);
    if (this.liquid) { this.liquid.offset.x = (now / 9000) % 1; this.liquid.offset.y = (now / 13000) % 1; }
    for (const heart of this.pads || []) { heart.rotation.y = now / 700; heart.position.y += (Math.sin(now / 300) * .002); }
    this.updatePoints(state, now);
    this.updateKnights(state, map, now, local);
    this.updateShots(state, map);
    this.updateBombs(state, map, now);
    this.updatePickups(state, map, now);
    this.updateClouds(state, map, now);
    this.updateEffects(now);
    if (this.composer) this.composer.render(); else this.gl.render(this.scene, this.camera3);
    this.drawOverlay(state, map, now, local, pointer);
  }
  updatePoints(state, now) {
    for (const view of this.pointViews || []) {
      const point = state.points.find(p => p.id === view.point.id) || view.point, owner = point.owner ?? null, progress = (point.progress || 0) / 100;
      const ownColour = owner === null ? colour('#c8d8ff') : colour(TEAM_COLORS[owner].main);
      view.crystalMat.emissive.copy(ownColour); view.crystalMat.color.copy(ownColour).lerp(colour('#ffffff'), .5);
      view.crystalGlow.material.color.copy(ownColour); view.light.color.copy(ownColour);
      view.crystal.rotation.y = now / 900; view.crystal.position.y = 1.25 + Math.sin(now / 500) * .07;
      view.studMat.emissive.copy(ownColour).lerp(colour('#ffffff'), .4);
      // The fill arc shows the capture in progress, in the colour of the team it leans toward.
      const amount = Math.abs(progress), toward = progress >= 0 ? 0 : 1;
      if (view.progressShown !== Math.round(amount * 64)) {
        view.progressShown = Math.round(amount * 64); view.fill.geometry.dispose();
        view.fill.geometry = arcGeometry(view.radius + .02, view.radius + .22, -Math.PI / 2, -Math.PI / 2 + Math.max(.001, amount) * Math.PI * 2, 64);
      }
      view.fill.material.color.set(TEAM_COLORS[toward].main); view.fill.visible = amount > .005;
      const contested = point.counts && point.counts[0] > 0 && point.counts[1] > 0;
      view.zone.material.opacity = contested ? .45 + .3 * Math.sin(now / 90) : .35;
    }
  }
  updateKnights(state, map, now, local) {
    const viewerTeam = local?.team ?? null, seen = new Set();
    for (const player of state.players) {
      const hiddenEnemy = player.cloakTicks > 0 && viewerTeam !== null && player.team !== viewerTeam && !(local?.alive && Math.hypot(local.x - player.x, local.y - player.y) < ABILITIES.cloak.revealRange);
      if (!player.alive || hiddenEnemy) continue;
      seen.add(player.id);
      let view = this.knights.get(player.id);
      if (view && view.key !== this.knightKey(player)) { this.scene.remove(view.group); view = null; }
      if (!view) { view = this.makeKnight(player); this.knights.set(player.id, view); }
      this.updateKnight(view, player, map, now, this.localId);
      this.updateGuard(view, player, now);
      this.updateTrail(player, map, now);
    }
    for (const [id, view] of this.knights) if (!seen.has(id)) view.group.visible = false;
    for (const [id, trail] of this.trails || []) if (!seen.has(id)) { trail.line.visible = false; trail.points.length = 0; }
  }
  /** The Striker's mark: a thin neon line in team colour trailing behind the knight as it moves,
   * longer while Boost is held. */
  updateTrail(player, map, now) {
    this.trails ||= new Map();
    let trail = this.trails.get(player.id);
    if (player.cls !== 'striker') { if (trail) { trail.line.visible = false; trail.points.length = 0; } return; }
    if (!trail) {
      // A flat ribbon, two vertices per sample, glowing (colours above 1 bloom).
      const geometry = new THREE.BufferGeometry(), index = [];
      for (let i = 0; i < TRAIL_POINTS - 1; i++) { const k = i * 2; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_POINTS * 6), 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_POINTS * 6), 3));
      geometry.setIndex(index);
      const line = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      line.frustumCulled = false; this.scene.add(line);
      trail = { line, points: [] }; this.trails.set(player.id, trail);
    }
    const x = player.x * U, z = player.y * U, y = levelAt(map, player.x, player.y) * STOREY + KNIGHT * .3, last = trail.points.at(-1);
    if (!last || Math.hypot(last.x - x, last.z - z) > .03) trail.points.push({ x, y, z, t: now });
    const life = player.boosting ? 700 : 380;
    trail.points = trail.points.filter(point => now - point.t < life).slice(-(TRAIL_POINTS - 1));
    const points = [...trail.points, { x, y, z, t: now }], tint = colour(TEAM_COLORS[player.team].main);
    const position = trail.line.geometry.attributes.position, color = trail.line.geometry.attributes.color, width = player.boosting ? .09 : .055;
    points.forEach((point, i) => {
      const next = points[Math.min(points.length - 1, i + 1)], prev = points[Math.max(0, i - 1)];
      let dx = next.x - prev.x, dz = next.z - prev.z; const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
      const fade = Math.max(0, 1 - (now - point.t) / life), w = width * (.3 + .7 * fade), glow = fade * (player.boosting ? 1.8 : 1.3);
      position.setXYZ(i * 2, point.x - dz * w, point.y, point.z + dx * w); position.setXYZ(i * 2 + 1, point.x + dz * w, point.y, point.z - dx * w);
      color.setXYZ(i * 2, tint.r * glow, tint.g * glow, tint.b * glow); color.setXYZ(i * 2 + 1, tint.r * glow, tint.g * glow, tint.b * glow);
    });
    position.needsUpdate = color.needsUpdate = true;
    trail.line.geometry.setDrawRange(0, Math.max(0, points.length - 1) * 6);
    trail.line.visible = points.length > 2;
  }
  updateGuard(view, player, now) {
    const up = player.guarding && player.guardRaise >= GUARD.raiseTicks;
    if (up && !view.bubble) {
      view.bubble = new THREE.Mesh(new THREE.SphereGeometry(.55, 24, 16), new THREE.MeshStandardMaterial({ color: TEAM_COLORS[player.team].light, emissive: TEAM_COLORS[player.team].main, emissiveIntensity: .5, transparent: true, opacity: .28, depthWrite: false }));
      view.bubble.position.y = .45; view.group.add(view.bubble);
    }
    if (view.bubble) view.bubble.visible = up;
    const dome = up && player.guardRaise >= GUARD.expandTicks && !player.domeBroken && player.domeHp > 0;
    if (dome && !view.dome) {
      view.dome = new THREE.Mesh(new THREE.SphereGeometry(GUARD.radius * U, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: TEAM_COLORS[player.team].light, emissive: TEAM_COLORS[player.team].main, emissiveIntensity: .35, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }));
      view.group.add(view.dome);
    }
    if (view.dome) { view.dome.visible = dome; if (dome) view.dome.material.opacity = .12 + .05 * Math.sin(now / 200); }
  }
  updateShots(state, map) {
    const seen = new Set();
    for (const shot of state.projectiles || []) {
      seen.add(shot.id);
      let view = this.shots.get(shot.id);
      if (!view) {
        const tint = colour(shot.status ? STATUS_COLOR[shot.status] || '#ffffff' : TEAM_COLORS[shot.team]?.light || '#ffffff');
        const size = Math.max(.07, (shot.size || 5) * U * 1.3);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshBasicMaterial({ color: tint.clone().lerp(colour('#ffffff'), .5) }));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: tint, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(size * 7);
        const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: tint, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending })); trail.scale.setScalar(size * 4);
        view = new THREE.Group(); view.add(ball, glow); view.userData.trail = trail; this.scene.add(view, trail); this.shots.set(shot.id, view);
      }
      const y = (shot.z || 0) * STOREY + KNIGHT * .45;
      view.position.set(shot.x * U, y, shot.y * U);
      view.userData.trail.position.set((shot.x - shot.vx * .03) * U, y, (shot.y - shot.vy * .03) * U);
      if (shot.grow) view.scale.setScalar(1 + (shot.size || 5) / 30);
    }
    for (const [id, view] of this.shots) if (!seen.has(id)) { this.scene.remove(view, view.userData.trail); this.shots.delete(id); }
  }
  updateBombs(state, map, now) {
    const seen = new Set();
    for (const bomb of state.bombs || []) {
      seen.add(bomb.id);
      let view = this.bombs.get(bomb.id);
      const weapon = WEAPONS[bomb.weapon], tint = colour(ELEMENT[weapon?.element] || (weapon?.cloud ? STATUS_COLOR[weapon.cloud.status] : '#ffb347') || '#ffb347');
      if (!view) {
        view = new THREE.Group();
        // A planted bomb: its model (sitting on the floor at the origin) or a temporary ball.
        const ball = this.models.instance(`bombs/${bomb.weapon}.glb`) || new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), new THREE.MeshStandardMaterial({ color: '#3a3e48', roughness: .4, metalness: .6 }));
        if (ball.isMesh) ball.position.y = .2; ball.traverse(node => { if (node.isMesh) node.castShadow = true; });
        const light = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: tint })); light.position.y = .42;
        const radius = (weapon?.cloud?.radius || weapon?.radius || 60) * U;
        const zone = new THREE.Mesh(arcGeometry(radius - .05, radius, 0, Math.PI * 2, 48), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending })); zone.position.y = .04;
        view.add(ball, light, zone); view.userData = { light, zone }; this.scene.add(view); this.bombs.set(bomb.id, view);
      }
      view.position.set(bomb.x * U, levelAt(map, bomb.x, bomb.y) * STOREY, bomb.y * U);
      const urgency = 1 - bomb.fuse / Math.max(1, bomb.total), blink = Math.sin(now / (120 - urgency * 90)) > 0;
      view.userData.light.visible = blink; view.userData.zone.material.opacity = .25 + urgency * .5;
      // Models with the template's named parts: the fuse blinks with the warning light, the body swells at the end.
      const fuse = view.getObjectByName('fuse'), bodyNode = view.getObjectByName('body');
      if (fuse) fuse.traverse(node => { if (node.material?.emissive) node.material.emissiveIntensity = blink ? 2.5 : .4; });
      if (bodyNode) bodyNode.scale.setScalar(1 + Math.max(0, urgency - .75) * .5 * (1 + Math.sin(now / 40)));
    }
    for (const [id, view] of this.bombs) if (!seen.has(id)) { this.scene.remove(view); this.bombs.delete(id); }
  }
  updatePickups(state, map, now) {
    const seen = new Set();
    for (const pickup of state.pickups || []) {
      seen.add(pickup.id);
      let view = this.hearts.get(pickup.id);
      if (!view) {
        view = new THREE.Mesh(this.heartGeo ||= this.heartGeometry(), this.heartMat ||= new THREE.MeshStandardMaterial({ color: '#ff3a5a', emissive: '#ff2040', emissiveIntensity: .7, roughness: .35 }));
        view.castShadow = true; this.scene.add(view); this.hearts.set(pickup.id, view);
      }
      view.position.set(pickup.x * U, levelAt(map, pickup.x, pickup.y) * STOREY + .4 + Math.sin(now / 250 + pickup.id) * .06, pickup.y * U); view.rotation.y = now / 500 + pickup.id;
      view.visible = !(pickup.ttl < 180 && Math.floor(now / 120) % 2);
    }
    for (const [id, view] of this.hearts) if (!seen.has(id)) { this.scene.remove(view); this.hearts.delete(id); }
  }
  updateClouds(state, map, now) {
    const seen = new Set();
    for (const cloud of state.clouds || []) {
      seen.add(cloud.id);
      let view = this.clouds.get(cloud.id);
      if (!view) {
        view = new THREE.Mesh(new THREE.CylinderGeometry(cloud.radius * U, cloud.radius * U, .6, 32, 1, true), new THREE.MeshBasicMaterial({ color: STATUS_COLOR[cloud.status] || '#ffffff', transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }));
        const disc = new THREE.Mesh(new THREE.CircleGeometry(cloud.radius * U, 32), new THREE.MeshBasicMaterial({ color: STATUS_COLOR[cloud.status] || '#ffffff', transparent: true, opacity: .25, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = -.27; view.add(disc);
        this.scene.add(view); this.clouds.set(cloud.id, view);
      }
      view.position.set(cloud.x * U, levelAt(map, cloud.x, cloud.y) * STOREY + .3, cloud.y * U);
      const fade = Math.min(1, cloud.ticks / 60); view.material.opacity = .22 * fade; view.rotation.y = now / 2000;
    }
    for (const [id, view] of this.clouds) if (!seen.has(id)) { this.scene.remove(view); this.clouds.delete(id); }
  }

  // ---------- events → effects ----------
  consumeEvents(state, now) {
    this.flashes ||= new Map();
    const map = MAPS[state.mapId];
    const at = (x, y, lift = 0) => new THREE.Vector3(x * U, (map ? levelAt(map, x, y) * STOREY : 0) + lift, y * U);
    for (const event of state.events || []) {
      if (this.seenEvents.has(event.id)) continue;
      this.seenEvents.add(event.id); this.eventOrder.push(event.id);
      if (this.eventOrder.length > 600) this.seenEvents.delete(this.eventOrder.shift());
      if (state.tick - event.tick > 30) continue;
      const mine = event.playerId === this.localId || event.targetId === this.localId;
      if (event.type === 'swing') this.slashEffect(state, event, now);
      else if (event.type === 'damage') {
        this.flashes.set(event.targetId, now);
        this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .1, text: String(event.amount), color: event.kind === 'burn' ? STATUS_COLOR.burn : event.kind === 'shock' || event.kind === 'chain' ? STATUS_COLOR.shock : '#ffffff', born: now, life: 700, size: 15, rise: 30 });
        this.burst(at(event.x, event.y, .5), '#ffffff', .5, 160, now);
        if (event.targetId === this.localId) this.shake = Math.max(this.shake, Math.min(8, 2 + event.amount / 5));
      } else if (event.type === 'explosion') { this.burst(at(event.x, event.y, .3), event.burst ? '#ffcf8a' : '#ffb347', (event.radius || 60) * U * 2, 420, now, true); this.shakeNear(event.x, event.y, 6); }
      else if (event.type === 'slam') { this.ringEffect(at(event.x, event.y, .05), (event.radius || 80) * U, '#ffe0a0', 420, now); this.shakeNear(event.x, event.y, 7); }
      else if (event.type === 'shot') {
        // The flash comes out of the gun's muzzle node when the model has one; the shooter's arm and barrel kick.
        const shooter = this.knights?.get(event.playerId), muzzle = shooter?.weapon?.getObjectByName?.('muzzle');
        if (shooter) { const gun = WEAPONS[event.weapon]; shooter.recoilAt = now; shooter.recoilPower = Math.min(1.3, Math.max(.35, (gun?.damage || 8) * (gun?.pellets || 1) / 16 * .75)) * (event.charged ? 1.5 : 1); }
        const position = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : at(event.x + Math.cos(event.angle) * 22, event.y + Math.sin(event.angle) * 22, KNIGHT * .45);
        this.burst(position, '#fff4c0', .45, 90, now);
      }
      else if (event.type === 'kill') this.burst(at(event.x, event.y, .5), '#ffffff', 1.6, 500, now, true);
      else if (event.type === 'capture') this.ringEffect(at(event.x, event.y, .05), RULES.pointRadius * U, TEAM_COLORS[event.team]?.main || '#ffffff', 900, now);
      else if (event.type === 'heal' || event.type === 'dome') this.ringEffect(at(event.x, event.y, .05), (event.radius || 60) * U, '#7dff9a', 500, now);
      else if (event.type === 'heartUse' || event.type === 'heartPickup') this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .2, text: `+${event.amount}`, color: '#7dff9a', born: now, life: 800, size: 15, rise: 26 });
      else if (event.type === 'status') this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .35, text: event.status.toUpperCase(), color: STATUS_COLOR[event.status] || '#ffffff', born: now, life: 600, size: 12, rise: 18 });
      else if (event.type === 'chain') this.beam(at(event.fromX, event.fromY, .5), at(event.toX, event.toY, .5), STATUS_COLOR.shock, 220, now);
      if (event.type === 'cloak') this.burst(at(event.x, event.y, KNIGHT * .4), '#b48cff', .9, 260, now);
      if (event.type === 'chargeRelease') { this.ringEffect(at(event.x, event.y, .06), 1.4, '#ffd36b', 380, now); this.burst(at(event.x, event.y, KNIGHT * .5), '#ffe9a8', 1.3, 300, now, true); }
      if (event.type === 'clash') { this.burst(at(event.x, event.y, .5), '#ffffff', .9, 220, now, true); this.shakeNear(event.x, event.y, 4); }
      if (CALLOUTS[event.type] && mine && !(event.type === 'interrupt' && event.by === 'clash')) {
        const [text, color, on] = CALLOUTS[event.type], who = on === 'target' ? event.targetId : event.playerId;
        const row = this.texts.filter(t => t.callout && t.playerId === who && now - t.born < t.life).length;
        this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .55, text, color, born: now, life: 650, size: 13, rise: 14, callout: true, playerId: who, row });
      }
    }
    this.texts = this.texts.filter(t => now - t.born < t.life);
  }
  shakeNear(x, y, amount) { const v = this.viewer; if (!v) return; const d = Math.hypot(v.x - x, v.y - y); if (d < 500) this.shake = Math.max(this.shake, amount * (1 - d / 500)); }
  addEffect(object, now, life, update) { this.scene.add(object); this.effects.push({ object, born: now, life, update }); }
  burst(position, tint, size, life, now, big = false) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: tint, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(position); sprite.scale.setScalar(size * .4);
    this.addEffect(sprite, now, life, t => { sprite.scale.setScalar(size * (.4 + t * (big ? 1.2 : .6))); sprite.material.opacity = 1 - t; });
  }
  ringEffect(position, radius, tint, life, now) {
    const mesh = new THREE.Mesh(arcGeometry(.85, 1, 0, Math.PI * 2, 48), new THREE.MeshBasicMaterial({ color: tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.position.copy(position);
    this.addEffect(mesh, now, life, t => { mesh.scale.setScalar(radius * (.3 + .7 * t)); mesh.material.opacity = 1 - t; });
  }
  beam(from, to, tint, life, now) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]), line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: tint, transparent: true }));
    this.addEffect(line, now, life, t => { line.material.opacity = 1 - t; });
  }
  /** The swept arc of a sword cut: it appears where the blade is, in the exact arc and reach of the hit. */
  slashEffect(state, event, now) {
    const owner = state.players[event.playerId], map = MAPS[state.mapId]; if (!owner || !map) return;
    const reach = (event.reach || 70) * U, start = event.angle - event.dir * event.arc / 2, delay = (event.startup || 0) * 1000 / 120, sweep = Math.max(1, (event.active || 1) * 1000 / 120);
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const lift = levelAt(map, owner.x, owner.y) * STOREY + KNIGHT * .4;
    mesh.position.set(owner.x * U, lift, owner.y * U);
    let shown = -1;
    this.addEffect(mesh, now, delay + sweep + 160, (t, age) => {
      const live = state.players[event.playerId]; if (live) mesh.position.set(live.x * U, lift, live.y * U);
      if (age < delay) { material.opacity = 0; return; }
      const progress = Math.min(1, (age - delay) / sweep), key = Math.round(progress * 20);
      if (key !== shown) { shown = key; mesh.geometry.dispose(); const a0 = start, a1 = start + event.dir * event.arc * Math.max(.05, progress); mesh.geometry = arcGeometry(reach * .35, reach, Math.min(a0, a1), Math.max(a0, a1), 20); }
      material.opacity = progress < 1 ? .75 : Math.max(0, .75 * (1 - (age - delay - sweep) / 160));
    });
  }
  updateEffects(now) {
    this.effects = this.effects.filter(effect => {
      const age = now - effect.born, t = Math.min(1, age / effect.life);
      effect.update?.(t, age);
      if (age >= effect.life) { this.scene.remove(effect.object); effect.object.geometry?.dispose(); effect.object.material?.dispose(); return false; }
      return true;
    });
  }

  // ---------- 2D overlay: names, health, numbers, callouts, crosshair ----------
  drawOverlay(state, map, now, local, pointer) {
    const ctx = this.ctx, canvas = this.overlayCanvas, ratio = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const viewerTeam = local?.team ?? null;
    for (const player of state.players) {
      const view = this.knights.get(player.id); if (!player.alive || !view?.group.visible) continue;
      const ground = levelAt(map, player.x, player.y) * STOREY, head = this.project(player.x, player.y, ground + KNIGHT + .25);
      if (!head.visible) continue;
      const ally = viewerTeam === null || player.team === viewerTeam, team = TEAM_COLORS[player.team];
      ctx.textAlign = 'center'; ctx.font = '600 12px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(player.name, head.x, head.y - 8); ctx.fillStyle = player.id === this.localId ? '#ffffff' : team.light; ctx.fillText(player.name, head.x, head.y - 8);
      // Health bars: allies only (and the Dojo's dummies).
      if (ally || player.dummy) {
        const w = 40, pct = Math.max(0, player.hp / player.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(head.x - w / 2 - 1, head.y - 3, w + 2, 6);
        ctx.fillStyle = pct > .5 ? team.light : pct > .25 ? '#ffd36b' : '#ff6b5a'; ctx.fillRect(head.x - w / 2, head.y - 2, w * pct, 4);
      }
      if (player.cls === 'striker' && player.id === this.localId && (player.boosting || player.boostMeter < ABILITIES.dash.meter)) {
        const feet = this.project(player.x, player.y, ground), w = 40, fill = Math.max(0, Math.min(1, player.boostMeter / ABILITIES.dash.meter));
        ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(feet.x - w / 2 - 1, feet.y + 14, w + 2, 6);
        ctx.fillStyle = player.boostLocked ? '#ff6b5a' : player.boosting ? '#ffd36b' : '#8fd8ff'; ctx.fillRect(feet.x - w / 2, feet.y + 15, w * fill, 4);
      }
      const statuses = STATUS_IDS.filter(id => player.status?.[id] > 0);
      statuses.forEach((id, i) => { ctx.fillStyle = STATUS_COLOR[id] || '#fff'; ctx.beginPath(); ctx.arc(head.x - (statuses.length - 1) * 6 + i * 12, head.y - 26, 4.5, 0, Math.PI * 2); ctx.fill(); });
      if (player.stunTicks > 0) { ctx.fillStyle = '#ffe680'; for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1; ctx.beginPath(); ctx.arc(head.x + Math.cos(a) * 14, head.y + 8 + Math.sin(a) * 4, 2.5, 0, Math.PI * 2); ctx.fill(); } }
    }
    for (const text of this.texts) {
      const age = (now - text.born) / text.life, owner = text.playerId !== undefined ? state.players[text.playerId] : null;
      const x = owner?.alive ? owner.x : text.x, y = owner?.alive ? owner.y : text.y;
      const p = this.project(x, y, levelAt(map, x, y) * STOREY + text.lift); if (!p.visible) continue;
      const ty = p.y - (text.row || 0) * 15 - age * text.rise;
      ctx.font = `bold ${text.size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      ctx.strokeText(text.text, p.x, ty); ctx.fillStyle = text.color; ctx.fillText(text.text, p.x, ty); ctx.globalAlpha = 1;
    }
    if (pointer && this.overlay) this.overlay.drawCrosshair(ctx, pointer, local, now);
  }
}
