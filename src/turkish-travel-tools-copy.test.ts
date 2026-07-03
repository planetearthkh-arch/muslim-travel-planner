import test from 'node:test';
import assert from 'node:assert/strict';
import { labels } from './i18n.js';
import './turkish-travel-tools-copy.js';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Turkish public travel-tool copy is complete, natural, and loaded by the app', async () => {
  const loader = await repoFile('src/turkish-halal-copy.ts');
  assert.equal(loader.includes("import './turkish-travel-tools-copy.js';"), true);

  const keys = [
    'publicTransportTitle', 'publicTransportSubtitle', 'publicTransportOpen', 'publicTransportBack',
    'publicTransportNotice', 'publicTransportLiveNotice', 'publicTransportUseLocation',
    'publicTransportUseDestination', 'publicTransportManualSearch', 'publicTransportManualPlaceholder',
    'publicTransportSearch', 'publicTransportSearchThisArea', 'publicTransportRecentre',
    'publicTransportFitResults', 'publicTransportRadius', 'publicTransportRequestingLocation',
    'publicTransportSearching', 'publicTransportLocationDenied', 'publicTransportLocationUnavailable',
    'publicTransportServiceUnavailable', 'publicTransportTimedOut', 'publicTransportTooMany',
    'publicTransportOffline', 'publicTransportCached', 'publicTransportNoResults',
    'publicTransportRetry', 'publicTransportIncreaseRadius', 'publicTransportSearchAnother',
    'publicTransportMapView', 'publicTransportListView', 'publicTransportAll',
    'publicTransportSort', 'publicTransportLegend', 'transportTrain', 'transportMetro',
    'transportLightRail', 'transportTram', 'transportBusStation', 'transportBusStop',
    'transportFerry', 'transportOther', 'transportType', 'transportOperator',
    'transportNetwork', 'transportReference', 'transportLines', 'transportShelter',
    'transportSeating', 'transportToilets', 'transportToiletsAvailable',
    'transportShelterAvailable', 'transportOfficialWebsite', 'transportSortType',

    'taxiTitle', 'taxiSubtitle', 'taxiOpen', 'taxiBack', 'taxiNotice', 'taxiLiveNotice',
    'taxiUseLocation', 'taxiUseDestination', 'taxiManualSearch', 'taxiManualPlaceholder',
    'taxiSearch', 'taxiSearchThisArea', 'taxiRecentre', 'taxiFitResults', 'taxiRadius',
    'taxiRequestingLocation', 'taxiSearching', 'taxiLocationDenied', 'taxiLocationUnavailable',
    'taxiServiceUnavailable', 'taxiTimedOut', 'taxiTooMany', 'taxiOffline', 'taxiCached',
    'taxiNoResults', 'taxiRetry', 'taxiIncreaseRadius', 'taxiSearchAnother', 'taxiMapView',
    'taxiListView', 'taxiAll', 'taxiRank', 'taxiAirportRank', 'taxiStationRank',
    'taxiBusRank', 'taxiOffice', 'taxiMotorcycle', 'taxiWater', 'taxiOther',
    'taxiPhoneAvailable', 'taxiWheelchairInfo', 'taxiSort', 'taxiSortType',
    'taxiSortContact', 'taxiLegend', 'taxiType', 'taxiCapacity', 'taxiVehicle',
    'taxiLit', 'taxiFee', 'taxiCall',

    'attractionsTitle', 'attractionsSubtitle', 'attractionsOpen', 'attractionsBack',
    'attractionsNotice', 'attractionsPhotoNotice', 'attractionsUseLocation',
    'attractionsUseDestination', 'attractionsManualSearch', 'attractionsSearch',
    'attractionsSearchAnother', 'attractionsRequestingLocation', 'attractionsLocationDenied',
    'attractionsLocationUnavailable', 'attractionsSearching', 'attractionsLoadingPhotos',
    'attractionsLoadingHistory', 'attractionsServiceUnavailable', 'attractionsWikipediaUnavailable',
    'attractionsImageUnavailable', 'attractionsTimedOut', 'attractionsOffline',
    'attractionsCached', 'attractionsNoResults', 'attractionsNoLicensedImage',
    'attractionsNoHistory', 'attractionsPhotoView', 'attractionsListView',
    'attractionsMapView', 'attractionsAll', 'attractionsHistoric', 'attractionsMuseum',
    'attractionsGallery', 'attractionsMonument', 'attractionsArchaeological',
    'attractionsCastle', 'attractionsReligious', 'attractionsViewpoint',
    'attractionsNatural', 'attractionsPark', 'attractionsZoo', 'attractionsTheme',
    'attractionsArtwork', 'attractionsCultural', 'attractionsOther',
    'attractionsPhotoAvailable', 'attractionsHistoryAvailable', 'attractionsSortCategory',
    'attractionsSortPhoto', 'attractionsSortHistory', 'attractionsSortComplete',
    'attractionsCategory', 'attractionsAdmission', 'attractionsInfoSource',
    'attractionsDetails', 'attractionsClose', 'attractionsSave', 'attractionsSaved',
    'attractionsReadMore',

    'toiletsTitle', 'toiletsSubtitle', 'toiletsOpen', 'toiletsBack', 'toiletsNotice',
    'toiletsAccessNotice', 'toiletsUseLocation', 'toiletsManualSearch',
    'toiletsManualPlaceholder', 'toiletsSearch', 'toiletsSearchThisArea',
    'toiletsRecentre', 'toiletsFitResults', 'toiletsRadius', 'toiletsRequestingLocation',
    'toiletsSearching', 'toiletsLocationDenied', 'toiletsLocationUnavailable',
    'toiletsServiceUnavailable', 'toiletsTimedOut', 'toiletsTooMany', 'toiletsOffline',
    'toiletsCached', 'toiletsNoResults', 'toiletsNoPublic', 'toiletsRetry',
    'toiletsIncreaseRadius', 'toiletsSearchAnotherCity', 'toiletsMapView',
    'toiletsListView', 'toiletsAllResults', 'toiletsPublicAccess',
    'toiletsCustomersOnly', 'toiletsRestricted', 'toiletsAccessUnknown',
    'toiletsFree', 'toiletsPaid', 'toiletsFeeUnknown', 'toiletsOpenNow',
    'toiletsOpen24', 'toiletsWheelchair', 'toiletsWheelchairLimited',
    'toiletsWheelchairNo', 'toiletsWheelchairUnknown', 'toiletsChanging',
    'toiletsFemale', 'toiletsMale', 'toiletsUnisex', 'toiletsHandwashing',
    'toiletsSoap', 'toiletsPaper', 'toiletsHotWater', 'toiletsShower',
    'toiletsDrinkingWater', 'toiletsSeated', 'toiletsSquat', 'toiletsUrinal',
    'toiletsOperator', 'toiletsSupervised', 'toiletsInside', 'toiletsStandalone',
    'toiletsVenue', 'toiletsPortable', 'toiletsSort', 'toiletsNearest',
    'toiletsSortName', 'toiletsSortAccess', 'toiletsSortFree', 'toiletsSortOpen',
    'toiletsSortAccessible', 'toiletsLegend',
  ] as const;

  const copy = labels.tr;
  for (const key of keys) {
    assert.equal(typeof copy[key], 'string');
    assert.equal(copy[key].trim().length > 0, true);
    assert.equal(copy[key].toLocaleLowerCase('tr-TR').includes('öğe'), false);
    assert.equal(copy[key].toLocaleLowerCase('tr-TR').includes('alt başlık'), false);
    assert.equal(copy[key].toLocaleLowerCase('tr-TR').endsWith(' başlık'), false);
  }

  assert.equal(copy.publicTransportTitle, 'Toplu Taşıma');
  assert.equal(copy.taxiTitle, 'Taksi Hizmetleri');
  assert.equal(copy.attractionsTitle, 'Gezilecek Yerler');
  assert.equal(copy.toiletsTitle, 'Umumi Tuvaletler');
  assert.equal(copy.toiletsHotWater, 'Sıcak su');
  assert.equal(copy.toiletsDrinkingWater, 'İçme suyu');
});
