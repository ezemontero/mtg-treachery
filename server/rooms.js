import { randomUUID } from 'node:crypto';
import { dealRoles, canDeal, ROLE_TABLE, MAX_PLAYERS } from './deal.js';
import { assignCards, normalizeRarity, DEFAULT_RARITY } from './cards.js';

/**
 * Server state: EVERYTHING lives in memory. Restarting the process = new game.
 * (The model is serializable, so it could later be dumped to a file or to
 * node:sqlite without changing the shape of the data.)
 */

/** Milliseconds we wait after the dealer drops before transferring control. */
export const DEALER_GRACE_MS = Number(process.env.DEALER_GRACE_MS) || 30_000;
/**
 * A never-started lobby is deleted this soon after its LAST player disconnects.
 * The short grace (not instant) absorbs a reload or a brief network blip so the
 * creator refreshing the page doesn't nuke the room before the socket reopens.
 */
export const EMPTY_LOBBY_GRACE_MS = Number(process.env.EMPTY_LOBBY_GRACE_MS) || 10_000;
/**
 * How long a fully-disconnected room survives before it gets swept.
 * The TTL is phase-aware: a game in progress (`dealt`) lingers long enough for
 * players to rejoin after a disconnect, but a room that never started (`lobby`)
 * is abandoned the moment everyone leaves — there is nothing worth keeping, and
 * holding it needlessly reserves its 4-letter code. A short grace still absorbs
 * transient drops (a phone changing networks, a quick reload).
 */
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;   // 2 h — a dealt game, awaiting rejoin
const LOBBY_TTL_MS = 10 * 60 * 1000;      // 10 min — a never-started lobby

/** TTL for a room given its phase. */
function ttlForPhase(phase) {
  return phase === 'lobby' ? LOBBY_TTL_MS : ROOM_TTL_MS;
}

/** Letters used for the room code (no I/O to avoid ambiguity when typing). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;

/** @type {Map<string, Room>} code -> Room */
const rooms = new Map();

/**
 * @typedef {Object} Player
 * @property {string} id        internal server seat id
 * @property {string} token     secret bearer that identifies that browser
 * @property {string} name
 * @property {?string} role     SECRET — server-only; null until dealt
 * @property {?string} card     identity card URL; public only once unveiled
 * @property {boolean} unveiled public reveal of identity (Leader starts true)
 * @property {boolean} defeated eliminated this deal; identity stays public
 * @property {boolean} connected presence based on a live socket
 * @property {number} lastSeen  Date.now() of the last socket close
 * @property {number} joinedAt  for seat ordering and dealer succession
 *
 * @typedef {Object} Room
 * @property {string} code
 * @property {Player[]} players  in arrival order (== succession order)
 * @property {'lobby'|'dealt'|'closed'} phase
 * @property {string} creatorId  the original creator (never changes)
 * @property {string} dealerId   who currently holds the Deal button
 * @property {?NodeJS.Timeout} dealerTimer  pending transfer timer
 * @property {?NodeJS.Timeout} emptyTimer   pending delete of an empty lobby
 * @property {number} createdAt
 * @property {?number} dealtAt
 */

function makeCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      // randomUUID is cryptographic; a simple index is enough for the code.
      const idx = Math.abs(hashChar(randomUUID(), i)) % CODE_ALPHABET.length;
      code += CODE_ALPHABET[idx];
    }
  } while (rooms.has(code));
  return code;
}

// Derives a pseudo-uniform char from a uuid without relying on Math.random.
function hashChar(uuid, salt) {
  const hex = uuid.replace(/-/g, '');
  const slice = hex.slice((salt * 2) % hex.length, ((salt * 2) % hex.length) + 4) || hex.slice(0, 4);
  return parseInt(slice, 16) || 0;
}

function makePlayer(name) {
  const now = Date.now();
  return {
    id: randomUUID(),
    token: randomUUID(),
    name: String(name || '').trim().slice(0, 12) || 'Player',
    role: null,
    card: null, // URL of the assigned identity card image; set on deal
    unveiled: false, // player has publicly revealed their identity (shared over WS)
    defeated: false, // eliminated this game; identity is public
    connected: false,
    lastSeen: now,
    joinedAt: now,
  };
}

