import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

export const accentPalettes = {
  lime: { label: 'Lime', accent: '#C8FF3D', pressed: '#AEE527', muted: '#243014', border: 'rgba(200, 255, 61, 0.26)', onAccent: '#101400', lightAccent: '#648600', lightPressed: '#557200', lightMuted: '#EFF7D8', lightBorder: 'rgba(100, 134, 0, 0.24)', lightOnAccent: '#FFFFFF' },
  violet: { label: 'Violet', accent: '#A78BFA', pressed: '#8B6FE8', muted: '#2A2142', border: 'rgba(167, 139, 250, 0.28)', onAccent: '#120B22', lightAccent: '#7352D3', lightPressed: '#6242BD', lightMuted: '#EEE9FC', lightBorder: 'rgba(115, 82, 211, 0.22)', lightOnAccent: '#FFFFFF' },
  blue: { label: 'Blue', accent: '#60A5FA', pressed: '#438CE0', muted: '#172A42', border: 'rgba(96, 165, 250, 0.28)', onAccent: '#071524', lightAccent: '#2672BC', lightPressed: '#1C61A5', lightMuted: '#E5F0FB', lightBorder: 'rgba(38, 114, 188, 0.22)', lightOnAccent: '#FFFFFF' },
  cyan: { label: 'Cyan', accent: '#22D3EE', pressed: '#0FB7D0', muted: '#12333A', border: 'rgba(34, 211, 238, 0.27)', onAccent: '#03191D', lightAccent: '#087F92', lightPressed: '#056D7D', lightMuted: '#DFF3F5', lightBorder: 'rgba(8, 127, 146, 0.22)', lightOnAccent: '#FFFFFF' },
  amber: { label: 'Amber', accent: '#FBBF24', pressed: '#E3A914', muted: '#392B0F', border: 'rgba(251, 191, 36, 0.28)', onAccent: '#201500', lightAccent: '#9A6500', lightPressed: '#815500', lightMuted: '#F8EFD9', lightBorder: 'rgba(154, 101, 0, 0.22)', lightOnAccent: '#FFFFFF' },
  coral: { label: 'Coral', accent: '#FB7185', pressed: '#E85A70', muted: '#3A1D25', border: 'rgba(251, 113, 133, 0.28)', onAccent: '#23080D', lightAccent: '#C84359', lightPressed: '#AE3449', lightMuted: '#FAE7EA', lightBorder: 'rgba(200, 67, 89, 0.22)', lightOnAccent: '#FFFFFF' },
} as const;

const colourModes = {
  dark: { background: '#090A0C', surface: '#111317', surfaceElevated: '#181B20', surfacePressed: '#20242A', border: '#272B32', borderSubtle: '#1D2025', textPrimary: '#F5F7F8', textSecondary: '#A7ADB7', textMuted: '#6F7681', success: '#5EE6A8', warning: '#F4C95D', warningMuted: 'rgba(244, 201, 93, 0.12)', danger: '#FF6B78', dangerMuted: 'rgba(255, 107, 120, 0.12)', overlay: 'rgba(0, 0, 0, 0.56)' },
  light: { background: '#F5F6F8', surface: '#FFFFFF', surfaceElevated: '#EEF0F3', surfacePressed: '#E2E5E9', border: '#C8CDD5', borderSubtle: '#D9DDE3', textPrimary: '#17191D', textSecondary: '#505762', textMuted: '#747C88', success: '#147A52', warning: '#8A6100', warningMuted: 'rgba(138, 97, 0, 0.10)', danger: '#C93649', dangerMuted: 'rgba(201, 54, 73, 0.10)', overlay: 'rgba(20, 24, 30, 0.42)' },
} as const;

export type AccentId = keyof typeof accentPalettes;
export type ColorMode = keyof typeof colourModes;
type EffectivePalette = { label: string; accent: string; pressed: string; muted: string; border: string; onAccent: string };

const ACCENT_STORAGE_KEY = 'doit:accent-colour';
const MODE_STORAGE_KEY = 'doit:colour-mode';
const fallbackId: AccentId = 'lime';
const fallbackMode: ColorMode = 'dark';

