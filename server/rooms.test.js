import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_TABLE, MIN_PLAYERS, MAX_PLAYERS } from './deal.js';
import {
  createRoom,
  joinRoom,
  getRoom,
  dealRoom,
  setUnveiled,
  setDefeated,
  kickPlayer,
  closeRoom,
  findPlayerByToken,
  markConnected,
  markDisconnected,
  toPublicRoom,
  sweepRooms,
  DEALER_GRACE_MS,
  EMPTY_LOBBY_GRACE_MS,
  _rooms,
} from './rooms.js';

/** Creates a lobby with `n` players (Ann first, so Ann is the creator/dealer). */
function table(n) {
  const names = ['Ann', 'Bob', 'Cam', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy'];
  const { room, player } = createRoom(names[0]);
  const players = [player];
  for (let i = 1; i < n; i++) players.push(joinRoom(room.code, names[i]).player);
  return { room, players };
}

function dealtTable(n) {
  const t = table(n);
  assert.equal(dealRoom(t.room, t.players[0].id).ok, true);
  return t;
}

beforeEach(() => _rooms().clear());

// ---- Secrecy: the one promise the whole app is built on ---------------------

test('the public view never leaks a token or a concealed role/card, for any viewer', () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const { room, players } = dealtTable(n);
    for (const viewer of [null, ...players]) {
      const json = JSON.stringify(toPublicRoom(room, viewer));
      for (const p of players) {
        assert.ok(!json.includes(p.token), `${n}p: a token leaked to ${viewer?.name ?? 'an anonymous viewer'}`);
        // Card URLs encode the role, so a concealed card must not appear anywhere.
        if (p.role !== 'LEADER') {
          assert.ok(!json.includes(p.card), `${n}p: ${p.name}'s concealed card leaked to ${viewer?.name ?? 'anonymous'}`);
        }
      }
    }
  }
});

test('after the deal only the Leader is public; the rest show role/card as null', () => {
  const { room, players } = dealtTable(6);
  const view = toPublicRoom(room, players[1]);
  for (const p of players) {
    const pub = view.players.find((x) => x.id === p.id);
    if (p.role === 'LEADER') {
      assert.equal(pub.isLeader, true);
      assert.equal(pub.unveiled, true);
      assert.equal(pub.role, 'LEADER');
      assert.equal(pub.card, p.card);
    } else {
      assert.equal(pub.isLeader, false);
      assert.equal(pub.role, null);
      assert.equal(pub.card, null);
    }
  }
});

test('nothing about roles is public before the deal', () => {
  const { room, players } = table(5);
  const view = toPublicRoom(room, players[0]);
  assert.equal(view.phase, 'lobby');
  for (const pub of view.players) {
    assert.equal(pub.isLeader, false);
    assert.equal(pub.role, null);
    assert.equal(pub.card, null);
  }
});

// ---- Unveil / surrender -----------------------------------------------------

test('unveiling makes a role public, concealing hides it again, the Leader cannot conceal', () => {
  const { room, players } = dealtTable(5);
  const leader = players.find((p) => p.role === 'LEADER');
  const other = players.find((p) => p.role !== 'LEADER');
  const pub = (p) => toPublicRoom(room).players.find((x) => x.id === p.id);

  setUnveiled(room, other, true);
  assert.equal(pub(other).role, other.role);
  assert.equal(pub(other).card, other.card);

  setUnveiled(room, other, false);
  assert.equal(pub(other).role, null);
  assert.equal(pub(other).card, null);

  setUnveiled(room, leader, false);
  assert.equal(pub(leader).role, 'LEADER', 'the Leader is public by rule');
});

test('surrendering is public, sticks until the next deal and drops out of the remaining mix', () => {
  const { room, players } = dealtTable(8);
  const assassin = players.find((p) => p.role === 'ASSASSIN');
  setDefeated(room, assassin);
  setUnveiled(room, assassin, false); // cannot hide again once defeated

  const pub = toPublicRoom(room).players.find((x) => x.id === assassin.id);
  assert.equal(pub.defeated, true);
  assert.equal(pub.role, 'ASSASSIN');
  assert.equal(toPublicRoom(room).roleCounts.ASSASSIN, ROLE_TABLE[8].ASSASSIN - 1);

  dealRoom(room, players[0].id, { allowRedeal: true });
  assert.equal(room.players.every((p) => !p.defeated), true, 'a re-deal clears defeats');
});

test('unveil and surrender are rejected before the deal', () => {
  const { room, players } = table(4);
  assert.equal(setUnveiled(room, players[1], true).status, 409);
  assert.equal(setDefeated(room, players[1]).status, 409);
});

// ---- Deal / join / close rules ----------------------------------------------

test('only the current dealer can deal, and only with 4–8 players', () => {
  const small = table(3);
  assert.equal(dealRoom(small.room, small.players[0].id).status, 422);

  const { room, players } = table(4);
  assert.equal(dealRoom(room, players[1].id).status, 403);
  assert.equal(dealRoom(room, players[0].id).ok, true);
});

test('a second deal needs the explicit redeal flag, and deals a full new mix', () => {
  const { room, players } = dealtTable(4);
  assert.equal(dealRoom(room, players[0].id).status, 409);
  assert.equal(dealRoom(room, players[0].id, { allowRedeal: true }).ok, true);
  assert.equal(room.phase, 'dealt');
  assert.equal(room.players.filter((p) => p.role === 'LEADER').length, 1);
  assert.equal(new Set(room.players.map((p) => p.card)).size, 4, 'cards stay unique');
});

