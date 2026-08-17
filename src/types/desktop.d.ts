export {};

declare global {
  interface Window {
    doitDesktop?: {
      isDesktop: true;
      platform: 'win32' | 'darwin' | 'linux' | string;
      version: string;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}
