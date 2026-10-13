// Shared client utilities: session (localStorage), fetch and navigation.
import { t, localizeServerError } from '/i18n.js';

const SESSION_PREFIX = 'treachery:'; // + CODE  -> { token, playerId, name }
const NAME_KEY = 'treachery:name';

/**
 * Optional multi-user isolation for the local lab: `?slot=1` (or any short
 * token) namespaces every localStorage key so several iframes / tabs on the
 * same origin can sit as different players. Absent in real play.
 */
export function currentSlot() {
  try {
    return (new URLSearchParams(location.search).get('slot') || '').trim();
  } catch {
    return '';
  }
}

function scoped(key, slot) {
  const s = slot === undefined ? currentSlot() : slot;
  return s ? `${key}::${s}` : key;
}

/** Appends the current `slot` query param to an in-app path, if any. */
export function withSlot(url, slot) {
  const s = slot === undefined ? currentSlot() : slot;
  if (!s) return url;
  const u = new URL(url, location.origin);
  u.searchParams.set('slot', s);
  return u.pathname + u.search;
}

/** Saves the session for a room. `slot` isolates this seat in the lab. */
export function saveSession(code, data, slot) {
  localStorage.setItem(scoped(SESSION_PREFIX + code.toUpperCase(), slot), JSON.stringify(data));
}

