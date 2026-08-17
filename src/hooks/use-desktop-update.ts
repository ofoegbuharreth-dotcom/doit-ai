import { useCallback, useEffect, useState } from 'react';

const fallbackState: DesktopUpdateState = {
  phase: 'unsupported',
  currentVersion: '—',
  message: 'Desktop updates are only available in the installed app.',
};

export function useDesktopUpdate() {
  const desktop = typeof window !== 'undefined' ? window.doitDesktop : undefined;
  const [state, setState] = useState<DesktopUpdateState>(fallbackState);

  useEffect(() => {
    if (!desktop) return;
    desktop.getUpdateState().then(setState).catch(() => undefined);
    return desktop.onUpdateState(setState);
  }, [desktop]);

  const check = useCallback(async () => {
    if (!desktop) return fallbackState;
    const next = await desktop.checkForUpdates();
    setState(next);
    return next;
  }, [desktop]);

  const download = useCallback(async () => {
    if (!desktop) return fallbackState;
    const next = await desktop.downloadUpdate();
    setState(next);
    return next;
  }, [desktop]);

  const install = useCallback(async () => desktop?.installUpdate() ?? false, [desktop]);

  return { isDesktop: Boolean(desktop), state, check, download, install };
}
