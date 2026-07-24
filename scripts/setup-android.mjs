import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const androidDir = join(root, 'android');
const templateDir = join(root, 'mobile', 'android');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(androidDir)) {
  run('npx', ['cap', 'add', 'android']);
}

run('npx', ['cap', 'sync', 'android']);

const mainDir = join(androidDir, 'app', 'src', 'main');
const javaTarget = join(mainDir, 'java', 'com', 'planetearthkids', 'muslimtravelplanner');
const testTarget = join(androidDir, 'app', 'src', 'test', 'java', 'com', 'planetearthkids', 'muslimtravelplanner');
mkdirSync(javaTarget, { recursive: true });
mkdirSync(testTarget, { recursive: true });
cpSync(join(templateDir, 'AndroidManifest.xml'), join(mainDir, 'AndroidManifest.xml'));
cpSync(join(templateDir, 'java'), javaTarget, { recursive: true });
cpSync(join(templateDir, 'res'), join(mainDir, 'res'), { recursive: true });
cpSync(join(templateDir, 'test'), testTarget, { recursive: true });
cpSync(join(templateDir, 'safarmate-release.gradle'), join(androidDir, 'app', 'safarmate-release.gradle'));

const appGradlePath = join(androidDir, 'app', 'build.gradle');
const releaseApply = "apply from: 'safarmate-release.gradle'";
let appGradle = readFileSync(appGradlePath, 'utf8');
if (!appGradle.includes(releaseApply)) {
  appGradle = `${appGradle.trimEnd()}\n\n${releaseApply}\n`;
  writeFileSync(appGradlePath, appGradle);
}

console.log('\nSafarMate Android setup complete: Athan alarms, Google Play Billing, API 36 and release bundle configuration are installed.');
console.log('Run: npm run android:open');
console.log('Release verification: npm run android:verify');
console.log('Signed bundle: set SAFARMATE_ANDROID_KEYSTORE_* variables, then run npm run android:bundle');
