import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_TABLE, dealRoles } from './deal.js';
import { RARITY_LEVELS, poolFor, assignCards, cardCatalog, normalizeRarity } from './cards.js';

const ROLE_DIR = { LEADER: 'Leader', GUARDIAN: 'Guardian', ASSASSIN: 'Assassin', TRAITOR: 'Traitor' };

/** "/assets/cards/Traitor/rare/021 - …webp" -> { roleDir: 'Traitor', folder: 'rare' } */
function parseUrl(url) {
  const [, , , roleDir, folder] = decodeURIComponent(url).split('/');
  return { roleDir, folder };
}

test('every rarity level has enough cards of each role for the biggest table', () => {
  // A short pool makes assignCards throw, which surfaces as a 500 on Start.
  const need = {};
  for (const mix of Object.values(ROLE_TABLE)) {
    for (const [role, n] of Object.entries(mix)) need[role] = Math.max(need[role] ?? 0, n);
  }
  for (const level of Object.keys(RARITY_LEVELS)) {
    for (const [role, n] of Object.entries(need)) {
      const have = poolFor(role, level).length;
      assert.ok(have >= n, `${role} at rarity ${level}: need ${n}, only ${have} cards`);
    }
  }
});

test('assignCards gives unique cards of the right role, within the rarity ceiling', () => {
  for (const level of Object.keys(RARITY_LEVELS)) {
    for (let run = 0; run < 50; run++) {
      const roles = dealRoles(8);
      const cards = assignCards(roles, level);
      assert.equal(new Set(cards).size, cards.length, 'no card is dealt twice');
      cards.forEach((url, i) => {
        const { roleDir, folder } = parseUrl(url);
        assert.equal(roleDir, ROLE_DIR[roles[i]], `card ${url} for a ${roles[i]}`);
        assert.ok(RARITY_LEVELS[level].includes(folder), `${folder} card dealt at rarity ${level}`);
      });
    }
  }
});

test('special cards appear in the gallery but are never dealt', () => {
  const specials = cardCatalog().groups.flatMap((g) => g.cards).filter((c) => c.rarity === 'S');
  assert.ok(specials.length > 0, 'the catalog lists the special cards');
  const dealable = new Set(Object.keys(ROLE_DIR).flatMap((role) => poolFor(role, 'M')));
  for (const card of specials) assert.ok(!dealable.has(card.url), `${card.name} is dealable`);
});

test('the gallery lists every dealable card exactly once, grouped by role', () => {
  const groups = cardCatalog().groups;
  assert.deepEqual(groups.map((g) => g.role), ['LEADER', 'GUARDIAN', 'ASSASSIN', 'TRAITOR']);
  for (const { role, cards } of groups) {
    const urls = cards.map((c) => c.url);
    assert.equal(new Set(urls).size, urls.length, `${role}: duplicate in the gallery`);
    for (const url of poolFor(role, 'M')) assert.ok(urls.includes(url), `${role}: ${url} missing from the gallery`);
  }
});

test('unknown rarity values fall back to Uncommon', () => {
  assert.equal(normalizeRarity('r'), 'R');
  assert.equal(normalizeRarity('S'), 'U', 'special is not a deal level');
  assert.equal(normalizeRarity(undefined), 'U');
  assert.equal(normalizeRarity('<script>'), 'U');
});
