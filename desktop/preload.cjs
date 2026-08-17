const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('doitDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  getUpdateState: () => ipcRenderer.invoke('desktop:update-state'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-update'),
  downloadUpdate: () => ipcRenderer.invoke('desktop:download-update'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('desktop:update-state-changed', handler);
    return () => ipcRenderer.removeListener('desktop:update-state-changed', handler);
  },
}));
