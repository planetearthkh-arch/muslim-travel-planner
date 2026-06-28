import { cpSync, existsSync, mkdirSync } from 'node:fs';
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
mkdirSync(javaTarget, { recursive: true });
cpSync(join(templateDir, 'AndroidManifest.xml'), join(mainDir, 'AndroidManifest.xml'));
cpSync(join(templateDir, 'java'), javaTarget, { recursive: true });

console.log('\nAndroid Athan alarms are installed. Run: npm run android:open');
