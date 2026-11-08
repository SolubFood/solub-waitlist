#!/usr/bin/env bash
# Build para Cloudflare (Workers): copia SOLO los archivos públicos de la web a dist/.
# Así no se publican worker/, design-reference/, ARQUITECTURA.md, SECURITY.md, .github/, etc.
# Cloudflare → Settings → Build → Build command: bash build.sh   (wrangler.jsonc publica dist/)
set -euo pipefail
rm -rf dist
mkdir -p dist
cp ./*.html dist/
cp -r assets dist/
cp robots.txt sitemap.xml favicon.svg favicon-16.png favicon-32.png apple-touch-icon.png _headers dist/
echo "Build OK: $(find dist -type f | wc -l) archivos publicados en dist/"
