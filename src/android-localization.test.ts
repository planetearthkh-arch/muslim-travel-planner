import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Android templates preserve SafarOne identity in every supported locale', async () => {
  for (const folder of ['values', 'values-ar', 'values-in', 'values-ms', 'values-tr', 'values-fr', 'values-ur']) {
    const source = await repoFile(`mobile/android/res/${folder}/strings.xml`);
    assert.equal(source.includes('<string name="app_name">SafarOne</string>'), true);
    assert.equal(source.includes('<string name="title_activity_main">SafarOne</string>'), true);
  }
  const manifest = await repoFile('mobile/android/AndroidManifest.xml');
  const setup = await repoFile('scripts/setup-android.mjs');
  assert.equal(manifest.includes('android:supportsRtl="true"'), true);
  assert.equal(setup.includes("cpSync(join(templateDir, 'res'), join(mainDir, 'res'), { recursive: true })"), true);
});
