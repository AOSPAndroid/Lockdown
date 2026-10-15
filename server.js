/** Lockdown server: serves the game and runs authoritative online rooms.
 *
 * - GET /           the start page (play solo, create or join a room)
 * - GET/POST /api/rooms   list open rooms / create one ({ name?, mapId? })
 * - WS /ws?room=CODE      play: join, start, rematch, lockdown-setup, lockdown-inventory,
 *                         lockdown-map, input, ping. The server answers welcome, state, error, pong.
 *
 * Up to eight people per room; bots fill every empty seat. The simulation runs at 120 Hz and
 * snapshots go out at 40 Hz (every third tick), carrying only recent events. */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';
import * as Lockdown from './public/lockdown-engine.js';

const TICK_RATE = Lockdown.TICK_RATE;
const SNAPSHOT_INTERVAL = 3;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};
// Snapshots carry only recent events: clients deduplicate by id and ignore old ones.
const EVENT_TICKS = 60, LONG_EVENT_TICKS = 240, LONG_EVENTS = new Set(['kill', 'matchEnd', 'fight']);
const recentEvents = state => (state.events || []).filter(event => {
  const age = state.tick - (Number.isFinite(event?.tick) ? event.tick : state.tick);
  return age <= EVENT_TICKS || LONG_EVENTS.has(event?.type) && age <= LONG_EVENT_TICKS;
});
const cleanName = (name, maximum) => name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum);
const neutralInput = () => Lockdown.emptyInput(0);
const validControl = (key, value) => Lockdown.INPUT_KEYS.includes(key) ? typeof value === 'boolean' : key === 'aim' && typeof value === 'number' && Number.isFinite(value) && value >= -Math.PI && value <= Math.PI;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function json(res, status, data, head = false) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(head ? undefined : JSON.stringify(data));
}
function readJSON(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    const timer = setTimeout(() => { reject(fail('Request body timed out.', 408)); req.resume(); }, 5000);
    req.on('data', chunk => { size += chunk.length; if (size <= 4096) chunks.push(chunk); });
    req.on('end', () => {
      clearTimeout(timer);
      if (size > 4096) { reject(fail('Request body exceeds 4 KB.', 413)); return; }
      try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); resolve(body); }
      catch { reject(fail('Send a valid JSON object.')); }
    });
    req.on('error', () => { clearTimeout(timer); reject(fail('Request was interrupted.')); });
  });
}
async function serveFile(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
  const filename = path.resolve(PUBLIC, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const info = await stat(filename);
    if (!info.isFile()) throw new Error('Not a file');
    const tag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
    const headers = { 'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', ETag: tag };
    if (String(req.headers['if-none-match'] || '').split(',').some(value => value.trim().replace(/^W\//, '') === tag.replace(/^W\//, ''))) { res.writeHead(304, headers); res.end(); return; }
    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (req.method === 'HEAD') res.end(); else createReadStream(filename).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
}

/** Creates the Lockdown server. `autoTick: false` lets tests step rooms by hand with `tick()`. */
export function createServer(options = {}) {
  const rooms = new Map(), occupied = new Set(), creationRates = new Map();
  const maxRooms = Math.max(1, Math.min(100, options.maxRooms ?? 50)), creationLimit = options.creationLimit ?? 20;
  let ticker = null, heartbeat = null, maintenance = null, closing = false, accumulator = 0, lastTime = performance.now();

  function makeRoom(id, name, mapId) {
    const createdAt = Date.now();
    return {
      id, gameId: 'lockdown', name: cleanName(name || 'Lockdown', 48) || 'Lockdown', capacity: Lockdown.CAPACITY, mapId, mapName: Lockdown.MAPS[mapId].name, hostId: null,
      createdAt, emptySince: createdAt, hadPlayers: false, sessionId: randomUUID(), state: Lockdown.createState({ mapId }),
      players: Array(Lockdown.CAPACITY).fill(null), slots: Array(Lockdown.CAPACITY).fill(null), acks: Array(Lockdown.CAPACITY).fill(-1), lastBroadcastTick: -12,
    };
  }
  const roomSettings = room => ({ capacity: room.capacity, mapId: room.mapId, mapName: room.mapName, hostId: room.hostId, teamSize: room.state.teamSize });
  const summary = room => ({ id: room.id, gameId: room.gameId, name: room.name, ...roomSettings(room), players: room.players, phase: room.state.phase, createdAt: room.createdAt });
  function reapRooms(now = Date.now()) {
    for (const [id, room] of rooms) {
      if (room.slots.some(Boolean)) continue;
      if (now - (room.hadPlayers ? room.emptySince : room.createdAt) >= (room.hadPlayers ? 60_000 : 600_000)) rooms.delete(id);
    }
    for (const [ip, rate] of creationRates) if (now - rate.startedAt > 120_000) creationRates.delete(ip);
  }
  function createRoom(name, settings = {}) {
    if (name !== undefined && typeof name !== 'string') throw fail('Room name must be text.');
    const mapId = Object.hasOwn(settings, 'mapId') ? settings.mapId : Lockdown.MAP_IDS[0];
    if (typeof mapId !== 'string' || !Lockdown.MAP_IDS.includes(mapId)) throw fail('Choose an available Lockdown map.');
    reapRooms();
    if (rooms.size >= maxRooms) throw fail('The server has reached its room limit. Try again after an empty room closes.', 503);
    let id;
    do { id = [...randomBytes(6)].map(byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join(''); } while (rooms.has(id));
    const room = makeRoom(id, name, mapId); rooms.set(id, room);
    return room;
  }

  async function handleHTTP(req, res) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { json(res, 400, { error: 'Invalid URL.' }); return; }
    if (pathname.includes('\0') || pathname.includes('\\')) { json(res, 400, { error: 'Invalid path.' }); return; }
    const head = req.method === 'HEAD';
    if (pathname === '/api/rooms') {
      reapRooms();
      if (req.method === 'GET' || head) { const now = Date.now(); json(res, 200, { rooms: [...rooms.values()].filter(room => room.slots.some(Boolean) || now - room.createdAt < 60_000).map(summary) }, head); return; }
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'GET, HEAD, POST' }); res.end('Method not allowed'); return; }
      const now = Date.now(), ip = req.socket.remoteAddress || 'local';
      let rate = creationRates.get(ip);
      if (!rate || now - rate.startedAt >= 60_000) { rate = { startedAt: now, count: 0 }; creationRates.set(ip, rate); }
      if (++rate.count > creationLimit) { req.resume(); res.setHeader('Retry-After', '60'); json(res, 429, { error: 'Too many room requests. Please wait a minute.' }); return; }
      try {
        const data = await readJSON(req);
        if (Object.hasOwn(data, 'gameId') && data.gameId !== 'lockdown') throw fail('This server only runs Lockdown.');
        if (Object.keys(data).some(key => !['gameId', 'name', 'mapId'].includes(key))) throw fail('Choose only a room name and Lockdown map.');
        const room = createRoom(data.name, Object.hasOwn(data, 'mapId') ? { mapId: data.mapId } : {});
        json(res, 201, { room: summary(room) });
      } catch (error) { if (!res.writableEnded) json(res, error.status || 400, { error: error.message }); }
      return;
    }
    if (pathname === '/health') { json(res, 200, { ok: true, tickRate: TICK_RATE, game: 'lockdown' }, head); return; }
    if (pathname === '/api/host-info') {
      const addresses = Object.values(os.networkInterfaces()).flatMap(items => (items || []).filter(item => item.family === 'IPv4' && !item.internal).map(item => item.address));
      json(res, 200, { hostname: os.hostname(), port: req.socket.localPort, addresses }, head); return;
    }
    await serveFile(req, res, pathname);
  }
  const server = http.createServer((req, res) => { handleHTTP(req, res).catch(() => { if (!res.headersSent) json(res, 500, { error: 'Server error.' }); else res.end(); }); });
  server.headersTimeout = 15_000; server.requestTimeout = 15_000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });

  const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(typeof data === 'string' ? data : JSON.stringify(data)); };
  const error = (ws, message) => send(ws, { type: 'error', message });
  function broadcast(selected) {
    for (const room of selected ? [selected] : occupied) {
      if (!room.slots.some(Boolean)) continue;
      const message = JSON.stringify({ type: 'state', roomId: room.id, gameId: room.gameId, ...roomSettings(room), players: room.players, acks: room.acks, state: { ...room.state, events: recentEvents(room.state) } });
      for (const slot of room.slots) {
        if (!slot || slot.ws.readyState !== WebSocket.OPEN) continue;
        if (slot.ws.bufferedAmount > 1024 * 1024) { slot.ws.terminate(); continue; }
        if (slot.ws.bufferedAmount < 128 * 1024) send(slot.ws, message);
      }
      room.lastBroadcastTick = room.state.tick;
    }
  }
  function resetInputs(room) {
    for (const slot of room.slots) { if (!slot) continue; slot.queue.length = 0; slot.buttons = neutralInput(); room.acks[slot.id] = slot.lastAccepted; }
  }
  function returnToLobby(room) {
    Lockdown.resetLobby(room.state); resetInputs(room);
    for (let id = 0; id < room.players.length; id++) if (!room.slots[id]) room.players[id] = null; else if (room.players[id]) room.players[id].ready = false;
  }
  function tick() {
    const now = performance.now();
    for (const room of occupied) {
      const inputs = room.slots.map((slot, index) => {
        if (!slot) return neutralInput();
        if (slot.queue.length) { const command = slot.queue.shift(); slot.buttons = command.buttons; room.acks[index] = command.seq; }
        else if (now - slot.lastInputTime > 350) slot.buttons = { ...neutralInput(), aim: slot.buttons.aim };
        return slot.buttons;
      });
      const before = room.state.phase;
      Lockdown.step(room.state, inputs);
      if (before !== room.state.phase) broadcast(room);
      else {
        const idle = room.state.phase === 'lobby' || room.state.phase === 'matchEnd';
        if (room.state.tick - room.lastBroadcastTick >= (idle ? 12 : SNAPSHOT_INTERVAL)) broadcast(room);
      }
    }
  }
  function pump() {
    const now = performance.now(), quantum = 1000 / TICK_RATE;
    accumulator += Math.min(250, now - lastTime); lastTime = now;
    let iterations = 0;
    while (accumulator >= quantum && iterations < 16) { tick(); accumulator -= quantum; iterations++; }
    if (iterations === 16) accumulator = Math.min(accumulator, quantum * 2);
  }
  function startTicker() {
    if (!maintenance) maintenance = setInterval(reapRooms, 10_000);
    if (ticker || options.autoTick === false || !occupied.size) return;
    lastTime = performance.now(); accumulator = 0;
    ticker = setInterval(pump, 4);
    heartbeat = setInterval(() => {
      for (const room of occupied) for (const slot of room.slots) {
        if (!slot) continue;
        if (!slot.alive) { slot.ws.terminate(); continue; }
        slot.alive = false; slot.ws.ping();
      }
    }, 10_000);
  }

  server.on('upgrade', (req, socket, head) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { socket.destroy(); return; }
    if (pathname !== '/ws' || closing) { socket.destroy(); return; }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host.toLowerCase() !== String(req.headers.host).toLowerCase()) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; } }
      catch { socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    ws.on('error', () => {});
    const roomId = String(new URL(req.url, 'http://localhost').searchParams.get('room') || '').trim().toUpperCase();
    reapRooms();
    const room = rooms.get(roomId);
    if (!/^[A-Z0-9]{6}$/.test(roomId) || !room) { error(ws, 'This room does not exist or has expired. Go back to the start page to create a new room.'); ws.close(4404, 'Room not found'); return; }
    let id = room.slots.findIndex(slot => slot === null);
    if (id === -1) { error(ws, `This room already has ${room.capacity} players.`); ws.close(4403, 'Room full'); return; }
    // A 1v1 or 2v2 room takes only as many people as the mode has places.
    const size = room.state.teamSize || Lockdown.TEAM_SIZE;
    if (room.state.players.filter(player => player.human).length >= size * 2) { error(ws, `This room is set to ${size}v${size} and is full.`); ws.close(4403, 'Room full'); return; }
    const slot = { id, ws, queue: [], buttons: neutralInput(), lastAccepted: -1, lastInputTime: performance.now(), alive: true, rateWindow: performance.now(), messages: 0 };
    room.slots[id] = slot; occupied.add(room); startTicker();
    room.players[id] = { name: `Player ${id + 1}`, connected: true, ready: false };
    if (room.hostId === null) room.hostId = id;
    // A seat is a bot until a person sits in it, even mid-match.
    Lockdown.setConnected(room.state, id, true, room.players[id].name);
    room.acks[id] = -1; room.hadPlayers = true; room.emptySince = null;
    send(ws, { type: 'welcome', playerId: id, roomId: room.id, gameId: room.gameId, ...roomSettings(room), sessionId: room.sessionId, tickRate: TICK_RATE });
    broadcast(room);
    ws.on('pong', () => { slot.alive = true; });
    ws.on('message', (raw, isBinary) => {
      if (closing || room.slots[id] !== slot) return;
      const now = performance.now();
      if (now - slot.rateWindow >= 1000) { slot.rateWindow = now; slot.messages = 0; }
      if (++slot.messages > 300) { error(ws, 'Too many messages.'); ws.close(4408, 'Rate limit'); return; }
      if (isBinary) { error(ws, 'Messages must be JSON text.'); return; }
      let data;
      try { data = JSON.parse(raw.toString()); } catch { error(ws, 'Invalid JSON message.'); return; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) { error(ws, 'Invalid message.'); return; }
      const state = room.state;
      if (data.type === 'join') {
        if (typeof data.name !== 'string') { error(ws, 'A player name is required.'); return; }
        room.players[id].name = cleanName(data.name, 24) || `Player ${id + 1}`;
        Lockdown.setConnected(state, id, true, room.players[id].name); broadcast(room);
      } else if (data.type === 'start') {
        if (Object.keys(data).some(key => key !== 'type')) { error(ws, 'Start accepts no player, map, or inventory overrides.'); return; }
        if (id !== room.hostId) { error(ws, 'Only the room host can start Lockdown.'); return; }
        if (state.phase !== 'lobby') { error(ws, 'The host can start only from the lobby.'); return; }
        const participants = room.slots.flatMap((candidate, seat) => candidate?.ws.readyState === WebSocket.OPEN ? [seat] : []);
        Lockdown.startMatch(state, participants); resetInputs(room); broadcast(room);
      } else if (data.type === 'ready') {
        if (typeof data.ready !== 'boolean') { error(ws, 'Ready must be true or false.'); return; }
        if (state.phase !== 'lobby') { error(ws, 'Readiness can change only in the Lockdown lobby.'); return; }
        room.players[id].ready = data.ready; broadcast(room);
      } else if (data.type === 'rematch') {
        if (Object.keys(data).some(key => key !== 'type')) { error(ws, 'Rematch accepts no player, map, or inventory overrides.'); return; }
        if (id !== room.hostId) { error(ws, 'Only the room host can open the next Lockdown lobby.'); return; }
        if (state.phase !== 'matchEnd') { error(ws, 'Finish the current match before opening the next lobby.'); return; }
        returnToLobby(room); broadcast(room);
      } else if (data.type === 'lockdown-setup') {
        if (Object.keys(data).some(key => !['type', 'team', 'cls', 'armor', 'helmet', 'pants', 'shoes', 'weapons'].includes(key))) { error(ws, 'Choose only a team, class, gear and up to four weapons.'); return; }
        const choice = {}; for (const key of ['team', 'cls', 'armor', 'helmet', 'pants', 'shoes', 'weapons']) if (Object.hasOwn(data, key)) choice[key] = data[key];
        const result = Lockdown.setPlayerSetup(state, id, choice);
        if (!result.ok) { error(ws, result.error); return; }
        broadcast(room);
      } else if (data.type === 'lockdown-inventory') {
        if (Object.keys(data).some(key => !['type', 'order'].includes(key))) { error(ws, 'Send only the new slot order.'); return; }
        const result = Lockdown.reorderInventory(state, id, data.order);
        if (!result.ok) { error(ws, result.error); return; }
        broadcast(room);
      } else if (data.type === 'lockdown-map') {
        if (id !== room.hostId) { error(ws, 'Only the room host can change the Lockdown map.'); return; }
        if (Object.keys(data).some(key => !['type', 'mapId'].includes(key)) || typeof data.mapId !== 'string') { error(ws, 'Choose an available Lockdown map.'); return; }
        const result = Lockdown.selectMap(state, data.mapId);
        if (!result.ok) { error(ws, result.error); return; }
        room.mapId = data.mapId; room.mapName = Lockdown.MAPS[data.mapId].name; broadcast(room);
      } else if (data.type === 'lockdown-mode') {
        if (id !== room.hostId) { error(ws, 'Only the room host can change the mode.'); return; }
        if (Object.keys(data).some(key => !['type', 'teamSize'].includes(key))) { error(ws, 'Choose 1v1, 2v2 or 4v4.'); return; }
        const result = Lockdown.selectTeamSize(state, data.teamSize);
        if (!result.ok) { error(ws, result.error); return; }
        broadcast(room);
      } else if (data.type === 'ping') {
        if (typeof data.time !== 'number' || !Number.isFinite(data.time)) { error(ws, 'Invalid ping timestamp.'); return; }
        send(ws, { type: 'pong', time: data.time });
      } else if (data.type === 'input') {
        if (!Number.isSafeInteger(data.seq) || data.seq < 0 || data.seq > 1_000_000_000) { error(ws, 'Invalid input sequence.'); return; }
        if (!data.buttons || typeof data.buttons !== 'object' || Array.isArray(data.buttons) || Object.keys(data.buttons).some(key => !validControl(key, data.buttons[key]))) {
          error(ws, 'Use boolean controls and an aim angle between -π and π.'); return;
        }
        if (data.seq <= slot.lastAccepted) return;
        if (data.seq - slot.lastAccepted > 600) { error(ws, 'Input sequence is too far ahead.'); return; }
        if (slot.queue.length >= 60) { error(ws, 'Input queue is full.'); return; }
        const buttons = { ...neutralInput(), aim: (slot.queue.at(-1)?.buttons ?? slot.buttons).aim };
        for (const key of Lockdown.INPUT_KEYS) buttons[key] = data.buttons[key] === true;
        if (Object.hasOwn(data.buttons, 'aim')) buttons.aim = data.buttons.aim;
        slot.queue.push({ seq: data.seq, buttons }); slot.lastAccepted = data.seq; slot.lastInputTime = now;
      } else error(ws, 'Unknown message type.');
    });
    ws.on('close', () => {
      if (room.slots[id] !== slot) return;
      const active = room.state.phase !== 'lobby';
      room.slots[id] = null; room.acks[id] = -1; room.players[id] = null;
      // A bot takes over the seat; the match carries on.
      Lockdown.setConnected(room.state, id, false);
      if (room.hostId === id) { room.hostId = room.slots.findIndex(Boolean); if (room.hostId === -1) room.hostId = null; }
      if (!room.slots.some(Boolean)) {
        room.emptySince = Date.now(); occupied.delete(room);
        if (!occupied.size) { clearInterval(ticker); clearInterval(heartbeat); ticker = heartbeat = null; }
      }
      if (!active || !room.slots.some(Boolean)) returnToLobby(room);
      broadcast(room);
    });
  });

  server.on('listening', startTicker);
  async function listen(port = options.port ?? Number(process.env.PORT || 3000), host = options.host ?? '0.0.0.0') {
    if (server.listening) return server.address();
    await new Promise((resolve, reject) => {
      const failed = problem => { server.off('listening', succeeded); reject(problem); };
      const succeeded = () => { server.off('error', failed); resolve(); };
      server.once('error', failed); server.once('listening', succeeded); server.listen(port, host);
    });
    return server.address();
  }
  async function close() {
    closing = true;
    for (const timer of [ticker, heartbeat, maintenance]) if (timer) clearInterval(timer);
    ticker = heartbeat = maintenance = null;
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
  return { server, wss, rooms, createRoom, reapRooms, listen, close, tick, broadcast };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const game = createServer();
  game.listen().then(address => {
    const addresses = Object.values(os.networkInterfaces()).flatMap(items => (items || []).filter(item => item.family === 'IPv4' && !item.internal).map(item => item.address));
    console.log(`Lockdown is running on http://localhost:${address.port}`);
    for (const ip of addresses) console.log(`  Friends on your network: http://${ip}:${address.port}`);
  }).catch(problem => { console.error(`Cannot start Lockdown: ${problem.message}`); process.exitCode = 1; });
  const stop = async () => { await game.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
