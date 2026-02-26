'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

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
    title: 'IT Dashboard v2.01',
    icon: path.join(__dirname, 'assets', 'icon_512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,         // required for <webview> elements
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,           // webviewTag needs sandbox disabled in Electron 34
    },
    show: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Minimal menu: just DevTools toggle in dev, nothing in prod
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    Menu.setApplicationMenu(null);
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
