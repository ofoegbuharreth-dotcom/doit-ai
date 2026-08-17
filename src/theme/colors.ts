import { Platform } from 'react-native';

const themed = (variable: string, fallback: string) => Platform.OS === 'web' ? `var(${variable}, ${fallback})` : fallback;

export const colors = {
  background: themed('--doit-background', '#090A0C'),
  surface: themed('--doit-surface', '#111317'),
  surfaceElevated: themed('--doit-surface-elevated', '#181B20'),
  surfacePressed: themed('--doit-surface-pressed', '#20242A'),
  border: themed('--doit-border', '#272B32'),
  borderSubtle: themed('--doit-border-subtle', '#1D2025'),
  textPrimary: themed('--doit-text-primary', '#F5F7F8'),
  textSecondary: themed('--doit-text-secondary', '#A7ADB7'),
  textMuted: themed('--doit-text-muted', '#6F7681'),
  accent: themed('--doit-accent', '#C8FF3D'),
  accentPressed: themed('--doit-accent-pressed', '#AEE527'),
  accentMuted: themed('--doit-accent-muted', '#243014'),
  accentBorder: themed('--doit-accent-border', 'rgba(200, 255, 61, 0.26)'),
  onAccent: themed('--doit-on-accent', '#101400'),
  success: themed('--doit-success', '#5EE6A8'),
  warning: themed('--doit-warning', '#F4C95D'),
  warningMuted: themed('--doit-warning-muted', 'rgba(244, 201, 93, 0.12)'),
  danger: themed('--doit-danger', '#FF6B78'),
  dangerMuted: themed('--doit-danger-muted', 'rgba(255, 107, 120, 0.12)'),
  overlay: themed('--doit-overlay', 'rgba(0, 0, 0, 0.56)'),
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
