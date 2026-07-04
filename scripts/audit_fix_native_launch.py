from __future__ import annotations

import json
from audit_fix_common import ROOT, read, write, replace_once

# ---------------------------------------------------------------------------
# Native/legal/privacy fixes
# ---------------------------------------------------------------------------
links_path = 'src/native-links.ts'
links = read(links_path)
links = replace_once(
    links,
    "      if (/^https?:\\/\\//i.test(href)) {\n        event.preventDefault();\n        void openSafeExternalUrl(href);\n      }",
    "      if (/^https?:\\/\\//i.test(href)) {\n"
    "        event.preventDefault();\n"
    "        void openSafeExternalUrl(href);\n"
    "        return;\n"
    "      }\n"
    "      if (/^(?:privacy|support)\\.html(?:\\?|$)/i.test(href)) {\n"
    "        event.preventDefault();\n"
    "        window.location.assign(href);\n"
    "      }",
    'native legal links',
)
write(links_path, links)

plist_path = 'ios/App/App/Info.plist'
plist = read(plist_path)
plist = replace_once(
    plist,
    "\t<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>\n\t<string>SafarOne uses your location only when you request Qibla direction or nearby travel places.</string>\n",
    '',
    'remove unnecessary always-location permission',
)
write(plist_path, plist)

# Launch screen and transparent images.
storyboard_path = 'ios/App/App/Base.lproj/LaunchScreen.storyboard'
storyboard = read(storyboard_path).replace('image="LaunchIcon"', 'image="LaunchLogo"').replace('<image name="LaunchIcon" width="320" height="320"/>', '<image name="LaunchLogo" width="180" height="180"/>')
write(storyboard_path, storyboard)

launch_contents = {
    'images': [
        {'filename': 'LaunchLogo_1x.png', 'idiom': 'universal', 'scale': '1x'},
        {'filename': 'LaunchLogo_2x.png', 'idiom': 'universal', 'scale': '2x'},
        {'filename': 'LaunchLogo_3x.png', 'idiom': 'universal', 'scale': '3x'},
    ],
    'info': {'author': 'xcode', 'version': 1},
}
write('ios/App/App/Assets.xcassets/LaunchLogo.imageset/Contents.json', json.dumps(launch_contents, indent=2) + '\n')

from PIL import Image

source_logo = ROOT / 'ios/App/App/Assets.xcassets/LaunchIcon.imageset/launch-icon.png'
image = Image.open(source_logo).convert('RGBA')
pixels = image.load()
background = pixels[0, 0][:3]
for y in range(image.height):
    for x in range(image.width):
        red, green, blue, alpha = pixels[x, y]
        distance = abs(red - background[0]) + abs(green - background[1]) + abs(blue - background[2])
        if distance < 48:
            pixels[x, y] = (red, green, blue, 0)
alpha_box = image.getchannel('A').getbbox()
if not alpha_box:
    raise RuntimeError('Launch logo background removal produced an empty image')
logo = image.crop(alpha_box)
for scale, size in [(1, 180), (2, 360), (3, 540)]:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    maximum = int(size * 0.84)
    logo_copy = logo.copy()
    logo_copy.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
    offset = ((size - logo_copy.width) // 2, (size - logo_copy.height) // 2)
    canvas.alpha_composite(logo_copy, offset)
    canvas.save(ROOT / 'ios/App/App/Assets.xcassets/LaunchLogo.imageset' / f'LaunchLogo_{scale}x.png')