test('joining: unknown code is 404, a started game is 409, names are trimmed to 12 chars', () => {
  assert.equal(joinRoom('ZZZZ', 'Bob').status, 404);

  const { room } = table(4);
  const long = joinRoom(room.code.toLowerCase(), '  Bartholomeusz  ');
  assert.equal(long.ok, true, 'codes are case-insensitive');
  assert.equal(long.player.name, 'Bartholomeus');
  assert.equal(joinRoom(room.code, '   ').player.name, 'Player');

  dealRoom(room, room.dealerId);
  assert.equal(joinRoom(room.code, 'Late').status, 409);
});

test('joining refuses a 9th player (otherwise the lobby can never start)', () => {
  const { room } = table(MAX_PLAYERS);
  const ninth = joinRoom(room.code, 'Ivy');
  assert.equal(ninth.ok, false);
  assert.equal(ninth.status, 409);
  assert.equal(room.players.length, MAX_PLAYERS);
});

test('the dealer can remove a lobby seat, and the removed token stops working', () => {
  const { room, players: [ann, bob, cam] } = table(3);
  assert.equal(kickPlayer(room, bob.id, cam.id).status, 403, 'only the dealer');
  assert.equal(kickPlayer(room, ann.id, ann.id).status, 400, 'never your own seat');

  assert.equal(kickPlayer(room, ann.id, cam.id).ok, true);
  assert.deepEqual(room.players.map((p) => p.name), ['Ann', 'Bob']);
  assert.equal(findPlayerByToken(room, cam.token), null);
  assert.equal(kickPlayer(room, ann.id, cam.id).status, 404, 'already gone');
});

test('a removed seat frees a place in a full room', () => {
  const { room, players } = table(MAX_PLAYERS);
  kickPlayer(room, players[0].id, players[7].id);
  assert.equal(joinRoom(room.code, 'Ivy').ok, true);
});

test('seats can only be removed before the deal', () => {
  const { room, players } = dealtTable(4);
  assert.equal(kickPlayer(room, players[0].id, players[1].id).status, 409);
  assert.equal(room.players.length, 4);
});

test('removing the absent creator hands the room to whoever holds control', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { room, players: [ann, bob] } = table(2);
  markConnected(room, ann);
  markConnected(room, bob);
  markDisconnected(room, ann);
  t.mock.timers.tick(DEALER_GRACE_MS);
  assert.equal(room.dealerId, bob.id);

  assert.equal(kickPlayer(room, bob.id, ann.id).ok, true);
  assert.equal(room.creatorId, bob.id, 'Bob keeps control if he drops and comes back');
});

test('only the dealer can close the room', () => {
  const { room, players } = dealtTable(4);
  assert.equal(closeRoom(room, players[1].id).status, 403);
  assert.equal(closeRoom(room, players[0].id).ok, true);
  assert.equal(room.phase, 'closed');
  assert.equal(dealRoom(room, players[0].id, { allowRedeal: true }).status, 409);
});

// ---- Presence: dealer handover and lobby cleanup ----------------------------

test('lobby: the next connected player inherits Start after the grace period; the creator reclaims it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { room, players: [ann, bob, cam] } = table(3);
  for (const p of [ann, bob, cam]) markConnected(room, p);

  markDisconnected(room, ann);
  t.mock.timers.tick(DEALER_GRACE_MS - 1);
  assert.equal(room.dealerId, ann.id, 'still Ann during the grace period');
  t.mock.timers.tick(1);
  assert.equal(room.dealerId, bob.id, 'first connected player in arrival order');

  markConnected(room, ann);
  assert.equal(room.dealerId, ann.id, 'the creator takes control back on return');
});

test('lobby: a creator who reloads within the grace period keeps control', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { room, players: [ann, bob] } = table(2);
  markConnected(room, ann);
  markConnected(room, bob);
  markDisconnected(room, ann);
  markConnected(room, ann);
  t.mock.timers.tick(DEALER_GRACE_MS);
  assert.equal(room.dealerId, ann.id);
});

test('an empty never-started lobby is deleted after a short grace; a quick reload keeps it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const deleted = [];
  const onDelete = (code) => deleted.push(code);

  const kept = createRoom('Ann');
  markConnected(kept.room, kept.player);
  markDisconnected(kept.room, kept.player, null, onDelete);
  markConnected(kept.room, kept.player); // reload
  t.mock.timers.tick(EMPTY_LOBBY_GRACE_MS);
  assert.ok(getRoom(kept.room.code), 'reloaded lobby survives');

  const gone = createRoom('Bob');
  markConnected(gone.room, gone.player);
  markDisconnected(gone.room, gone.player, null, onDelete);
  t.mock.timers.tick(EMPTY_LOBBY_GRACE_MS);
  assert.equal(getRoom(gone.room.code), null);
  assert.deepEqual(deleted, [gone.room.code]);
});

test('a dealt game is not deleted when everyone disconnects (players can come back)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { room, players } = dealtTable(4);
  for (const p of players) markConnected(room, p);
  for (const p of players) markDisconnected(room, p);
  t.mock.timers.tick(DEALER_GRACE_MS + EMPTY_LOBBY_GRACE_MS);
  assert.ok(getRoom(room.code));
});

test('sweep: abandoned lobbies go after 10 min, abandoned games after 2 h', () => {
  const lobby = createRoom('Ann').room;
  const { room: game } = dealtTable(4);
  const now = Date.now();

  sweepRooms(now + 10 * 60 * 1000 + 1_000);
  assert.equal(getRoom(lobby.code), null);
  assert.ok(getRoom(game.code));

  sweepRooms(now + 2 * 60 * 60 * 1000 + 1_000);
  assert.equal(getRoom(game.code), null);
});

test('sweep never deletes a room with someone connected', () => {
  const { room, player } = createRoom('Ann');
  markConnected(room, player);
  sweepRooms(Date.now() + 24 * 60 * 60 * 1000);
  assert.ok(getRoom(room.code));
});
