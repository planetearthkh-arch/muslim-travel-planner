from pathlib import Path

root = Path('.')
skipped_parts = {'.git', 'node_modules', 'dist', 'dist-native', 'build', 'coverage'}
replacements = (
    ('SAFARONE', 'SAFARMATE'),
    ('SafarOne', 'SafarMate'),
    ('safarone', 'safarmate'),
    ('Effective date: July 11, 2026', 'Effective date: July 12, 2026'),
    ('Last updated: July 4, 2026', 'Last updated: July 12, 2026'),
    ('آخر تحديث: 4 يوليو 2026', 'آخر تحديث: 12 يوليو 2026'),
    ('Terakhir diperbarui: 4 Juli 2026', 'Terakhir diperbarui: 12 Juli 2026'),
    ('Kemas kini terakhir: 4 Julai 2026', 'Kemas kini terakhir: 12 Julai 2026'),
    ('Son güncelleme: 4 Temmuz 2026', 'Son güncelleme: 12 Temmuz 2026'),
    ('Dernière mise à jour : 4 juillet 2026', 'Dernière mise à jour : 12 juillet 2026'),
    ('آخری تازہ کاری: 4 جولائی 2026', 'آخری تازہ کاری: 12 جولائی 2026'),
)


def skipped(path: Path) -> bool:
    return any(part in skipped_parts for part in path.parts)


for path in list(root.rglob('*')):
    if not path.is_file() or skipped(path):
        continue
    data = path.read_bytes()
    if b'\x00' in data:
        continue
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        continue
    updated = text
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated, encoding='utf-8')

capacitor = Path('capacitor.config.ts')
capacitor_text = capacitor.read_text(encoding='utf-8')
new_scheme = "    scheme: 'SafarMate',"
legacy_scheme = (
    "    // Legacy WebView origin retained to preserve existing native local storage after the rebrand.\n"
    "    scheme: 'SafarOne',"
)
if new_scheme not in capacitor_text:
    raise SystemExit('Expected renamed Capacitor iOS scheme was not found.')
capacitor.write_text(capacitor_text.replace(new_scheme, legacy_scheme, 1), encoding='utf-8')

brand_doc = '''# SafarMate Brand Identity

## Official product naming

- Brand: **SafarMate**
- In-app and web descriptor: **Muslim Travel Planner**
- Full web identity: **SafarMate — Muslim Travel Planner**
- App Store name: **SafarMate: Muslim Travel**
- App Store subtitle: **Prayer, Qibla & Halal Guide**
- Tagline: **Plan with faith. Travel with peace.**

Use **SafarMate** unchanged in every supported language. Translate only the descriptor, surrounding sentences, legal copy, and support text.

## Compatibility identifiers retained intentionally

The following identifiers are not customer-facing brand names and must remain stable to preserve upgrades, saved trips, links, and integrations:

- iOS/Android application identifier: `com.planetearthkids.muslimtravelplanner`
- Repository and package name: `muslim-travel-planner`
- GitHub Pages base path: `/muslim-travel-planner/`
- Saved-trip storage key: `mtp-saved-trips-v1`
- Existing calendar UID domain: `muslim-travel-planner.local`
- The pre-rebrand Capacitor iOS WebView scheme is retained internally to preserve the existing native storage origin and must never be displayed to users.

## Release checklist

Before publishing a release, verify the phone display name, launch experience, browser/PWA metadata, legal pages, permission descriptions, sharing, calendar exports, reports, tests, screenshots, and App Store Connect metadata all use the official SafarMate naming above.
'''
Path('docs').mkdir(exist_ok=True)
Path('docs/BRAND_IDENTITY.md').write_text(brand_doc, encoding='utf-8')

paths = [path for path in root.rglob('*') if not skipped(path)]
for path in sorted(paths, key=lambda item: len(item.parts), reverse=True):
    if not path.exists():
        continue
    renamed = path.name.replace('SAFARONE', 'SAFARMATE').replace('SafarOne', 'SafarMate').replace('safarone', 'safarmate')
    if renamed != path.name:
        destination = path.with_name(renamed)
        if destination.exists():
            raise SystemExit(f'Cannot rename {path} because {destination} already exists.')
        path.rename(destination)
