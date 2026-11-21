# The fonts of CI's golden jobs (.github/workflows/test.yml "golden", pptx-golden.yml), for regenerating and checking the goldens on any machine.
# Text widths are read from the font files that fontconfig picks (lib/font-metrics.ts), so a golden holds only for this set of fonts.
# The text is measured with the pinned Noto Sans JP (install-noto-sans-jp.sh); the rest only matters for mono, emoji and fallbacks.
# The golden jobs run on `runs-on: ubuntu-24.04` (pinned, not ubuntu-latest, so that this image and CI share one release: change both together).
# The runner has DejaVu already; the jobs add fonts-noto-cjk and the fonts that `playwright install-deps chromium` installs
# (playwright-core's nativeDeps, "ubuntu24.04-x64" tools: Liberation Mono for the mono stack, Noto Color Emoji for the emoji stack, ...).
# Built and run by scripts/golden-docker.sh.
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-noto-cjk \
      fonts-noto-color-emoji fonts-unifont xfonts-cyrillic xfonts-scalable fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei fonts-tlwg-loma-otf fonts-freefont-ttf \
      fonts-dejavu-core fontconfig curl ca-certificates xz-utils \
 && rm -rf /var/lib/apt/lists/*
# the pinned Noto Sans JP (what the Worker measures with), as the golden jobs install it: 'Noto Sans JP' of FONT_STACKS.sans resolves to it
COPY install-noto-sans-jp.sh /usr/local/bin/
RUN install-noto-sans-jp.sh
# Node: the same release as the golden jobs (actions/setup-node node-version: 22.23.5), checked against nodejs.org's SHASUMS256.txt;
# pnpm comes from package.json's packageManager through corepack
ARG NODE_VERSION=22.23.5
ARG NODE_SHA256=cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8
RUN curl -fsSL -o /tmp/node.tar.xz https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz \
 && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
 && tar -xJ -C /opt -f /tmp/node.tar.xz && rm /tmp/node.tar.xz \
 && ln -s /opt/node-v${NODE_VERSION}-linux-x64/bin/node /usr/local/bin/node \
 && ln -s /opt/node-v${NODE_VERSION}-linux-x64/bin/corepack /usr/local/bin/corepack \
 && corepack enable --install-directory /usr/local/bin
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /work
