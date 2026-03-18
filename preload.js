'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal:           (url)    => ipcRenderer.invoke('open-external', url),
  loadConfig:             ()       => ipcRenderer.invoke('load-config'),
  saveConfig:             (config) => ipcRenderer.invoke('save-config', config),
  deleteConfig:           ()       => ipcRenderer.invoke('delete-config'),
  showWebviewContextMenu: (id)     => ipcRenderer.invoke('show-webview-context-menu', id),
  clearAllCache:          ()       => ipcRenderer.invoke('clear-all-cache'),
  ensureGo2rtc:           ()       => ipcRenderer.invoke('ensure-go2rtc'),
  onGo2rtcStatus:         (cb)     => ipcRenderer.on('go2rtc-status', (_e, msg) => cb(msg)),
});
