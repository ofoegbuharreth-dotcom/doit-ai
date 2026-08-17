export type DesktopPlatform = 'windows' | 'macos' | 'other';
export type DesktopInstallResult = 'accepted' | 'dismissed' | 'installed' | 'unavailable';

export function getDesktopInstallSnapshot() {
  return { installed: false, platform: 'other' as DesktopPlatform, promptAvailable: false };
}

export function subscribeToDesktopInstall(_listener: () => void) {
  return () => undefined;
}

export async function requestDesktopInstall(): Promise<DesktopInstallResult> {
  return 'unavailable';
}