/** Creates a new room with `creatorName` as the first player and dealer. */
export function createRoom(creatorName, rarity = DEFAULT_RARITY) {
  const code = makeCode();
  const creator = makePlayer(creatorName);
  const room = {
    code,
    players: [creator],
    phase: 'lobby',
    rarity: normalizeRarity(rarity), // rarity ceiling for the card pool (U/R/M)
    creatorId: creator.id,
    dealerId: creator.id,
    dealerTimer: null,
    emptyTimer: null,
    createdAt: Date.now(),
    dealtAt: null,
  };
  rooms.set(code, room);
  return { room, player: creator };
}

export function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase()) || null;
}

/** Finds a player by their token within a room. */
export function findPlayerByToken(room, token) {
  if (!room || !token) return null;
  return room.players.find((p) => p.token === token) || null;
}

/**
 * Adds a new player to a room that is still in the lobby.
 * @returns {{ok:true, room:Room, player:Player}|{ok:false, error:string, status:number}}
 */
export function joinRoom(code, name) {
  const room = getRoom(code);
  if (!room) return { ok: false, status: 404, error: 'Room not found.' };
  if (room.phase !== 'lobby') return { ok: false, status: 409, error: 'The game has already started.' };
  // Past the max the table could never start, so refuse at the door.
  if (room.players.length >= MAX_PLAYERS) return { ok: false, status: 409, error: 'The room is full (8 players max).' };
  const player = makePlayer(name);
  room.players.push(player);
  return { ok: true, room, player };
}

/**
 * Removes a seat from a lobby: only the dealer may, and never their own.
 * Lets the dealer clear ghost seats (a double tap, someone who left) before
 * Start, since every seat in the room is dealt a role.
 * @returns {{ok:true, room:Room, player:Player}|{ok:false, error:string, status:number}}
 */
export function kickPlayer(room, byPlayerId, targetId) {
  if (!room) return { ok: false, status: 404, error: 'Room not found.' };
  if (byPlayerId !== room.dealerId) return { ok: false, status: 403, error: 'Only the dealer can remove players.' };
  if (room.phase !== 'lobby') return { ok: false, status: 409, error: 'The game has already started.' };
  if (targetId === byPlayerId) return { ok: false, status: 400, error: "You can't remove your own seat." };
  const idx = room.players.findIndex((p) => p.id === targetId);
  if (idx === -1) return { ok: false, status: 404, error: 'Player not found.' };
  const [player] = room.players.splice(idx, 1);
  // The owner left for good: whoever holds control now owns the room.
  if (player.id === room.creatorId) room.creatorId = room.dealerId;
  return { ok: true, room, player };
}

/**
 * Deals roles. Only the current dealer may, only with 4–8 players.
 * `allowRedeal` lets the dealer re-shuffle a game already in progress
 * ("Deal again" / rematch); otherwise a fresh deal requires the lobby phase.
 * @returns {{ok:true, room:Room}|{ok:false, error:string, status:number}}
 */
export function dealRoom(room, byPlayerId, { allowRedeal = false } = {}) {
  if (!room) return { ok: false, status: 404, error: 'Room not found.' };
  if (room.phase === 'closed') return { ok: false, status: 409, error: 'The room is closed.' };
  if (room.phase === 'dealt' && !allowRedeal) {
    return { ok: false, status: 409, error: 'Roles have already been dealt.' };
  }
  if (byPlayerId !== room.dealerId) {
    return { ok: false, status: 403, error: 'Only the dealer can start the game.' };
  }
  if (!canDeal(room.players.length)) {
    return { ok: false, status: 422, error: 'Treachery is for 4–8 players.' };
  }
  const roles = dealRoles(room.players.length);
  const cards = assignCards(roles, room.rarity); // unique card per player, by role + rarity
  room.players.forEach((p, i) => {
    p.role = roles[i];
    p.card = cards[i];
    // The Leader is public from the start; everyone else begins concealed.
    p.unveiled = roles[i] === 'LEADER';
    p.defeated = false;
  });
  room.phase = 'dealt';
  room.dealtAt = Date.now();
  clearDealerTimer(room);
  clearEmptyTimer(room); // a dealt game is never swept as an "empty lobby"
  return { ok: true, room };
}

