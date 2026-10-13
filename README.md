# 🎴 MTG Treachery

A homemade web app to play the hidden-role Magic: The Gathering variant
**[MTG Treachery](https://mtgtreachery.net)**. It secretly deals each player an
identity (Leader, Guardian, Assassin or Traitor) with its card, on their own
phone. It does **not run the Magic game itself** (life totals, turns, etc.): it
deals the identities, keeps them secret, and shows what the table has revealed.

One computer hosts the server and everyone else joins from their phone, on the
same WiFi, by scanning a QR code; nobody installs anything.

## How to play

1. Someone opens the app, enters their name, picks the **card rarity** and taps
   **Create room** → a **4-letter code** and a **QR code** appear.
2. Everyone else scans the QR (or types the code on the home screen) and enters
   their name.
3. Once everyone is in (**4 to 8 players**), whoever created the room taps
   **Start**. Until then, the screen says how many players are missing.
   - Every seat in the room is dealt a role, so the creator can remove one with
     **✕** next to the name (someone who joined twice, or left). Offline players
     are flagged before dealing.
4. Each player sees **their card face down**: tap it to flip it and see your
   identity; tap again to hide it. It hides itself after 10 seconds, or when the
   phone locks or the app goes to the background.
   - The **Leader** is public (it's open information in the game): their card
     stays face up and everyone sees a crown next to their name.
5. When you use your **Unveil** ability at the table, flip the **Unveil** switch
   and confirm: your identity becomes **public**. Every phone shows your role
   icon, and anyone can tap your name to see your card. Turning the switch off
   hides it again, but the table has already seen it.
6. When you're eliminated, tap **Surrender** and accept: you're marked
   **Defeated** and your identity is revealed until the next deal. The line above
   the player list counts the Traitors, Assassins and Guardians still in play.

Whoever controls the room also gets:

- **Restart**: deals fresh identities to the same players, no need to rejoin.
  Great for several games in a row.
- **End Game**: closes the room; everyone returns to the start screen.

Every screen has **Rules** (with an example 5-player table) and **Cards** (the
whole card gallery, by role and rarity) in the header, and the language selector
(**en-US** / **es-AR**) in the footer.

### Card rarity

Rarity reflects how **complex** an identity is to play, not how powerful it is.
The choice is a ceiling: **Uncommon** deals only uncommon cards, **Rare** adds the
rares, and **Mythic** adds the mythics. Each player gets a different card. The
*Special* cards appear in the gallery but are never dealt.

## Hosting

### From source

Requirements: **Node.js 24 or newer**, and every player on the **same WiFi**.

```bash
npm install
npm start
```

The console prints the addresses and a QR code:

```
  On this machine:   http://localhost:3000
  Share on the LAN:  http://192.168.1.47:3000   ← share this one
```

- Players scan the QR (in the console or in the room) or open the LAN address.
- To show a big QR on the host's screen, open `http://localhost:3000/host`.
- To use another port: `PORT=4000 npm start`.

> **macOS firewall:** the first time a phone connects, macOS may ask whether to
> allow incoming connections for `node`. Allow it, or phones can't reach the
> server.

### Standalone executables (no Node needed)

For hosts who'd rather not install Node: download a ready-made executable from
[Releases](https://github.com/ezemontero/mtg-treachery/releases), or build them:

```bash
npm run package
```

This produces, in `dist/`, two flavors for macOS (Apple Silicon) and Windows:

| Files | Card images |
|---|---|
| `mtg-treachery-macos-arm64`, `mtg-treachery-win-x64.exe` | Loaded from mtgtreachery.net, so players' phones need internet |
| `mtg-treachery-embedded-macos-arm64`, `mtg-treachery-embedded-win-x64.exe` | Bundled (bigger file), so it works fully offline on the WiFi |

Double-click the one for your machine: it starts the server, opens the host page
with a big QR in your browser, and keeps the computer from going to sleep while
it runs. Keep the console window open; closing it stops the server.

**First-launch warnings (the binaries are unsigned):**

- **macOS:** the first launch is blocked. Open **System Settings → Privacy &
  Security** and click **Open Anyway**, or run this once:
  `xattr -d com.apple.quarantine mtg-treachery-macos-arm64`.
- **Windows:** SmartScreen shows "unknown publisher" → **More info → Run anyway**.

> The build runs on a Mac and cross-compiles the Windows `.exe`. The first
> `npm run package` downloads Node base binaries (~60 MB each), so it needs
> internet once; later builds are cached.

## Good to know

- **Reconnection:** if you refresh or close the browser, you get your same seat
  and identity back (a token is stored in the browser), and the home screen
  offers **Rejoin your game**. The seat lives in that browser: another device
  can't take it over.
- **Who controls the room:** whoever created it. If they're away for ~30 s before
  Start, control passes to the next player and returns when they come back. Once
  the roles are dealt, control doesn't move: if the creator leaves for good,
  nobody else can Restart or End the game (create a new room instead).
- **State lives in memory.** If the server restarts, its rooms are lost, but
  every player keeps their card on their phone (it's cached) and the room screen
  says the room is gone, so the game at the table can go on. To deal again,
  create a new room.
- **Cleanup:** a room that never started is deleted 10 s after its last player
  leaves; a dealt game is kept for 2 h so players can come back.
- **Roles are truly secret:** the server never sends a player another player's
  concealed identity; not even the browser dev tools can reveal someone else's
  deal. Only the Leader and players who unveil or are defeated become public. The
  tests check this for every table size and every viewer.

## Development

```bash
npm run dev     # auto-reload on edit (node --watch)
npm run lab     # same, and opens the multi-user lab in the browser
npm test        # dealing, room state + secrecy, card pools, HTTP API + WebSocket, translations
```

Other scripts:

- `npm run optimize-cards` converts new card PNGs under `assets/cards` to
  phone-sized WebP (needs `cwebp` or ImageMagick, and macOS `sips`).
- `npm run package` builds the executables (it runs `manifest`, `bundle:*` and
  `package:*`).

### Multi-user lab

Sessions live in `localStorage`, so two normal tabs on the same origin would
share a seat. The **lab** (`npm run lab`, then `/lab`) shows 4 to 8 players in
one window, each on its own phone (`?slot=1` … `?slot=8` namespaces the session).

Each phone has its own device picker. By default the four players get four
typical phones: iPhone 6.7″ and 6.1″ (Safari), and Android at the two common
widths, 412 and 360 (Pixel 8 and Pixel 9, Chrome); bigger tables repeat them.
Each page gets the viewport that browser actually leaves it, so you see what
fits on screen without scrolling. Phones are drawn at real size and shrink only
to fit the window (the scale shows in the lab bar); switching a phone's device
doesn't reload it, and each phone remembers its pick.

- **Start table**: creates a room and seats everyone (Ann is the dealer), with
  the chosen player count and rarity.
- **Blank phones**: empty home screens, to walk through create / join yourself.
- **Reset**: closes the table and clears every phone.
- **Pop out**: opens that player in a real window at the same viewport size.

The lab is only served on `localhost` when started with `--lab`, never on the LAN
or in packaged builds. You can also emulate players without it: open
`http://localhost:3000/home?slot=alice` and `…/home?slot=bob` in two windows.

### Environment variables

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `PUBLIC_URL` | (none) | Base URL for the join QR and links when the server has a public address (otherwise the LAN address is used) |
| `DEALER_GRACE_MS` | `30000` | How long the creator can be away before control passes on (lobby only) |
| `EMPTY_LOBBY_GRACE_MS` | `10000` | How long an empty, never-started room survives (absorbs a reload) |
| `LAB` | (none) | `1` serves the lab, same as `--lab` |

### Structure

```
server/
  index.js       HTTP + WebSocket startup, static files, LAN IP / public URL, console QR
  api.js         JSON HTTP endpoints
  ws.js          presence WebSocket; broadcasts each viewer their own view of the room
  rooms.js       room state: join, deal, unveil, defeat, remove seats, control handover, cleanup
  deal.js        official role table + Fisher–Yates shuffle with crypto randomness
  cards.js       card catalog by role and rarity; a unique card per player; gallery
  keep-awake.js  keeps the host computer awake (packaged builds)
  *.test.js      node:test suites
public/
  index.html     home: create, join, rejoin
  join.html      join (QR target)
  room.html      lobby + your card
  host.html      big QR for the host's screen
  lab.html       multi-user lab
  app.js         session (localStorage), create/join requests
  room.js        socket, lobby, card flip, unveil, defeat, restart / end game
  i18n.js        en-US / es-AR texts
  rules.js       Rules button + modal, footer language selector
  gallery.js     card gallery
  example.js     example 5-player table
  version.js     version in the footer
  lab.js         lab: seats N phones as iframes
  styles.css     mobile-first styles
assets/
  cards/         identity cards as WebP: <Role>/<rarity>/, plus extras/ (card back, tokens)
  roles/         role icons
scripts/         optimize-cards.js, gen-cards-manifest.js (card list for packaged builds)
```

## Not included

Computing the winner automatically, a Magic life counter, and persisting rooms to
disk to survive restarts.
