const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const { existsSync, statSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'doit';
const APP_ORIGIN = `${APP_SCHEME}://app`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
    },
  },
]);

let mainWindow = null;

function rendererRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '..', 'dist');
}

function resolveRendererFile(requestUrl) {
  const root = rendererRoot();
  const url = new URL(requestUrl);
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const candidate = path.resolve(root, relativePath || 'index.html');
  const insideRoot = candidate === root || candidate.startsWith(`${root}${path.sep}`);

  if (insideRoot && existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return path.join(root, 'index.html');
}

function isSafeExternalUrl(value) {
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function openExternal(value) {
  if (!isSafeExternalUrl(value)) return false;
  void shell.openExternal(value);
  return true;
}

function desktopRouteFromDeepLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== `${APP_SCHEME}:`) return null;
    const route = `/${url.hostname}${url.pathname}`.replace(/\/{2,}/g, '/');
    return `${APP_ORIGIN}${route}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function createWindow() {
  const icon = app.isPackaged ? path.join(process.resourcesPath, 'build', 'desktop-icon.png') : path.join(__dirname, '..', 'build', 'desktop-icon.png');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#090A0C',
    icon,
    show: false,
    title: 'DOIT AI',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[renderer] failed to load ${url}: ${code} ${description}`);
  });
  mainWindow.webContents.on('console-message', (_event, details) => {
    const message = typeof details === 'object' ? details.message : String(details);
    console.error(`[renderer] ${message}`);
  });
  if (process.argv.includes('--doit-diagnostics')) {
    mainWindow.webContents.on('did-finish-load', async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const state = await mainWindow?.webContents.executeJavaScript(`JSON.stringify({
        url: location.href,
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 300),
        rootChildren: document.getElementById('root')?.childElementCount,
        fontStatus: document.fonts?.status
      })`);
      console.error(`[renderer-state] ${state}`);
    });
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_ORIGIN)) return { action: 'allow' };
    openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(APP_ORIGIN)) return;
    event.preventDefault();
    openExternal(url);
  });

  void mainWindow.loadURL(`${APP_ORIGIN}/`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((argument) => argument.startsWith(`${APP_SCHEME}://`));
    const route = deepLink ? desktopRouteFromDeepLink(deepLink) : null;
    if (route && mainWindow) void mainWindow.loadURL(route);
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.doitai.desktop');
    if (app.isPackaged) app.setAsDefaultProtocolClient(APP_SCHEME);

    protocol.handle(APP_SCHEME, (request) => {
      return net.fetch(pathToFileURL(resolveRendererFile(request.url)).toString());
    });

    ipcMain.handle('desktop:open-external', (_event, url) => openExternal(url));
    Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]) : null);

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  const route = desktopRouteFromDeepLink(url);
  if (route && mainWindow) void mainWindow.loadURL(route);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
