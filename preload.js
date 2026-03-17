'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal:           (url)    => ipcRenderer.invoke('open-external', url),
  loadConfig:             ()       => ipcRenderer.invoke('load-config'),
  saveConfig:             (config) => ipcRenderer.invoke('save-config', config),
  deleteConfig:           ()       => ipcRenderer.invoke('delete-config'),
  showWebviewContextMenu: (id)     => ipcRenderer.invoke('show-webview-context-menu', id),
  clearAllCache:          ()       => ipcRenderer.invoke('clear-all-cache'),
});
