const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const { existsSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Sentry = require('@sentry/electron/main');
const { autoUpdater } = require('electron-updater');

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
let pendingDeepLink = process.argv.find((argument) => argument.startsWith(`${APP_SCHEME}://`)) ?? null;
let updateState = {
  phase: 'idle',
  currentVersion: app.getVersion(),
};

function runtimeConfig() {
  try {
    const filename = path.join(__dirname, 'runtime-config.json');
    return existsSync(filename) ? JSON.parse(readFileSync(filename, 'utf8')) : {};
  } catch (error) {
    console.error('[runtime-config] Could not read desktop configuration.', error);
    return {};
  }
}

const { sentryDsn = '' } = runtimeConfig();
Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn) && app.isPackaged,
  environment: app.isPackaged ? 'production' : 'development',
  release: `doit-ai-desktop@${app.getVersion()}`,
  sendDefaultPii: false,
});

function captureDesktopError(error, area, details = {}) {
  const normalised = error instanceof Error ? error : new Error(String(error));
  console.error(`[${area}] ${normalised.message}`);
  Sentry.withScope((scope) => {
    scope.setContext('desktop', { area, ...details });
    Sentry.captureException(normalised);
  });
}

function publishUpdateState(next) {
  updateState = { ...updateState, ...next, currentVersion: app.getVersion() };
  mainWindow?.webContents.send('desktop:update-state-changed', updateState);
  return updateState;
}

function updateSupported() {
  return app.isPackaged && ['win32', 'darwin'].includes(process.platform);
}

function normaliseReleaseNotes(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : item?.note ?? '').filter(Boolean).join('\n');
  return typeof value === 'string' ? value : undefined;
}

function compareVersions(left = '0', right = '0') {
  const a = String(left).replace(/^v/i, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right).replace(/^v/i, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

function shouldKeepKnownUpdate(candidateVersion) {
  return Boolean(updateState.availableVersion) && compareVersions(updateState.availableVersion, candidateVersion) > 0;
}

async function checkForUpdates() {
  if (['downloading', 'downloaded'].includes(updateState.phase)) return updateState;
  if (!updateSupported()) {
    return publishUpdateState({
      phase: 'unsupported',
      message: app.isPackaged ? 'Automatic updates are not available on this operating system.' : 'Update checks are available in installed releases.',
    });
  }
  publishUpdateState({ phase: 'checking', message: undefined, percent: undefined });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    captureDesktopError(error, 'update_check');
    publishUpdateState({ phase: 'error', message: 'DOIT could not check for updates. Check your connection and try again.' });
  }
  return updateState;
}

function configureUpdater() {
  // Download verified GitHub releases in the background. The renderer only
  // asks the user to restart once the update is fully ready—never to rerun an installer.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  // Avoid an intermediary/CDN response keeping a client on the first missed
  // release when a newer GitHub release already exists.
  autoUpdater.requestHeaders = { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' };
  autoUpdater.on('checking-for-update', () => publishUpdateState({ phase: 'checking', message: undefined }));
  autoUpdater.on('update-available', (info) => {
    if (shouldKeepKnownUpdate(info.version)) return;
    publishUpdateState({ phase: 'available', availableVersion: info.version, releaseNotes: normaliseReleaseNotes(info.releaseNotes), percent: 0, message: undefined });
  });
  autoUpdater.on('update-not-available', () => {
    if (updateState.availableVersion && compareVersions(updateState.availableVersion, app.getVersion()) > 0) return;
    publishUpdateState({ phase: 'up-to-date', availableVersion: undefined, percent: undefined, message: 'You have the newest published version of DOIT AI.' });
  });
  autoUpdater.on('download-progress', (progress) => publishUpdateState({ phase: 'downloading', percent: Math.max(0, Math.min(100, Math.round(progress.percent))), message: undefined }));
  autoUpdater.on('update-downloaded', (info) => {
    if (shouldKeepKnownUpdate(info.version)) {
      setTimeout(() => { void checkForUpdates(); }, 1_000);
      return;
    }
    publishUpdateState({ phase: 'downloaded', availableVersion: info.version, releaseNotes: normaliseReleaseNotes(info.releaseNotes) ?? updateState.releaseNotes, percent: 100, message: 'The newest update is ready to install.' });
  });
  autoUpdater.on('error', (error) => {
    captureDesktopError(error, 'auto_updater');
    publishUpdateState({ phase: 'error', message: 'The update could not be completed. Your current version is still safe to use.' });
  });
}

function showRecoveryScreen(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  captureDesktopError(new Error(`Desktop renderer stopped: ${reason}`), 'renderer_recovery');
  void mainWindow.loadURL(`${APP_ORIGIN}/desktop-error.html`);
}

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
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    console.error(`[renderer] failed to load ${url}: ${code} ${description}`);
    if (isMainFrame && code !== -3 && !url.endsWith('/desktop-error.html')) showRecoveryScreen(`load failed (${code})`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => showRecoveryScreen(details.reason));
  mainWindow.on('unresponsive', () => captureDesktopError(new Error('Desktop window became unresponsive.'), 'window_unresponsive'));
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

  const initialRoute = pendingDeepLink ? desktopRouteFromDeepLink(pendingDeepLink) : null;
  pendingDeepLink = null;
  void mainWindow.loadURL(initialRoute ?? `${APP_ORIGIN}/`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((argument) => argument.startsWith(`${APP_SCHEME}://`));
    const route = deepLink ? desktopRouteFromDeepLink(deepLink) : null;
    if (route && mainWindow) void mainWindow.loadURL(route);
    else if (deepLink) pendingDeepLink = deepLink;
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
    ipcMain.handle('desktop:get-info', () => ({ appVersion: app.getVersion(), electronVersion: process.versions.electron, platform: process.platform, packaged: app.isPackaged }));
    ipcMain.handle('desktop:update-state', () => updateState);
    ipcMain.handle('desktop:check-update', () => checkForUpdates());
    ipcMain.handle('desktop:download-update', async () => {
      if (updateState.phase !== 'available') return updateState;
      publishUpdateState({ phase: 'downloading', percent: 0 });
      try { await autoUpdater.downloadUpdate(); }
      catch (error) {
        captureDesktopError(error, 'update_download');
        publishUpdateState({ phase: 'error', message: 'The update download failed. Check your connection and try again.' });
      }
      return updateState;
    });
    ipcMain.handle('desktop:install-update', () => {
      if (updateState.phase !== 'downloaded') return false;
      autoUpdater.quitAndInstall(false, true);
      return true;
    });
    Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]) : null);

    createWindow();
    configureUpdater();
    if (app.isPackaged) {
      setTimeout(() => { void checkForUpdates(); }, 2_000);
      setInterval(() => { void checkForUpdates(); }, 4 * 60 * 60 * 1000);
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  const route = desktopRouteFromDeepLink(url);
  if (route && mainWindow) void mainWindow.loadURL(route);
  else pendingDeepLink = url;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