/** Returns the saved session for a room, or null. */
export function getSession(code, slot) {
  try {
    const raw = localStorage.getItem(scoped(SESSION_PREFIX + code.toUpperCase(), slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasSession(code, slot) {
  const s = getSession(code, slot);
  return !!(s && s.token);
}

/**
 * Lists room codes with a saved session for the current slot. Skips the
 * name/role/unveil/locale keys (only bare `treachery:CODE` entries match).
 */
export function listRoomCodes(slot) {
  const s = slot === undefined ? currentSlot() : slot;
  const suffix = s ? `::${s}` : '';
  const codes = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(SESSION_PREFIX)) continue;
    let rest = k.slice(SESSION_PREFIX.length);
    if (suffix) {
      if (!rest.endsWith(suffix)) continue;
      rest = rest.slice(0, -suffix.length);
    } else if (rest.includes('::')) {
      continue; // belongs to a lab slot, not this (unscoped) context
    }
    if (/^[A-Z]{4}$/.test(rest)) codes.push(rest);
  }
  return codes;
}

/**
 * Probes every saved session against the server. Rooms that no longer exist
 * (404) or whose token is no longer valid get their stale session cleared;
 * transient network errors are left untouched. Resolves to the live ones.
 * @returns {Promise<Array<{code:string, name:string}>>}
 */
export async function findResumableRooms(slot) {
  const live = [];
  for (const code of listRoomCodes(slot)) {
    const session = getSession(code, slot);
    if (!session?.token) { clearSession(code, slot); continue; }
    try {
      const res = await fetch(`/api/rooms/${code}`, { headers: { Authorization: 'Bearer ' + session.token } });
      if (res.status !== 404 && !res.ok) continue; // transient server error: keep the session
      const data = res.ok ? await res.json() : null;
      if (data?.you) { live.push({ code, name: session.name || data.you.name || '' }); continue; }
      // The server no longer knows this seat (room gone, or the server restarted).
      // A card from a recent deal is still worth going back to: the room page
      // shows it offline. Anything else is stale.
      if (getRecentRole(code, slot)) live.push({ code, name: session.name || '' });
      else clearSession(code, slot);
    } catch {
      // Network error — don't destroy a possibly-valid session.
    }
  }
  return live;
}

/** Clears the session for a room (e.g. invalid token after a server restart). */
export function clearSession(code, slot) {
  const c = code.toUpperCase();
  localStorage.removeItem(scoped(SESSION_PREFIX + c, slot));
  localStorage.removeItem(scoped(ROLE_PREFIX + c, slot));
  localStorage.removeItem(scoped(UNVEIL_PREFIX + c, slot));
}

/** Drops every namespaced key for a lab slot (home name, leftover rooms, …). */
export function clearSlot(slot) {
  if (!slot) return;
  const suffix = `::${slot}`;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.endsWith(suffix)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

// ---- Per-room gameplay cache -------------------------------------------------
// Once dealt, the role/card never change until a re-deal. Caching them (plus
// the private unveil flag) lets a player see their card, flip it, and read the
// rules with NO server round-trip — so the host can safely sleep mid-game.

const ROLE_PREFIX = 'treachery:role:';     // + CODE -> { role, card, cardBack, dealtAt }
const UNVEIL_PREFIX = 'treachery:unveil:'; // + CODE -> "1" | absent (private, per player)

/** Caches the dealt role/card for a room. Include dealtAt to detect re-deals. */
export function saveRole(code, data, slot) {
  localStorage.setItem(scoped(ROLE_PREFIX + code.toUpperCase(), slot), JSON.stringify(data));
}
/** Returns the cached role/card for a room, or null. */
export function getRole(code, slot) {
  try {
    const raw = localStorage.getItem(scoped(ROLE_PREFIX + code.toUpperCase(), slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * How long after a deal a cached card still belongs to "the game at the table".
 * Within this window a room the server lost (restart, sleep, redeploy) keeps
 * showing your card; older caches are just leftovers.
 */
const RECENT_DEAL_MS = 6 * 60 * 60 * 1000;

/** The cached role/card if it comes from a recent deal, or null. */
export function getRecentRole(code, slot) {
  const cached = getRole(code, slot);
  if (!cached?.role || !cached.dealtAt) return null;
  return Date.now() - cached.dealtAt < RECENT_DEAL_MS ? cached : null;
}

/** The unveil flag is private to this player; we keep it purely client-side. */
export function getUnveil(code, slot) {
  return localStorage.getItem(scoped(UNVEIL_PREFIX + code.toUpperCase(), slot)) === '1';
}
export function setUnveil(code, value, slot) {
  const key = scoped(UNVEIL_PREFIX + code.toUpperCase(), slot);
  if (value) localStorage.setItem(key, '1');
  else localStorage.removeItem(key);
}

/** Name remembered across screens (convenience). */
export function getName(slot) {
  return localStorage.getItem(scoped(NAME_KEY, slot)) || '';
}
export function setName(name, slot) {
  localStorage.setItem(scoped(NAME_KEY, slot), name);
}

/** Shows an error in the #error container if present. */
export function showError(msg) {
  const text = localizeServerError(msg) || msg;
  const el = document.getElementById('error');
  if (!el) return alert(text);
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(showError._t);
  showError._t = setTimeout(() => el.classList.add('hidden'), 5000);
}

async function postJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Runs a create/join request with the screen's buttons locked. On a slow
 * network (or a host waking up) people tap again, and every extra request is
 * an extra seat. The buttons stay locked when the action navigates away.
 * @param {HTMLButtonElement[]} buttons  every button that submits this screen
 * @param {HTMLButtonElement} active     the tapped one (shows a spinner)
 * @param {() => Promise<boolean>} action resolves true when it navigated away
 */
export async function lockWhile(buttons, active, action) {
  if (buttons.some((b) => b.disabled)) return;
  for (const b of buttons) b.disabled = true;
  active.setAttribute('aria-busy', 'true');
  let navigating = false;
  try {
    navigating = await action();
  } finally {
    if (!navigating) {
      for (const b of buttons) b.disabled = false;
      active.removeAttribute('aria-busy');
    }
  }
}

/** Creates a room and navigates to the lobby. Resolves true if it navigated. */
export async function createRoom(name, rarity = 'U') {
  try {
    const { res, data } = await postJson('/api/rooms', { name, rarity });
    if (!res.ok) { showError(data.error || t('error.create')); return false; }
    saveSession(data.roomCode, { token: data.token, playerId: data.playerId, name });
    // replace (not href) so 'back' from the room skips these entry screens -> Home.
    location.replace(withSlot(`/room/${data.roomCode}`));
    return true;
  } catch {
    showError(t('error.connection'));
    return false;
  }
}

/**
 * Joins a room. If a session is already saved, goes straight in (reconnection).
 * Resolves true if it navigated.
 */
export async function joinExisting(code, name) {
  code = code.toUpperCase();
  if (hasSession(code)) {
    location.replace(withSlot(`/room/${code}`));
    return true;
  }
  try {
    const { res, data } = await postJson(`/api/rooms/${code}/join`, { name });
    if (!res.ok) { showError(data.error || t('error.join')); return false; }
    saveSession(code, { token: data.token, playerId: data.playerId, name });
    // replace (not href) so 'back' from the room skips these entry screens -> Home.
    location.replace(withSlot(`/room/${code}`));
    return true;
  } catch {
    showError(t('error.connection'));
    return false;
  }
}
