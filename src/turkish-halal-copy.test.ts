import test from 'node:test';
import assert from 'node:assert/strict';
import { labels } from './i18n.js';
import './turkish-halal-copy.js';

test('Turkish Halal Restaurants copy is complete and natural', () => {
  const copy = labels.tr;
  const keys = [
    'halalRestaurantsTitle', 'halalRestaurantsSubtitle', 'halalRestaurantsOpen',
    'halalRestaurantsBack', 'halalNotice', 'halalMeaningNotice', 'halalUseLocation',
    'halalManualSearch', 'halalManualPlaceholder', 'halalSearch',
    'halalSearchThisArea', 'halalRecentre', 'halalFitResults', 'halalRadius',
    'halalRequestingLocation', 'halalSearching', 'halalLocationDenied',
    'halalLocationUnavailable', 'halalServiceUnavailable', 'halalTimedOut',
    'halalTooMany', 'halalNoResults', 'halalNoReliable', 'halalCached',
    'halalOffline', 'halalRetry', 'halalIncreaseRadius', 'halalSearchAnotherCity',
    'halalMapView', 'halalListView', 'halalAllReliable', 'halalOnly',
    'halalOptions', 'halalCertificationListed', 'halalLegacy', 'halalPossible',
    'halalRestaurant', 'halalFastFood', 'halalCafe', 'halalFoodCourt',
    'halalOpenNow', 'halalTakeaway', 'halalDelivery', 'halalWheelchair',
    'halalCuisine', 'halalAllCuisines', 'halalSort', 'halalNearest',
    'halalSortName', 'halalSortStatus', 'halalSortOpen', 'halalSortCuisine',
    'halalCertificationNotice', 'halalLegacyNotice', 'halalPossibleNotice',
    'halalOpeningUnavailable', 'halalOpen', 'halalClosed', 'halalCuisineLabel',
    'halalMenu', 'halalPrice', 'halalOutdoor', 'halalInfoIssue',
    'halalCopyDetails', 'halalCopiedDetails', 'halalLegend', 'osmAttribution',
  ] as const;

  for (const key of keys) {
    assert.equal(typeof copy[key], 'string', key);
    assert.equal(copy[key].trim().length > 0, true, key);
    assert.equal(copy[key].includes('Öğe'), false, key);
  }

  assert.equal(copy.halalRestaurantsTitle, 'Helal Restoranlar');
  assert.equal(copy.halalMapView, 'Harita');
  assert.equal(copy.halalListView, 'Yakındakiler');
  assert.equal(copy.halalIncreaseRadius, 'Yarıçapı artır');
});
