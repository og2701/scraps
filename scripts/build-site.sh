#!/bin/sh
# flattens the demo for static hosting: pages at /, library files beside them
set -e
rm -rf public
mkdir -p public
cp demo/index.html demo/swatch-book.html demo/favicon.svg demo/og.png public/
cp src/scraps.js src/scraps.css public/
for f in public/index.html public/swatch-book.html; do
  sed -i.bak 's#\.\./src/##g' "$f" && rm "$f.bak"
done
