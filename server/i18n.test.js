import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The client translates server errors by their exact English text
// (public/i18n.js SERVER_ERRORS). An error without an entry reaches Spanish
// players in English, so every `error: '…'` the server can send must map.
function serverErrors() {
  const dir = new URL('.', import.meta.url);
  const errors = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    for (const [, , text] of src.matchAll(/error:\s*(['"])(.*?)\1/g)) errors.add(text);
  }
  return [...errors];
}

test('both dictionaries have the same keys, and every server error is translated', async () => {
  const warn = mock.method(console, 'warn', () => {});
  const i18n = await import('../public/i18n.js');
  assert.equal(warn.mock.callCount(), 0, 'public/i18n.js reports its dictionaries out of sync');

  const errors = serverErrors();
  assert.ok(errors.length >= 10, 'found the server error strings');
  i18n.setLocale('es-AR');
  const untranslated = errors.filter((e) => i18n.localizeServerError(e) === e);
  assert.deepEqual(untranslated, [], 'add these to SERVER_ERRORS and both dictionaries');
});
