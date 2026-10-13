// Client translations. A new tab always starts in en-US; the selector switches
// the language for the rest of that tab's session (sessionStorage), so it
// survives moving between screens but not closing the tab.

export const LOCALES = ['en-US', 'es-AR'];
export const DEFAULT_LOCALE = 'en-US';

const dict = {
  'en-US': {
    'title.home': 'MTG Treachery — Roles',
    'title.join': 'Join — MTG Treachery',
    'title.host': 'Host — MTG Treachery',
    'title.room': 'Room — MTG Treachery',
    'lang.label': 'Language',
    'footer.source': 'Source on GitHub',
    'rules.btn': 'Rules',
    'gallery.btn': 'Cards',
    'gallery.title': 'Card gallery',
    'info.close': 'Close',
    'info.basics': 'How it works',
    'info.basics.deal': 'Each player is dealt an <b>identity card</b>. Only you can see yours until it is revealed.',
    'info.basics.leaderStart': 'The <b>Leader</b> is public from the start and always takes the first turn.',
    'info.basics.hidden': 'Everyone else stays face down. Until you reveal, you have no teammates — everyone is an opponent.',
    'info.winConditions': 'Roles & wincons',
    'info.roles': 'Setup',
    'info.roles.players': 'Players',
    'info.roles.leader': 'Leader',
    'info.roles.traitor': 'Traitor',
    'info.roles.assassin': 'Assassin',
    'info.roles.guardian': 'Guardian',
    'info.lose.body': 'When you are eliminated, reveal your identity card.',
    'info.abilities': 'Abilities',
    'info.win.leader': 'The <b>Leader</b> {leader} and the <b>Guardians</b> {guardian} win if they are the last players standing.',
    'info.win.assassins': 'The <b>Assassins</b> {assassin} win if the Leader is eliminated.',
    'info.win.traitor': 'A <b>Traitor</b> {traitor} wins if they are the last player standing <i>(this implies killing the Assassins before the Leader).</i>',
    'info.unveil': '<b>Unveil {cost}:</b> Any time you have priority you may turn a face-down identity card with an unveil ability. This is a special action: it doesn\'t use the stack.',
    'info.undercover': '<b>Undercover:</b> Special unveil restriction. Unveil only if another non-Leader identity has been revealed or if a player other than you attacked a Leader this game.',
    'info.rarity': 'Card rarity',
    'info.rarity.complexity': 'Rarity reflects how <b>complex</b> an identity is to play — not how <b>powerful</b> it is.',
    'info.rarity.inclusive': 'A higher rarity is a ceiling: it adds those cards on top of the lower rarities.',
    'name.label': 'Your name',
    'name.placeholder': 'e.g. Ann',
    'name.placeholderJoin': 'e.g. Bob',
    'rarity.label': 'Card rarity',
    'rarity.U': 'Uncommon',
    'rarity.R': 'Rare',
    'rarity.M': 'Mythic',
    'rarity.S': 'Special',
    'home.resumeTitle': 'Rejoin your game',
    'home.resumeBtn': 'Back to room {code}',
    'example.btn': 'Example',
    'example.title': 'A 5-player table',
    'home.create': 'Create room',
    'home.orJoin': '— or join a room —',
    'code.label': 'Room code',
    'join': 'Join',
    'error.needName': 'Enter your name first.',
    'error.needNameJoin': 'Enter your name.',
    'error.codeLength': 'The code has 4 letters.',
    'join.sub': 'Join the room',
    'join.footer': 'Were you already in this room? You\'ll be reconnected automatically.',
    'host.sub': 'Scan to join from your phone',
    'host.starting': 'Starting…',
    'host.hint': 'This computer only hosts the game. Everyone plays from their phone — scan the code or open the address above.',
    'host.noLan': 'Could not detect a network address.',
    'host.qrAlt': 'QR to open the game',
    'room.roomCode': 'Room code',
    'room.players': 'Players',
    'room.start': 'Start',
    'room.waitingBefore': 'Waiting for ',
    'room.waitingAfter': ' to deal…',
    'room.dealerFallback': 'the room creator',
    'room.ready': '{n} players ready.',
    'room.needOne': 'Need 1 more player.',
    'room.needMany': 'Need {n} more players.',
    'room.offline': 'Offline: {names}',
    'room.startAnyway': 'Start anyway',
    'room.kick': 'Remove',
    'room.kickLabel': 'Remove {name}',
    'room.lostTitle': 'This room is gone from the server',
    'room.lostText': 'It probably restarted. Your card is still saved on this phone, so the game at the table can go on. To deal again, create a new room.',
    'room.leave': 'Leave room',
    'room.flipHelp': 'Tap the card to flip it, hold it to enlarge. It hides itself after 10 s.',
    'room.unveil': 'Unveil',
    'room.unveilSub': 'Everyone sees your card',
    'room.surrender': 'Surrender',
    'room.defeated': 'Defeated',
    'room.count.traitor': 'Traitors',
    'room.count.assassin': 'Assassins',
    'room.count.guardian': 'Guardians',
    'room.restart': 'Restart',
    'room.endGame': 'End Game',
    'room.tapClose': 'Tap anywhere to close',
    'room.confirmTitle': 'Are you sure?',
    'room.cancel': 'Cancel',
    'room.confirm': 'Confirm',
    'room.reconnecting': 'Reconnecting…',
    'room.cardAlt': 'Your identity card',
    'room.cardBackAlt': 'Card back',
    'room.playerCardAlt': '{name}\'s identity card',
    'room.qrAlt': 'QR to join',
    'confirm.restartTitle': 'Restart game?',
    'confirm.restartText': 'This deals fresh roles to everyone at the table. Continue?',
    'confirm.endTitle': 'End game?',
    'confirm.endText': 'This closes the room and sends everyone back to the start. Continue?',
    'confirm.defeatTitle': 'Surrender?',
    'confirm.defeatText': 'You\'ll be marked as defeated and your identity revealed to the table. Accept?',
    'confirm.unveilTitle': 'Unveil your identity?',
    'confirm.unveilText': 'This will reveal your identity to every player.',
    'confirm.kickTitle': 'Remove {name}?',
    'confirm.kickText': 'They leave the room and can scan the QR again to rejoin.',
    'confirm.offlineTitle': 'Someone is offline',
    'confirm.offlineText': 'Offline: {names}. Starting deals a role to everyone in the room, connected or not. If someone isn\'t playing, remove them first with ✕.',
    'error.create': 'Could not create the room.',
    'error.join': 'Could not join the room.',
    'error.connection': 'Connection error with the server.',
    'error.connectionShort': 'Connection error.',
    'error.deal': 'Could not deal.',
    'error.dealAgain': 'Could not deal again.',
    'error.close': 'Could not close the room.',
    'error.defeat': 'Could not mark you as defeated.',
    'error.kick': 'Could not remove the player.',
    'error.role': 'Could not fetch your role.',
    'server.unauth': 'Not authenticated in this room.',
    'server.notFound': 'Room not found.',
    'server.started': 'The game has already started.',
    'server.dealt': 'Roles have already been dealt.',
    'server.dealerStart': 'Only the dealer can start the game.',
    'server.playerCount': 'Treachery is for 4–8 players.',
    'server.notDealt': 'Roles have not been dealt yet.',
    'server.dealerClose': 'Only the dealer can close the room.',
    'server.closed': 'The room is closed.',
    'server.full': 'The room is full (8 players max).',
    'server.dealerKick': 'Only the dealer can remove players.',
    'server.kickSelf': 'You can\'t remove your own seat.',
    'server.playerNotFound': 'Player not found.',
    'server.unknown': 'Unknown API route.',
    'server.badJson': 'Invalid JSON.',
    'server.internal': 'Internal error.',
  },
  'es-AR': {
    'title.home': 'MTG Treachery — Roles',
    'title.join': 'Unirse — MTG Treachery',
    'title.host': 'Host — MTG Treachery',
    'title.room': 'Sala — MTG Treachery',
    'lang.label': 'Idioma',
    'footer.source': 'Código en GitHub',
    'rules.btn': 'Reglas',
    'gallery.btn': 'Cartas',
    'gallery.title': 'Galería de cartas',
    'info.close': 'Cerrar',
    'info.basics': 'Cómo se juega',
    'info.basics.deal': 'A cada jugador se le reparte una <b>carta de identidad</b>. Solo vos ves la tuya hasta que se revele.',
    'info.basics.leaderStart': 'El <b>Líder</b> es público desde el comienzo y siempre juega el primer turno.',
    'info.basics.hidden': 'El resto queda boca abajo. Hasta que revelés, no tenés aliados: todos son oponentes.',
    'info.winConditions': 'Roles y wincons',
    'info.roles': 'Setup',
    'info.roles.players': 'Jugadores',
    'info.roles.leader': 'Líder',
    'info.roles.traitor': 'Traidor',
    'info.roles.assassin': 'Asesino',
    'info.roles.guardian': 'Guardián',
    'info.lose.body': 'Cuando te eliminan, revelá tu carta de identidad.',
    'info.abilities': 'Habilidades',
    'info.win.leader': 'El <b>Líder</b> {leader} y los <b>Guardianes</b> {guardian} ganan si son los últimos jugadores en pie.',
    'info.win.assassins': 'Los <b>Asesinos</b> {assassin} ganan si el Líder es eliminado.',
    'info.win.traitor': 'Un <b>Traidor</b> {traitor} gana si es el último jugador en pie <i>(eso implica matar a los Asesinos antes que al Líder).</i>',
    'info.unveil': '<b>Revelar {cost}:</b> Cuando tengas prioridad, podés girar una carta de identidad boca abajo con una habilidad de revelar. Es una acción especial: no usa la pila.',
    'info.undercover': '<b>Encubierto:</b> Restricción especial de revelar. Solo revelás si otra identidad que no sea el Líder ya fue revelada, o si un jugador que no seas vos atacó a un Líder en esta partida.',
    'info.rarity': 'Rareza de las cartas',
    'info.rarity.complexity': 'La rareza indica qué tan <b>compleja</b> es una identidad de jugar, no qué tan <b>fuerte</b> es.',
    'info.rarity.inclusive': 'Una rareza más alta es un tope: suma esas cartas sobre las de rareza menor.',
    'name.label': 'Tu nombre',
    'name.placeholder': 'ej. Ann',
    'name.placeholderJoin': 'ej. Bob',
    'rarity.label': 'Rareza de las cartas',
    'rarity.U': 'Infrecuente',
    'rarity.R': 'Rara',
    'rarity.M': 'Mítica',
    'rarity.S': 'Especial',
    'home.resumeTitle': 'Volvé a tu partida',
    'home.resumeBtn': 'Volver a la sala {code}',
    'example.btn': 'Ejemplo',
    'example.title': 'Una mesa de 5 jugadores',
    'home.create': 'Crear sala',
    'home.orJoin': '— o unirse a una sala —',
    'code.label': 'Código de sala',
    'join': 'Unirse',
    'error.needName': 'Primero ingresá tu nombre.',
    'error.needNameJoin': 'Ingresá tu nombre.',
    'error.codeLength': 'El código tiene 4 letras.',
    'join.sub': 'Unite a la sala',
    'join.footer': '¿Ya estabas en esta sala? Te reconectamos automáticamente.',
    'host.sub': 'Escaneá para unirte desde el celular',
    'host.starting': 'Iniciando…',
    'host.hint': 'Esta computadora solo hostea la partida. Todos juegan desde el celular: escaneá el código o abrí la dirección de arriba.',
    'host.noLan': 'No se detectó una dirección de red.',
    'host.qrAlt': 'QR para abrir el juego',
    'room.roomCode': 'Código de sala',
    'room.players': 'Jugadores',
    'room.start': 'Empezar',
    'room.waitingBefore': 'Esperando que ',
    'room.waitingAfter': ' reparta…',
    'room.dealerFallback': 'quien creó la sala',
    'room.ready': '{n} jugadores listos.',
    'room.needOne': 'Falta 1 jugador.',
    'room.needMany': 'Faltan {n} jugadores.',
    'room.offline': 'Sin conexión: {names}',
    'room.startAnyway': 'Empezar igual',
    'room.kick': 'Sacar',
    'room.kickLabel': 'Sacar a {name}',
    'room.lostTitle': 'La sala ya no está en el servidor',
    'room.lostText': 'Probablemente se reinició. Tu carta sigue guardada en este celular, así que la partida en la mesa puede seguir. Para repartir de nuevo, hay que crear una sala nueva.',
    'room.leave': 'Salir de la sala',
    'room.flipHelp': 'Tocá la carta para darla vuelta y mantenela apretada para agrandarla. Se oculta sola a los 10 s.',
    'room.unveil': 'Revelar',
    'room.unveilSub': 'Todos ven tu carta',
    'room.surrender': 'Rendirse',
    'room.defeated': 'Derrotado',
    'room.count.traitor': 'Traidores',
    'room.count.assassin': 'Asesinos',
    'room.count.guardian': 'Guardianes',
    'room.restart': 'Reiniciar',
    'room.endGame': 'Terminar partida',
    'room.tapClose': 'Tocá cualquier lado para cerrar',
    'room.confirmTitle': '¿Estás seguro?',
    'room.cancel': 'Cancelar',
    'room.confirm': 'Confirmar',
    'room.reconnecting': 'Reconectando…',
    'room.cardAlt': 'Tu carta de identidad',
    'room.cardBackAlt': 'Dorso de la carta',
    'room.playerCardAlt': 'Carta de identidad de {name}',
    'room.qrAlt': 'QR para unirse',
    'confirm.restartTitle': '¿Reiniciar la partida?',
    'confirm.restartText': 'Reparte roles nuevos a todos en la mesa. ¿Seguimos?',
    'confirm.endTitle': '¿Terminar la partida?',
    'confirm.endText': 'Cierra la sala y manda a todos al inicio. ¿Seguimos?',
    'confirm.defeatTitle': '¿Rendirte?',
    'confirm.defeatText': 'Te vamos a marcar como derrotado y tu identidad se revela en la mesa. ¿Aceptar?',
    'confirm.unveilTitle': '¿Revelar tu identidad?',
    'confirm.unveilText': 'Esto va a revelar tu identidad a todos los jugadores.',
    'confirm.kickTitle': '¿Sacar a {name}?',
    'confirm.kickText': 'Sale de la sala y puede volver a entrar escaneando el QR.',
    'confirm.offlineTitle': 'Hay alguien sin conexión',
    'confirm.offlineText': 'Sin conexión: {names}. Al empezar se reparte rol a todos los de la sala, conectados o no. Si alguien no juega, sacalo antes con ✕.',
    'error.create': 'No se pudo crear la sala.',
    'error.join': 'No se pudo unir a la sala.',
    'error.connection': 'Error de conexión con el servidor.',
    'error.connectionShort': 'Error de conexión.',
    'error.deal': 'No se pudo repartir.',
    'error.dealAgain': 'No se pudo volver a repartir.',
    'error.close': 'No se pudo cerrar la sala.',
    'error.defeat': 'No se pudo marcarte como derrotado.',
    'error.kick': 'No se pudo sacar al jugador.',
    'error.role': 'No se pudo obtener tu rol.',
    'server.unauth': 'No estás autenticado en esta sala.',
    'server.notFound': 'Sala no encontrada.',
    'server.started': 'La partida ya empezó.',
    'server.dealt': 'Los roles ya se repartieron.',
    'server.dealerStart': 'Solo quien reparte puede empezar la partida.',
    'server.playerCount': 'Treachery es para 4–8 jugadores.',
    'server.notDealt': 'Todavía no se repartieron los roles.',
    'server.dealerClose': 'Solo quien reparte puede cerrar la sala.',
    'server.closed': 'La sala está cerrada.',
    'server.full': 'La sala está llena (máximo 8 jugadores).',
    'server.dealerKick': 'Solo quien reparte puede sacar jugadores.',
    'server.kickSelf': 'No podés sacar tu propio asiento.',
    'server.playerNotFound': 'Jugador no encontrado.',
    'server.unknown': 'Ruta de API desconocida.',
    'server.badJson': 'JSON inválido.',
    'server.internal': 'Error interno.',
  },
};

