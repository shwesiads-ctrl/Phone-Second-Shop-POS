#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Phone-Second-Shop-POS
node -e "if (Number(process.versions.node.split('.')[0]) < 24) { console.error('Node.js 24+ required'); process.exit(1); }"
command -v pdfinfo >/dev/null
command -v pdftotext >/dev/null
export NODE_USE_ENV_PROXY=1
export XDG_CACHE_HOME=/workspace/.cache
export electron_config_cache=/workspace/.cache/electron
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
node node_modules/electron/install.js
npm test
npm run build
node tests/e2e/desktop.mjs
node tests/e2e/currency-print.mjs
