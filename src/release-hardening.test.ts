import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseAmountInput } from './money.js';

test('money parsing respects locale decimal separators', () => {
  assert.equal(parseAmountInput('0.125', 'en').value, 0.125);
  assert.equal(parseAmountInput('0,125', 'tr').value, 0.125);
  assert.equal(parseAmountInput('1,250', 'en').value, 1250);
  assert.equal(parseAmountInput('1.250', 'tr').value, 1250);
  assert.equal(parseAmountInput('USD 12', 'en').error, 'invalid');
});

test('external map fields are escaped before insertion', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  for (const expression of ['esc(place.address)', 'esc(toilet.address)', 'esc(office.address)', 'esc(stop.address)', 'esc(item.address)', 'esc(attraction.address)']) assert.match(main, new RegExp(expression.replace(/[()]/g, '\\$&')));
});

test('service worker deletes only SafarOne caches', () => {
  const worker = readFileSync('public/sw.js', 'utf8');
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(worker, /mtp-app-shell-v13/);
});

test('a restrictive content security policy is present', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src 'none'/);
});
