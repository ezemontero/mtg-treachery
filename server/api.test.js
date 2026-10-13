import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleApi } from './api.js';
import { attachWebSocket } from './ws.js';
import { ROLE_TABLE } from './deal.js';

// Same wiring as index.js (HTTP API + presence socket), minus static files.
let server;
let base;
let wsBase;
// Every socket a test opens; closed in after() so a failing test can't hang the run.
const allSockets = new Set();

before(async () => {
  server = http.createServer();
  const deps = { ...attachWebSocket(server), lanBaseUrl: () => 'http://lan.test', version: 'test' };
  server.on('request', async (req, res) => {
    if (!(await handleApi(req, res, deps))) res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}`;
});

after(async () => {
  await closeAll([...allSockets]);
  server.closeAllConnections();
  server.close();
});

async function call(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: raw ?? (body && JSON.stringify(body)) });
  return { status: res.status, data: await res.json().catch(() => null) };
}

/** Creates a room and seats `n` players over HTTP. Seat 0 is the dealer. */
async function seatTable(n) {
  const names = ['Ann', 'Bob', 'Cam', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal'];
  const created = await call('POST', '/api/rooms', { body: { name: names[0] } });
  const code = created.data.roomCode;
  const seats = [{ name: names[0], ...created.data }];
  for (let i = 1; i < n; i++) {
    const joined = await call('POST', `/api/rooms/${code}/join`, { body: { name: names[i] } });
    seats.push({ name: names[i], ...joined.data });
  }
  return { code, seats };
}

/** Opens a presence socket that records every message it receives. */
function openSocket(code, token) {
  const ws = new WebSocket(`${wsBase}/ws?code=${code}&token=${encodeURIComponent(token)}`);
  ws.messages = [];
  ws.addEventListener('message', (ev) => ws.messages.push(JSON.parse(ev.data)));
  allSockets.add(ws);
  return ws;
}

const lastState = (ws) => ws.messages.findLast((m) => m.type === 'state')?.room;

async function until(predicate, label, timeoutMs = 2000) {
  const end = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

function closeAll(sockets) {
  return Promise.all(sockets.map((ws) => new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve();
    ws.addEventListener('close', resolve, { once: true });
    ws.close();
  })));
}

test('over HTTP, only the dealer can start and each player reads only their own role', async () => {
  const { code, seats } = await seatTable(5);
  assert.equal((await call('POST', `/api/rooms/${code}/deal`, { token: seats[1].token })).status, 403);
  assert.equal((await call('POST', `/api/rooms/${code}/deal`, { token: seats[0].token })).status, 200);

  const tally = { LEADER: 0, TRAITOR: 0, ASSASSIN: 0, GUARDIAN: 0 };
  for (const seat of seats) {
    const me = await call('GET', `/api/me/role?code=${code}`, { token: seat.token });
    assert.equal(me.status, 200);
    seat.role = me.data.role;
    tally[seat.role]++;
  }
  assert.deepEqual(tally, ROLE_TABLE[5]);

  // Whoever asks, the room only shows the Leader's role.
  for (const viewer of seats) {
    const { data } = await call('GET', `/api/rooms/${code}`, { token: viewer.token });
    for (const p of data.players) {
      const seat = seats.find((s) => s.playerId === p.id);
      assert.equal(p.role, seat.role === 'LEADER' ? 'LEADER' : null, `${viewer.name} sees ${seat.name}`);
    }
  }
});

test('the WebSocket never pushes a concealed role, card or anyone\'s token', async () => {
  const { code, seats } = await seatTable(4);
  const sockets = seats.map((s) => openSocket(code, s.token));
  await until(() => sockets.every(lastState), 'initial state');

  await call('POST', `/api/rooms/${code}/deal`, { token: seats[0].token });
  await until(() => sockets.every((ws) => lastState(ws)?.phase === 'dealt'), 'dealt state');

  const secrets = new Map(); // playerId -> { role, card }
  for (const seat of seats) {
    secrets.set(seat.playerId, (await call('GET', `/api/me/role?code=${code}`, { token: seat.token })).data);
  }

  // Unveil and conceal again, so both broadcasts are covered.
  const unveiler = seats.find((s) => secrets.get(s.playerId).role !== 'LEADER');
  const shown = (ws) => lastState(ws).players.find((p) => p.id === unveiler.playerId).unveiled;
  await call('POST', `/api/rooms/${code}/unveil`, { token: unveiler.token, body: { unveiled: true } });
  await until(() => sockets.every(shown), 'unveil broadcast');
  await call('POST', `/api/rooms/${code}/unveil`, { token: unveiler.token, body: { unveiled: false } });
  await until(() => sockets.every((ws) => !shown(ws)), 'conceal broadcast');

  for (const ws of sockets) {
    for (const msg of ws.messages) {
      const raw = JSON.stringify(msg);
      for (const seat of seats) assert.ok(!raw.includes(seat.token), 'a token went over the socket');
      for (const p of msg.room?.players ?? []) {
        if (p.unveiled) continue; // public on purpose (the Leader, or an unveiled player)
        assert.equal(p.role, null);
        assert.equal(p.card, null);
        const secret = secrets.get(p.id);
        if (secret?.card) assert.ok(!raw.includes(secret.card), 'a concealed card went over the socket');
      }
    }
  }
  await closeAll(sockets);
});

test('a socket with an unknown token is told it is unauthorized', async () => {
  const { code } = await seatTable(1);
  const ws = openSocket(code, 'not-a-real-token');
  await until(() => ws.messages.length > 0, 'a reply');
  assert.deepEqual(ws.messages[0], { type: 'unauthorized' });
  await closeAll([ws]);
});

test('closing the room notifies every socket and forgets the room', async () => {
  const { code, seats } = await seatTable(4);
  const sockets = seats.map((s) => openSocket(code, s.token));
  await until(() => sockets.every(lastState), 'initial state');
  await call('POST', `/api/rooms/${code}/deal`, { token: seats[0].token });

  assert.equal((await call('POST', `/api/rooms/${code}/close`, { token: seats[1].token })).status, 403);
  assert.equal((await call('POST', `/api/rooms/${code}/close`, { token: seats[0].token })).status, 200);
  await until(() => sockets.every((ws) => ws.messages.some((m) => m.type === 'closed')), 'closed message');
  assert.equal((await call('GET', `/api/rooms/${code}`)).status, 404);
  await closeAll(sockets);
});

test('removing a seat tells that player\'s socket and revokes their token', async () => {
  const { code, seats: [ann, bob, cam] } = await seatTable(3);
  const annSocket = openSocket(code, ann.token);
  const camSocket = openSocket(code, cam.token);
  await until(() => lastState(annSocket) && lastState(camSocket), 'initial state');

  const kick = (by, target) => call('POST', `/api/rooms/${code}/kick`, { token: by.token, body: { playerId: target.playerId } });
  assert.equal((await kick(bob, cam)).status, 403);
  assert.equal((await kick(ann, cam)).status, 200);

  await until(() => camSocket.messages.some((m) => m.type === 'kicked'), 'kicked message');
  await until(() => lastState(annSocket).players.length === 2, 'updated roster');
  assert.equal((await call('GET', `/api/rooms/${code}`, { token: cam.token })).data.you, null);
  await closeAll([annSocket, camSocket]);
});

test('a full room turns the 9th player away', async () => {
  const { code } = await seatTable(8);
  const ninth = await call('POST', `/api/rooms/${code}/join`, { body: { name: 'Ivy' } });
  assert.equal(ninth.status, 409);
  assert.equal(ninth.data.error, 'The room is full (8 players max).');
});

test('error contract: 401 without a token, 400 on bad JSON, 404 for unknown rooms/routes', async () => {
  const { code, seats } = await seatTable(4);
  assert.equal((await call('POST', `/api/rooms/${code}/deal`)).status, 401);
  assert.equal((await call('GET', `/api/me/role?code=${code}`, { token: 'bogus' })).status, 401);
  assert.equal((await call('POST', `/api/rooms/${code}/join`, { raw: '{oops' })).status, 400);
  assert.equal((await call('POST', `/api/rooms/${code}/unveil`, { token: seats[1].token, body: { unveiled: true } })).status, 409);
  assert.equal((await call('GET', '/api/rooms/ZZZZ')).status, 404);
  assert.equal((await call('GET', '/api/nope')).status, 404);
});

test('the join QR points at the shared base URL', async () => {
  const { code } = await seatTable(1);
  const { data } = await call('GET', `/api/rooms/${code}/qr`);
  assert.equal(data.joinUrl, `http://lan.test/join?code=${code}`);
  assert.match(data.dataUrl, /^data:image\/png;base64,/);
});
