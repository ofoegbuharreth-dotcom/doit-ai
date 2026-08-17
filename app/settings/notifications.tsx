import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { getReminderPreferences, saveReminderPreferences, type ReminderPreferences } from '@/services/notifications';
import { colors, spacing } from '@/theme';

const initial: ReminderPreferences = { enabled: false, planningEnabled: true, planningTime: '09:00', checkInEnabled: true, checkInTime: '20:30', overdueEnabled: false, overdueTime: '17:00', sound: true, quietStart: '21:30', quietEnd: '08:00' };

export default function NotificationSettingsScreen() {
  const [preferences, setPreferences] = useState(initial); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { getReminderPreferences().then(setPreferences).finally(() => setLoading(false)); }, []);
  const save = async () => { setSaving(true); setError(''); setMessage(''); try { await saveReminderPreferences(preferences); setMessage(preferences.enabled ? 'Your selected reminders are scheduled.' : 'DOIT reminders are off.'); } catch (value) { setError(value instanceof Error ? value.message : 'Could not save reminders.'); } finally { setSaving(false); } };
  const toggle = (key: keyof ReminderPreferences, value: boolean) => setPreferences((current) => ({ ...current, [key]: value }));
  return <Screen scrollable contentContainerStyle={styles.screen}><ScreenHeader title="Notifications" /><View style={styles.heading}><Text variant="eyebrow" color="accent">REMINDER CONTROL</Text><Text variant="title">Useful prompts, never noise.</Text><Text color="secondary">Choose exactly which reminders DOIT sends and protect your quiet hours.</Text></View>
    <ReminderToggle title="Allow DOIT reminders" detail="Master switch for every notification below." value={preferences.enabled} onChange={(value) => toggle('enabled', value)} />
    <Card style={styles.group}><ReminderToggle embedded title="Morning plan" detail="Choose one clear move for today." value={preferences.planningEnabled} onChange={(value) => toggle('planningEnabled', value)} /><Input editable={!loading && preferences.enabled && preferences.planningEnabled} label="Time" value={preferences.planningTime} onChangeText={(planningTime) => setPreferences((current) => ({ ...current, planningTime }))} keyboardType="numbers-and-punctuation" /></Card>
    <Card style={styles.group}><ReminderToggle embedded title="Evening check-in" detail="Record what moved forward today." value={preferences.checkInEnabled} onChange={(value) => toggle('checkInEnabled', value)} /><Input editable={!loading && preferences.enabled && preferences.checkInEnabled} label="Time" value={preferences.checkInTime} onChangeText={(checkInTime) => setPreferences((current) => ({ ...current, checkInTime }))} keyboardType="numbers-and-punctuation" /></Card>
    <Card style={styles.group}><ReminderToggle embedded title="Overdue action review" detail="A prompt to do, move, replace, or remove stale actions." value={preferences.overdueEnabled} onChange={(value) => toggle('overdueEnabled', value)} /><Input editable={!loading && preferences.enabled && preferences.overdueEnabled} label="Time" value={preferences.overdueTime} onChangeText={(overdueTime) => setPreferences((current) => ({ ...current, overdueTime }))} keyboardType="numbers-and-punctuation" /></Card>
    <Card style={styles.group}><Text variant="label">Quiet hours</Text><Text variant="caption" color="muted">DOIT refuses to schedule reminders inside this period.</Text><View style={styles.times}><View style={styles.flex}><Input label="Start" value={preferences.quietStart} onChangeText={(quietStart) => setPreferences((current) => ({ ...current, quietStart }))} keyboardType="numbers-and-punctuation" /></View><View style={styles.flex}><Input label="End" value={preferences.quietEnd} onChangeText={(quietEnd) => setPreferences((current) => ({ ...current, quietEnd }))} keyboardType="numbers-and-punctuation" /></View></View></Card>
    <ReminderToggle title="Reminder sounds" detail="Turn off for silent banners." value={preferences.sound} onChange={(value) => toggle('sound', value)} />
    {error ? <Text variant="caption" color="danger">{error}</Text> : null}{message ? <Text variant="caption" color="accent">{message}</Text> : null}<Button label={saving ? 'Saving…' : 'Save notification settings'} disabled={loading || saving} onPress={save} />
  </Screen>;
}

function ReminderToggle({ title, detail, value, onChange, embedded = false }: { title: string; detail: string; value: boolean; onChange: (value: boolean) => void; embedded?: boolean }) { const content = <><View style={styles.flex}><Text variant="label">{title}</Text><Text variant="caption" color="muted">{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.accentMuted }} thumbColor={value ? colors.accent : colors.textMuted} /></>; return embedded ? <View style={styles.toggle}>{content}</View> : <Card style={styles.toggle}>{content}</Card>; }
const styles = StyleSheet.create({ screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.md }, heading: { gap: spacing.sm, paddingTop: spacing.sm }, toggle: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, group: { gap: spacing.md }, flex: { flex: 1, gap: spacing.xxs }, times: { flexDirection: 'row', gap: spacing.sm } });
