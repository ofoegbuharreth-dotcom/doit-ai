import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { getOwnerDashboard, getOwnerHealth, isOwnerEmail, setOwnerFeedbackStatus, type OwnerDashboard, type OwnerHealth } from '@/services';
import { colors, radius, spacing } from '@/theme';

type FeedbackStatus = OwnerDashboard['feedback'][number]['status'];
const statuses: { id: FeedbackStatus; label: string }[] = [
  { id: 'new', label: 'New' }, { id: 'reviewing', label: 'Reviewing' }, { id: 'planned', label: 'Planned' }, { id: 'resolved', label: 'Resolved' },
];

export default function OwnerDashboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const allowed = isOwnerEmail(user?.email);
  const [dashboard, setDashboard] = useState<OwnerDashboard>();
  const [health, setHealth] = useState<OwnerHealth>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [healthError, setHealthError] = useState('');
  const [updatingFeedback, setUpdatingFeedback] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!allowed) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(''); setHealthError('');
    try {
      const [dashboardResult, healthResult] = await Promise.allSettled([getOwnerDashboard(), getOwnerHealth()]);
      if (dashboardResult.status === 'rejected') throw dashboardResult.reason;
      setDashboard(dashboardResult.value);
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
      else setHealthError(healthResult.reason instanceof Error ? healthResult.reason.message : 'Could not check service health.');
    }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load owner analytics.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [allowed]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const changeFeedbackStatus = async (id: string, status: FeedbackStatus) => {
    if (!dashboard) return;
    setUpdatingFeedback(id); setError('');
    try {
      await setOwnerFeedbackStatus(id, status);
      setDashboard({ ...dashboard, feedback: dashboard.feedback.map((item) => item.id === id ? { ...item, status } : item) });
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not update feedback.'); }
    finally { setUpdatingFeedback(''); }
  };

  if (authLoading || loading) return <Screen contentContainerStyle={styles.center}><ActivityIndicator color={colors.accent} size="large" /><Text color="secondary">Loading your command centre…</Text></Screen>;
  if (!allowed) return <Screen contentContainerStyle={styles.center}><View style={styles.lock}><Ionicons name="lock-closed" color={colors.textSecondary} size={28} /></View><Text variant="title">Private dashboard</Text><Text color="secondary" style={styles.centerCopy}>This area is available only to the DOIT owner account.</Text><Button label="Back to Profile" onPress={() => router.replace('/(tabs)/profile')} /></Screen>;

  const metrics = dashboard?.metrics;
  return <Screen scrollable refreshing={refreshing} onRefresh={() => load(true)} contentContainerStyle={styles.screen}>
    <ScreenHeader title="Owner dashboard" fallbackHref="/(tabs)/profile" action={<Pressable accessibilityRole="button" accessibilityLabel="Refresh dashboard" onPress={() => load(true)} style={styles.refresh}><Ionicons name="refresh" color={colors.textSecondary} size={20} /></Pressable>} />
    <View style={styles.hero}>
      <View style={styles.heroIcon}><Ionicons name="pulse" color={colors.onAccent} size={25} /></View>
      <View style={styles.flex}><Text variant="eyebrow" color="accent">PRIVATE · LIVE BUSINESS VIEW</Text><Text variant="title">DOIT command centre</Text><Text color="secondary">See whether people join, reach value, return, refer others, and upgrade.</Text></View>
      {dashboard?.generatedAt ? <Text variant="caption" color="muted">Updated {formatDate(dashboard.generatedAt)}</Text> : null}
    </View>
    {error ? <Card style={styles.error}><Ionicons name="alert-circle" color={colors.danger} size={20} /><Text color="danger" style={styles.flex}>{error}</Text></Card> : null}

    <SectionTitle title="Service health" detail="Private live checks for the systems that keep DOIT running." />
    {healthError ? <Card style={styles.healthWarning}><Ionicons name="warning" color={colors.warning} size={20} /><Text style={styles.flex}>{healthError}</Text></Card> : null}
    {health ? <View style={styles.healthGrid}>
      {(['auth', 'database', 'ai', 'stripe', 'email'] as const).map((id) => <HealthCard key={id} id={id} check={health.checks.find((item) => item.id === id)} />)}
    </View> : healthError ? null : <ActivityIndicator color={colors.accent} />}

    {metrics ? <>
      <SectionTitle title="Growth pulse" detail="The numbers that decide what DOIT should improve next." />
      <View style={styles.metricGrid}>
        <Metric label="Total users" value={metrics.totalUsers} detail={`+${metrics.signups7d} this week`} icon="people" compact={compact} />
        <Metric label="Activated" value={`${metrics.activationRate}%`} detail={`${metrics.activatedUsers} created a goal`} icon="flash" compact={compact} />
        <Metric label="7-day return" value={`${metrics.returnRate7d}%`} detail={`${metrics.returningUsers7d} established users active`} icon="return-up-forward" compact={compact} />
        <Metric label="Paid conversion" value={`${metrics.paidConversionRate}%`} detail={`${metrics.paidSubscribers} paying subscribers`} icon="card" compact={compact} />
      </View>

      <View style={[styles.twoColumn, compact && styles.stack]}>
        <Card style={styles.panel}>
          <SectionTitle title="Signups · last 14 days" detail={`${metrics.signupsToday} today · ${metrics.signups30d} in the last 30 days`} />
          <SignupChart points={dashboard?.dailySignups ?? []} />
        </Card>
        <Card style={styles.panel}>
          <SectionTitle title="Revenue funnel" detail="Live subscription state from DOIT billing." />
          <FunnelRow label="Active trials" value={metrics.activeTrials} icon="hourglass" />
          <FunnelRow label="DOIT Pro paid" value={metrics.proSubscribers} icon="diamond" />
          <FunnelRow label="DOIT MAX paid" value={metrics.maxSubscribers} icon="flash" />
          <FunnelRow label="Founding members" value={metrics.foundingMembers} icon="rocket" />
          <FunnelRow label="Referral signups" value={metrics.referredUsers} icon="share-social" />
        </Card>
      </View>

      <SectionTitle title="Recent signups" detail="The latest accounts and whether they reached their first goal." />
      <Card style={styles.tableCard}>
        {dashboard?.recentUsers.length ? dashboard.recentUsers.map((item, index) => <View key={item.id} style={[styles.userRow, index > 0 && styles.rowBorder]}>
          <View style={styles.userAvatar}><Text variant="label" color="accent">{item.email?.[0]?.toUpperCase() ?? '?'}</Text></View>
          <View style={styles.flex}><View style={styles.userNameRow}><Text variant="label" numberOfLines={1} style={styles.flex}>{item.email}</Text><View style={styles.presence}><View style={[styles.presenceDot, item.online && styles.presenceDotOnline]} /><Text variant="caption" color={item.online ? 'accent' : 'muted'}>{item.online ? 'Online now' : item.last_seen_at ? `Last seen ${formatRelative(item.last_seen_at)}` : 'Not seen yet'}</Text></View></View><Text variant="caption" color="muted">Joined {formatDate(item.created_at)} · {item.goal_count ? `${item.goal_count} goal${item.goal_count === 1 ? '' : 's'}` : 'Not activated yet'}{item.app_kind ? ` · ${appKindLabel(item.app_kind)}` : ''}</Text></View>
          <View style={styles.userTags}>{item.referred ? <Tag text="Referred" accent /> : null}<Tag text={item.plan.toUpperCase()} accent={item.plan !== 'free'} /></View>
        </View>) : <Empty text="No users yet." />}
      </Card>

      <SectionTitle title={`Feedback inbox · ${metrics.newFeedbackCount} new`} detail={`${metrics.feedbackCount} total responses · ${Number(metrics.averageRating).toFixed(1)} average rating`} />
      <View style={styles.feedbackList}>
        {dashboard?.feedback.length ? dashboard.feedback.map((item) => <Card key={item.id} style={styles.feedbackCard}>
          <View style={styles.feedbackTop}><View style={styles.feedbackIcon}><Ionicons name={feedbackIcon(item.category)} color={colors.accent} size={20} /></View><View style={styles.flex}><Text variant="label">{categoryLabel(item.category)}</Text><Text variant="caption" color="muted">{item.user_email} · {formatDate(item.created_at)}</Text></View>{item.rating ? <Text variant="label" color="accent">{'★'.repeat(item.rating)}</Text> : null}</View>
          <Text>{item.message}</Text>
          <View style={styles.statusRow}>{statuses.map((status) => <Pressable key={status.id} disabled={updatingFeedback === item.id} onPress={() => changeFeedbackStatus(item.id, status.id)} style={[styles.status, item.status === status.id && styles.statusSelected]}><Text variant="caption" color={item.status === status.id ? 'accent' : 'muted'}>{status.label}</Text></Pressable>)}</View>
        </Card>) : <Card><Empty text="No feedback has arrived yet." /></Card>}
      </View>
    </> : null}
  </Screen>;
}

