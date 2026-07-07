export {};

type AssertModule = {
  default: {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
  };
};

type FsModule = {
  readFileSync(path: string, encoding: 'utf8'): string;
};

type TestModule = {
  default(name: string, callback: () => void | Promise<void>): void;
};

const loadNodeModule = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>;

const { default: assert } = await loadNodeModule<AssertModule>('node:assert/strict');
const { readFileSync } = await loadNodeModule<FsModule>('node:fs');
const { default: test } = await loadNodeModule<TestModule>('node:test');

test('status bootstrap is loaded after the main app renders and collapses empty tool rows', () => {
  const bootstrap = readFileSync('src/app-bootstrap.ts', 'utf8');
  const helper = readFileSync('src/prayer-status-bootstrap.ts', 'utf8');

  assert.ok(bootstrap.includes("await import('./prayer-status-bootstrap.js');"));
  assert.ok(helper.includes("'.prayer-app .prayer-status.idle'"));
  assert.ok(helper.includes("'.prayer-app .prayer-status.ready'"));
  assert.ok(helper.includes("'.halal-app .prayer-status.idle'"));
  assert.ok(helper.includes("'.halal-app .prayer-status.ready'"));
  assert.ok(helper.includes("status.classList.contains('prayer-status')"));
  assert.ok(helper.includes('status.hidden = isEmpty'));
  assert.ok(helper.includes("status.setAttribute('aria-hidden', String(isEmpty))"));
  assert.equal(helper.includes('status.textContent ='), false);
  assert.equal(helper.includes('const toolPanels ='), false);
  assert.equal(helper.includes('`${toolPanels} ${idleStatuses}`'), false);
});