/**
 * Sets a player's public unveil state. Only valid once roles are dealt.
 * The Leader is always public and cannot re-conceal.
 * @returns {{ok:true, room:Room, player:Player}|{ok:false, error:string, status:number}}
 */
export function setUnveiled(room, player, unveiled) {
  if (!room) return { ok: false, status: 404, error: 'Room not found.' };
  if (!player) return { ok: false, status: 401, error: 'Not authenticated in this room.' };
  if (room.phase !== 'dealt') return { ok: false, status: 409, error: 'Roles have not been dealt yet.' };
  if (player.defeated) {
    player.unveiled = true;
    return { ok: true, room, player };
  }
  // The Leader is public by rule; ignore attempts to conceal them.
  player.unveiled = player.role === 'LEADER' ? true : !!unveiled;
  return { ok: true, room, player };
}

/**
 * Marks this player eliminated: identity becomes public and stays that way
 * until the next deal. Anyone in the room may mark themselves.
 */
export function setDefeated(room, player) {
  if (!room) return { ok: false, status: 404, error: 'Room not found.' };
  if (!player) return { ok: false, status: 401, error: 'Not authenticated in this room.' };
  if (room.phase !== 'dealt') return { ok: false, status: 409, error: 'Roles have not been dealt yet.' };
  player.defeated = true;
  player.unveiled = true;
  return { ok: true, room, player };
}

/**
 * Closes the room: only the dealer may. Marks it closed so every client is
 * told to return to the start, then removes it.
 * @returns {{ok:true, room:Room}|{ok:false, error:string, status:number}}
 */
export function closeRoom(room, byPlayerId) {
  if (!room) return { ok: false, status: 404, error: 'Room not found.' };
  if (byPlayerId !== room.dealerId) {
    return { ok: false, status: 403, error: 'Only the dealer can close the room.' };
  }
  room.phase = 'closed';
  clearDealerTimer(room);
  clearEmptyTimer(room);
  return { ok: true, room };
}

/** Actually deletes a closed room from memory (after clients were notified). */
export function deleteRoom(code) {
  const room = getRoom(code);
  if (room) { clearDealerTimer(room); clearEmptyTimer(room); }
  rooms.delete(String(code || '').toUpperCase());
}

// ---- Presence and dealer transfer -----------------------------------------

function clearDealerTimer(room) {
  if (room.dealerTimer) {
    clearTimeout(room.dealerTimer);
    room.dealerTimer = null;
  }
}

function clearEmptyTimer(room) {
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }
}

/** First connected player (in arrival order) other than `exceptId`. */
function nextConnectedPlayer(room, exceptId) {
  return room.players.find((p) => p.connected && p.id !== exceptId) || null;
}

/**
 * Marks a player as connected. If it's the creator returning during the lobby,
 * they reclaim the dealer role (cancelling a pending transfer, or re-taking it
 * if it already happened).
 * @param {(room:Room)=>void} onChange  callback to broadcast the new state
 */
export function markConnected(room, player, onChange) {
  player.connected = true;
  // Someone is back: cancel any pending delete of this (previously empty) lobby.
  clearEmptyTimer(room);
  if (room.phase === 'lobby' && player.id === room.creatorId && room.dealerId !== room.creatorId) {
    // The creator reclaims control on return (transfer is only "while away").
    room.dealerId = room.creatorId;
  }
  if (player.id === room.creatorId) clearDealerTimer(room);
  onChange?.(room);
}

/**
 * Marks a player as disconnected. If it's the current dealer in the lobby,
 * starts the grace timer to transfer control. If this empties a never-started
 * lobby entirely, schedules the room's deletion after a short grace.
 * @param {(room:Room)=>void} onChange
 * @param {(code:string)=>void} [onDelete]  called once the empty lobby is deleted
 */
