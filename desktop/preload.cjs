const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('doitDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
}));
