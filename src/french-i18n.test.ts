import assert from 'node:assert/strict';
import test from 'node:test';
import { athanLabels } from './athan-i18n.js';
import { frenchExtraLabelsA } from './french-labels-extra-a.js';
import { frenchExtraLabelsC } from './french-labels-extra-c.js';
import { frenchFlightLabels } from './french-labels-flight.js';
import { frenchLabels } from './french-labels.js';
import { frenchTransportLabelsA } from './french-labels-transport-a.js';
import { frenchTransportLabelsB } from './french-labels-transport-b.js';
import { frenchTransportLabelsC } from './french-labels-transport-c.js';
import { labels, languageDirection, languages, nextLanguage, optionLabels, prayerLabels, regionLabels, statusLabels } from './i18n.js';

test('French is available as a left-to-right app language', () => {
  assert.equal(languages.some((language) => language.code === 'fr' && language.label === 'Français'), true);
  assert.equal(languageDirection('fr'), 'ltr');
  assert.equal(nextLanguage('tr'), 'fr');
  assert.equal(nextLanguage('fr'), 'en');
});

test('French core travel and Muslim-essential labels are translated', () => {
  assert.equal(labels.fr.subtitle, 'Planificateur de voyage musulman');
  assert.equal(labels.fr.plan, 'Créer l’itinéraire');
  assert.equal(labels.fr.qiblaTitle, 'Direction de la Qibla');
  assert.equal(labels.fr.halalRestaurantsTitle, 'Restaurants halal');
  assert.equal(labels.fr.prayerSpacesTitle, 'Mosquées et espaces de prière');
  assert.equal(labels.fr.weatherTitle, 'Météo');
  assert.equal(labels.fr.flightModeTitle, 'Prière et Qibla en vol');
  assert.equal(labels.fr.carRentalTitle, 'Location de voitures');
  assert.equal(labels.fr.publicTransportTitle, 'Transports en commun');
  assert.equal(labels.fr.taxiTitle, 'Services de taxi');
  assert.equal(labels.fr.toiletsTitle, 'Toilettes publiques');
  assert.equal(athanLabels.fr.enable, 'Activer les notifications de prière');
});

test('French has an explicit translation for every interface label', () => {
  const translated = {
    ...frenchLabels,
    ...frenchFlightLabels,
    ...frenchTransportLabelsA,
    ...frenchTransportLabelsB,
    ...frenchTransportLabelsC,
    ...frenchExtraLabelsA,
    ...frenchExtraLabelsC,
  };
  assert.deepEqual(Object.keys(translated).sort(), Object.keys(labels.en).sort());
  assert.deepEqual(Object.keys(labels.fr).sort(), Object.keys(labels.en).sort());
});

test('French structured labels are complete', () => {
  assert.equal(regionLabels.fr['Middle East'], 'Moyen-Orient');
  assert.equal(statusLabels.fr.Verified, 'Vérifié');
  assert.equal(prayerLabels.fr.Dhuhr, 'Dhuhr');
  assert.equal(optionLabels.budget.fr.mid, 'moyen');
  assert.equal(optionLabels.transportation.fr['public transport'], 'transports en commun');
  assert.equal(optionLabels.prayerPreference.fr.mosque, 'mosquée');
});
