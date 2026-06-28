import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const iosDir = join(root, 'ios');
const templatePath = join(root, 'mobile', 'ios', 'AppDelegate.swift.template');
const alertSoundPath = join(root, 'mobile', 'ios', 'athan_alert.caf');
const appDelegatePath = join(iosDir, 'App', 'App', 'AppDelegate.swift');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(iosDir)) {
  run('npx', ['cap', 'add', 'ios']);
}

run('npx', ['cap', 'sync', 'ios']);

if (!existsSync(templatePath) || !existsSync(alertSoundPath)) {
  throw new Error('The iOS Athan template files are missing.');
}

const alertBase64 = readFileSync(alertSoundPath).toString('base64');
const template = readFileSync(templatePath, 'utf8');
const appDelegate = template.replace('__ATHAN_ALERT_BASE64__', alertBase64);

mkdirSync(dirname(appDelegatePath), { recursive: true });
writeFileSync(appDelegatePath, appDelegate);

console.log('\niOS Athan notifications are installed. Run: npm run ios:open');
console.log('Closed-app alerts use the 29-second Athan clip. Test Athan plays the full recording.');
