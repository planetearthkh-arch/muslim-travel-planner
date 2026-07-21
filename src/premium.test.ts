import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_PREMIUM_MAX_BUILD,
  SAFARMATE_PREMIUM_PRODUCT_ID,
  parseOriginalBuild,
  qualifiesForLegacyPremium,
} from './premium.js';

test('uses the App Store Connect lifetime product identifier', () => {
  assert.equal(SAFARMATE_PREMIUM_PRODUCT_ID, 'com.planetearthkh.safarmate.premium.lifetime');
});

test('grandfathers production iOS builds released before the premium transition', () => {
  assert.equal(LEGACY_PREMIUM_MAX_BUILD, 154);
  assert.equal(qualifiesForLegacyPremium('1'), true);
  assert.equal(qualifiesForLegacyPremium('154'), true);
  assert.equal(qualifiesForLegacyPremium('155'), false);
});

test('does not treat StoreKit sandbox version strings as production build numbers', () => {
  assert.equal(parseOriginalBuild('1.0'), null);
  assert.equal(qualifiesForLegacyPremium('1.0'), false);
  assert.equal(qualifiesForLegacyPremium(undefined), false);
  assert.equal(qualifiesForLegacyPremium('invalid'), false);
});
