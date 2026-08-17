export {};

declare global {
  type DesktopUpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'unsupported';

  interface DesktopUpdateState {
    phase: DesktopUpdatePhase;
    currentVersion: string;
    availableVersion?: string;
    percent?: number;
    message?: string;
  }

  interface Window {
    doitDesktop?: {
      isDesktop: true;
      platform: 'win32' | 'darwin' | 'linux' | string;
      version: string;
      openExternal: (url: string) => Promise<boolean>;
      getInfo: () => Promise<{ appVersion: string; electronVersion: string; platform: string; packaged: boolean }>;
      getUpdateState: () => Promise<DesktopUpdateState>;
      checkForUpdates: () => Promise<DesktopUpdateState>;
      downloadUpdate: () => Promise<DesktopUpdateState>;
      installUpdate: () => Promise<boolean>;
      onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
    };
  }
}
