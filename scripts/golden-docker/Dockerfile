# The fonts of CI's golden jobs (.github/workflows/test.yml "golden", pptx-golden.yml), for regenerating and checking the goldens on any machine.
# Text widths are read from the font files that fontconfig picks (lib/font-metrics.ts), so a golden holds only for this set of fonts.
# The text is measured with the pinned Noto Sans JP (install-noto-sans-jp.sh); the rest only matters for mono, emoji and fallbacks.
# CI's runner is ubuntu-latest (24.04: DejaVu is there already) with fonts-noto-cjk, plus the fonts that `playwright install --with-deps chromium` installs
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
# Node 22, as in CI (actions/setup-node node-version: 22); pnpm comes from package.json's packageManager through corepack
ARG NODE_VERSION=22.21.1
RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz | tar -xJ -C /opt \
 && ln -s /opt/node-v${NODE_VERSION}-linux-x64/bin/node /usr/local/bin/node \
 && ln -s /opt/node-v${NODE_VERSION}-linux-x64/bin/corepack /usr/local/bin/corepack \
 && corepack enable --install-directory /usr/local/bin
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /work