const SERVER_ERRORS = {
  'Not authenticated in this room.': 'server.unauth',
  'Room not found.': 'server.notFound',
  'The game has already started.': 'server.started',
  'Roles have already been dealt.': 'server.dealt',
  'Only the dealer can start the game.': 'server.dealerStart',
  'Treachery is for 4–8 players.': 'server.playerCount',
  'Roles have not been dealt yet.': 'server.notDealt',
  'Only the dealer can close the room.': 'server.dealerClose',
  'The room is closed.': 'server.closed',
  'The room is full (8 players max).': 'server.full',
  'Only the dealer can remove players.': 'server.dealerKick',
  "You can't remove your own seat.": 'server.kickSelf',
  'Player not found.': 'server.playerNotFound',
  'Unknown API route.': 'server.unknown',
  'Invalid JSON.': 'server.badJson',
  'Internal error.': 'server.internal',
};

const listeners = new Set();

function normalize(value) {
  return LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

// A new tab starts in en-US regardless of the browser language. A choice made
// from the selector lives in sessionStorage: create/join/reload keep it, a new
// tab doesn't. Lab phones (?slot=N) share one tab, so each slot gets its own key.
const LOCALE_KEY = 'treachery:locale';

function localeKey() {
  let slot = '';
  try { slot = (new URLSearchParams(location.search).get('slot') || '').trim(); } catch { /* no location */ }
  return slot ? `${LOCALE_KEY}::${slot}` : LOCALE_KEY;
}

function savedLocale() {
  try { return normalize(sessionStorage.getItem(localeKey())); } catch { return DEFAULT_LOCALE; }
}

let locale = savedLocale();

export function getLocale() {
  return locale;
}

export function t(key, vars) {
  const table = dict[locale] || dict[DEFAULT_LOCALE];
  let s = table[key] ?? dict[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (match, k) => (
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : match
    ));
  }
  return s;
}

