import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui';
import { doitLogo } from '@/constants/logo';
import { loadLatestDesktopRelease, type DesktopRelease } from '@/services';
import { colors, radius, shadows, spacing } from '@/theme';

const FALLBACK_RELEASE: DesktopRelease = {
  version: 'Latest',
  windowsUrl: process.env.EXPO_PUBLIC_DESKTOP_WINDOWS_URL?.trim(),
  macUrl: process.env.EXPO_PUBLIC_DESKTOP_MAC_URL?.trim(),
};

function currentPlatform() {
  if (typeof navigator === 'undefined') return 'windows';
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? 'macos' : 'windows';
}

async function download(url?: string) {
  if (url && !url.includes('your-account')) {
    if (typeof window !== 'undefined' && window.doitDesktop?.isDesktop) {
      await window.doitDesktop.openExternal(url);
      return;
    }
    await Linking.openURL(url);
  }
}

export default function DownloadPage() {
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const platform = currentPlatform();
  const [release, setRelease] = useState(FALLBACK_RELEASE);
  const [checkingRelease, setCheckingRelease] = useState(true);
  useEffect(() => {
    let active = true;
    loadLatestDesktopRelease().then((latest) => { if (active) setRelease(latest); }).catch(() => undefined).finally(() => { if (active) setCheckingRelease(false); });
    return () => { active = false; };
  }, []);
  const primaryUrl = platform === 'macos' ? release.macUrl : release.windowsUrl;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.shell}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.push('/')} style={styles.brand}><Image source={doitLogo} style={styles.logo} /><Text style={styles.brandText}>DOIT AI</Text></Pressable>
          <Pressable onPress={() => router.push('/')} style={styles.backButton}><Ionicons name="arrow-back" size={18} color={colors.textPrimary} /><Text variant="label">Back to website</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.eyebrow}><Ionicons name="desktop-outline" size={15} color={colors.accent} /><Text variant="eyebrow" color="accent">THE REAL DESKTOP APP</Text></View>
          <Text style={[styles.title, compact && styles.titleCompact]}>DOIT AI, without the browser.</Text>
          <Text style={styles.subtitle} color="secondary">A dedicated DOIT window with its own installer, desktop icon, Start menu or Dock entry, and locally bundled interface. Your account, goals, and progress stay synced everywhere.</Text>
          <Pressable onPress={() => download(primaryUrl)} disabled={!primaryUrl || primaryUrl.includes('your-account')} style={[styles.primaryButton, (!primaryUrl || primaryUrl.includes('your-account')) && styles.disabled]}>
            <Ionicons name={platform === 'macos' ? 'logo-apple' : 'logo-windows'} size={22} color={colors.onAccent} /><Text variant="label" style={styles.onAccent}>{primaryUrl && !primaryUrl.includes('your-account') ? `Download for ${platform === 'macos' ? 'macOS' : 'Windows'}` : `${platform === 'macos' ? 'macOS' : 'Windows'} build coming soon`}</Text><Ionicons name="download-outline" size={20} color={colors.onAccent} />
          </Pressable>
          <Text variant="caption" color="muted">{checkingRelease ? 'Checking the newest release…' : `Latest release · Version ${release.version}`} · Native app window · One synced DOIT account</Text>
        </View>

        <View style={[styles.platformGrid, compact && styles.stack]}>
          <PlatformCard icon="logo-windows" name="Windows" detail="Windows 10 or 11 · 64-bit" format=".exe installer" active={platform === 'windows'} url={release.windowsUrl} version={release.version} checking={checkingRelease} />
          <PlatformCard icon="logo-apple" name="macOS" detail="Intel and Apple silicon Macs" format=".dmg installer" active={platform === 'macos'} url={release.macUrl} version={release.version} checking={checkingRelease} />
        </View>

        <View style={[styles.benefits, compact && styles.stack]}>
          <Benefit icon="apps-outline" title="A proper installed app" copy="Launch DOIT from its own icon. No address bar, browser tabs, or browser-managed shell." />
          <Benefit icon="flash-outline" title="Fast and focused" copy="The interface is packaged with the app and opens directly into your DOIT workspace." />
          <Benefit icon="sync-outline" title="Everything stays synced" copy="Use the same account on desktop, web, and Android without losing progress." />
        </View>

        <View style={[styles.footerCta, compact && styles.footerCtaCompact]}>
          <View style={styles.footerCopy}><Text variant="eyebrow" color="accent">NOT ON YOUR COMPUTER?</Text><Text style={styles.footerTitle}>Keep using DOIT on the web from any device.</Text></View>
          <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.secondaryButton}><Text variant="label">Open web app</Text><Ionicons name="arrow-forward" size={18} color={colors.textPrimary} /></Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function PlatformCard({ active, icon, name, detail, format, url, version, checking }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; name: string; detail: string; format: string; url?: string; version: string; checking: boolean }) {
  const available = Boolean(url && !url.includes('your-account'));
  return <View style={[styles.platformCard, active && styles.platformCardActive]}>
    <View style={styles.platformTop}><View style={styles.platformIcon}><Ionicons name={icon} size={27} color={colors.accent} /></View>{active ? <View style={styles.detected}><View style={styles.detectedDot} /><Text variant="caption" color="accent">RECOMMENDED</Text></View> : null}</View>
    <Text style={styles.platformName}>{name}</Text><Text color="secondary">{detail}</Text>
    <View style={styles.fileRow}><Ionicons name="shield-checkmark-outline" size={19} color={colors.accent} /><Text variant="caption" color="secondary">{format} · {checking ? 'Checking latest version…' : `Version ${version}`}</Text></View>
    <Pressable onPress={() => download(url)} disabled={!available || checking} style={[styles.cardButton, (!available || checking) && styles.disabled]}><Ionicons name="download-outline" size={18} color={colors.onAccent} /><Text variant="label" style={styles.onAccent}>{checking ? 'Finding latest installer…' : available ? `Download ${name}` : `${name} build coming soon`}</Text></Pressable>
  </View>;
}

