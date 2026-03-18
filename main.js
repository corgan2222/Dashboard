'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu, session, webContents } = require('electron');

// Suppress Chromium INFO-level console output (e.g. DirectShow device enumeration)
app.commandLine.appendSwitch('log-level', '3');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');
const { version } = require('./package.json');
const buildDate = (() => {
  try {
    const d = new Date(require('./build-info.json').buildDate);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (_) { return ''; }
})();

let mainWindow;

// ── Config file path (persists across sessions) ──────────────────────────────
function getConfigPath() {
  return path.join(app.getPath('userData'), 'dashboard-config.json');
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#212529',
    title: `IT Dashboard v${version}${buildDate ? '  |  built ' + buildDate : ''}`,
    icon: path.join(__dirname, 'assets', 'icon_512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,         // required for <webview> elements
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,           // webviewTag needs sandbox disabled in Electron 34
      webSecurity: false,       // allows cross-origin requests inside webviews
    },
    show: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.maximize(); });

  // Lock the title so renderer document.title changes don't overwrite it
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  // No visible menu bar — access tools via right-click on the dashboard
  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      { label: 'Developer Tools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() },
      { type: 'separator' },
      { role: 'reload', label: 'Reload' },
      { role: 'forceReload', label: 'Force Reload' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { type: 'separator' },
      {
        label: 'Clear All Cache & Reload',
        click: async () => { await clearAllCaches(); mainWindow.reload(); },
      },
    ]).popup({ window: mainWindow });
  });
}

// ── Track all sessions so we can clear them all at once ──────────────────────
const activeSessions = new Set();

// ── Permissions: allow common web app requests (notifications, media, etc.) ───
function allowPermissions(ses) {
  activeSessions.add(ses);
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });
}

