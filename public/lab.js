// Multi-user lab: one desktop window, N isolated "phones" (iframes with ?slot=).
import { saveSession, setName, clearSlot } from '/app.js';

const NAMES = ['Ann', 'Bob', 'Cam', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal'];
// Every frame is a 6.7" iPhone (15 Pro Max / 16 Plus, 430×932 pt) running
// Safari. The status bar and Safari's bottom bar take 193 pt, so each page gets
// the 430×739 viewport Safari really leaves it (bars expanded, as on page
// load; same numbers as Playwright's device profiles). The device is drawn at
// real size and scaled down only to fit the window (fitPhones). Pixel density
// can't be emulated inside an iframe.
const DEVICE = {
  label: 'iPhone 6.7″ · Safari',
  screenW: 430,
  screenH: 932,
  statusH: 59,   // status bar around the Dynamic Island
  browserH: 134, // address field + toolbar + home indicator
  bezel: 12,
};
const VIEWPORT_W = DEVICE.screenW;
const VIEWPORT_H = DEVICE.screenH - DEVICE.statusH - DEVICE.browserH; // 739
const DEVICE_W = DEVICE.screenW + 2 * DEVICE.bezel;
const DEVICE_H = DEVICE.screenH + 2 * DEVICE.bezel;

const phonesEl = document.getElementById('phones');
const statusEl = document.getElementById('status');
const deviceEl = document.getElementById('device');
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

// The frame's geometry lives here; lab.html's CSS reads it from these vars.
phonesEl.style.setProperty('--screen-w', `${DEVICE.screenW}px`);
phonesEl.style.setProperty('--screen-h', `${DEVICE.screenH}px`);
phonesEl.style.setProperty('--status-h', `${DEVICE.statusH}px`);
phonesEl.style.setProperty('--browser-h', `${DEVICE.browserH}px`);
phonesEl.style.setProperty('--bezel', `${DEVICE.bezel}px`);

/**
 * Sizes every device like the real phone: never bigger than 1:1, shrunk just
 * enough for a whole phone (label included) to fit the window. If shrinking a
 * little more fits the whole table on one row (4 phones on a laptop), do that.
 * One scale for all, so they match.
 */
function fitPhones() {
  const pad = getComputedStyle(phonesEl);
  const padY = parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom);
  const padX = parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight);
  const gap = parseFloat(pad.columnGap) || 0;
  const top = document.querySelector('.lab-bar').offsetHeight;
  const label = (phonesEl.querySelector('.phone-bar')?.offsetHeight ?? 26) + 8; // + gap
  const width = innerWidth - padX - 8; // the side buttons overhang the edges
  let scale = Math.min(1, (innerHeight - top - padY - label) / DEVICE_H, width / DEVICE_W);
  const count = phonesEl.children.length;
  const oneRow = (width - gap * (count - 1)) / (DEVICE_W * count);
  if (count > 1 && oneRow < scale && oneRow >= 0.85 * scale) scale = oneRow;
  phonesEl.style.setProperty('--device-scale', String(scale));
  phonesEl.style.setProperty('--device-w', `${Math.floor(DEVICE_W * scale)}px`);
  phonesEl.style.setProperty('--device-h', `${Math.floor(DEVICE_H * scale)}px`);
  deviceEl.textContent = `${DEVICE.label} ${VIEWPORT_W}×${VIEWPORT_H} · ${Math.round(scale * 100)}%`;
}

// Inline icons (Safari dark mode), drawn at their real point size.
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
};

/** The phone around a player's iframe: bezel, status bar, Safari's bottom bar. */
function deviceFrame(iframe) {
  const slot = document.createElement('div');
  slot.className = 'device-slot';
  slot.innerHTML = `
    <div class="device">
      <span class="btn action"></span><span class="btn vol-up"></span>
      <span class="btn vol-down"></span><span class="btn power"></span>
      <div class="screen">
        <div class="status-bar">
          <span class="ear left">9:41</span>
          <span class="island"></span>
          <span class="ear right">${ICONS.signal}${ICONS.wifi}${ICONS.battery}</span>
        </div>
        <div class="viewport"></div>
        <div class="safari-bar">
          <div class="address"><span class="aa">aA</span><span class="host">${location.hostname}</span>${ICONS.reload}</div>
          <div class="toolbar">
            ${ICONS.back}<span class="off">${ICONS.forward}</span>${ICONS.share}${ICONS.bookmarks}${ICONS.tabs}
          </div>
          <span class="home-indicator"></span>
        </div>
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
    const pop = document.createElement('button');
    pop.type = 'button';
    pop.textContent = 'Pop out';
    pop.title = 'Open this player in a new window';
    bar.append(slotEl, nameEl, pop);

    const iframe = document.createElement('iframe');
    iframe.title = `${name} (player ${slot})`;
    iframe.src = srcForSlot(slot, name);

    pop.addEventListener('click', () => {
      const url = iframe.contentWindow?.location?.href || iframe.src;
      // Same size as the in-frame viewport: what Safari leaves the page.
      window.open(url, `treachery-slot-${slot}`, `width=${VIEWPORT_W},height=${VIEWPORT_H}`);
    });

    phone.append(bar, deviceFrame(iframe));
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
