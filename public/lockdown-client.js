/** Lockdown page: lobby, input, HUD and networking around the shared engine.
 * `?solo=1` runs the simulation in the page with bots; `?room=ID` plays online. */
import * as Engine from './lockdown-engine.js';
import { LockdownRenderer, TEAM_COLORS, FLOOR_RISE } from './lockdown-renderer.js';
import { createAssetLibrary } from './lockdown-assets.js';
import { gameKey, getKeyboardLayout, setKeyboardLayout, subscribeKeyboardLayout, displayKey, KEYBOARD_LAYOUT_STORAGE_KEY } from './keyboard-layout.js';
import { GameAudio } from './lockdown-audio.js';
import { getName, saveName } from './lockdown-name.js';

const { TICK_RATE, RULES, CLASSES, ARMORS, ARMOR_IDS, GEAR, GEAR_SLOTS, combineGear, WEAPONS, WEAPON_IDS, WEAPON_NOTES, CUTS, DEFAULT_LOADOUTS, SLOT_COUNT, MAPS, MAP_IDS, ABILITIES, INPUT_KEYS, GUARD, STATUS, STATUS_IDS } = Engine;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const roomId = params.get('room');
const solo = !roomId;
// ?solo=1&dojo=1: the Dojo, a training hall with dummies where loadouts change anywhere.
const dojo = solo && params.get('dojo') === '1';
const FAMILY_GLYPH = { blade: '⚔', gun: '✦', bomb: '●' };
const CLASS_GLYPH = { striker: '➶', guardian: '⛨', recon: '◐' };
const ELEMENT_TAGS = { chill: 'Frost', freeze: 'Frost', burn: 'Fire', shock: 'Shock', poison: 'Poison', curse: 'Curse', drain: 'Drain', holy: 'Holy' };
let gearTab = 'armor';
const GEAR_LABELS = { helmet: 'Helmet', armor: 'Armor', pants: 'Pants', shoes: 'Shoes' };
const GEAR_GLYPH = { helmet: '⛑', pants: '⫴', shoes: '👢' };
const gearIcon = (slot, id) => iconMarkup(slot === 'armor' ? `icon_armor_${id}` : `icon_${slot}_${id}`, slot === 'armor' ? ARMOR_GLYPH[id] || '◆' : GEAR_GLYPH[slot]);
const ARMOR_GLYPH = { none: '♙', scout: '➶', ballistic: '▣', duelist: '⚔', heavy: '⛨', gunslinger: '✦', fencer: '†', windrunner: '≋', juggernaut: '▦', bombardier: '●', berserker: '✷', mirrorweave: '◇', medic: '✚', clockwork: '⚙' };
const ABILITY_ICON = { striker: 'dash', guardian: 'bubble', recon: 'cloak' };
const STORAGE_KEY = 'lockdown-setup';
const SEND_INTERVAL_MS = 16, HEARTBEAT_MS = 100, MAX_EXTRAPOLATE_MS = 60;

const app = $('ld-app'), canvas = $('ld-arena'), minimap = $('ld-minimap');
const audio = new GameAudio();
const assets = createAssetLibrary({ onChange: () => refreshIcons() });
const renderer = new LockdownRenderer(canvas, assets);
// The arena is drawn in 3D (?view=2d for the flat view); the 2D renderer still draws the minimap and the reticle.
const scene = new URLSearchParams(location.search).get('view') === '2d' ? renderer : await create3dScene();
async function create3dScene() {
  try { const { Lockdown3DRenderer } = await import('./lockdown-renderer3d.js'); return new Lockdown3DRenderer(canvas, assets, renderer); }
  catch (problem) { console.warn('3D view unavailable, using 2D', problem); return renderer; }
}

// ---------- local setup (remembered per browser) ----------
function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const weapons = Array.isArray(saved?.weapons) ? Array.from({ length: SLOT_COUNT }, (_, slot) => Object.hasOwn(WEAPONS, saved.weapons[slot]) ? saved.weapons[slot] : null) : [];
    const chosen = weapons.filter(Boolean);
    if (saved && Object.hasOwn(CLASSES, saved.cls) && chosen.length && new Set(chosen).size === chosen.length) {
      return { cls: saved.cls, ...Object.fromEntries(GEAR_SLOTS.map(slot => [slot, Object.hasOwn(GEAR[slot], saved[slot]) ? saved[slot] : 'none'])), weapons, team: saved.team === 1 ? 1 : 0 };
    }
  } catch {}
  return { cls: 'striker', ...Object.fromEntries(GEAR_SLOTS.map(slot => [slot, 'none'])), weapons: [...DEFAULT_LOADOUTS.striker], team: 0 };
}
function storeSetup() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(setup)); } catch {} }
const setup = loadSetup();
const gearOf = source => Object.fromEntries(GEAR_SLOTS.map(slot => [slot, Object.hasOwn(GEAR[slot], source?.[slot]) ? source[slot] : 'none']));
let soloMapId = dojo ? 'dojo' : MAP_IDS[0];

// ---------- session state ----------
let state = null;          // latest authoritative (or local) state
let previous = null;       // previous snapshot, for interpolation
let receivedAt = 0, previousAt = 0, snapshotGap = 1000 / 40;
let localId = solo ? 0 : null;
let hostId = solo ? 0 : null;
let socket = null, connected = false, seq = 0, setupSent = false;
let menuOpen = true, lastPhase = null, statusTimer = 0;

function setStatus(text, sticky = false) {
  $('ld-status').textContent = text || '';
  clearTimeout(statusTimer);
  if (text && !sticky) statusTimer = setTimeout(() => { $('ld-status').textContent = ''; }, 4000);
}

// ---------- solo simulation ----------
let accumulator = 0, lastFrame = performance.now();
function soloCreate() {
  state = Engine.createState({ mapId: soloMapId, seed: (Math.random() * 2 ** 32) >>> 0 });
  Engine.setConnected(state, 0, true, getName());
  applySetupLocally();
  // The Dojo opens straight away (the menu stays up, paused, until you step in).
  if (dojo) Engine.startMatch(state, [0]);
}
function applySetupLocally() {
  if (!state || state.phase !== 'lobby' && state.phase !== 'matchEnd') return;
  const result = Engine.setPlayerSetup(state, 0, { team: setup.team, cls: setup.cls, ...gearOf(setup), weapons: setup.weapons, name: getName() });
  if (!result.ok) setStatus(result.error);
}
function soloStep(elapsedMs) {
  if (!state || menuOpen && state.phase !== 'matchEnd') return; // the menu pauses practice
  accumulator = Math.min(accumulator + elapsedMs, 250);
  const stepMs = 1000 / TICK_RATE;
  while (accumulator >= stepMs) {
    accumulator -= stepMs;
    const inputs = []; inputs[0] = sampleInput(true);
    Engine.step(state, inputs);
  }
}

// ---------- networking ----------
function connect() {
  const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?room=${encodeURIComponent(roomId)}`;
  socket = new WebSocket(url);
  socket.addEventListener('open', () => { connected = true; send({ type: 'join', name: getName() }); setStatus('Connected.'); });
  socket.addEventListener('close', () => { connected = false; setStatus('Disconnected from the room. Refresh to rejoin.', true); });
  socket.addEventListener('message', event => {
    let data; try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'welcome') {
      localId = data.playerId; setupSent = false;
    } else if (data.type === 'state') {
      hostId = data.hostId ?? null;
      previous = state; previousAt = receivedAt;
      state = data.state; receivedAt = performance.now();
      if (previous && previous.tick < state.tick) snapshotGap = Math.max(8, Math.min(120, (receivedAt - previousAt) * .3 + snapshotGap * .7));
      syncLocalSetupFromState();
    } else if (data.type === 'error') setStatus(data.message);
  });
}
function send(message) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
function syncLocalSetupFromState() {
  const me = state && localId !== null ? state.players[localId] : null;
  if (!me) return;
  // Send the remembered setup the first time we sit in a lobby.
  if (!setupSent && state.phase === 'lobby') { setupSent = true; send({ type: 'lockdown-setup', team: setup.team, cls: setup.cls, ...gearOf(setup), weapons: setup.weapons }); return; }
  // The server is the source of truth (a full team, for example, keeps you where you were).
  rememberAuthoritativeSetup(me);
}
function rememberAuthoritativeSetup(me) {
  const gear = gearOf(me);
  if (setup.team === me.team && setup.cls === me.cls && GEAR_SLOTS.every(slot => setup[slot] === gear[slot]) && setup.weapons.join() === me.weapons.join()) return;
  Object.assign(setup, { team: me.team, cls: me.cls, ...gear, weapons: [...me.weapons] });
  storeSetup();
}

// ---------- input ----------
const held = new Set();      // logical keys currently down
const pressed = new Set();   // edges seen since the last sample, so quick taps are never lost
const mouse = { x: 0, y: 0, inside: false, left: false, right: false };
let aim = 0, wheelSum = 0, wheelAt = -1e9, wheelUsed = false;
const KEY_BINDINGS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'dash', ShiftLeft: 'dash', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', KeyQ: 'swap',
};
function bindingFor(event) {
  if (KEY_BINDINGS[event.code] && event.code.startsWith('Arrow')) return KEY_BINDINGS[event.code];
  const key = gameKey(event);
  const code = typeof key === 'string' && key.length === 1 ? (/[0-9]/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`) : event.code;
  return KEY_BINDINGS[code] || KEY_BINDINGS[event.code] || null;
}
function press(control) { held.add(control); pressed.add(control); }
// Movement keys: WASD, or ZQSD for French (AZERTY) keyboards. An AZERTY keyboard is recognised on its own the
// first time (from the browser's layout map, or the first letter typed on it) unless the player already chose.
const layoutChosen = () => { try { return localStorage.getItem(KEYBOARD_LAYOUT_STORAGE_KEY) !== null; } catch { return false; } };
function refreshKeyLabels() {
  const layout = getKeyboardLayout();
  for (const kbd of document.querySelectorAll('[data-keylabel]')) kbd.textContent = displayKey(kbd.dataset.keylabel, layout);
  for (const button of document.querySelectorAll('[data-layout]')) button.setAttribute('aria-pressed', String(button.dataset.layout === layout));
  canvas.setAttribute('aria-label', `Lockdown arena. ${displayKey('WASD', layout)} moves, the mouse aims, left click attacks (hold to charge), right click uses your class ability, Space dashes, 1 to 4 or ${displayKey('Q', layout)} switch weapons, M shows the map, O plays full screen, Escape opens the menu.`);
}
for (const button of document.querySelectorAll('[data-layout]')) button.addEventListener('click', () => setKeyboardLayout(button.dataset.layout));
subscribeKeyboardLayout(refreshKeyLabels);
if (!layoutChosen()) navigator.keyboard?.getLayoutMap?.().then(map => { if (!layoutChosen() && map.get('KeyQ') === 'a') setKeyboardLayout('zqsd'); }).catch(() => {});
addEventListener('keydown', event => { if (!layoutChosen() && event.code === 'KeyQ' && event.key?.toLowerCase() === 'a') setKeyboardLayout('zqsd'); }, { capture: true });
function release(control) { held.delete(control); }
addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.code === 'Escape' && inventoryOpen) { event.preventDefault(); toggleInventory(false); return; }
  if (event.code === 'Escape' && armory.open) { event.preventDefault(); closeArmory(); return; }
  if (event.code === 'Escape' && bigMapOpen) { event.preventDefault(); toggleBigMap(false); return; }
  if (event.code === 'Escape' && finale && !finale.done) { event.preventDefault(); endFinale(); return; }
  if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); toggleMenu(); return; }
  if (event.code === 'Tab') { event.preventDefault(); showBoard(true); return; }
  if (String(gameKey(event)).toLowerCase() === 'o' && !event.repeat) { event.preventDefault(); toggleFullscreen(); return; }
  if (String(gameKey(event)).toLowerCase() === 'm' && !event.repeat && !menuOpen) { event.preventDefault(); toggleBigMap(); return; }
  if (gameKey(event) === 'i' && !event.repeat && !menuOpen) { event.preventDefault(); toggleInventory(); return; }
  if (event.code === 'Escape' && inventoryOpen) { event.preventDefault(); toggleInventory(false); return; }
  if (event.code === 'KeyB' && !event.repeat && !menuOpen) {
    // The loadout opens in base (or while waiting to respawn); elsewhere B just says where to go.
    event.preventDefault();
    if (canChangeLoadout()) toggleMenu(true); else flashBaseHint();
    return;
  }
  if (menuOpen) return;
  const control = bindingFor(event);
  if (!control) return;
  event.preventDefault();
  if (!event.repeat) press(control);
});
addEventListener('keyup', event => { if (event.code === 'Tab') showBoard(false); const control = bindingFor(event); if (control) release(control); });
addEventListener('blur', () => { held.clear(); mouse.left = mouse.right = false; showBoard(false); });
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointermove', event => { if (mouseLocked()) return; mouse.x = event.offsetX; mouse.y = event.offsetY; mouse.inside = true; });
canvas.addEventListener('pointerdown', event => {
  enableAudio();
  canvas.focus();
  if (!mouseLocked()) { mouse.x = event.offsetX; mouse.y = event.offsetY; }
  lockMouse();
  if (event.button === 0) { mouse.left = true; press('attack'); }
  if (event.button === 2) { mouse.right = true; press('ability'); }
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointerup', event => {
  if (event.button === 0) { mouse.left = false; release('attack'); }
  if (event.button === 2) { mouse.right = false; release('ability'); }
});
// The wheel: down for the next slot, up for the previous one (up from the first goes round to the last), skipping
// empty slots.
// One scroll gesture is one step: the burst of events a smooth wheel or a trackpad sends for one notch or flick
// (events less than 0.2 s apart) moves one slot.
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const now = performance.now();
  if (now - wheelAt > 200) { wheelSum = 0; wheelUsed = false; }
  wheelAt = now;
  if (wheelUsed) return;
  wheelSum += event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
  if (Math.abs(wheelSum) < 20) return;
  const dir = Math.sign(wheelSum); wheelUsed = true;
  const me = viewState()?.players[localId ?? -1]; if (!me) return;
  const filled = index => me.weapons[index] || me.hearts?.[index] > 0;
  const from = me.pendingSlot ?? me.slot;
  for (let step = 1; step < SLOT_COUNT; step++) { const index = (from + dir * step + SLOT_COUNT) % SLOT_COUNT; if (filled(index)) { pressed.add(`slot${index + 1}`); return; } } // a single press: a wheel never lets go
}, { passive: false });

