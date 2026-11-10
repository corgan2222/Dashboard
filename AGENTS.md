# Notes for coding agents

Orientation for an agent working in this repository. The README describes the
app for users; this file describes how the code is put together and how a
change gets shipped.

## What this program is

IT Dashboard: an Electron app that shows websites and RTSP cameras in a
resizable grid of up to three columns and two rows. Plain JavaScript, no
framework, no bundler. The window loads `index.html`; every panel is a
`<webview>` or, for an `rtsp://` URL, a `<video>` fed by go2rtc over WebRTC.

## Code map

| Path | What lives there |
|---|---|
| `main.js` | Main process: window and its saved position, webview hooks (user agent, link handling, permission allow-list), go2rtc download and process, IPC handlers, portable mode |
| `preload.js` | The only bridge to the page: `window.electronAPI`, one function per IPC call |
| `renderer.js` | Dashboard UI: grid and Split.js, web and camera panels, WebRTC to go2rtc, auto-reload, Settings and Manage Panels |
| `index.html`, `styles.css` | Markup and styles of the dashboard window |
| `assets/` | App icon, logo and default panel icons |
| `scripts/make-portable.ps1` | Packs `dist/win-unpacked` plus an empty `data` folder into the portable zip |
| `.github/workflows/` | `release.yml` builds and publishes on a tag; `release-drafter.yml` keeps the draft release notes |
| `doc/` | The screenshot the README shows |
| `package.json` | Version, pinned go2rtc version (`go2rtcVersion`), electron-builder config |

## Runtime data

- userData is `%APPDATA%\it-dashboard` on Windows. The folder name comes from
  `name` in `package.json`, not from `productName`. Never rename it: existing
  installations would start with an empty config and lose their logins.
- In userData: `dashboard-config.json` (panels, sizes, CSS),
  `window-state.json`, `Partitions/<panel>/` (one persistent session per
  panel, holds the logins), `go2rtc/` (binary plus `version.txt`).
- Portable mode: if a `data` folder exists next to the executable, userData
  points there. Only the portable zip ships that folder.
- The config can hold camera passwords in clear text. Never commit a real
  config, and show URLs through `maskUrl` in the UI.

## Commands

| Purpose | Command |
|---|---|
| Run from source | `npm start` |
| Windows installer and `dist/win-unpacked` | `npm run build:win` |
| Windows portable zip | `npm run build:portable` |
| Linux AppImage, macOS DMG | `npm run build:linux`, `npm run build:mac` |

Node.js 22.12 or newer is required (Electron 45). There is no test suite and
no linter yet. Check a change by running it: `npm start` for the UI, and a
packaged build for anything that depends on `app.isPackaged`, paths next to
the executable or the installer.

## Electron rules

- `contextIsolation: true` and `nodeIntegration: false` stay on. `preload.js`
  is the only bridge; add one function per capability the page needs, never
  a passthrough of `ipcRenderer`.
- IPC goes through `ipcMain.handle` and `ipcRenderer.invoke`.
- `sandbox: false` and `webSecurity: false` on the main window exist for the
  `<webview>` tag. Do not widen them further.
- A `<webview>` that leaves the DOM loses its page. `renderDashboard`
  reconciles the grid instead of rebuilding it; keep it that way, or toggling
  one panel reloads all of them.
- Anything a panel starts (timers, streams) is stopped in its `_cleanup`,
  which `renderDashboard` calls when the panel goes away.
- Permissions follow an allow-list in `main.js`. Camera and microphone
  (`media`) must stay granted: calls in WhatsApp or Slack depend on them.

## go2rtc

- `go2rtcVersion` in `package.json` pins the go2rtc release. The app downloads
  exactly that version from GitHub and records it in `go2rtc/version.txt`;
  when a release pins another one, the next camera start fetches it. To update
  go2rtc, change that field in a release pull request.
- A muted camera streams its picture straight from go2rtc's RTSP client. Only
  while sound is on, the panel switches to an `ffmpeg:` source that adds
  AAC to Opus transcoding.

## Releases

- The version lives in `package.json`. Bump it in a pull request, merge, then
  push the tag `vX.Y.Z` on that commit. The tag starts `release.yml`; a tag
  without the bump ships installers with the old number.
- Every pull request carries a label: `enhancement` (new feature, minor
  version), `bug`, `chore`, `dependencies` (all patch) or `documentation`.
  The labels sort the release notes and let Release Drafter resolve the
  next version.
- A release carries one file per platform plus
  `IT-Dashboard-<version>-portable.zip`.

## Git

- Every change goes through a pull request to `master`.
- Commit messages, branch names and pull request texts are in English.
- Read a file before you edit it. Search for every caller before you change a
  function.
