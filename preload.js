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
  // Returns an unsubscribe function, so a removed camera panel drops its listener
  onGo2rtcStatus:         (cb)     => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('go2rtc-status', handler);
    return () => ipcRenderer.removeListener('go2rtc-status', handler);
  },
});