export function markDisconnected(room, player, onChange, onDelete) {
  player.connected = false;
  player.lastSeen = Date.now();

  // A never-started lobby with nobody left has nothing worth keeping: delete it
  // after a short grace (so a reload/blip doesn't drop it mid-reconnect).
  if (room.phase === 'lobby' && !room.players.some((p) => p.connected) && !room.emptyTimer) {
    room.emptyTimer = setTimeout(() => {
      room.emptyTimer = null;
      // Re-check: still a lobby, still empty (nobody reconnected in the meantime).
      if (room.phase !== 'lobby' || room.players.some((p) => p.connected)) return;
      clearDealerTimer(room);
      rooms.delete(room.code);
      onDelete?.(room.code);
    }, EMPTY_LOBBY_GRACE_MS);
    room.emptyTimer.unref?.();
  }

  if (room.phase === 'lobby' && player.id === room.dealerId && !room.dealerTimer) {
    room.dealerTimer = setTimeout(() => {
      room.dealerTimer = null;
      // Re-check conditions: still in lobby and the dealer is still down.
      const dealer = room.players.find((p) => p.id === room.dealerId);
      if (room.phase !== 'lobby' || (dealer && dealer.connected)) return;
      const heir = nextConnectedPlayer(room, room.dealerId);
      if (heir) {
        room.dealerId = heir.id;
        onChange?.(room);
      }
    }, DEALER_GRACE_MS);
    // Don't let this timer keep the process alive.
    room.dealerTimer.unref?.();
  }
  onChange?.(room);
}

// ---- Public serialization (the ONLY place that exposes state to others) ----

/** Remaining Traitor/Assassin/Guardian seats still in play (Leader omitted). */
function remainingRoleCounts(room) {
  const mix = ROLE_TABLE[room.players.length];
  if (!mix) return null;
  const counts = { TRAITOR: mix.TRAITOR, ASSASSIN: mix.ASSASSIN, GUARDIAN: mix.GUARDIAN };
  if (room.phase !== 'dealt') return counts;
  for (const p of room.players) {
    if (!p.defeated || counts[p.role] == null) continue;
    counts[p.role] = Math.max(0, counts[p.role] - 1);
  }
  return counts;
}

/**
 * Builds the PUBLIC view of the room. This is the only place allowed to
 * serialize state to clients. It NEVER leaks `token`, nor a concealed player's
 * `role`/`card`. Once dealt, a player who has unveiled makes their role and
 * card image public (the Leader is unveiled automatically).
 *
 * @param {Room} room
 * @param {?Player} viewer  the player looking (to compute youCanDeal); optional
 */
export function toPublicRoom(room, viewer = null) {
  const dealt = room.phase === 'dealt';
  return {
    code: room.code,
    phase: room.phase,
    dealtAt: room.dealtAt, // lets clients detect a re-deal and refresh their cached card
    playerCount: room.players.length,
    dealerId: room.dealerId,
    creatorId: room.creatorId,
    canDeal: canDeal(room.players.length),
    youAreDealer: !!viewer && viewer.id === room.dealerId,
    youCanDeal: !!viewer && viewer.id === room.dealerId && room.phase === 'lobby' && canDeal(room.players.length),
    you: viewer ? { id: viewer.id, name: viewer.name } : null,
    // Remaining public mix (no Leader — always 1). Defeated seats drop out.
    roleCounts: remainingRoleCounts(room),
    players: room.players.map((p) => {
      const unveiled = dealt && !!p.unveiled;
      return {
        id: p.id,
        name: p.name,
        connected: p.connected,
        isDealer: p.id === room.dealerId,
        defeated: dealt && !!p.defeated,
        // The Leader is public by rule; anyone else becomes public by unveiling.
        isLeader: dealt && p.role === 'LEADER',
        unveiled,
        // Only expose role/card once the player is publicly unveiled.
        role: unveiled ? p.role : null,
        card: unveiled ? p.card : null,
      };
    }),
  };
}

// ---- Cleanup of abandoned rooms --------------------------------------------

/**
 * Deletes rooms where everyone has been disconnected longer than the TTL for
 * the room's phase. A never-started lobby is swept quickly (LOBBY_TTL_MS); a
 * dealt game lingers (ROOM_TTL_MS) so players can rejoin after a drop.
 */
export function sweepRooms(now = Date.now()) {
  for (const [code, room] of rooms) {
    const anyConnected = room.players.some((p) => p.connected);
    if (anyConnected) continue;
    const lastActivity = Math.max(room.createdAt, ...room.players.map((p) => p.lastSeen));
    if (now - lastActivity > ttlForPhase(room.phase)) {
      clearDealerTimer(room);
      rooms.delete(code);
    }
  }
}

/** For tests / diagnostics only. */
export function _rooms() {
  return rooms;
}
