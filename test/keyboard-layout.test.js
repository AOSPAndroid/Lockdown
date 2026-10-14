import assert from 'node:assert/strict';
import test from 'node:test';
import { gameKey, displayKey, normalizeKeyboardLayout } from '../public/keyboard-layout.js';

test('ZQSD: on a French AZERTY keyboard, Z Q S D move and A switches weapons', () => {
  // AZERTY keys as the browser reports them: the printed letter, and the physical (QWERTY) position.
  const azerty = { z: { key: 'z', code: 'KeyW' }, q: { key: 'q', code: 'KeyA' }, s: { key: 's', code: 'KeyS' }, d: { key: 'd', code: 'KeyD' }, a: { key: 'a', code: 'KeyQ' } };
  assert.equal(gameKey(azerty.z, 'zqsd'), 'w', 'Z moves up');
  assert.equal(gameKey(azerty.q, 'zqsd'), 'a', 'Q moves left');
  assert.equal(gameKey(azerty.s, 'zqsd'), 's');
  assert.equal(gameKey(azerty.d, 'zqsd'), 'd');
  assert.equal(gameKey(azerty.a, 'zqsd'), 'q', 'A switches weapons');
  // A QWERTY keyboard on the WASD setting is unchanged.
  assert.equal(gameKey({ key: 'w', code: 'KeyW' }, 'wasd'), 'w');
  assert.equal(gameKey({ key: 'q', code: 'KeyQ' }, 'wasd'), 'q');
  // Key labels follow the setting.
  assert.equal(displayKey('WASD', 'zqsd'), 'ZQSD'); assert.equal(displayKey('Q', 'zqsd'), 'A');
  assert.equal(displayKey('WASD', 'wasd'), 'WASD');
  assert.equal(normalizeKeyboardLayout('ZQSD'), 'zqsd'); assert.equal(normalizeKeyboardLayout('nonsense'), 'wasd');
});
