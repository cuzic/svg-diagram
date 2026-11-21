#!/usr/bin/env bash
# Installs the pinned Noto Sans JP (Regular, Bold) into fontconfig, so that FONT_STACKS.sans's 'Noto Sans JP' resolves to it and the goldens
# are measured with the font the Worker bundles (the same files and SHA-256 as the edge entries in .github/workflows/test.yml).
# Used by the golden jobs (test.yml, pptx-golden.yml) and scripts/golden-docker/Dockerfile. Run as root (or with sudo).
#   install-noto-sans-jp.sh [DIR]   (default /usr/local/share/fonts/noto-sans-jp)
set -euo pipefail
d=${1:-/usr/local/share/fonts/noto-sans-jp}
base=https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF/JP
mkdir -p "$d"
curl -sSfL -o "$d/NotoSansJP-Regular.otf" "$base/NotoSansJP-Regular.otf"
curl -sSfL -o "$d/NotoSansJP-Bold.otf" "$base/NotoSansJP-Bold.otf"
(cd "$d" && sha256sum -c - <<'SUMS'
dff723ba59d57d136764a04b9b2d03205544f7cd785a711442d6d2d085ac5073  NotoSansJP-Regular.otf
1b0edfb500b73a4fa8a4fcaae1bbbd403994e08e73e3e0da37e70d3853f42c5f  NotoSansJP-Bold.otf
SUMS
)
fc-cache -f "$d" >/dev/null