// ---------- full screen and mouse lock ----------
// The big map (M): the whole arena, the zones with their letters, capture progress and who stands on them.
let bigMapOpen = false;
function toggleBigMap(force) { bigMapOpen = typeof force === 'boolean' ? force : !bigMapOpen; $('ld-bigmap').hidden = !bigMapOpen; }
// Full screen (O or the menu button): the game fills the screen, and while you play the mouse is locked to it,
// so it can never wander off the window or onto another monitor. The game's own reticle follows the mouse
// inside the screen; menus and the inventory free it, going back to the fight locks it again.
let fullscreenWanted = false;
const mouseLocked = () => document.pointerLockElement === canvas;
function lockMouse() {
  if (!fullscreenWanted || menuOpen || inventoryOpen || mouseLocked() || !canvas.requestPointerLock) return;
  try { canvas.requestPointerLock()?.catch?.(() => {}); } catch {}
}
function unlockMouse() { if (mouseLocked()) document.exitPointerLock(); }
async function toggleFullscreen(on = !fullscreenWanted) {
  fullscreenWanted = on;
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch { fullscreenWanted = !!document.fullscreenElement; }
  if (fullscreenWanted) lockMouse(); else unlockMouse();
  refreshFullscreenButton();
}
function refreshFullscreenButton() { const button = $('ld-fullscreen'); if (button) { button.setAttribute('aria-pressed', String(fullscreenWanted)); button.textContent = fullscreenWanted ? 'Leave full screen' : 'Full screen'; } }
$('ld-fullscreen')?.addEventListener('click', () => toggleFullscreen());
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fullscreenWanted) { fullscreenWanted = false; unlockMouse(); } refreshFullscreenButton(); });
// The browser hands the mouse back on Esc: take that as opening the menu.
document.addEventListener('pointerlockchange', () => { if (mouseLocked()) mouse.inside = true; else if (fullscreenWanted && !menuOpen && !inventoryOpen) toggleMenu(true); });
addEventListener('mousemove', event => {
  if (!mouseLocked()) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = Math.min(rect.width - 1, Math.max(0, mouse.x + event.movementX)); mouse.y = Math.min(rect.height - 1, Math.max(0, mouse.y + event.movementY));
});

function updateAim() {
  const me = viewState()?.players[localId ?? -1];
  if (!me || !mouse.inside) return;
  // Shots fly at chest height in the ¾ view (a storey higher on raised floor), so the pointer is read
  // on that plane, through the camera tilt.
  const world = scene.screenToWorld(mouse.x, mouse.y, scene.aimHeight(me));
  aim = Math.atan2(world.y - me.y, world.x - me.x);
}
/** One input frame. Edge presses that were already released still count once. */
function sampleInput(consume) {
  const input = Engine.emptyInput(aim);
  if (menuOpen) return input;
  for (const key of INPUT_KEYS) input[key] = held.has(key) || pressed.has(key);
  // With the inventory open the mouse drags items, so clicks never attack.
  if (inventoryOpen) input.attack = input.ability = false;
  if (consume) pressed.clear();
  return input;
}
let lastSent = 0, lastSentKey = '';
function sendInput(now) {
  if (!connected || localId === null) return;
  const input = sampleInput(false), key = JSON.stringify(input);
  if (now - lastSent < SEND_INTERVAL_MS || key === lastSentKey && now - lastSent < HEARTBEAT_MS) return;
  sampleInput(true);
  lastSent = now; lastSentKey = key;
  send({ type: 'input', seq: ++seq, buttons: input });
  // A tap released before this send goes out as a press now and a release next time.
  if (INPUT_KEYS.some(control => input[control] && !held.has(control))) lastSentKey = '';
}

// ---------- audio ----------
let audioOn = false;
async function enableAudio() { if (audioOn) return; audioOn = true; try { await audio.setEnabled(true); } catch { audioOn = false; } }
const heardEvents = new Set(), heardOrder = [];
function playEvents(current) {
  for (const event of current.events || []) {
    if (heardEvents.has(event.id)) continue;
    heardEvents.add(event.id); heardOrder.push(event.id); if (heardOrder.length > 600) heardEvents.delete(heardOrder.shift());
    if (current.tick - event.tick > TICK_RATE / 2) continue;
    const me = current.players[localId ?? -1], near = me && Number.isFinite(event.x) ? Math.max(.15, 1 - Math.hypot(event.x - me.x, event.y - me.y) / 900) : .6;
    try {
      switch (event.type) {
        case 'combo': audio.tone(520, .16, { end: 1040, type: 'triangle', gain: .2 * near }); break;
        case 'swing': audio.noise(event.charged ? .22 : .09, { highpass: 900, lowpass: 5200, gain: .16 * near }); if (event.charged) audio.tone(180, .2, { end: 60, type: 'triangle', gain: .2 * near }); break;
        case 'shot': audio.tone(event.weapon === 'magnus' ? 220 : event.weapon === 'scatter' ? 300 : 620, event.charged ? .18 : .08, { end: 120, type: 'square', gain: .08 * near }); audio.noise(.06, { highpass: 1200, gain: .1 * near }); break;
        case 'damage': if (event.targetId === localId) audio.tone(140, .12, { end: 70, type: 'sawtooth', gain: .2 }); else if (event.playerId === localId) audio.tone(880, .05, { end: 660, type: 'triangle', gain: .12 }); break;
        case 'explosion': audio.noise(.45, { highpass: 40, lowpass: 1400, gain: .5 * near }); audio.tone(90, .4, { end: 30, gain: .4 * near }); break;
        case 'bombPlant': audio.tone(500, .06, { end: 700, type: 'square', gain: .08 * near }); break;
        case 'kill': if (event.playerId === localId) audio.tone(520, .25, { end: 1040, type: 'triangle', gain: .2 }); else if (event.targetId === localId) audio.tone(260, .5, { end: 80, type: 'sawtooth', gain: .2 }); break;
        case 'capture': audio.tone(me && event.team === me.team ? 660 : 330, .35, { end: me && event.team === me.team ? 990 : 220, type: 'triangle', gain: .22 }); break;
        case 'bubble': audio.tone(300, .3, { end: 520, gain: .15 * near }); break;
        case 'bubblePop': audio.noise(.15, { highpass: 1500, gain: .2 * near }); break;
        case 'heal': audio.tone(520, .3, { end: 880, gain: .15 * near }); break;
        case 'dash': audio.noise(.18, { highpass: 2000, gain: .1 * near }); break;
        case 'cloak': audio.tone(700, .25, { end: 200, gain: .1 * near }); break;
        case 'block': audio.tone(1200, .05, { end: 900, type: 'square', gain: .07 * near }); audio.noise(.05, { highpass: 2500, gain: .08 * near }); break;
        case 'guardBreak': audio.noise(.25, { highpass: 1800, gain: .25 * near }); audio.tone(400, .3, { end: 120, type: 'sawtooth', gain: .15 * near }); break;
        case 'status': audio.tone(event.status === 'freeze' ? 1400 : event.status === 'shock' ? 900 : event.status === 'burn' ? 300 : 500, .18, { end: event.status === 'freeze' ? 2000 : 200, type: 'triangle', gain: .1 * near }); break;
        case 'ricochet': audio.tone(2200, .04, { end: 1500, type: 'square', gain: .04 * near }); break;
        case 'detonate': audio.noise(.3, { highpass: 60, lowpass: 1800, gain: .35 * near }); break;
        case 'slam': audio.noise(.35, { highpass: 40, lowpass: 900, gain: .45 * near }); audio.tone(70, .3, { end: 35, gain: .35 * near }); break;
        case 'spinTurn': audio.noise(.1, { highpass: 1200, lowpass: 5000, gain: .12 * near }); break;
        case 'vortex': audio.tone(200, .6, { end: 60, type: 'sawtooth', gain: .12 * near }); break;
        case 'chargeRelease': if (event.playerId === localId) audio.tone(660, .08, { end: 990, type: 'triangle', gain: .12 }); break;
        case 'dryFire': if (event.playerId === localId) audio.tone(180, .04, { type: 'square', gain: .08 }); break;
        case 'reloaded': if (event.playerId === localId) audio.tone(1000, .04, { end: 1300, type: 'square', gain: .05 }); break;
        case 'fight': audio.fight?.(); break;
        case 'heartDrop': audio.tone(440, .12, { end: 660, type: 'triangle', gain: .06 * near }); break;
        case 'heartPickup': audio.tone(660, .18, { end: 990, type: 'sine', gain: (event.playerId === localId ? .22 : .08) * near }); break;
        case 'loadoutChange': if (event.playerId === localId) audio.tone(392, .15, { end: 523, type: 'triangle', gain: .15 }); break;
        case 'matchEnd': audio.tone(me && event.winner === me.team ? 523 : 262, .6, { end: me && event.winner === me.team ? 1046 : 131, type: 'triangle', gain: .25 }); break;
      }
    } catch {}
  }
}

