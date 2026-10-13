// Multi-user lab: one desktop window, N isolated "phones" (iframes with ?slot=).
import { saveSession, setName, clearSlot } from '/app.js';

const NAMES = ['Ann', 'Bob', 'Cam', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal'];
// Phones the lab can emulate. Each page gets the viewport its browser really
// leaves it, with the bars expanded as on page load (screen minus status bar
// and browser bars; same numbers as Playwright's device profiles). Devices are
// drawn at real size and only scaled down to fit the window (fitPhones). Pixel
// density can't be emulated inside an iframe.
const IPHONE = { browser: 'Safari', kind: 'iphone', statusH: 59, topH: 0, bottomH: 134, bezel: 12, radius: 55 };
const PIXEL = { browser: 'Chrome', kind: 'android', statusH: 24, topH: 52, bottomH: 0, bezel: 9, radius: 38 };
const DEVICES = {
  'iphone-61': { ...IPHONE, label: 'iPhone 6.1″', model: 'iPhone 15 / 16', screenW: 393, screenH: 852 },
  'iphone-63': { ...IPHONE, label: 'iPhone 6.3″', model: 'iPhone 16 Pro / 17', screenW: 402, screenH: 874 },
  'iphone-67': { ...IPHONE, label: 'iPhone 6.7″', model: 'iPhone 15 Pro Max / 16 Plus', screenW: 430, screenH: 932 },
  'iphone-69': { ...IPHONE, label: 'iPhone 6.9″', model: 'iPhone 16 / 17 Pro Max', screenW: 440, screenH: 956 },
  'android-360': { ...PIXEL, label: 'Android 6.3″', model: 'Pixel 9', screenW: 360, screenH: 808 },
  'android-412': { ...PIXEL, label: 'Android 6.2″', model: 'Pixel 8', screenW: 412, screenH: 915 },
  'android-448': { ...PIXEL, label: 'Android 6.8″', model: 'Pixel 9 Pro XL', screenW: 448, screenH: 997 },
};
// Four typical phones by default (two iPhone sizes and the two common Android
// widths); phones 5–8 repeat them. Each phone remembers its own pick.
const DEFAULT_DEVICES = ['iphone-67', 'iphone-61', 'android-412', 'android-360'];
const deviceKey = (slot) => `treachery:lab:device:${slot}`;
function deviceIdFor(slot, index) {
  const saved = localStorage.getItem(deviceKey(slot));
  return DEVICES[saved] ? saved : DEFAULT_DEVICES[index % DEFAULT_DEVICES.length];
}
const viewportOf = (d) => ({ w: d.screenW, h: d.screenH - d.statusH - d.topH - d.bottomH });
const outerOf = (d) => ({ w: d.screenW + 2 * d.bezel, h: d.screenH + 2 * d.bezel });

const phonesEl = document.getElementById('phones');
const statusEl = document.getElementById('status');
const scaleEl = document.getElementById('scale');
const fillBtn = document.getElementById('fill-btn');
const blankBtn = document.getElementById('blank-btn');
const resetBtn = document.getElementById('reset-btn');

let playerCount = 4;
let rarity = 'U';
let lastCode = null;
let lastDealerToken = null;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error-text', isError);
}

function bindSegmented(id, attr, onChange) {
  const box = document.getElementById(id);
  box.addEventListener('click', (e) => {
    const btn = e.target.closest(`[${attr}]`);
    if (!btn) return;
    for (const b of box.children) b.classList.toggle('active', b === btn);
    onChange(btn.getAttribute(attr));
  });
}

bindSegmented('count', 'data-n', (n) => { playerCount = Number(n); });
bindSegmented('rarity', 'data-rarity', (r) => { rarity = r; });

async function postJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function slotOf(i) {
  return String(i + 1);
}

function clearAllSlots() {
  for (let i = 0; i < 8; i++) clearSlot(slotOf(i));
}

