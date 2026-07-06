export {};

import { generateItinerary } from './planner.js';
import type { PlannerPreferences } from './models.js';

type AssertModule = {
  default: {
    equal(actual: unknown, expected: unknown, message?: string): void;
  };
};

type TestModule = {
  default(name: string, callback: () => void | Promise<void>): void;
};

const loadNodeModule = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>;

const { default: assert } = await loadNodeModule<AssertModule>('node:assert/strict');
const { default: test } = await loadNodeModule<TestModule>('node:test');

test('planner itinerary details do not expose internal verification labels', () => {
  const prefs: PlannerPreferences = {
    city: 'Tokyo',
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    startHour: '09:00',
    endHour: '18:00',
    interests: ['history'],
    groupSize: 2,
    children: false,
    walkingAbility: 'medium',
    transportation: 'public transport',
    budget: 'mid',
    prayerMethod: 'Muslim World League',
    prayerPreference: 'mosque',
    womenPrayerRequired: true,
    wuduRequired: true,
    accessibilityNeeds: 'step-free',
    halalPreference: 'strictly labelled',
  };

  assert.equal(generateItinerary(prefs).some((item) => /\b(?:Sample|Verified|Unverified)\b/.test(item.details)), false);
});