// ---------- interpolation ----------
/** Online play renders between the two latest snapshots; practice renders the live state. */
function viewState(now = performance.now()) {
  if (!state) return null;
  if (solo || !previous || previous.phase !== state.phase) return state;
  const alpha = Math.max(0, Math.min(1, (now - receivedAt) / snapshotGap));
  const extra = Math.max(0, Math.min(MAX_EXTRAPOLATE_MS, now - receivedAt - snapshotGap)) / 1000;
  const players = state.players.map((player, index) => {
    const before = previous.players[index];
    if (!before || !before.alive || !player.alive || Math.hypot(player.x - before.x, player.y - before.y) > 120) return player;
    return { ...player, x: before.x + (player.x - before.x) * alpha, y: before.y + (player.y - before.y) * alpha };
  });
  const projectiles = state.projectiles.map(shot => ({ ...shot, x: shot.x + shot.vx * extra, y: shot.y + shot.vy * extra }));
  return { ...state, players, projectiles };
}

// ---------- HUD ----------
const fmtTime = ticks => { const s = Math.ceil(ticks / TICK_RATE); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pointChips = new Map();
function ensurePointChips(points) {
  const box = $('ld-points');
  if (pointChips.size === points.length && points.every(point => pointChips.has(point.id))) return;
  box.textContent = ''; pointChips.clear();
  for (const point of points) {
    const chip = document.createElement('span'); chip.className = 'ld-point'; chip.textContent = point.id;
    const bar = document.createElement('i'), fill = document.createElement('em'); bar.append(fill); chip.append(bar);
    box.append(chip); pointChips.set(point.id, { chip, fill });
  }
}
let weaponCards = [];
/** What sits in one inventory slot, for the HUD and the inventory screen. */
function slotItem(me, slot) {
  const id = me.weapons[slot], hearts = me.hearts?.[slot] || 0;
  if (id) { const weapon = WEAPONS[id]; return { kind: 'weapon', id, name: weapon.name, type: weapon.type, icon: iconMarkup(`icon_weapon_${id}`, FAMILY_GLYPH[weapon.family]) }; }
  if (hearts) return { kind: 'hearts', id: 'hearts', name: `Heart × ${hearts}`, type: `Click to heal ${RULES.heart.heal}`, icon: iconMarkup('pickup_heart', '♥'), hearts };
  return { kind: 'empty', id: 'empty', name: 'Empty', type: 'Hearts go here', icon: '<span class="ld-glyph" aria-hidden="true">·</span>' };
}
function buildWeaponCards(me) {
  const key = Array.from({ length: SLOT_COUNT }, (_, slot) => `${me.weapons[slot]}:${me.hearts?.[slot] || 0}`).join(',');
  if ($('ld-weapons').dataset.key === key) return;
  $('ld-weapons').dataset.key = key; $('ld-weapons').textContent = '';
  weaponCards = Array.from({ length: SLOT_COUNT }, (_, slot) => {
    const item = slotItem(me, slot), card = document.createElement('div');
    card.className = 'ld-weapon'; card.dataset.kind = item.kind;
    card.innerHTML = `<kbd>${slot + 1}</kbd>${item.icon}<b></b><small></small><div class="ld-pips"></div><div class="ld-charge"><em></em></div>`;
    card.querySelector('b').textContent = item.name; card.querySelector('small').textContent = item.type;
    $('ld-weapons').append(card);
    return { card, pips: card.querySelector('.ld-pips'), charge: card.querySelector('.ld-charge em'), id: item.kind === 'weapon' ? item.id : null };
  });
}
function iconMarkup(key, glyph) {
  const image = assets.get(key);
  return image ? `<img alt="" src="${image.src}">` : `<span class="ld-glyph" aria-hidden="true">${glyph}</span>`;
}
const percent = value => Math.round(value * 100);
const damageReduction = value => percent(value) > 0 ? `−${percent(value)}%` : percent(value) < 0 ? `+${-percent(value)}%` : '0%';
function armorSpeed(armor) {
  const delta = Math.round((armor.speedMultiplier - 1) * 100);
  return delta > 0 ? `+${delta}%` : delta < 0 ? `−${Math.abs(delta)}%` : '0%';
}
/** Perks and drawbacks an outfit adds on top of the class, as [text, good] pairs. */
const signed = value => `${value > 0 ? '+' : '−'}${Math.abs(percent(value))}%`;
function armorPerkList(armor) {
  const list = [], add = (good, text) => list.push([text, good]);
  if (armor.gunDamage !== 1) add(armor.gunDamage > 1, `Gun damage ${signed(armor.gunDamage - 1)}`);
  if (armor.gunCharge !== 1) add(armor.gunCharge < 1, `Gun charge ${armor.gunCharge < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.gunCharge))}%`);
  if (armor.bladeDamage !== 1) add(armor.bladeDamage > 1, `Sword damage ${signed(armor.bladeDamage - 1)}`);
  if (armor.bladeSpeed !== 1) add(armor.bladeSpeed > 1, `Swings ${armor.bladeSpeed > 1 ? 'faster' : 'slower'} ${Math.abs(percent(armor.bladeSpeed - 1))}%`);
  if (armor.bombDamage !== 1) add(armor.bombDamage > 1, `Bomb damage ${signed(armor.bombDamage - 1)}`);
  if (armor.bombCharge !== 1) add(armor.bombCharge < 1, `Bomb charge ${armor.bombCharge < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.bombCharge))}%`);
  if (armor.maxHp) add(armor.maxHp > 0, `Health ${armor.maxHp > 0 ? '+' : '−'}${Math.abs(armor.maxHp)}`);
  if (armor.dashCooldown !== 1) add(armor.dashCooldown < 1, `Dash recharge ${armor.dashCooldown < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.dashCooldown))}%`);
  if (armor.dashDistance !== 1) add(armor.dashDistance > 1, `Dash ${armor.dashDistance > 1 ? 'longer' : 'shorter'} ${Math.abs(percent(armor.dashDistance - 1))}%`);
  if (armor.abilityCooldown !== 1) add(armor.abilityCooldown < 1, `Ability recharge ${armor.abilityCooldown < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.abilityCooldown))}%`);
  if (armor.knockback !== 1) add(armor.knockback < 1, `Knockback ${armor.knockback < 1 ? '−' : '+'}${Math.abs(percent(1 - armor.knockback))}%`);
  if (armor.statusDuration !== 1) add(armor.statusDuration < 1, `Status effects ${Math.abs(percent(1 - armor.statusDuration))}% ${armor.statusDuration < 1 ? 'shorter' : 'longer'}`);
  if (armor.healing !== 1) add(armor.healing > 1, `Healing ${signed(armor.healing - 1)}`);
  if (armor.walk?.length) add(true, `Walks over ${armor.walk.join(', ').replace('chasm', 'open sky and chasms')}`);
  if (armor.regen) add(true, `Regenerates ${Math.round(armor.regen * armor.healing * 10) / 10} HP/s out of combat`);
  return list;
}
const armorPerks = armor => armorPerkList(armor).map(([text]) => text);
function armorStats(armor) {
  return [`Gun ${damageReduction(armor.gunResistance)} · Sword ${damageReduction(armor.bladeResistance)} · Blast ${damageReduction(armor.bombResistance)} · Speed ${armorSpeed(armor)}`, ...armorPerks(armor)].join(' · ');
}
function armorStatMarkup(armor) {
  const weak = value => value < 0 ? ' class="slower" title="Takes more damage"' : '';
  return `<span${weak(armor.gunResistance)}>Gun <b>${damageReduction(armor.gunResistance)}</b></span><span${weak(armor.bladeResistance)}>Sword <b>${damageReduction(armor.bladeResistance)}</b></span><span${weak(armor.bombResistance)}>Blast <b>${damageReduction(armor.bombResistance)}</b></span><span class="${armor.speedMultiplier > 1 ? 'faster' : armor.speedMultiplier < 1 ? 'slower' : ''}">Speed <b>${armorSpeed(armor)}</b></span>${armorPerkList(armor).map(([text, good]) => `<span class="perk ${good ? 'good' : 'bad'}">${good ? '▲' : '▼'} ${text}</span>`).join('')}`;
}
const feedSeen = new Set();
function pushFeed(current) {
  const feed = $('ld-feed');
  for (const event of current.events || []) {
    if (event.type !== 'kill' && event.type !== 'capture' || feedSeen.has(event.id)) continue;
    feedSeen.add(event.id);
    if (current.tick - event.tick > TICK_RATE * 4) continue;
    const item = document.createElement('li');
    const name = id => { const player = current.players[id]; const span = document.createElement('span'); span.className = player?.team === 0 ? 'a' : 'c'; span.textContent = player?.name ?? '—'; return span; };
    if (event.type === 'kill') { if (event.playerId !== null && event.playerId !== undefined) item.append(name(event.playerId), ' ⚔ '); item.append(name(event.targetId)); }
    else { const span = document.createElement('span'); span.className = event.team === 0 ? 'a' : 'c'; span.textContent = `${TEAM_COLORS[event.team].name} took ${event.pointId}`; item.append(span); }
    feed.prepend(item);
    setTimeout(() => item.remove(), 5000);
    while (feed.children.length > 6) feed.lastElementChild.remove();
  }
}
function updateHud(current) {
  for (const team of [0, 1]) {
    $(`ld-score${team}`).textContent = current.scores[team];
    $(`ld-bar${team}`).style.width = `${Math.min(100, current.scores[team] / RULES.scoreToWin * 100)}%`;
  }
  $('ld-timer').textContent = fmtTime(current.timeLeftTicks);
  matchEndingCues(current);
  ensurePointChips(current.points);
  for (const point of current.points) {
    const { chip, fill } = pointChips.get(point.id);
    chip.dataset.owner = point.owner ?? 'none';
    chip.dataset.contested = String(!!(point.counts && point.counts[0] && point.counts[1]));
    fill.style.width = `${Math.abs(point.progress)}%`;
    fill.style.background = point.progress >= 0 ? TEAM_COLORS[0].main : TEAM_COLORS[1].main;
  }
  const me = current.players[localId ?? -1];
  if (me) {
    $('ld-class').textContent = CLASSES[me.cls].name.toUpperCase();
    const gear = combineGear(me);
    $('ld-armor-name').textContent = gear.name;
    $('ld-armor-stats').textContent = armorStats(gear);
    $('ld-hp').textContent = `${Math.max(0, Math.ceil(me.alive ? me.hp : 0))} / ${me.maxHp}`;
    $('ld-hp-bar').style.width = `${me.alive ? Math.max(0, me.hp / me.maxHp * 100) : 0}%`;
    // The class ability: Striker Boost and Recon Cloak have cooldowns; the Guardian's shield has health.
    // Striker Boost shows its nitro meter (the dark part is what is used up); Cloak shows its cooldown.
    const ability = { striker: [me.boostLocked ? 'Boost (recharging)' : 'Boost (hold)', ABILITIES.dash.meter, me.boosting], guardian: ['Shield (hold)', 1, me.guarding], recon: ['Cloak', ABILITIES.cloak.cooldown, me.cloakTicks > 0] }[me.cls];
    $('ld-ability1-name').textContent = ability[0];
    $('ld-ability1').dataset.active = String(ability[2]);
    $('ld-ability1').dataset.locked = String(me.cls === 'striker' && !!me.boostLocked);
    const used = me.cls === 'guardian' ? 0 : me.cls === 'striker' ? 1 - (me.boostMeter ?? ABILITIES.dash.meter) / ABILITIES.dash.meter : me.abilityCooldown / ability[1];
    $('ld-ability1').querySelector('em').style.transform = `scaleX(${Math.max(0, Math.min(1, used))})`;
    $('ld-guard').hidden = me.cls !== 'guardian';
    $('ld-dash').querySelector('em').style.transform = `scaleX(${(me.dashCooldown || 0) / RULES.dash.cooldown})`;
    $('ld-dash').dataset.active = String(me.dodgeTicks > 0);
    const guardMax = GUARD.max;
    // Two layers: the dome (covers teammates) and, once it breaks, the Guardian's own shield.
    const domeLeft = !me.domeBroken && (me.domeHp ?? GUARD.domeMax) > 0;
    $('ld-guard-label').textContent = me.guardBroken ? 'Shield broken' : domeLeft ? 'Dome' : me.domeBroken ? 'Dome down · Shield' : 'Shield';
    $('ld-dome-bar').style.width = `${Math.max(0, (me.domeHp ?? GUARD.domeMax) / GUARD.domeMax * 100)}%`;
    $('ld-guard-bar').style.width = `${Math.max(0, (me.guardHp ?? guardMax) / guardMax * 100)}%`;
    $('ld-guard').dataset.state = me.guardBroken ? 'broken' : me.guarding ? 'up' : 'ready';
    $('ld-guard').dataset.dome = me.domeBroken ? 'broken' : 'ok';
    $('ld-statuses').textContent = STATUS_IDS.filter(id => me.status?.[id] > 0).map(id => `${STATUS[id].name}${id === 'chill' ? ` ${me.chillStacks}/${STATUS.chill.freezeAt}` : ''} ${Math.ceil(me.status[id] / TICK_RATE)}s${id === 'curse' ? ' (no dash or ability)' : ''}`).join(' · ');
    buildWeaponCards(me);
    renderInventory();
    weaponCards.forEach((card, slot) => {
      const weapon = WEAPONS[card.id];
      card.card.dataset.active = String(slot === me.slot);
      if (!weapon) { card.pips.textContent = ''; card.charge.style.width = '0%'; return; }
      const pips = weapon.family === 'gun' ? weapon.clip : 0, have = me.clips?.[card.id] ?? 0;
      if (card.pips.childElementCount !== pips) { card.pips.textContent = ''; for (let i = 0; i < pips; i++) card.pips.append(document.createElement('i')); }
      [...card.pips.children].forEach((pip, index) => pip.classList.toggle('empty', index >= have || (me.reloadTicks?.[card.id] ?? 0) > 0));
      const needed = Engine.chargeTicksFor(me, weapon);
      card.charge.style.width = slot === me.slot && me.charging ? `${Math.min(100, me.chargeTicks / needed * 100)}%` : '0%';
      card.charge.style.background = slot === me.slot && me.chargeTicks >= needed ? '#ffffff' : '';
    });
  }
  // Big centre banner: countdown, respawn, result.
  const banner = $('ld-banner');
  let text = '', sub = '';
  if (current.phase === 'countdown') { text = String(Math.ceil(current.phaseTicks / TICK_RATE)); sub = `${current.mapName} — take the points!`; }
  else if (current.phase === 'fight' && me && !me.alive) { text = `Respawn in ${Math.ceil(me.respawnTicks / TICK_RATE)}`; sub = 'Press B to change class or equipment before you return.'; }
  // (The end of the match has its own finale, below.)
  banner.hidden = !text;
  const base = me && me.alive && current.phase === 'fight' && Engine.inBase(current, me);
  $('ld-base-hint').hidden = !(base && !menuOpen) && performance.now() > baseHintFlash;
  const hint = $('ld-base-hint'), [label, status, action] = hint.children;
  for (const button of hint.querySelectorAll('[data-base-class]')) button.setAttribute('aria-pressed', String(me && button.dataset.baseClass === me.cls));
  hint.querySelector('.ld-base-classes').hidden = !base;
  hint.classList.toggle('away', !base);
  label.textContent = base ? 'IN BASE' : 'LOADOUT';
  status.textContent = base ? (me.hp < me.maxHp ? 'Healing' : 'Full health') : 'Go back to your base to change class or equipment';
  action.hidden = !base;
  if (boardOpen && performance.now() - boardDrawn > 250) { boardDrawn = performance.now(); $('ld-board').hidden = false; $('ld-board').replaceChildren(scoreTables(current)); }
  if (text && (banner.dataset.text !== text + sub)) { banner.dataset.text = text + sub; banner.textContent = text; const small = document.createElement('small'); small.textContent = sub; banner.append(small); }
  renderer.drawMinimap(minimap, current, { localId });
  if (bigMapOpen) renderer.drawMinimap($('ld-bigmap-canvas'), current, { localId, detailed: true });
  pushFeed(current);
}

// ---------- menu ----------
function toggleMenu(force) {
  menuOpen = typeof force === 'boolean' ? force : !menuOpen;
  if (state && state.phase === 'lobby') menuOpen = true;
  app.dataset.menu = menuOpen ? 'open' : 'closed';
  held.clear(); pressed.clear(); mouse.left = mouse.right = false;
  if (!menuOpen) { canvas.focus(); lockMouse(); } else unlockMouse();
  renderMenu();
}
function buildMenu() {
  // Class stations in the base: one click switches class without opening the menu.
  for (const button of document.querySelectorAll('[data-base-class]')) button.addEventListener('click', event => {
    event.stopPropagation(); if (!canChangeLoadout()) return;
    const id = button.dataset.baseClass, keepWeapons = !Object.values(DEFAULT_LOADOUTS).some(loadout => loadout.join() === setup.weapons.join());
    chooseSetup(keepWeapons ? { cls: id } : { cls: id, weapons: [...DEFAULT_LOADOUTS[id]] });
    canvas.focus();
  });
  $('ld-name').value = getName();
  $('ld-name').addEventListener('change', () => {
    const name = saveName($('ld-name').value); $('ld-name').value = name;
    if (solo) applySetupLocally(); else send({ type: 'join', name });
  });
  for (const button of document.querySelectorAll('.ld-team-button')) button.addEventListener('click', () => chooseSetup({ team: Number(button.dataset.team) }));
  const classes = $('ld-classes');
  for (const cls of Object.values(CLASSES)) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'ld-class-card'; card.dataset.cls = cls.id;
    card.innerHTML = `<span class="ld-class-icon"></span><b></b><small></small>`;
    card.querySelector('b').textContent = cls.name;
    card.querySelector('small').textContent = `${cls.hp} HP · ${cls.ability}`;
    card.addEventListener('click', () => {
      // Picking a class also offers its signature loadout unless you already customised one.
      const defaults = Object.values(DEFAULT_LOADOUTS).some(loadout => loadout.join() === setup.weapons.join());
      chooseSetup(defaults ? { cls: cls.id, weapons: [...DEFAULT_LOADOUTS[cls.id]] } : { cls: cls.id });
    });
    classes.append(card);
  }
  // Equipment: one tab per slot (helmet, armour, pants, shoes); every piece is a card.
  for (const tab of document.querySelectorAll('[data-gear-tab]')) tab.addEventListener('click', () => { gearTab = tab.dataset.gearTab; buildGearCards(); renderMenu(); });
  $('ld-gear-random').addEventListener('click', () => {
    if (!canChangeLoadout()) return;
    const pick = slot => { const ids = Object.keys(GEAR[slot]); return ids[Math.floor(Math.random() * ids.length)]; };
    chooseSetup(Object.fromEntries(GEAR_SLOTS.map(slot => [slot, pick(slot)])));
  });
  $('ld-gear-clear').addEventListener('click', () => { if (canChangeLoadout()) chooseSetup(Object.fromEntries(GEAR_SLOTS.map(slot => [slot, 'none']))); });
  buildGearCards();
  // Weapons: four slot buttons with thumbnails; each opens the Armory to pick what goes in it.
  const loadout = $('ld-loadout');
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ld-slot-button'; button.dataset.slot = slot;
    button.addEventListener('click', () => openArmory(slot));
    button.addEventListener('pointerenter', () => { previewWeapon = (state?.players[localId ?? -1]?.weapons ?? setup.weapons)[slot] || previewWeapon; updatePreview(); });
    loadout.append(button);
  }
  $('ld-armory-open').addEventListener('click', () => openArmory(null));
  $('ld-armory-close').addEventListener('click', () => closeArmory());
  for (const tab of document.querySelectorAll('[data-family]')) tab.addEventListener('click', () => { armory.family = tab.dataset.family; renderArmory(); });
  const botSelect = $('ld-bots');
  for (const [id, level] of Object.entries(Engine.BOT_LEVELS)) botSelect.append(new Option(level.label, id));
  botSelect.addEventListener('change', () => {
    if (solo) { const result = Engine.selectBotLevel(state, botSelect.value); if (!result.ok) setStatus(result.error); renderMenu(); }
    else send({ type: 'lockdown-bots', level: botSelect.value });
  });
  const moodSelect = $('ld-aggression');
  for (const [id, mood] of Object.entries(Engine.BOT_AGGRESSION)) moodSelect.append(new Option(mood.label, id));
  moodSelect.addEventListener('change', () => {
    if (solo) { const result = Engine.selectBotAggression(state, moodSelect.value); if (!result.ok) setStatus(result.error); renderMenu(); }
    else send({ type: 'lockdown-bot-aggression', aggression: moodSelect.value });
  });
  // Bot classes: one choice for the enemy's bots and one for your own team's (relative to the team you are on).
  const classLabel = id => id === 'mix' ? 'Mixed classes' : `All ${CLASSES[id].name}s`;
  for (const [selectId, side] of [['ld-foe-class', 1], ['ld-ally-class', 0]]) {
    const select = $(selectId);
    for (const id of Engine.BOT_CLASS_CHOICES) select.append(new Option(classLabel(id), id));
    select.addEventListener('change', () => {
      const myTeam = state?.players[localId ?? -1]?.team ?? setup.team ?? 0, team = side ? 1 - myTeam : myTeam;
      if (solo) { const result = Engine.selectBotClass(state, team, select.value); if (!result.ok) setStatus(result.error); renderMenu(); }
      else send({ type: 'lockdown-bot-class', team, cls: select.value });
    });
  }
  const sizeSelect = $('ld-size');
  for (const size of Engine.TEAM_SIZES) sizeSelect.append(new Option(`${Engine.MODE_RULES[size].label}${size === 4 ? ' · three zones' : ' · middle zone'}`, String(size)));
  sizeSelect.addEventListener('change', () => {
    const size = Number(sizeSelect.value);
    if (solo) { const result = Engine.selectTeamSize(state, size); if (!result.ok) setStatus(result.error); renderMenu(); }
    else send({ type: 'lockdown-mode', teamSize: size });
  });
  const mapSelect = $('ld-map');
  for (const id of MAP_IDS) mapSelect.append(new Option(MAPS[id].name, id));
  mapSelect.addEventListener('change', () => {
    if (solo) { soloMapId = mapSelect.value; Engine.selectMap(state, soloMapId); renderMenu(); }
    else send({ type: 'lockdown-map', mapId: mapSelect.value });
  });
  $('ld-start').addEventListener('click', () => {
    enableAudio();
    if (!state) return;
    if (state.phase === 'matchEnd') { if (solo) { Engine.resetLobby(state); applySetupLocally(); } else send({ type: 'rematch' }); renderMenu(); return; }
    if (solo) { applySetupLocally(); Engine.startMatch(state, [0]); toggleMenu(false); }
    else send({ type: 'start' });
  });
  $('ld-resume').addEventListener('click', () => toggleMenu(false));
  $('ld-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); setStatus('Invite link copied.'); } catch { setStatus(location.href, true); }
  });
  if (!solo) { $('ld-room-box').hidden = false; $('ld-room-code').textContent = roomId; }
}
function buildGearCards() {
  const list = $('ld-armors'); list.textContent = ''; list.setAttribute('aria-label', GEAR_LABELS[gearTab]);
  for (const [id, piece] of Object.entries(GEAR[gearTab])) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'ld-armor-card'; card.dataset.armor = id; card.dataset.slot = gearTab;
    card.innerHTML = '<span class="ld-armor-icon"></span><b class="ld-armor-title"></b><span class="ld-armor-tradeoffs"></span>';
    card.querySelector('.ld-armor-icon').innerHTML = gearIcon(gearTab, id);
    card.querySelector('.ld-armor-title').textContent = piece.name;
    card.querySelector('.ld-armor-tradeoffs').innerHTML = armorStatMarkup(piece);
    card.title = piece.description;
    card.setAttribute('aria-label', `${piece.name}. ${piece.description} ${armorStats(piece)}.`);
    card.addEventListener('click', () => chooseSetup({ [gearTab]: id }));
    list.append(card);
  }
}
// ---------- armory: every weapon, what it does, and picking one for a slot ----------
// One click on a weapon puts it in the slot being filled (picked in the bar above the grid); the knight on
// the right holds it and shows it off.
const armory = { open: false, slot: 0, family: 'all', selected: null };
function openArmory(slot) {
  const weapons = setup.weapons;
  armory.open = true; armory.slot = slot ?? Math.max(0, weapons.indexOf(null));
  armory.selected = weapons[armory.slot] || armory.selected || WEAPON_IDS[0];
  if (weapons[armory.slot]) armory.family = WEAPONS[weapons[armory.slot]].family;
  $('ld-armory').hidden = false; renderArmory();
}
function closeArmory() { armory.open = false; $('ld-armory').hidden = true; if (armory.selected) previewWeapon = armory.selected; updatePreview(); }
const seconds = ticks => `${(ticks / TICK_RATE).toFixed(ticks < TICK_RATE ? 2 : 1)} s`;
/** Plain numbers for the detail card, by family. */
function weaponStats(weapon) {
  if (weapon.family === 'blade') {
    const combo = weapon.combo, time = combo.reduce((sum, move) => sum + move.startup + move.active + move.recovery, 0);
    const cut = CUTS[weapon.cut], degrees = combo.map(move => Math.round(move.arc * 180 / Math.PI));
    return [['Aim', Engine.aimRating(weapon).note], ['Cut', `${cut.label}: ${cut.note}`], ['Combo', combo.map(move => Engine.MOVE_KINDS[move.kind]?.label || 'sweep').join(' → ')], ['Arc', `${[...new Set(degrees)].join('° / ')}°`], ['Damage per cut', combo.map(move => move.strokes > 1 ? `${move.strokes}×${move.damage}` : move.damage).join(' / ')], ['Perfect combo', combo.length > 1 ? `land every cut on one knight: the last ${combo.at(-1).critical ? `is a critical, +${Math.round((Engine.CRITICAL - 1) * 100)}%` : `hits +${Math.round(Engine.BLADE.combo.perCut * (combo.length - 1) * 100)}%`}` : '—'], ['Full combo', `${combo.length} cuts in ${seconds(time)}`], ['Reach', `${Math.max(...combo.map(move => move.reach))}`], ['Charge', seconds(weapon.chargeTicks)]];
  }
  if (weapon.family === 'gun') return [['Aim', Engine.aimRating(weapon).note], ['Damage per shot', String(weapon.damage)], ['Clip', `${weapon.clip} · ${(TICK_RATE / weapon.interval).toFixed(1)} shots/s`], ['Range', String(weapon.range)], ['Reload', seconds(weapon.reload)], ['Charge', seconds(weapon.chargeTicks)]];
  return [['Blast', weapon.cloud ? `${weapon.cloud.status} cloud, ${seconds(weapon.cloud.ticks)}` : `${weapon.damage} damage`], ['Radius', String(weapon.cloud?.radius || weapon.radius)], ['Fuse', seconds(weapon.fuse)], ['Charge', seconds(weapon.chargeTicks)]];
}
function renderArmory() {
  if (!armory.open) return;
  for (const tab of document.querySelectorAll('[data-family]')) tab.setAttribute('aria-selected', String(tab.dataset.family === armory.family));
  const grid = $('ld-armory-grid'), carried = setup.weapons, editable = canChangeLoadout();
  // Only rebuild when something shown changed, so cards stay clickable between refreshes.
  const key = [armory.family, armory.selected, armory.slot, carried.join(), editable, assets.version].join('|');
  if (grid.dataset.key === key) { updatePreview(); return; }
  grid.dataset.key = key;
  grid.textContent = '';
  const bar = $('ld-armory-slots'); bar.textContent = '';
  const label = document.createElement('span'); label.className = 'ld-armory-slots-label';
  label.textContent = editable ? `Click a weapon to put it in slot ${armory.slot + 1}` : 'Return to your base to change weapons'; bar.append(label);
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const id = carried[slot], button = document.createElement('button');
    button.type = 'button'; button.setAttribute('aria-pressed', String(slot === armory.slot)); button.disabled = !editable;
    button.innerHTML = `<kbd>${slot + 1}</kbd>${id ? iconMarkup(`icon_weapon_${id}`, FAMILY_GLYPH[WEAPONS[id].family]) : '<span class="ld-glyph" aria-hidden="true">+</span>'}<span><b></b><small></small></span>`;
    button.querySelector('b').textContent = id ? WEAPONS[id].name : 'Empty';
    button.querySelector('small').textContent = id ? WEAPONS[id].type : 'Room for hearts';
    button.addEventListener('click', () => { armory.slot = slot; if (id) armory.selected = id; renderArmory(); });
    bar.append(button);
  }
  for (const id of WEAPON_IDS.filter(id => armory.family === 'all' || WEAPONS[id].family === armory.family)) {
    const weapon = WEAPONS[id], note = WEAPON_NOTES[id], card = document.createElement('button');
    card.type = 'button'; card.className = 'ld-armory-card'; card.dataset.weapon = id;
    card.setAttribute('aria-pressed', String(armory.selected === id));
    const slot = carried.indexOf(id);
    card.innerHTML = `${iconMarkup(`icon_weapon_${id}`, FAMILY_GLYPH[weapon.family])}<b></b><small></small><span class="ld-difficulty" title="Difficulty">${'●'.repeat(note.difficulty)}${'○'.repeat(3 - note.difficulty)}</span>${slot >= 0 ? `<kbd class="ld-carried">${slot + 1}</kbd>` : ''}`;
    card.querySelector('b').textContent = weapon.name;
    card.querySelector('small').textContent = `${weapon.type}${ELEMENT_TAGS[weapon.element] ? ` · ${ELEMENT_TAGS[weapon.element]}` : ''}`;
    card.title = canChangeLoadout() ? `Put ${weapon.name} in slot ${armory.slot + 1}` : weapon.name;
    card.addEventListener('click', () => {
      const again = armory.selected === id && setup.weapons[armory.slot] === id; armory.selected = id;
      if (canChangeLoadout() && setup.weapons[armory.slot] !== id) equipFromArmory(id, armory.slot); else renderArmory();
      if (again) preview?.replay();
    });
    grid.append(card);
  }
  const id = armory.selected, weapon = WEAPONS[id], note = WEAPON_NOTES[id], detail = $('ld-armory-detail');
  if (!weapon) { detail.textContent = ''; return; }
  const list = (items, kind) => items.map(text => `<li class="${kind}">${kind === 'pro' ? '▲' : '▼'} ${text}</li>`).join('');
  detail.innerHTML = `<div class="ld-armory-stage" title="Drag to turn"></div><div class="ld-armory-hero">${iconMarkup(`icon_weapon_${id}`, FAMILY_GLYPH[weapon.family])}<div><h3></h3><p class="ld-armory-type"></p></div></div>
    <p class="ld-armory-desc"></p>
    <dl class="ld-armory-stats">${weaponStats(weapon).map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}<dt>Difficulty</dt><dd>${['', 'Easy', 'Medium', 'Hard'][note.difficulty]}</dd></dl>
    <ul class="ld-armory-notes">${list(note.pros, 'pro')}${list(note.cons, 'con')}</ul>
    ${carried[armory.slot] ? `<button type="button" class="ld-armory-clear" data-clear="${armory.slot}"${editable ? '' : ' disabled'}>Empty slot ${armory.slot + 1}</button>` : ''}`;
  detail.querySelector('h3').textContent = weapon.name;
  detail.querySelector('.ld-armory-type').textContent = `${weapon.type}${ELEMENT_TAGS[weapon.element] ? ` · ${ELEMENT_TAGS[weapon.element]}` : ''}`;
  detail.querySelector('.ld-armory-desc').textContent = weapon.description;
  detail.querySelector('[data-clear]')?.addEventListener('click', () => {
    const weapons = [...setup.weapons]; weapons[armory.slot] = null;
    if (!weapons.some(Boolean)) { setStatus('Carry at least one weapon.'); return; }
    chooseSetup({ weapons });
  });
  updatePreview();
}
/** Put a weapon in a slot; if it is already carried elsewhere the two slots swap. */
function equipFromArmory(id, slot) {
  const weapons = [...setup.weapons], other = weapons.indexOf(id);
  if (other >= 0 && other !== slot) weapons[other] = weapons[slot];
  weapons[slot] = id; armory.slot = slot; previewWeapon = id;
  chooseSetup({ weapons }); showWeaponNote(id);
}

