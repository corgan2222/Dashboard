'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu, session, webContents } = require('electron');
const path = require('path');
const fs = require('fs');
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

  mainWindow.once('ready-to-show', () => mainWindow.show());

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
