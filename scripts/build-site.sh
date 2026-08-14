#!/bin/sh
# flattens the demo for static hosting: page at /, library files beside it
set -e
rm -rf public
mkdir -p public
cp demo/index.html demo/favicon.svg demo/og.png public/
cp src/scraps.js src/scraps.css public/
sed -i.bak 's#\.\./src/##g' public/index.html && rm public/index.html.bak
