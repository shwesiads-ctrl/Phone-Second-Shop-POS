# Cloud development

Each cloud task is already isolated. Use the existing checkout at `/workspace/Phone-Second-Shop-POS`; do not create a Git worktree unless the user explicitly asks.

Node 24 and npm are already available on this instance. Core development does not require secrets, payment-provider credentials, GitHub tokens or a database server. Git access uses the platform's existing authentication proxy. Package downloads need the existing package-manager/GitHub network presets.

```sh
cd /workspace/Phone-Second-Shop-POS
export NODE_USE_ENV_PROXY=1
export XDG_CACHE_HOME=/workspace/.cache
export electron_config_cache=/workspace/.cache/electron
npm ci --cache /workspace/.npm-cache
node node_modules/electron/install.js
npm test
npm run build
node tests/e2e/desktop.mjs
```

The CI desktop test launches Electron with a temporary database, runs the functional workflow and removes its test database. It is suitable without a graphical display. Its Linux-only sandbox bypass is confined to this test environment; Windows production launches retain sandboxing.

To work with the Vite development renderer internally on this machine:

```sh
XDG_CONFIG_HOME=/workspace/.config XDG_CACHE_HOME=/workspace/.cache npm run dev -- --no-sandbox --ozone-platform=headless --disable-gpu
```

Vite listens on `127.0.0.1:5173`. Validate it internally; the onboarding UI does not support localhost preview links. Live Electron/Vite processes do not survive publication or task restart; start them again when needed. A normal Windows developer runs `npm run dev` without CI flags.

Windows cross-build uses Electron Builder with a custom NSIS script. NSIS compiles the installer and uninstaller together, so no Wine runtime is needed. Use writable caches:

```sh
XDG_CACHE_HOME=/workspace/.cache NODE_USE_ENV_PROXY=1 ELECTRON_GET_USE_PROXY=1 ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder npm run dist:win
```

A successfully produced Windows executable still requires Windows 10/11 installation, upgrade, uninstall, printing and acceptance tests. Linux Electron tests do not establish Windows compatibility by themselves.

## Release verification setup

`bash scripts/setup-cloud.sh` is the tested complete setup: Node 24 check, Poppler commands, frozen dependency install, explicit Electron install, business tests, production build and both real Electron workflows. `node tests/e2e/currency-print.mjs` uses `pdfinfo`/`pdftotext` to verify the nine Unicode/paper-size PDFs. These Poppler tools and Linux Electron shared libraries are present in the saved image; a bare remote checkout needs them installed separately. Do not interpret the Linux sandbox bypass as a Windows launch setting.

Saved onboarding draft revision 2 was confirmed by read-back after the update. It preserves network/credential/repository settings and requires no new secrets or custom domains. The platform returned `requires_publish: true`. Review and save changes in environment settings, then publish the environment; no publication occurred in this session. Fresh-task restoration has not been verified. The application changes are local/unpushed and must be retained in the environment snapshot or committed through an authorized source-control workflow.
