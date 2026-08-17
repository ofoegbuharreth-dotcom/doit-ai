export type DesktopPlatform = 'windows' | 'macos' | 'other';
export type DesktopInstallResult = 'accepted' | 'dismissed' | 'installed' | 'unavailable';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallSnapshot = {
  installed: boolean;
  platform: DesktopPlatform;
  promptAvailable: boolean;
};

let deferredPrompt: InstallPrompt | undefined;
let installed = false;
const listeners = new Set<() => void>();

function detectPlatform(): DesktopPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const platform = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  return 'other';
}

function detectInstalled() {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  installed = detectInstalled();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = undefined;
    notify();
  });
}

export function getDesktopInstallSnapshot(): InstallSnapshot {
  installed = detectInstalled() || installed;
  return { installed, platform: detectPlatform(), promptAvailable: Boolean(deferredPrompt) };
}

export function subscribeToDesktopInstall(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function requestDesktopInstall(): Promise<DesktopInstallResult> {
  if (detectInstalled() || installed) return 'installed';
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') deferredPrompt = undefined;
  notify();
  return outcome;
}