// ---------- the knight preview: your class and gear, holding the weapon you are looking at ----------
let preview = null, previewWeapon = null;
async function setupPreview() {
  try { const { KnightPreview } = await import('./lockdown-renderer3d.js'); preview = new KnightPreview(); updatePreview(); }
  catch (problem) { console.warn('The knight preview needs WebGL.', problem); $('ld-preview').hidden = true; }
}
function updatePreview() {
  if (!preview) return;
  const me = state?.players[localId ?? -1], weapons = me?.weapons ?? setup.weapons;
  const weapon = armory.open ? armory.selected : weapons.includes(previewWeapon) ? previewWeapon : weapons.find(Boolean);
  preview.show({ team: me?.team ?? setup.team, cls: me?.cls ?? setup.cls, ...gearOf(me ?? setup), weapon });
  const home = armory.open ? $('ld-armory-detail').querySelector('.ld-armory-stage') : $('ld-preview');
  if (home && preview.canvas.parentNode !== home) home.append(preview.canvas);
}

// ---------- inventory (I): drag and drop to reorder the four slots ----------
let inventoryOpen = false, dragFrom = null;
function toggleInventory(force) {
  inventoryOpen = typeof force === 'boolean' ? force : !inventoryOpen;
  $('ld-inventory').hidden = !inventoryOpen; dragFrom = null;
  if (inventoryOpen) { held.delete('attack'); held.delete('ability'); unlockMouse(); renderInventory(); } else { canvas.focus(); lockMouse(); }
}
function reorder(from, to) {
  if (from === to) return;
  const order = [...Array(SLOT_COUNT).keys()]; order[from] = to; order[to] = from; // swap the two slots
  if (solo) { const result = Engine.reorderInventory(state, localId ?? 0, order); if (!result.ok) setStatus(result.error); }
  else send({ type: 'lockdown-inventory', order });
}
function renderInventory() {
  if (!inventoryOpen) return;
  const me = viewState()?.players[localId ?? -1], grid = $('ld-inventory-slots');
  if (!me) return;
  const key = Array.from({ length: SLOT_COUNT }, (_, slot) => `${me.weapons[slot]}:${me.hearts?.[slot] || 0}`).join(',') + `|${me.slot}`;
  if (grid.dataset.key === key) return;
  grid.dataset.key = key; grid.textContent = '';
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const item = slotItem(me, slot), cell = document.createElement('div');
    cell.className = 'ld-inv-slot'; cell.dataset.slot = slot; cell.dataset.kind = item.kind; cell.dataset.active = String(slot === me.slot);
    cell.draggable = item.kind !== 'empty';
    cell.innerHTML = `<kbd>${slot + 1}</kbd>${item.icon}<b></b><small></small>`;
    cell.querySelector('b').textContent = item.name; cell.querySelector('small').textContent = item.type;
    if (item.kind === 'hearts') cell.querySelector('b').insertAdjacentHTML('beforeend', ` <span class="ld-heart-pips">${'♥'.repeat(item.hearts)}${'♡'.repeat(RULES.heart.stack - item.hearts)}</span>`);
    // Mouse drag and drop (HTML5), plus pointer fallback for touch screens.
    cell.addEventListener('dragstart', event => { dragFrom = slot; cell.classList.add('dragging'); event.dataTransfer?.setData('text/plain', String(slot)); });
    cell.addEventListener('dragend', () => { cell.classList.remove('dragging'); dragFrom = null; });
    cell.addEventListener('dragover', event => { event.preventDefault(); cell.classList.add('over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('over'));
    cell.addEventListener('drop', event => { event.preventDefault(); cell.classList.remove('over'); const from = dragFrom ?? Number(event.dataTransfer?.getData('text/plain')); if (Number.isInteger(from)) reorder(from, slot); dragFrom = null; });
    cell.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse') dragFrom = slot; });
    cell.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse' && dragFrom !== null) { reorder(dragFrom, slot); dragFrom = null; } });
    grid.append(cell);
  }
}
function showWeaponNote(id) { const weapon = WEAPONS[id]; if (weapon) $('ld-weapon-note').textContent = `${weapon.name}: ${weapon.description}`; }
function chooseSetup(change) {
  if (inMatch() && !canChangeLoadout()) { flashBaseHint(); setStatus('Return to your base to change class or equipment.'); return; }
  const changedWeapon = change.weapons?.find((id, slot) => id !== setup.weapons[slot]);
  const nextSetup = { ...setup, ...change };
  if (inMatch()) {
    // Mid-match changes apply straight away, but only in base (the engine checks too).
    const { team, ...loadout } = change;
    if (solo) { const result = Engine.setPlayerSetup(state, 0, loadout); if (!result.ok) { setStatus(result.error); renderMenu(); return; } }
    else send({ type: 'lockdown-setup', ...loadout });
    nextSetup.team = setup.team;
  } else if (solo) {
    const result = Engine.setPlayerSetup(state, 0, { ...nextSetup, name: getName() });
    if (!result.ok) { setStatus(result.error); renderMenu(); return; }
  }
  else send({ type: 'lockdown-setup', ...change });
  Object.assign(setup, nextSetup); storeSetup();
  if (solo) rememberAuthoritativeSetup(state.players[0]);
  if (changedWeapon) showWeaponNote(changedWeapon);
  if (change.cls) $('ld-class-note').textContent = `${CLASSES[setup.cls].perks}. ${CLASSES[setup.cls].description}`;
  renderMenu();
}
function refreshIcons() {
  for (const card of document.querySelectorAll('.ld-class-card')) card.querySelector('.ld-class-icon').innerHTML = iconMarkup(`icon_class_${card.dataset.cls}`, CLASS_GLYPH[card.dataset.cls]);
  for (const card of document.querySelectorAll('.ld-armor-card')) card.querySelector('.ld-armor-icon').innerHTML = gearIcon(card.dataset.slot, card.dataset.armor);
  // Weapon slots and the Armory grid cache their markup: clear the caches so the new icons show.
  for (const button of document.querySelectorAll('.ld-slot-button')) button.dataset.key = '';
  const grid = $('ld-armory-grid'); if (grid) grid.dataset.key = '';
  if (menuBuilt) renderMenu();
}
// Icons can finish loading before the menu (and the game state) exist; `var` so the check is safe that early.
var menuBuilt = false;
const inMatch = () => state?.phase === 'countdown' || state?.phase === 'fight';
function canChangeLoadout() {
  const me = state?.players[localId ?? -1];
  if (state && Engine.isDojo(state)) return true;
  return !inMatch() || !!me && (!me.alive || Engine.inBase(state, me));
}
let baseHintFlash = 0;
function flashBaseHint() { baseHintFlash = performance.now() + 1800; }
function renderMenu() {
  const me = state?.players[localId ?? -1];
  const phase = state?.phase ?? 'lobby';
  app.dataset.phase = phase;
  const team = me?.team ?? setup.team, cls = me?.cls ?? setup.cls, gear = gearOf(me ?? setup), weapons = me?.weapons ?? setup.weapons;
  const lobby = phase === 'lobby' || phase === 'matchEnd', editable = canChangeLoadout();
  for (const button of document.querySelectorAll('.ld-team-button')) { button.setAttribute('aria-pressed', String(Number(button.dataset.team) === team)); button.disabled = !lobby; }
  for (const card of document.querySelectorAll('.ld-class-card')) {
    const choice = CLASSES[card.dataset.cls];
    card.setAttribute('aria-pressed', String(choice.id === cls)); card.disabled = !editable;
    card.querySelector('small').textContent = `${Engine.maxHpFor(choice.id, gear)} HP · ${choice.ability}`;
  }
  for (const card of document.querySelectorAll('.ld-armor-card')) { card.setAttribute('aria-pressed', String(card.dataset.armor === gear[card.dataset.slot])); card.disabled = !editable; }
  for (const tab of document.querySelectorAll('[data-gear-tab]')) {
    tab.setAttribute('aria-selected', String(tab.dataset.gearTab === gearTab));
    tab.querySelector('small').textContent = GEAR[tab.dataset.gearTab][gear[tab.dataset.gearTab]].name;
  }
  $('ld-gear-random').disabled = $('ld-gear-clear').disabled = !editable;
  const total = combineGear(gear), piece = GEAR[gearTab][gear[gearTab]];
  $('ld-armor-summary').textContent = `${piece.name}: ${piece.description}`;
  $('ld-armor-summary-stats').innerHTML = `<b>Whole build</b> (${total.name}): ${Engine.maxHpFor(cls, gear)} max HP (${CLASSES[cls].hp} class ${total.maxHp >= 0 ? '+' : '−'} ${Math.abs(total.maxHp)} equipment) · ${armorStatMarkup(total)}`;
  [...$('ld-loadout').querySelectorAll('.ld-slot-button')].forEach((button, slot) => {
    const id = weapons[slot], weapon = WEAPONS[id], key = `${id}:${editable}`;
    if (button.dataset.key === key) return;
    button.dataset.key = key; button.disabled = !editable;
    button.innerHTML = `<kbd>${slot + 1}</kbd>${weapon ? iconMarkup(`icon_weapon_${id}`, FAMILY_GLYPH[weapon.family]) : '<span class="ld-glyph" aria-hidden="true">+</span>'}<b></b><small></small>`;
    button.querySelector('b').textContent = weapon ? weapon.name : 'Empty';
    button.querySelector('small').textContent = weapon ? `${weapon.type}${ELEMENT_TAGS[weapon.element] ? ` · ${ELEMENT_TAGS[weapon.element]}` : ''}` : 'Room for hearts';
    button.setAttribute('aria-label', `Slot ${slot + 1}: ${weapon ? weapon.name : 'empty'}. Choose in the Armory.`);
  });
  if (armory.open) renderArmory(); else updatePreview();
  const note = $('ld-base-note');
  note.hidden = lobby;
  if (!lobby) {
    note.classList.toggle('away', !editable);
    note.textContent = Engine.isDojo(state) ? 'Dojo: change class, gear and weapons any time with B. Changes apply right away.' : !me?.alive ? 'Waiting to respawn: class and equipment changes apply when you return.' : editable ? 'You are in your base: class and equipment changes apply right away. Teams stay fixed until the next lobby.' : 'Return to your base to change class or equipment. Your base also heals you.';
  }
  $('ld-class-note').textContent = `${CLASSES[cls].perks}. ${CLASSES[cls].description}`;
  if (!$('ld-weapon-note').textContent) showWeaponNote(weapons[0]);
  const isHost = solo || hostId === localId;
  const mapId = state?.mapId ?? soloMapId;
  $('ld-map').value = mapId; $('ld-map').disabled = !isHost || phase !== 'lobby';
  const size = state?.teamSize || 4, sizeLabel = Engine.MODE_RULES[size].label.toUpperCase();
  $('ld-size').value = String(size); $('ld-size').disabled = !isHost || phase !== 'lobby'; $('ld-size-field').hidden = !!dojo;
  $('ld-bots').value = state?.botLevel || 'normal'; $('ld-bots').disabled = !isHost || phase !== 'lobby'; $('ld-bots-field').hidden = !!dojo;
  $('ld-aggression').value = state?.botAggression || 'balanced'; $('ld-aggression').disabled = !isHost || phase !== 'lobby'; $('ld-aggression-field').hidden = !!dojo;
  const myTeam = state?.players[localId ?? -1]?.team ?? setup.team ?? 0, botClasses = state?.botClasses || ['mix', 'mix'];
  $('ld-foe-class').value = botClasses[1 - myTeam]; $('ld-ally-class').value = botClasses[myTeam];
  for (const id of ['ld-foe-class', 'ld-ally-class']) $(id).disabled = !isHost || phase !== 'lobby';
  $('ld-foe-class-field').hidden = !!dojo;
  $('ld-ally-class-field').hidden = !!dojo || (solo && size === 1); // a solo 1v1 has no bots on your side
  if (!dojo) $('ld-lede').textContent = `${size === 4 ? 'Capture and hold the three control points. Every five seconds your team scores for the points it holds' : `${Engine.MODE_RULES[size].label}: fight over the middle zone alone. Every five seconds the team holding it scores ${Engine.MODE_RULES[size].scoreTable[1]}`}: first to ${Engine.RULES.scoreToWin} wins. Bots fill every empty place. Your base heals you, and it is where you change class and equipment mid-match. Every knockout drops a heart.`;
  $('ld-mode').textContent = dojo ? 'DOJO · TRAINING' : solo ? `PRACTICE · ${sizeLabel} · YOU + ${size * 2 - 1} BOT${size * 2 - 1 === 1 ? '' : 'S'}` : `ONLINE ROOM · ${sizeLabel}`;
  $('ld-map-note').textContent = `${MAPS[mapId].description}${isHost ? '' : ' The host picks the map.'}`;
  const start = $('ld-start');
  start.textContent = phase === 'matchEnd' ? (solo ? 'New match' : 'Back to the lobby') : 'Start match';
  start.hidden = !(phase === 'lobby' || phase === 'matchEnd');
  start.disabled = !isHost || !state || (!solo && !connected);
  if (!isHost && (phase === 'lobby' || phase === 'matchEnd')) setStatus('Waiting for the host to start…', true);
  $('ld-resume').hidden = !(phase === 'countdown' || phase === 'fight');
  $('ld-resume').textContent = dojo ? 'Train' : 'Back to the fight';
  // Roster: everyone in seat order, bots greyed.
  const roster = $('ld-roster'); roster.textContent = '';
  // In the lobby, the seats the mode will play; in a match, everyone in it.
  const seats = state?.teamSize || 4, playing = player => state.phase === 'lobby' ? player.human || state.players.filter(other => other.team === player.team && (other.human || other.id < player.id)).length < seats : !player.benched || player.human;
  for (const player of (state?.players ?? []).filter(player => playing(player))) {
    const item = document.createElement('li');
    item.className = `t${player.team}${player.human ? '' : ' bot'}`;
    item.textContent = `${player.human ? player.name : 'Bot'}${player.id === localId ? ' (you)' : ''}${player.id === hostId && !solo ? ' ★' : ''} · ${CLASSES[player.cls].name}`;
    roster.append(item);
  }
  renderResults();
}
/** Two team tables: score (from capturing zones), kills, deaths and damage per knight. */
const BOARD_COLUMNS = [['score', 'Score'], ['kills', 'Kills'], ['deaths', 'Deaths'], ['damage', 'Damage'], ['captures', 'Caps']];
function scoreTables(current) {
  const board = Engine.getScoreboard(current), wrap = document.createElement('div'); wrap.className = 'ld-teams-board';
  const best = Object.fromEntries(BOARD_COLUMNS.filter(([key]) => key !== 'deaths').map(([key]) => [key, Math.max(1, ...board.map(row => row[key]))]));
  for (const team of [0, 1]) {
    const rows = board.filter(row => row.team === team), section = document.createElement('section');
    section.className = `ld-team-table t${team}`;
    const title = document.createElement('h3');
    title.append(`${TEAM_COLORS[team].name} · ${current.scores[team]}`, Object.assign(document.createElement('small'), { textContent: current.winner === team ? 'WINNER' : current.phase === 'matchEnd' && current.winner === null ? 'DRAW' : '' }));
    const table = document.createElement('table');
    const head = document.createElement('tr'); head.append(Object.assign(document.createElement('th'), { textContent: 'Knight' }));
    for (const [, label] of BOARD_COLUMNS) head.append(Object.assign(document.createElement('th'), { textContent: label }));
    const thead = document.createElement('thead'); thead.append(head);
    const body = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr'); tr.className = `${row.id === localId ? 'me' : ''}${row.human ? '' : ' bot'}`;
      tr.append(Object.assign(document.createElement('td'), { textContent: `${row.name}${row.id === localId ? ' (you)' : ''} · ${CLASSES[row.cls].name}` }));
      for (const [key] of BOARD_COLUMNS) {
        const cell = Object.assign(document.createElement('td'), { textContent: String(row[key]) });
        if (best[key] !== undefined && row[key] === best[key]) cell.className = 'best';
        tr.append(cell);
      }
      body.append(tr);
    }
    const total = document.createElement('tr'); total.append(Object.assign(document.createElement('td'), { textContent: 'Team' }));
    for (const [key] of BOARD_COLUMNS) total.append(Object.assign(document.createElement('td'), { textContent: String(rows.reduce((sum, row) => sum + row[key], 0)) }));
    const foot = document.createElement('tfoot'); foot.append(total);
    table.append(thead, body, foot); section.append(title, table); wrap.append(section);
  }
  return wrap;
}
function renderResults() {
  const box = $('ld-results');
  if (!state || state.phase !== 'matchEnd') { box.hidden = true; return; }
  if (box.dataset.tick === String(state.tick) && !box.hidden) return;
  box.dataset.tick = String(state.tick); box.hidden = false; box.textContent = '';
  const heading = document.createElement('h2');
  heading.textContent = state.winner === null ? `Draw · ${state.scores[0]} – ${state.scores[1]}` : `${TEAM_COLORS[state.winner].name} wins · ${state.scores[0]} – ${state.scores[1]}`;
  const mvp = Engine.getScoreboard(state).sort((a, b) => b.score - a.score || b.kills - a.kills || b.damage - a.damage)[0];
  const line = Object.assign(document.createElement('p'), { className: 'ld-mvp', textContent: mvp ? `Top knight: ${mvp.name} — ${mvp.score} pts from zones, ${mvp.kills} kills, ${mvp.damage} damage. Score comes from capturing (+${RULES.captureScore}) and neutralising (+${RULES.neutralizeScore}) zones.` : '' });
  box.append(heading, line, scoreTables(state));
}
let boardOpen = false, boardDrawn = 0;
function showBoard(open) { boardOpen = open; $('ld-board').hidden = !open || !state || state.phase === 'lobby'; boardDrawn = 0; }

// ---------- main loop ----------
function frame(now) {
  const elapsed = now - lastFrame; lastFrame = now;
  updateAim();
  if (solo) soloStep(elapsed); else sendInput(now);
  const view = viewState(now);
  if (view) {
    const me = view.players[localId ?? -1];
    // Show your own aim instantly instead of waiting for the server echo.
    const shown = me && !menuOpen && me.alive ? { ...view, players: view.players.map(player => player.id === localId ? { ...player, aim } : player) } : view;
    const focus = me && !me.alive ? overviewFocus(view, me) : null;
    // In play the game draws its own bold reticle; otherwise the normal pointer comes back.
    const reticle = mouse.inside && !menuOpen && !inventoryOpen && !!me?.alive;
    if (canvas.dataset.reticle !== String(reticle)) { canvas.dataset.reticle = String(reticle); canvas.style.cursor = reticle ? 'none' : 'default'; }
    scene.render(shown, { localId, now, focus, pointer: reticle ? mouse : null });
    playEvents(view);
    if (view.phase !== 'lobby') updateHud(view);
    if (dojo) updateDojo(view, now);
    chargeCue(view);
    if (view.phase !== lastPhase) {
      if (view.phase === 'countdown' && lastPhase !== null) toggleMenu(false);
      if (view.phase === 'matchEnd') startFinale(view, now); // the results come after the finale
      else if (finale) endFinale(true);
      if (view.phase === 'lobby') toggleMenu(true);
      lastPhase = view.phase; renderMenu();
    } else if (menuOpen && Math.floor(now / 250) !== Math.floor((now - elapsed) / 250)) renderMenu();
  }
  requestAnimationFrame(frame);
}
// ---------- the end of a match ----------
/** Heads-up as the match nears its end: the timer pulses red in the last ten seconds (with a tick each of the last
 * five), and a MATCH POINT badge shows while a team is one scoring tick from winning. */
let lastTickSecond = null, matchPointTeam = null;
function matchEndingCues(current) {
  const fight = current.phase === 'fight', seconds = Math.ceil(current.timeLeftTicks / TICK_RATE);
  $('ld-timer').dataset.final = String(fight && seconds <= 10);
  if (fight && seconds <= 5 && seconds !== lastTickSecond && seconds > 0) audio.tone(880, .07, { type: 'square', gain: .08 });
  lastTickSecond = seconds;
  const table = Engine.MODE_RULES[current.teamSize]?.scoreTable || RULES.scoreTable, step = Math.max(...table);
  const close = fight ? [0, 1].filter(team => current.scores[team] >= RULES.scoreToWin - step).sort((a, b) => current.scores[b] - current.scores[a])[0] ?? null : null;
  const badge = $('ld-match-point');
  badge.hidden = close === null;
  if (close !== null) { badge.textContent = `MATCH POINT · ${TEAM_COLORS[close].name.toUpperCase()}`; badge.style.setProperty('--team', TEAM_COLORS[close].main); }
  if (close !== null && close !== matchPointTeam) audio.tone(660, .25, { end: 990, type: 'triangle', gain: .14 });
  matchPointTeam = close;
}
/** The finale: the match freezes, letterbox bars slide in, the result slams onto the screen in the winner's colour,
 * the score and the top knight follow, and the camera pushes in while the winners cheer. The results come up after
 * FINALE_MS, or at once with Esc. */
const FINALE_MS = 4400;
let finale = null;
function startFinale(view, now) {
  const me = view.players[localId ?? -1], winner = view.winner;
  const result = winner === null ? 'draw' : me && !me.benched ? (me.team === winner ? 'win' : 'lose') : 'team';
  const box = $('ld-finale'), team = winner === null ? null : TEAM_COLORS[winner];
  box.classList.remove('leaving'); box.hidden = false; box.dataset.result = result;
  box.style.setProperty('--team', team?.main || '#d9dde4'); box.style.setProperty('--team-light', team?.light || '#ffffff');
  $('ld-finale-kicker').textContent = view.timeLeftTicks === 0 ? "TIME'S UP" : 'MATCH OVER';
  $('ld-finale-title').textContent = result === 'win' ? 'VICTORY' : result === 'lose' ? 'DEFEAT' : result === 'draw' ? 'DRAW' : `${team.name.toUpperCase()} WINS`;
  const mvp = Engine.getScoreboard(view).sort((a, b) => b.score - a.score || b.kills - a.kills || b.damage - a.damage)[0];
  $('ld-finale-mvp').textContent = mvp ? `Top knight: ${mvp.name} · ${mvp.kills} KO · ${mvp.damage} damage` : '';
  app.dataset.finale = 'true'; $('ld-banner').hidden = true; $('ld-match-point').hidden = true;
  finale = { start: now, done: false, scores: [...view.scores], timer: setTimeout(() => endFinale(), FINALE_MS) };
  scene.finale = { start: now, winner };
  // The score counts up as it appears.
  const count = () => {
    if (!finale || finale.done) return;
    const t = Math.min(1, Math.max(0, (performance.now() - finale.start - 1000) / 900)), ease = 1 - (1 - t) ** 3;
    $('ld-finale-a').textContent = Math.round(finale.scores[0] * ease); $('ld-finale-c').textContent = Math.round(finale.scores[1] * ease);
    if (t < 1) requestAnimationFrame(count);
  };
  requestAnimationFrame(count);
  // A short fanfare: rising for a win, falling for a loss.
  const notes = result === 'lose' ? [392, 330, 262] : result === 'draw' ? [392, 392, 330] : [523, 659, 784, 1046];
  notes.forEach((frequency, i) => audio.tone(frequency, i === notes.length - 1 ? .7 : .18, { type: 'triangle', gain: .2, delay: .45 + i * .16 }));
  held.clear(); pressed.clear(); mouse.left = mouse.right = false; unlockMouse();
}
function endFinale(silent = false) {
  // Silent: a new lobby or match took over; clear everything, even after the results came up.
  if (silent) { if (finale) clearTimeout(finale.timer); finale = null; scene.finale = null; app.dataset.finale = 'false'; $('ld-finale').hidden = true; return; }
  if (!finale || finale.done) return;
  clearTimeout(finale.timer); finale.done = true;
  const box = $('ld-finale'); box.classList.add('leaving');
  setTimeout(() => { if (finale?.done) { box.hidden = true; box.classList.remove('leaving'); } }, 450);
  app.dataset.finale = 'false';
  toggleMenu(true);
}

/** A bright chime the moment your charge is full, so you can release it without watching the bar. */
let chargeWasReady = false;
function chargeCue(current) {
  const me = current.players[localId ?? -1], weapon = me && WEAPONS[me.weapons?.[me.slot]];
  const ready = !!(me?.alive && me.charging && weapon && me.chargeTicks >= Engine.chargeTicksFor(me, weapon));
  if (ready && !chargeWasReady) audio.tone(990, .12, { end: 1320, type: 'triangle', gain: .14 });
  chargeWasReady = ready;
}

// ---------- Dojo: damage meter ----------
const meter = { seen: new Set(), last: null, lastCharged: false, combo: 0, streak: 0, streakStart: 0, lastHitAt: 0, bestCharge: 0, total: 0, chargeAt: -Infinity };
const COMBO_GAP_MS = 1500;
function updateDojo(current, now) {
  for (const event of current.events || []) {
    if (meter.seen.has(event.id)) continue;
    meter.seen.add(event.id);
    if (event.playerId !== localId) continue;
    if (event.type === 'chargeRelease') meter.chargeAt = event.tick;
    if (event.type !== 'damage' || current.players[event.targetId]?.team === current.players[localId]?.team) continue;
    // Hits within a second of releasing a charge count as the charge attack.
    const charged = event.tick - meter.chargeAt < TICK_RATE;
    if (now - meter.lastHitAt > COMBO_GAP_MS) { meter.combo = 0; meter.streak = 0; meter.streakStart = now; }
    meter.combo++; meter.streak += event.amount; meter.total += event.amount; meter.lastHitAt = now;
    meter.last = event.amount; meter.lastCharged = charged;
    if (charged) meter.bestCharge = Math.max(meter.bestCharge, event.amount);
  }
  if (meter.seen.size > 2000) meter.seen.clear();
  const seconds = Math.max(1, (meter.lastHitAt - meter.streakStart) / 1000);
  $('ld-dojo-last').textContent = meter.last === null ? '—' : `${meter.last}${meter.lastCharged ? ' ★' : ''}`;
  $('ld-dojo-combo').textContent = now - meter.lastHitAt > COMBO_GAP_MS ? '0' : String(meter.combo);
  $('ld-dojo-streak').textContent = String(Math.round(meter.streak));
  $('ld-dojo-dps').textContent = meter.combo > 1 ? (meter.streak / seconds).toFixed(1) : '—';
  $('ld-dojo-charge').textContent = meter.bestCharge ? String(meter.bestCharge) : '—';
  $('ld-dojo-total').textContent = String(Math.round(meter.total));
}
function setupDojoPanel() {
  app.dataset.mode = 'dojo';
  $('ld-dojo').hidden = false;
  $('ld-mode').textContent = 'TRAINING · DUMMIES';
  $('ld-menu-title').textContent = 'Dojo';
  $('ld-start').closest('.ld-panel').querySelector('h2').textContent = 'Training';
  $('ld-lede').textContent = 'Try any weapon, charge attack and piece of gear on training dummies. Hold attack to charge: a gold ring fills at your feet and turns white when the charge is ready; let go to unleash it. Press B any time to change class, equipment or weapons. Dummies heal when left alone and come back after a knockout; turn on sparring to make one fight back.';
  $('ld-dojo-reset').addEventListener('click', () => { Object.assign(meter, { last: null, combo: 0, streak: 0, bestCharge: 0, total: 0, lastHitAt: 0 }); canvas.focus(); });
  $('ld-dojo-spar').addEventListener('click', event => {
    const on = event.currentTarget.getAttribute('aria-pressed') !== 'true', result = Engine.setDojoSpar(state, on);
    if (!result.ok) { setStatus(result.error); return; }
    event.currentTarget.setAttribute('aria-pressed', String(on)); event.currentTarget.textContent = `Sparring: ${on ? 'on' : 'off'}`; canvas.focus();
  });
}

/** While you wait to respawn the camera drifts toward the most contested point. */
function overviewFocus(view, me) {
  const hot = [...view.points].sort((a, b) => ((b.counts?.[0] || 0) + (b.counts?.[1] || 0)) - ((a.counts?.[0] || 0) + (a.counts?.[1] || 0)))[0];
  return hot ? { x: hot.x, y: hot.y } : { x: me.x, y: me.y };
}

buildMenu();
menuBuilt = true;
setupPreview();
refreshKeyLabels();
refreshIcons();
if (solo) soloCreate(); else connect();
// ?hitboxes=1: draw the real hit areas over the 3D view.
if (params.get('hitboxes') === '1') scene.hitboxes = true;
// ?debug=1: the live state and the view for test scripts (nothing changes without it).
if (params.get('debug') === '1') window.lockdownDebug = { get state() { return state; }, get localId() { return localId; }, scene };
if (dojo) setupDojoPanel();
app.dataset.menu = 'open';
renderMenu();
requestAnimationFrame(frame);
addEventListener('resize', () => scene.resize());
// Exposed for automated smoke tests.
globalThis.__lockdown = { get state() { return state; }, get scene() { return scene; }, get localId() { return localId; }, get menuOpen() { return menuOpen; }, get inventoryOpen() { return inventoryOpen; }, toggleMenu, toggleInventory, chooseSetup, showBoard };