async function clearAllCaches() {
  for (const ses of activeSessions) {
    await ses.clearCache();
    await ses.clearStorageData({
      storages: ['cookies', 'filesystem', 'indexdb', 'localstorage',
                 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
    });
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  allowPermissions(session.defaultSession);
  createWindow();
});

// Grant permissions for persist: partition sessions created by webviews
app.on('session-created', (ses) => allowPermissions(ses));

app.on('window-all-closed', () => {
  stopGo2rtc();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Webview: set UA at session level + override navigator.userAgentData ──────
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

// Injected before every page's JS via Page.addScriptToEvaluateOnNewDocument.
// This is more reliable than a preload override because it runs in the page's
// own world before any framework code checks navigator.userAgentData.
const UA_OVERRIDE_SCRIPT = `(function(){
  var ua = {
    brands: [
      {brand:'Not_A Brand',   version:'99' },
      {brand:'Google Chrome', version:'146'},
      {brand:'Chromium',      version:'146'}
    ],
    mobile: false,
    platform: 'Windows',
    getHighEntropyValues: async function() {
      return {
        brands:          [{brand:'Not_A Brand',version:'99.0.0.0'},{brand:'Google Chrome',version:'146.0.0.0'},{brand:'Chromium',version:'146.0.0.0'}],
        fullVersionList: [{brand:'Not_A Brand',version:'99.0.0.0'},{brand:'Google Chrome',version:'146.0.0.0'},{brand:'Chromium',version:'146.0.0.0'}],
        mobile: false, platform: 'Windows', architecture: 'x86',
        bitness: '64', platformVersion: '10.0.0', uaFullVersion: '146.0.0.0',
        model: '', wow64: false
      };
    },
    toJSON: function() {
      return {brands:[{brand:'Not_A Brand',version:'99'},{brand:'Google Chrome',version:'146'},{brand:'Chromium',version:'146'}],mobile:false,platform:'Windows'};
    }
  };
  // Try own-property override first (covers Chromium where it's not on the prototype)
  try { Object.defineProperty(navigator, 'userAgentData', {get:function(){return ua;},configurable:true,enumerable:true}); } catch(e){}
  // Fallback: prototype override
  try { Object.defineProperty(Navigator.prototype, 'userAgentData', {get:function(){return ua;},configurable:true,enumerable:true}); } catch(e){}
  // Hide Electron fingerprints so apps like Slack don't detect the wrapper
  // and silently degrade their UI (e.g. hide the message editor).
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
      Object.defineProperty(window, 'process', {get:function(){return undefined;},configurable:true});
    }
  } catch(e){}
})();`;

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;

  const uaMetadata = {
    brands: [
      { brand: 'Not_A Brand',   version: '99'  },
      { brand: 'Google Chrome', version: '146' },
      { brand: 'Chromium',      version: '146' },
    ],
    fullVersionList: [
      { brand: 'Not_A Brand',   version: '99.0.0.0'  },
      { brand: 'Google Chrome', version: '146.0.0.0' },
      { brand: 'Chromium',      version: '146.0.0.0' },
    ],
    platform: 'Windows', platformVersion: '10.0.0',
    architecture: 'x86', model: '', bitness: '64', mobile: false, wow64: false,
  };

  let scriptInjected = false;

  const applyUAOverride = () => {
    try {
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
      // Override UA header and navigator.userAgent
      contents.debugger.sendCommand('Emulation.setUserAgentOverride', {
        userAgent: CHROME_UA,
        userAgentMetadata: uaMetadata,
      }).catch(() => {});
      // Inject JS override for navigator.userAgentData — runs before page scripts
      if (!scriptInjected) {
        contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
          source: UA_OVERRIDE_SCRIPT,
        }).then(() => { scriptInjected = true; }).catch(() => {});
      }
    } catch (_) {}
  };

  // Apply immediately when webContents is created
  applyUAOverride();

  // Re-apply on every navigation — fires before page scripts run
  contents.on('did-start-loading', applyUAOverride);

  contents.on('did-attach', () => {
    contents.session.setUserAgent(CHROME_UA);
    applyUAOverride();
  });

  // If an "unsupported browser" page loads, clear service workers and reload
  contents.on('did-finish-load', () => {
    contents.executeJavaScript(`
      if (document.body && document.body.innerText.includes('not supported')) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
          if (regs.length) location.reload();
        });
      }
    `).catch(() => {});
  });

  // ── External link handling ─────────────────────────────────────────────────
  // Helper: returns true if url shares the domain of the webview's current page
  const isSameDomain = (url) => {
    try {
      const currentHost = new URL(contents.getURL()).hostname.replace(/^www\./, '');
      const linkHost    = new URL(url).hostname.replace(/^www\./, '');
      return linkHost === currentHost
          || linkHost.endsWith('.' + currentHost)
          || currentHost.endsWith('.' + linkHost);
    } catch (_) { return false; }
  };

  // Regular link clicks that navigate the page → open external if different domain
  contents.on('will-navigate', (e, url) => {
    const current = contents.getURL();
    if (!current || current === 'about:blank') return; // initial load
    const same = isSameDomain(url);
    console.log(`[will-navigate] "${new URL(current).hostname}" → "${url}" same=${same}`);
    if (!same) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // window.open / target=_blank → same domain loads in-panel, external → browser
  contents.setWindowOpenHandler(({ url }) => {
    const same = isSameDomain(url);
    console.log(`[window-open] → "${url}" same=${same}`);
    if (same) {
      setImmediate(() => contents.loadURL(url));
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});

// ── IPC: webview right-click context menu ────────────────────────────────────
ipcMain.handle('show-webview-context-menu', (_event, webContentsId) => {
  const wc = webContents.fromId(webContentsId);
  if (!wc) return;
  const ctxMenu = Menu.buildFromTemplate([
    { label: 'Inspect Panel (DevTools)', click: () => wc.openDevTools() },
    { type: 'separator' },
    { label: 'Reload Panel', click: () => wc.reload() },
    {
      label: 'Clear Panel Cache & Reload',
      click: async () => {
        await wc.session.clearCache();
        await wc.session.clearStorageData({
          storages: ['cookies', 'filesystem', 'indexdb', 'localstorage',
                     'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
        });
        wc.reload();
      },
    },
  ]);
  ctxMenu.popup({ window: mainWindow });
});

// ── IPC: clear all caches ─────────────────────────────────────────────────────
ipcMain.handle('clear-all-cache', async () => {
  await clearAllCaches();
  return true;
});

// ── go2rtc: RTSP → WebRTC proxy ───────────────────────────────────────────────
let go2rtcProc  = null;
let go2rtcPorts = null; // { api, rtsp, webrtc } — assigned at startup

function go2rtcBin() {
  const bin = process.platform === 'win32' ? 'go2rtc.exe' : 'go2rtc';
  return path.join(app.getPath('userData'), 'go2rtc', bin);
}

function go2rtcAssetName() {
  const { platform, arch } = process;
  if (platform === 'win32')  return arch === 'arm64' ? 'go2rtc_win_arm64.zip' : 'go2rtc_win64.zip';
  if (platform === 'darwin') return `go2rtc_mac_${arch === 'arm64' ? 'arm64' : 'amd64'}.zip`;
  return `go2rtc_linux_${arch === 'arm64' ? 'arm64' : 'amd64'}`;
}

function sendStatus(msg) {
  console.log('[go2rtc]', msg);
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('go2rtc-status', msg));
}

async function downloadGo2rtc() {
  const binPath = go2rtcBin();
  fs.mkdirSync(path.dirname(binPath), { recursive: true });

  sendStatus('Checking latest go2rtc release…');
  const apiRes = await fetch('https://api.github.com/repos/AlexxIT/go2rtc/releases/latest',
    { headers: { 'User-Agent': 'it-dashboard-electron' } });
  if (!apiRes.ok) throw new Error(`GitHub API: HTTP ${apiRes.status}`);
  const release = await apiRes.json();

  const assetName = go2rtcAssetName();
  const asset = release.assets.find(a => a.name === assetName);
  if (!asset) throw new Error(`Asset "${assetName}" not found in release ${release.tag_name}`);

  sendStatus(`Downloading go2rtc ${release.tag_name}…`);
  const res = await fetch(asset.browser_download_url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const total = parseInt(res.headers.get('content-length') || '0', 10);
  let received = 0;
  const chunks = [];
  for await (const chunk of res.body) {
    chunks.push(chunk);
    received += chunk.length;
    if (total) sendStatus(`Downloading go2rtc ${release.tag_name}… ${Math.round(received / total * 100)}%`);
  }
  const buffer = Buffer.concat(chunks);

  if (go2rtcAssetName().endsWith('.zip')) {
    const zipPath = binPath + '.zip';
    fs.writeFileSync(zipPath, buffer);
    await new Promise((resolve, reject) => {
      const p = process.platform === 'win32'
        ? spawn('powershell', ['-NoProfile', '-Command',
            `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${path.dirname(binPath)}' -Force`])
        : spawn('unzip', ['-o', zipPath, '-d', path.dirname(binPath)]);
      p.on('exit', code => code === 0 ? resolve() : reject(new Error(`extract failed: ${code}`)));
    });
    fs.unlinkSync(zipPath);
  } else {
    fs.writeFileSync(binPath, buffer);
  }

  if (process.platform !== 'win32') fs.chmodSync(binPath, 0o755);
  sendStatus(`go2rtc ${release.tag_name} ready`);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.on('error', reject);
  });
}

async function ensureGo2rtc() {
  if (go2rtcProc) return true;
  const bin = go2rtcBin();
  if (!fs.existsSync(bin)) {
    try { await downloadGo2rtc(); }
    catch (e) { console.error('[go2rtc] download failed:', e.message); return false; }
  }
  const [apiPort, rtspPort, rtcPort] = await Promise.all([findFreePort(), findFreePort(), findFreePort()]);
  go2rtcPorts = { api: apiPort, rtsp: rtspPort, webrtc: rtcPort };
  const cfg = JSON.stringify({
    api:    { listen: `127.0.0.1:${apiPort}`, origin: '*' },
    rtsp:   { listen: `127.0.0.1:${rtspPort}` },
    webrtc: { listen: `127.0.0.1:${rtcPort}`, candidates: [`127.0.0.1:${rtcPort}`] },
  });
  go2rtcProc = spawn(bin, ['-c', cfg], { stdio: 'pipe', windowsHide: true });
  go2rtcProc.on('error', e => console.error('[go2rtc]', e.message));
  const logGo2rtc = (d) => {
    const lines = d.toString().split('\n')
      .map(l => l.trimEnd())
      .filter(l => l && !l.includes('[DSH]'));
    if (lines.length) console.log('[go2rtc]', lines.join('\n'));
  };
  go2rtcProc.stdout?.on('data', logGo2rtc);
  go2rtcProc.stderr?.on('data', logGo2rtc);
  go2rtcProc.on('exit', () => { go2rtcProc = null; go2rtcPorts = null; });
  await new Promise(r => setTimeout(r, 800));
  return true;
}

function stopGo2rtc() {
  go2rtcProc?.kill();
  go2rtcProc = null;
  go2rtcPorts = null;
}

ipcMain.handle('ensure-go2rtc', async () => {
  const ok = await ensureGo2rtc();
  if (!ok) return { error: 'Failed to download go2rtc — check your internet connection.' };
  return { port: go2rtcPorts.api };
});

// ── IPC: open URL in system browser ──────────────────────────────────────────
ipcMain.handle('open-external', (_event, url) => {
  shell.openExternal(url);
});

// ── IPC: read config file ─────────────────────────────────────────────────────
ipcMain.handle('load-config', () => {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
});

// ── IPC: write config file ────────────────────────────────────────────────────
ipcMain.handle('save-config', (_event, config) => {
  const p = getConfigPath();
  fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
  return true;
});

// ── IPC: delete config file (reset) ──────────────────────────────────────────
ipcMain.handle('delete-config', () => {
  const p = getConfigPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return true;
});
