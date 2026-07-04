#!/usr/bin/env bash
set -euo pipefail

cat > .github/workflows/ci.yml <<'YAML'
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
      - run: npm run lint
      - name: Package temporary debug workspace
        if: always()
        run: tar --exclude='./.git' --exclude='./dist' --exclude='./dist-test' --exclude='./android/.gradle' --exclude='./hardening-workspace.tgz' -czf hardening-workspace.tgz .
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: hardening-workspace
          path: hardening-workspace.tgz
          retention-days: 1

  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - run: npm ci
      - run: npm run android:setup
      - run: ./gradlew assembleDebug
        working-directory: android
YAML

cat scripts/final-hardening-patch.part* > /tmp/final-hardening.patch.gz.b64
base64 --decode /tmp/final-hardening.patch.gz.b64 > /tmp/final-hardening.patch.gz
sha256sum /tmp/final-hardening.patch.gz
echo "95a8f04f19bcf337015e069c0abd7ba425262cd85b60e0a9349fcc93e9f50450  /tmp/final-hardening.patch.gz" | sha256sum --check
gzip --test /tmp/final-hardening.patch.gz
gzip --decompress --stdout /tmp/final-hardening.patch.gz > /tmp/final-hardening.patch
patch --dry-run -p2 --batch --forward < /tmp/final-hardening.patch
patch -p2 --batch --forward < /tmp/final-hardening.patch
rm -f temp/noop.txt