/** Maps an English server error to the active locale; unknown strings pass through. */
export function localizeServerError(msg) {
  if (!msg) return msg;
  const key = SERVER_ERRORS[msg];
  return key ? t(key) : msg;
}

export function applyTranslations(root) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  const scope = root || document;
  for (const el of scope.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  for (const el of scope.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  }
  for (const el of scope.querySelectorAll('[data-i18n-placeholder]')) {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  }
  for (const el of scope.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  }
  for (const el of scope.querySelectorAll('[data-i18n-alt]')) {
    el.setAttribute('alt', t(el.getAttribute('data-i18n-alt')));
  }
  const titleEl = document.querySelector('title[data-i18n]');
  if (titleEl) document.title = t(titleEl.getAttribute('data-i18n'));
}

export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  applyTranslations();
  for (const fn of listeners) fn(locale);
}

// A language change lasts for this tab's session. See savedLocale() above.
export function setLocale(next) {
  const loc = normalize(next);
  if (loc === locale) return;
  locale = loc;
  try { sessionStorage.setItem(localeKey(), loc); } catch { /* private mode: this page only */ }
  emit();
}

const missing = Object.keys(dict['en-US']).filter((k) => !(k in dict['es-AR']));
const extra = Object.keys(dict['es-AR']).filter((k) => !(k in dict['en-US']));
if (missing.length || extra.length) {
  console.warn('[i18n] dictionaries out of sync', { missing, extra });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTranslations());
  } else {
    applyTranslations();
  }
}