function Benefit({ icon, title, copy }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }) {
  return <View style={styles.benefit}><View style={styles.benefitIcon}><Ionicons name={icon} size={21} color={colors.accent} /></View><Text variant="heading">{title}</Text><Text variant="caption" color="secondary">{copy}</Text></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.background, flex: 1 }, content: { alignItems: 'center', minHeight: '100%', paddingHorizontal: spacing.lg }, shell: { maxWidth: 1160, width: '100%' },
  nav: { alignItems: 'center', borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 84 }, brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, logo: { borderRadius: 11, height: 38, width: 38 }, brandText: { fontFamily: 'Manrope_700Bold', fontSize: 18 }, backButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.md, paddingBottom: 72, paddingTop: 92 }, eyebrow: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 7 }, title: { color: colors.textPrimary, fontFamily: 'Manrope_800ExtraBold', fontSize: 60, letterSpacing: -2.8, lineHeight: 68, maxWidth: 900, textAlign: 'center' }, titleCompact: { fontSize: 42, lineHeight: 49 }, subtitle: { fontSize: 18, lineHeight: 29, maxWidth: 780, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.sm, minHeight: 58, paddingHorizontal: spacing.xl }, secondaryButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.lg }, onAccent: { color: colors.onAccent }, disabled: { opacity: 0.48 },
  platformGrid: { flexDirection: 'row', gap: spacing.lg }, stack: { flexDirection: 'column' }, platformCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, flex: 1, gap: spacing.sm, padding: spacing.xl, ...shadows.card }, platformCardActive: { borderColor: colors.accent, ...shadows.floating }, platformTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, platformIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 54, justifyContent: 'center', width: 54 }, detected: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, flexDirection: 'row', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6 }, detectedDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 }, platformName: { color: colors.textPrimary, fontFamily: 'Manrope_800ExtraBold', fontSize: 31, letterSpacing: -1, marginTop: spacing.sm }, fileRow: { alignItems: 'center', borderTopColor: colors.borderSubtle, borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md }, cardButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.md, minHeight: 50 },
  benefits: { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, borderTopColor: colors.borderSubtle, borderTopWidth: 1, flexDirection: 'row', gap: spacing.lg, marginTop: 80, paddingVertical: 52 }, benefit: { flex: 1, gap: spacing.sm }, benefitIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 },
  footerCta: { alignItems: 'center', flexDirection: 'row', gap: spacing.xl, justifyContent: 'space-between', paddingVertical: 72 }, footerCtaCompact: { alignItems: 'stretch', flexDirection: 'column' }, footerCopy: { flex: 1, gap: spacing.xs }, footerTitle: { color: colors.textPrimary, fontFamily: 'Manrope_700Bold', fontSize: 29, letterSpacing: -0.8, lineHeight: 37 },
});