type AccentContextValue = {
  accentId: AccentId;
  colorMode: ColorMode;
  palette: EffectivePalette;
  setAccentId: (accentId: AccentId) => Promise<void>;
  setColorMode: (mode: ColorMode) => Promise<void>;
};

const AccentContext = createContext<AccentContextValue | null>(null);

function effectivePalette(accentId: AccentId, mode: ColorMode): EffectivePalette {
  const palette = accentPalettes[accentId];
  return mode === 'dark'
    ? { label: palette.label, accent: palette.accent, pressed: palette.pressed, muted: palette.muted, border: palette.border, onAccent: palette.onAccent }
    : { label: palette.label, accent: palette.lightAccent, pressed: palette.lightPressed, muted: palette.lightMuted, border: palette.lightBorder, onAccent: palette.lightOnAccent };
}

function applyWebAppearance(accentId: AccentId, mode: ColorMode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const palette = effectivePalette(accentId, mode);
  const scheme = colourModes[mode];
  const root = document.documentElement;
  const variables = {
    '--doit-background': scheme.background,
    '--doit-surface': scheme.surface,
    '--doit-surface-elevated': scheme.surfaceElevated,
    '--doit-surface-pressed': scheme.surfacePressed,
    '--doit-border': scheme.border,
    '--doit-border-subtle': scheme.borderSubtle,
    '--doit-text-primary': scheme.textPrimary,
    '--doit-text-secondary': scheme.textSecondary,
    '--doit-text-muted': scheme.textMuted,
    '--doit-success': scheme.success,
    '--doit-warning': scheme.warning,
    '--doit-warning-muted': scheme.warningMuted,
    '--doit-danger': scheme.danger,
    '--doit-danger-muted': scheme.dangerMuted,
    '--doit-overlay': scheme.overlay,
    '--doit-accent': palette.accent,
    '--doit-accent-pressed': palette.pressed,
    '--doit-accent-muted': palette.muted,
    '--doit-accent-border': palette.border,
    '--doit-on-accent': palette.onAccent,
  };
  Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
  root.style.setProperty('color-scheme', mode);
  root.style.setProperty('accent-color', palette.accent);
  root.dataset.theme = mode;
  if (document.body) {
    document.body.style.backgroundColor = scheme.background;
    document.body.style.color = scheme.textPrimary;
  }
}

export function AccentProvider({ children }: PropsWithChildren) {
  const [accentId, setAccentIdState] = useState<AccentId>(fallbackId);
  const [colorMode, setColorModeState] = useState<ColorMode>(fallbackMode);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(ACCENT_STORAGE_KEY), AsyncStorage.getItem(MODE_STORAGE_KEY)]).then(([storedAccent, storedMode]) => {
      if (!active) return;
      const nextAccent = storedAccent && storedAccent in accentPalettes ? storedAccent as AccentId : fallbackId;
      const nextMode = storedMode === 'light' || storedMode === 'dark' ? storedMode : fallbackMode;
      setAccentIdState(nextAccent);
      setColorModeState(nextMode);
      applyWebAppearance(nextAccent, nextMode);
    }).catch(() => applyWebAppearance(fallbackId, fallbackMode));
    return () => { active = false; };
  }, []);

  const setAccentId = useCallback(async (next: AccentId) => {
    setAccentIdState(next);
    applyWebAppearance(next, colorMode);
    await AsyncStorage.setItem(ACCENT_STORAGE_KEY, next);
  }, [colorMode]);

  const setColorMode = useCallback(async (next: ColorMode) => {
    setColorModeState(next);
    applyWebAppearance(accentId, next);
    await AsyncStorage.setItem(MODE_STORAGE_KEY, next);
  }, [accentId]);

  const palette = useMemo(() => effectivePalette(accentId, colorMode), [accentId, colorMode]);
  const value = useMemo(() => ({ accentId, colorMode, palette, setAccentId, setColorMode }), [accentId, colorMode, palette, setAccentId, setColorMode]);
  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccentTheme() {
  const value = useContext(AccentContext);
  if (!value) throw new Error('useAccentTheme must be used within AccentProvider');
  return value;
}
