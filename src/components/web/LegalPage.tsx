import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { doitLogo } from '@/constants/logo';

type Section = { title: string; body: string };

export function LegalPage({ title, intro, sections, children }: PropsWithChildren<{ title: string; intro: string; sections: Section[] }>) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.shell}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.replace('/')} style={styles.brand}><Image source={doitLogo} style={styles.logo} /><Text variant="heading">DOIT AI</Text></Pressable>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" color={colors.textPrimary} size={19} /><Text variant="label">Back</Text></Pressable>
      </View>
      <View style={styles.header}><Text variant="eyebrow" color="accent">DOIT AI</Text><Text style={styles.title}>{title}</Text><Text color="secondary" style={styles.intro}>{intro}</Text><Text variant="caption" color="muted">Last updated: 16 August 2026</Text></View>
      <View style={styles.sections}>{sections.map((section) => <View key={section.title} style={styles.section}><Text variant="heading">{section.title}</Text><Text color="secondary" style={styles.body}>{section.body}</Text></View>)}</View>
      {children}
      <View style={styles.contact}><Text variant="heading">Need help?</Text><Pressable onPress={() => Linking.openURL('mailto:ofoegbuharreth@gmail.com')}><Text color="accent">ofoegbuharreth@gmail.com</Text></Pressable></View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.background, flex: 1 }, content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 80 }, shell: { maxWidth: 820, width: '100%' },
  nav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 84 }, brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, logo: { borderRadius: radius.sm, height: 34, width: 34 }, back: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
  header: { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, gap: spacing.md, paddingBottom: spacing.xl, paddingTop: 64 }, title: { color: colors.textPrimary, fontFamily: 'Manrope_700Bold', fontSize: 46, letterSpacing: -1.4, lineHeight: 54 }, intro: { fontSize: 18, lineHeight: 29, maxWidth: 700 },
  sections: { gap: spacing.xl, paddingVertical: spacing.xl }, section: { gap: spacing.sm }, body: { lineHeight: 25 }, contact: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
});
