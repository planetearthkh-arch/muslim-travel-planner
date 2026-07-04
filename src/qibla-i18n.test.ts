import assert from 'node:assert/strict';
import test from 'node:test';
import { labels } from './i18n.js';

test('live compass button translation stays synchronized across languages', () => {
  assert.equal(labels.en.qiblaRequestMotion, 'Start live compass');
  assert.equal(labels.ar.qiblaRequestMotion, 'ابدأ البوصلة المباشرة');
  assert.equal(labels.id.qiblaRequestMotion, 'Mulai kompas langsung');
  assert.equal(labels.ms.qiblaRequestMotion, 'Mulakan kompas langsung');
  assert.equal(labels.tr.qiblaRequestMotion, 'Canlı pusulayı başlat');
  assert.equal(labels.fr.qiblaRequestMotion, 'Démarrer la boussole en direct');
});