function Metric({ label, value, detail, icon, compact }: { label: string; value: string | number; detail: string; icon: keyof typeof Ionicons.glyphMap; compact: boolean }) {
  return <Card style={[styles.metric, compact && styles.metricCompact]}><View style={styles.metricIcon}><Ionicons name={icon} color={colors.accent} size={20} /></View><Text variant="title">{value}</Text><Text variant="label">{label}</Text><Text variant="caption" color="muted">{detail}</Text></Card>;
}
function HealthCard({ id, check }: { id: OwnerHealth['checks'][number]['id']; check?: OwnerHealth['checks'][number] }) {
  const meta = {
    auth: { label: 'Auth', icon: 'key-outline' }, database: { label: 'Database', icon: 'server-outline' }, ai: { label: 'AI', icon: 'sparkles-outline' }, stripe: { label: 'Stripe', icon: 'card-outline' }, email: { label: 'Email', icon: 'mail-outline' },
  }[id] as { label: string; icon: keyof typeof Ionicons.glyphMap };
  const status = check?.status ?? 'degraded';
  const colour = status === 'healthy' ? colors.success : status === 'degraded' ? colors.warning : colors.danger;
  return <Card style={styles.healthCard}><View style={styles.healthTop}><View style={styles.smallIcon}><Ionicons name={meta.icon} color={colour} size={18} /></View><View style={styles.flex}><Text variant="label">{meta.label}</Text><View style={styles.healthStatus}><View style={[styles.healthDot, { backgroundColor: colour }]} /><Text variant="eyebrow" style={{ color: colour }}>{check ? status.toUpperCase() : 'CHECKING'}</Text></View></View></View><Text variant="caption" color="muted">{check?.summary ?? 'Running secure service check…'}</Text>{check ? <Text variant="eyebrow" color="muted">{check.latencyMs} MS</Text> : null}</Card>;
}
function SectionTitle({ title, detail }: { title: string; detail: string }) { return <View style={styles.sectionTitle}><Text variant="heading">{title}</Text><Text variant="caption" color="muted">{detail}</Text></View>; }
function FunnelRow({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) { return <View style={styles.funnelRow}><View style={styles.smallIcon}><Ionicons name={icon} color={colors.textSecondary} size={17} /></View><Text variant="label" style={styles.flex}>{label}</Text><Text variant="heading">{value}</Text></View>; }
function Tag({ text, accent = false }: { text: string; accent?: boolean }) { return <View style={[styles.tag, accent && styles.tagAccent]}><Text variant="eyebrow" color={accent ? 'accent' : 'muted'}>{text}</Text></View>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Ionicons name="file-tray-outline" color={colors.textMuted} size={24} /><Text color="muted">{text}</Text></View>; }
function SignupChart({ points }: { points: OwnerDashboard['dailySignups'] }) {
  const max = useMemo(() => Math.max(1, ...points.map((point) => point.count)), [points]);
  return <View style={styles.chart}>{points.map((point, index) => <View key={point.date} style={styles.barColumn}><Text variant="eyebrow" color="muted">{point.count || ''}</Text><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(5, point.count / max * 100)}%` }]} /></View>{index % 3 === 0 || index === points.length - 1 ? <Text variant="eyebrow" color="muted">{new Date(`${point.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text> : <Text variant="eyebrow"> </Text>}</View>)}</View>;
}
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function formatRelative(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 86400)}d ago`; }
function appKindLabel(value: string) { return ({ web: 'Web', 'installed-web': 'Installed web app', desktop: 'Desktop', native: 'Mobile' } as Record<string, string>)[value] ?? value; }
function categoryLabel(value: string) { return ({ idea: 'Idea', confusing: 'Something confusing', bug: 'Bug report', love: 'What they love' } as Record<string, string>)[value] ?? value; }
function feedbackIcon(value: string): keyof typeof Ionicons.glyphMap { return ({ idea: 'bulb', confusing: 'help-circle', bug: 'bug', love: 'heart' } as Record<string, keyof typeof Ionicons.glyphMap>)[value] ?? 'chatbubble'; }

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, paddingBottom: spacing.xxxl }, center: { alignItems: 'center', gap: spacing.md, justifyContent: 'center' }, centerCopy: { maxWidth: 460, textAlign: 'center' }, lock: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 64, justifyContent: 'center', width: 64 },
  refresh: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  hero: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.accentBorder, borderRadius: radius.xl, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.xl }, heroIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 52, justifyContent: 'center', width: 52 }, flex: { flex: 1 }, error: { alignItems: 'center', backgroundColor: colors.dangerMuted, borderColor: colors.danger, flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { gap: spacing.xxs }, healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, healthCard: { flexBasis: 200, flexGrow: 1, gap: spacing.sm, minWidth: 180 }, healthTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, healthStatus: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs }, healthDot: { borderRadius: radius.pill, height: 7, width: 7 }, healthWarning: { alignItems: 'center', backgroundColor: colors.warningMuted, borderColor: colors.warning, flexDirection: 'row', gap: spacing.sm }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, metric: { flexBasis: 230, flexGrow: 1, gap: spacing.xxs, minWidth: 210 }, metricCompact: { flexBasis: 145, minWidth: 140 }, metricIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.sm, height: 38, justifyContent: 'center', marginBottom: spacing.xs, width: 38 },
  twoColumn: { alignItems: 'stretch', flexDirection: 'row', gap: spacing.md }, stack: { flexDirection: 'column' }, panel: { flex: 1, gap: spacing.md, minHeight: 280 }, chart: { alignItems: 'flex-end', flexDirection: 'row', gap: 5, height: 175 }, barColumn: { alignItems: 'center', flex: 1, gap: spacing.xxs, height: '100%', justifyContent: 'flex-end' }, barTrack: { backgroundColor: colors.surfaceElevated, borderRadius: radius.pill, flex: 1, justifyContent: 'flex-end', overflow: 'hidden', width: '72%' }, bar: { backgroundColor: colors.accent, borderRadius: radius.pill, minHeight: 5, width: '100%' },
  funnelRow: { alignItems: 'center', borderBottomColor: colors.borderSubtle, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm }, smallIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radius.sm, height: 34, justifyContent: 'center', width: 34 },
  tableCard: { paddingVertical: 0 }, userRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 76, paddingVertical: spacing.sm }, rowBorder: { borderTopColor: colors.borderSubtle, borderTopWidth: StyleSheet.hairlineWidth }, userAvatar: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, height: 38, justifyContent: 'center', width: 38 }, userNameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, presence: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs }, presenceDot: { backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 8, width: 8 }, presenceDotOnline: { backgroundColor: colors.success }, userTags: { alignItems: 'flex-end', gap: spacing.xxs }, tag: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.xs, paddingVertical: 3 }, tagAccent: { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder },
  feedbackList: { gap: spacing.sm }, feedbackCard: { gap: spacing.md }, feedbackTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, feedbackIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.sm, height: 40, justifyContent: 'center', width: 40 }, statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, status: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 7 }, statusSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder }, empty: { alignItems: 'center', gap: spacing.sm, justifyContent: 'center', minHeight: 120 },
});