/**
 * Sizes every device like the real phone: never bigger than 1:1, shrunk just
 * enough for the tallest phone (label included) to fit the window. If shrinking
 * a little more fits the whole table on one row (4 phones on a laptop), do that.
 * One scale for all, so their real sizes compare.
 */
function fitPhones() {
  const phones = [...phonesEl.children];
  const pad = getComputedStyle(phonesEl);
  const padY = parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom);
  const padX = parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight);
  const gap = parseFloat(pad.columnGap) || 0;
  const top = document.querySelector('.lab-bar').offsetHeight;
  const label = (phonesEl.querySelector('.phone-bar')?.offsetHeight ?? 26) + 8; // + gap
  const sizes = phones.map((p) => outerOf(DEVICES[p.dataset.device]));
  const tallest = Math.max(1, ...sizes.map((z) => z.h));
  const widest = Math.max(1, ...sizes.map((z) => z.w));
  const width = innerWidth - padX - 8; // the side buttons overhang the edges
  let scale = Math.min(1, (innerHeight - top - padY - label) / tallest, width / widest);
  const oneRow = (width - gap * (phones.length - 1)) / sizes.reduce((sum, z) => sum + z.w, 0);
  if (phones.length > 1 && oneRow < scale && oneRow >= 0.85 * scale) scale = oneRow;
  phonesEl.style.setProperty('--device-scale', String(scale));
  phones.forEach((p, i) => {
    p.style.setProperty('--device-w', `${Math.floor(sizes[i].w * scale)}px`);
    p.style.setProperty('--device-h', `${Math.floor(sizes[i].h * scale)}px`);
  });
  scaleEl.textContent = `Phones at ${Math.round(scale * 100)}% of real size`;
}

/** Puts a phone on a device: its geometry vars and its bars (the iframe stays put). */
function setDevice(phone, id) {
  const d = DEVICES[id];
  phone.dataset.device = id;
  const vars = { 'screen-w': d.screenW, 'screen-h': d.screenH, 'status-h': d.statusH, 'top-h': d.topH, 'bottom-h': d.bottomH, bezel: d.bezel, radius: d.radius };
  for (const [name, px] of Object.entries(vars)) phone.style.setProperty(`--${name}`, `${px}px`);
  renderChrome(phone.querySelector('.device'), d);
  const pick = phone.querySelector('.device-pick');
  pick.value = id;
  pick.title = `${d.model} · ${d.browser}`;
}

// Inline icons (dark mode), drawn at their real point size.
const svg = (w, h, body, extra = '') =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
const ICONS = {
  signal: `<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>`,
  wifi: svg(17, 12, '<path d="M1.5 4.5a10 10 0 0 1 14 0M4.2 7.3a6 6 0 0 1 8.6 0"/><circle cx="8.5" cy="10.3" r="1.3" fill="currentColor" stroke="none"/>'),
  battery: `<svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor"/><path d="M25 4.5v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.45"/></svg>`,
  reload: svg(18, 18, '<path d="M15.5 9a6.5 6.5 0 1 1-1.9-4.6"/><path d="M15.6 2.2v3.6H12"/>'),
  back: svg(24, 24, '<path d="M15 4.5 7.5 12l7.5 7.5"/>', 'stroke-width="2.4"'),
  forward: svg(24, 24, '<path d="m9 4.5 7.5 7.5L9 19.5"/>', 'stroke-width="2.4"'),
  share: svg(24, 24, '<path d="M8.5 9.5H6.8A1.8 1.8 0 0 0 5 11.3v8A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.7v-8a1.8 1.8 0 0 0-1.8-1.8h-1.7M12 14V3M8.5 6.5 12 3l3.5 3.5"/>'),
  bookmarks: svg(24, 24, '<path d="M12 6.5C10 5 7 4.5 3.5 5.3v13.4C7 18 10 18.5 12 20c2-1.5 5-2 8.5-1.3V5.3C17 4.5 14 5 12 6.5ZM12 6.5V20"/>'),
  tabs: svg(24, 24, '<rect x="3.5" y="7.5" width="13" height="13" rx="2.2"/><path d="M7.5 7.5V5.7a2.2 2.2 0 0 1 2.2-2.2h9.1a2.2 2.2 0 0 1 2.2 2.2v9.1a2.2 2.2 0 0 1-2.2 2.2h-2.3"/>'),
  // Android: vertical battery, Chrome's page-info and menu icons.
  batteryV: `<svg width="9" height="15" viewBox="0 0 9 15" fill="currentColor"><rect x="2.5" y="0" width="4" height="2" rx="0.6"/><rect x="0" y="1.5" width="9" height="13.5" rx="1.8"/></svg>`,
  tune: svg(18, 18, '<path d="M3 5.5h7M14 5.5h1M3 12.5h1M8 12.5h7"/><circle cx="12" cy="5.5" r="2"/><circle cx="6" cy="12.5" r="2"/>', 'stroke-width="1.8"'),
  more: `<svg width="4" height="18" viewBox="0 0 4 18" fill="currentColor"><circle cx="2" cy="3" r="2"/><circle cx="2" cy="9" r="2"/><circle cx="2" cy="15" r="2"/></svg>`,
};

