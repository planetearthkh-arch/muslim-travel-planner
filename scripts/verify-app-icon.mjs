import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const master = join(root, 'resources/safarone-app-icon-1024.png');
const appIconDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(master)) fail('Missing resources/safarone-app-icon-1024.png');

const fileInfo = execFileSync('file', [master], { encoding: 'utf8' });
if (!/PNG image data/.test(fileInfo)) fail('App icon master must be a PNG.');
if (!/1024 x 1024/.test(fileInfo)) fail('App icon master must be exactly 1024 x 1024 pixels.');
if (/RGBA|alpha/i.test(fileInfo)) fail('App icon master must be opaque with no alpha channel.');

const sipsInfo = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', master], { encoding: 'utf8' });
if (!/pixelWidth:\s*1024/.test(sipsInfo) || !/pixelHeight:\s*1024/.test(sipsInfo)) fail('App icon master must be exactly 1024 x 1024 pixels.');
if (!/hasAlpha:\s*no/.test(sipsInfo)) fail('App icon master must be opaque with no alpha channel.');

const icons = [
  ['Icon-App-20x20@2x.png', 40, 'iphone', '20x20', '2x'],
  ['Icon-App-20x20@3x.png', 60, 'iphone', '20x20', '3x'],
  ['Icon-App-29x29@2x.png', 58, 'iphone', '29x29', '2x'],
  ['Icon-App-29x29@3x.png', 87, 'iphone', '29x29', '3x'],
  ['Icon-App-40x40@2x.png', 80, 'iphone', '40x40', '2x'],
  ['Icon-App-40x40@3x.png', 120, 'iphone', '40x40', '3x'],
  ['Icon-App-60x60@2x.png', 120, 'iphone', '60x60', '2x'],
  ['Icon-App-60x60@3x.png', 180, 'iphone', '60x60', '3x'],
  ['Icon-App-1024x1024@1x.png', 1024, 'ios-marketing', '1024x1024', '1x'],
];

mkdirSync(appIconDir, { recursive: true });
for (const [filename, size] of icons) {
  const destination = join(appIconDir, filename);
  execFileSync('sips', ['-z', String(size), String(size), master, '--out', destination], { stdio: 'ignore' });
  if (!existsSync(destination)) fail(`Failed to generate ${filename}`);
  const png = readFileSync(destination);
  if (png.length < 1000) fail(`Generated icon ${filename} is unexpectedly small.`);
}

writeFileSync(join(appIconDir, 'Contents.json'), JSON.stringify({
  images: icons.map(([filename, , idiom, size, scale]) => ({ idiom, size, scale, filename })),
  info: { author: 'xcode', version: 1 },
}, null, 2));

for (const [filename] of icons) {
  if (!existsSync(join(appIconDir, filename))) fail(`AppIcon catalog references missing file ${filename}`);
}

console.log('SafarOne app icon master is valid and iOS AppIcon assets are present.');
