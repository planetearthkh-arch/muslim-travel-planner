import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportText, createPlaceReport, githubIssueUrl } from './place-report.js';

const place = { feature: 'Halal Restaurants', name: 'Central Grill', city: 'London', country: 'United Kingdom' };

test('place-report exports and GitHub titles follow the selected language', () => {
  const cases = [
    ['en', 'SafarMate place report', 'Place report:'],
    ['ar', 'تقرير مكان من SafarMate', 'تقرير مكان:'],
    ['id', 'Laporan tempat SafarMate', 'Laporan tempat:'],
    ['ms', 'Laporan tempat SafarMate', 'Laporan tempat:'],
    ['tr', 'SafarMate yer bildirimi', 'Yer bildirimi:'],
    ['fr', 'Signalement de lieu SafarMate', 'Signalement de lieu:'],
    ['ur', 'SafarMate مقام رپورٹ', 'مقام رپورٹ:'],
  ] as const;
  for (const [language, heading, titlePrefix] of cases) {
    const report = createPlaceReport(place, 'halal', 'note', language, '2026-07-05T12:00:00.000Z');
    const text = buildReportText(report);
    assert.equal(text.startsWith(heading), true);
    assert.equal(text.includes('halal\n'), false);
    const title = new URL(githubIssueUrl(report)).searchParams.get('title') ?? '';
    assert.equal(title.startsWith(titlePrefix), true);
  }
});