// Browser and system bars around the page, per device kind.
const CHROME = {
  iphone: () => ({
    status: `<span class="ear left">9:41</span><span class="island"></span>
      <span class="ear right">${ICONS.signal}${ICONS.wifi}${ICONS.battery}</span>`,
    top: '',
    bottom: `<div class="address"><span class="aa">aA</span><span class="host">${location.hostname}</span>${ICONS.reload}</div>
      <div class="toolbar">${ICONS.back}<span class="off">${ICONS.forward}</span>${ICONS.share}${ICONS.bookmarks}${ICONS.tabs}</div>
      <span class="home-indicator"></span>`,
  }),
  android: () => ({
    status: `<span class="clock">9:41</span><span class="camera"></span>
      <span class="icons">${ICONS.wifi}${ICONS.signal}${ICONS.batteryV}</span>`,
    top: `<div class="omnibox">${ICONS.tune}<span class="host">${location.hostname}</span></div>
      <span class="tab-count">1</span>${ICONS.more}`,
    bottom: '<span class="gesture-bar"></span>',
  }),
};

/** Paints a device's system and browser bars for its kind. */
function renderChrome(dev, d) {
  const parts = CHROME[d.kind]();
  dev.dataset.kind = d.kind;
  dev.querySelector('.status-bar').innerHTML = parts.status;
  dev.querySelector('.top-bar').innerHTML = parts.top;
  dev.querySelector('.bottom-bar').innerHTML = parts.bottom;
}

/** The phone around a player's iframe: bezel, side buttons, system + browser bars. */
function deviceFrame(iframe) {
  const slot = document.createElement('div');
  slot.className = 'device-slot';
  slot.innerHTML = `
    <div class="device">
      <span class="btn b1"></span><span class="btn b2"></span>
      <span class="btn b3"></span><span class="btn b4"></span>
      <div class="screen">
        <div class="status-bar"></div>
        <div class="top-bar"></div>
        <div class="viewport"></div>
        <div class="bottom-bar"></div>
      </div>
    </div>`;
  slot.querySelector('.viewport').append(iframe);
  return slot;
}

