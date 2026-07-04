import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/planner.test.ts';
const source = readFileSync(path, 'utf8');
const oldAssertion = "  assert.equal(ics.includes('DTSTART;TZID=Europe/London:20260701T223000'), true);";
const replacement = "  assert.equal(ics.includes('DTSTART:20260701T213000Z'), true);\n  assert.equal(ics.includes('DTEND:20260702T012000Z'), true);";
if (!source.includes(oldAssertion)) throw new Error('Expected old flight calendar assertion was not found');
writeFileSync(path, source.replace(oldAssertion, replacement));
console.log('updated flight calendar assertions for UTC export');
