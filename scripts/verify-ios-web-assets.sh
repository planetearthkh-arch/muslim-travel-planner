#!/bin/sh
set -eu

REPOSITORY_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PUBLIC_DIR="$REPOSITORY_ROOT/ios/App/App/public"

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

[ -f "$PUBLIC_DIR/index.html" ] || fail "SafarMate iOS web assets are missing. From the repository root run: npm run ios:sync"

/usr/bin/grep -R -F -q "data-weather-attribution" "$PUBLIC_DIR" \
  || fail "SafarMate iOS web assets are stale and do not contain the native Apple Weather attribution host. Run: npm run ios:sync"

/usr/bin/grep -R -F -q "Weather data sources and legal attribution" "$PUBLIC_DIR" \
  || fail "SafarMate iOS web assets are stale and do not contain the Apple Weather legal attribution link. Run: npm run ios:sync"

/usr/bin/grep -R -F -q "X-SafarMate-Weather-Provider" "$PUBLIC_DIR" \
  || fail "SafarMate iOS web assets are stale and do not contain the WeatherKit transport bridge. Run: npm run ios:sync"

printf 'Verified SafarMate iOS web assets: Apple Weather attribution is bundled.\n'