function renderPhones(count, srcForSlot) {
  phonesEl.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const slot = slotOf(i);
    const name = NAMES[i];
    const phone = document.createElement('div');
    phone.className = 'phone';

    const bar = document.createElement('div');
    bar.className = 'phone-bar';
    const slotEl = document.createElement('span');
    slotEl.className = 'slot';
    slotEl.textContent = `P${slot}`;
    const nameEl = document.createElement('span');
    nameEl.className = 'name';
    nameEl.textContent = name;
    const pick = document.createElement('select');
    pick.className = 'device-pick';
    pick.setAttribute('aria-label', `Phone for ${name}`);
    for (const [id, d] of Object.entries(DEVICES)) {
      const vp = viewportOf(d);
      pick.append(new Option(`${d.label} · ${vp.w}×${vp.h}`, id));
    }
    pick.addEventListener('change', () => {
      localStorage.setItem(deviceKey(slot), pick.value);
      setDevice(phone, pick.value);
      fitPhones();
    });
    const pop = document.createElement('button');
    pop.type = 'button';
    pop.className = 'pop-out';
    pop.textContent = '↗';
    pop.title = 'Pop out: open this player in a new window';
    pop.setAttribute('aria-label', `Pop out ${name}`);
    bar.append(slotEl, nameEl, pick, pop);

    const iframe = document.createElement('iframe');
    iframe.title = `${name} (player ${slot})`;
    iframe.src = srcForSlot(slot, name);

    pop.addEventListener('click', () => {
      const url = iframe.contentWindow?.location?.href || iframe.src;
      // Same size as the in-frame viewport: what the browser leaves the page.
      const vp = viewportOf(DEVICES[phone.dataset.device]);
      window.open(url, `treachery-slot-${slot}`, `width=${vp.w},height=${vp.h}`);
    });

    phone.append(bar, deviceFrame(iframe));
    setDevice(phone, deviceIdFor(slot, i));
    phonesEl.append(phone);
  }
  fitPhones();
}

async function closeLastRoom() {
  if (!lastCode || !lastDealerToken) return;
  try {
    await postJson(`/api/rooms/${lastCode}/close`, {}, lastDealerToken);
  } catch {
    /* room may already be gone */
  }
  lastCode = null;
  lastDealerToken = null;
}

function seedNames(count) {
  for (let i = 0; i < count; i++) setName(NAMES[i], slotOf(i));
}

blankBtn.addEventListener('click', async () => {
  await closeLastRoom();
  clearAllSlots();
  seedNames(playerCount);
  renderPhones(playerCount, (slot) => `/home?slot=${encodeURIComponent(slot)}`);
  setStatus(`${playerCount} blank phones. Create a room on one and join from the others.`);
});

fillBtn.addEventListener('click', async () => {
  fillBtn.disabled = true;
  setStatus('Seating players…');
  try {
    await closeLastRoom();
    clearAllSlots();
    seedNames(playerCount);

    const created = await postJson('/api/rooms', { name: NAMES[0], rarity });
    if (!created.res.ok) {
      setStatus(created.data.error || 'Could not create the room.', true);
      return;
    }
    const code = created.data.roomCode;
    saveSession(code, {
      token: created.data.token,
      playerId: created.data.playerId,
      name: NAMES[0],
    }, '1');
    lastCode = code;
    lastDealerToken = created.data.token;

    for (let i = 1; i < playerCount; i++) {
      const joined = await postJson(`/api/rooms/${code}/join`, { name: NAMES[i] });
      if (!joined.res.ok) {
        setStatus(joined.data.error || `Could not seat ${NAMES[i]}.`, true);
        return;
      }
      saveSession(code, {
        token: joined.data.token,
        playerId: joined.data.playerId,
        name: NAMES[i],
      }, slotOf(i));
    }

    renderPhones(playerCount, (slot) => `/room/${code}?slot=${encodeURIComponent(slot)}`);
    setStatus(`Room ${code} — ${playerCount} players seated. Ann is the dealer.`);
  } catch {
    setStatus('Connection error with the server.', true);
  } finally {
    fillBtn.disabled = false;
  }
});

resetBtn.addEventListener('click', async () => {
  await closeLastRoom();
  clearAllSlots();
  phonesEl.innerHTML = '';
  setStatus('Cleared. Start a table, or open blank phones.');
});

window.addEventListener('resize', fitPhones);
// The bar wraps onto more lines in narrow windows, leaving less height.
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(fitPhones).observe(document.querySelector('.lab-bar'));
}
fitPhones();

// First paint: a ready-to-play table so the lab is useful on open.
fillBtn.click();
