#!/usr/bin/env bash
# Rasterize an SVG to PNG for visual QA while authoring.
#
# ImageMagick's `convert` on this sandbox falls back to its built-in MSVG
# coder (the rsvg-convert delegate is disabled by /etc/ImageMagick-6/policy.xml),
# and MSVG silently drops all <text> — shapes render, labels don't. Headless
# Chrome renders SVG+CJK text correctly, so use it instead for previews.
# --headless=new specifically: plain --headless mis-painted small viewports
# in testing (partial/garbled output) on this Chrome build.
#
# This script is a QA tool only — the shipped SVG is embedded verbatim into
# the book (referenced by <img src="images/<name>.svg"> in the chapter
# markdown; pandoc/EPUB and the HTML build both resolve it as a normal
# static asset). Nothing here touches the build output.
#
# Usage: preview_svg.sh <input.svg> <output.png> [scale]
#
# Known quirk: headless Chrome's actual layout viewport comes out ~88 CSS px
# shorter than the `--window-size` height you ask for (reproduced: a shape
# placed at the bottom of the requested height gets silently clipped, padded
# with white — indistinguishable from legitimate empty canvas). We work
# around it by requesting extra height, then cropping the screenshot back
# down to the SVG's real (scaled) dimensions.
set -euo pipefail

svg_path="$1"
out_path="$2"
scale="${3:-2}"
viewport_pad=200

width=$(grep -o 'width="[0-9.]*"' "$svg_path" | head -1 | grep -o '[0-9.]*')
height=$(grep -o 'height="[0-9.]*"' "$svg_path" | head -1 | grep -o '[0-9.]*')
if [ -z "$width" ] || [ -z "$height" ]; then
  echo "error: could not read width/height from $svg_path (viewBox alone isn't enough — set explicit width/height attributes on the <svg> root)" >&2
  exit 1
fi

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
html_path="$workdir/preview.html"
{
  echo '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#fff}</style></head><body>'
  cat "$svg_path"
  echo '</body></html>'
} > "$html_path"

raw_path="$workdir/raw.png"
CHROME="${CHROME:-}"
if [ -z "$CHROME" ]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser chrome; do
    if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
  done
fi
if [ -z "$CHROME" ]; then
  echo "preview: Chrome/Chromium が見つからない。CHROME=/path/to/chrome を指定するか、インストールする" >&2
  exit 1
fi
"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --screenshot="$raw_path" \
  --window-size="${width%.*},$((${height%.*} + viewport_pad))" \
  --force-device-scale-factor="$scale" \
  "file://$html_path" 2>/dev/null

out_w=$(( ${width%.*} * scale ))
out_h=$(( ${height%.*} * scale ))
convert "$raw_path" -crop "${out_w}x${out_h}+0+0" +repage "$out_path"

echo "wrote $out_path"
