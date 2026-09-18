import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('le shim localStorage fonctionne', () => {
  localStorage.setItem('a', '1');
  assert.equal(localStorage.getItem('a'), '1');
  assert.equal(localStorage.getItem('absent'), null);
});
