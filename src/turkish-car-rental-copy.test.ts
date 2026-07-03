import test from 'node:test';
import assert from 'node:assert/strict';
import { labels } from './i18n.js';
import './turkish-car-rental-copy.js';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Turkish Car Rental copy is complete, natural, and loaded by the app', async () => {
  const loader = await repoFile('src/turkish-halal-copy.ts');
  assert.equal(loader.includes("import './turkish-car-rental-copy.js';"), true);

  const copy = labels.tr;
  const keys = [
    'carRentalTitle', 'carRentalSubtitle', 'carRentalOpen', 'carRentalBack',
    'carRentalNotice', 'carRentalAvailabilityNotice', 'carRentalLiveNotice',
    'carRentalUseLocation', 'carRentalManualSearch', 'carRentalManualPlaceholder',
    'carRentalSearchNear', 'carRentalDestinationSearch', 'carRentalAirportSearch',
    'carRentalStationSearch', 'carRentalSearch', 'carRentalSearchThisArea',
    'carRentalRecentre', 'carRentalFitResults', 'carRentalRadius',
    'carRentalRequestingLocation', 'carRentalSearching', 'carRentalLocationDenied',
    'carRentalLocationUnavailable', 'carRentalServiceUnavailable', 'carRentalTimedOut',
    'carRentalTooMany', 'carRentalOffline', 'carRentalCached', 'carRentalNoResults',
    'carRentalRetry', 'carRentalIncreaseRadius', 'carRentalSearchAnother',
    'carRentalMapView', 'carRentalListView', 'carRentalAllOffices',
    'carRentalAirportOffice', 'carRentalCityOffice', 'carRentalRailwayOffice',
    'carRentalBusOffice', 'carRentalHotelDesk', 'carRentalIndependentOffice',
    'carRentalUnknownOffice', 'carRentalAtAirport', 'carRentalWebsiteAvailable',
    'carRentalPhoneAvailable', 'carRentalSort', 'carRentalSortAirport',
    'carRentalSortWebsite', 'carRentalLegend', 'carRentalBrand', 'carRentalOperator',
    'carRentalLocationType', 'carRentalLocationContext', 'carRentalEmail',
    'carRentalBookingWebsite', 'carRentalBranchRef', 'carRentalOfficialWebsiteListed',
    'carRentalOfficialBookingListed', 'carRentalOpenOfficialWebsite',
    'carRentalCallOffice', 'carRentalChecklistTitle', 'carRentalChecklistIntro',
    'carRentalCheckAge', 'carRentalCheckLicence', 'carRentalCheckPermit',
    'carRentalCheckDeposit', 'carRentalCheckInsurance', 'carRentalCheckFuel',
    'carRentalCheckMileage', 'carRentalCheckDriver', 'carRentalCheckBorder',
    'carRentalCheckCancel', 'carRentalCheckTimes', 'carRentalCheckLate',
  ] as const;

  for (const key of keys) {
    assert.equal(typeof copy[key], 'string');
    assert.equal(copy[key].trim().length > 0, true);
    assert.equal(copy[key].includes('öğe'), false);
    assert.equal(copy[key].includes('alt başlık'), false);
    assert.equal(copy[key].startsWith('Araba kiralama'), false);
  }

  assert.equal(copy.carRentalTitle, 'Araç Kiralama');
  assert.equal(copy.carRentalMapView, 'Harita');
  assert.equal(copy.carRentalListView, 'Yakındakiler');
  assert.equal(copy.carRentalIncreaseRadius, 'Yarıçapı artır');
  assert.equal(copy.carRentalCallOffice, 'Ofisi telefonla ara');
});
