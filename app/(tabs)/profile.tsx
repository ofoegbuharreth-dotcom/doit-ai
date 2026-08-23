import Ionicons from '@expo/vector-icons/Ionicons';
import { router as expoRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useAuth, useDesktopUpdate, useDeviceSessions, useSubscription } from '@/hooks';
import { exportMaxCalendar, exportMaxPortfolioCsv, exportProgressCsv, exportWorkspaceBackup, getFoundingStatus, getMyFoundingProfile, getMyProfile, isOwnerEmail, saveMyProfile, shareReferral, uploadMyAvatar, type DoitProfile, type FoundingProfile, type FoundingStatus, type ProfileGender } from '@/services';
import { getTelemetryEnabled, setTelemetryEnabled } from '@/services/observability';
import { useAppStore } from '@/stores';
import { accentPalettes, colors, radius, spacing, useAccentTheme, type AccentId, type ColorMode } from '@/theme';

const router = expoRouter as unknown as { push: (href: string) => void; replace: (href: string) => void };

export default function ProfileScreen() {
  const { user, signOut, deleteAccount, demoMode } = useAuth();
  const { isPro, isMax, planName, status, trialDaysLeft } = useSubscription();
  const { devices, currentDeviceId, loading: devicesLoading, error: devicesError, revoke: revokeDevice } = useDeviceSessions();
  const { accentId, colorMode, palette, setAccentId, setColorMode } = useAccentTheme();
  const desktopUpdate = useDesktopUpdate();
  const { goals, milestones, tasks, activity, checkIns, progressEntries, focusSessions, taskDependencies } = useAppStore();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [analyticsEnabled, setAnalyticsEnabledState] = useState(true);
  const [exporting, setExporting] = useState(false); const [exportMessage, setExportMessage] = useState('');
  const [founding, setFounding] = useState<FoundingProfile>(); const [foundingStatus, setFoundingStatus] = useState<FoundingStatus>(); const [shareMessage, setShareMessage] = useState('');
  const [desktopInfo, setDesktopInfo] = useState<{ appVersion: string; electronVersion: string; platform: string; packaged: boolean }>();
  const [profile, setProfile] = useState<DoitProfile>();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileGender, setProfileGender] = useState<ProfileGender>('prefer_not_to_say');
  const [profileAvatar, setProfileAvatar] = useState<string>();
  const [profileAvatarPath, setProfileAvatarPath] = useState<string>();
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const canDelete = deleteConfirmation === 'Delete';
  const isOwner = isOwnerEmail(user?.email);

  useEffect(() => { getTelemetryEnabled().then(setAnalyticsEnabledState).catch(() => undefined); }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.doitDesktop?.getInfo().then(setDesktopInfo).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!user || demoMode) return;
    Promise.all([getMyFoundingProfile(), getFoundingStatus()]).then(([profile, campaign]) => { setFounding(profile); setFoundingStatus(campaign); }).catch(() => undefined);
  }, [demoMode, user]);
  useEffect(() => {
    if (!user || demoMode || !('user_metadata' in user)) return;
    getMyProfile(user).then(setProfile).catch(() => undefined);
  }, [demoMode, user]);
  const openProfileEditor = () => {
    const fallbackName = user && 'user_metadata' in user ? String(user.user_metadata?.name ?? '') : '';
    setProfileName(profile?.displayName ?? fallbackName);
    setProfileGender(profile?.gender ?? 'prefer_not_to_say');
    setProfileAvatar(profile?.avatarUrl);
    setProfileAvatarPath(profile?.avatarPath);
    setProfileError('');
    setProfileModalVisible(true);
  };
  const chooseProfilePicture = async () => {
    if (!user || !('user_metadata' in user)) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setProfileError('Allow photo access to choose a profile picture.'); return; }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (picked.canceled) return;
    setProfileSaving(true); setProfileError('');
    try {
    const asset = picked.assets[0];
    if (!asset) { setProfileError('No image was selected.'); setProfileSaving(false); return; }
      const uploaded = await uploadMyAvatar(user.id, asset.uri, asset.mimeType);
      setProfileAvatar(uploaded.url); setProfileAvatarPath(uploaded.path);
    } catch (value) { setProfileError(value instanceof Error ? value.message : 'Could not upload that image.'); }
    finally { setProfileSaving(false); }
  };
  const saveProfile = async () => {
    if (!user || !('user_metadata' in user) || profileSaving) return;
    setProfileSaving(true); setProfileError('');
    try {
      await saveMyProfile(user, { displayName: profileName, avatarUrl: profileAvatar, avatarPath: profileAvatarPath, gender: profileGender });
      const next = { id: user.id, displayName: profileName.trim(), avatarUrl: profileAvatar, avatarPath: profileAvatarPath, gender: profileGender };
      setProfile(next); setProfileModalVisible(false);
    } catch (value) { setProfileError(value instanceof Error ? value.message : 'Could not save your profile.'); }
    finally { setProfileSaving(false); }
  };
  const invite = async () => {
    if (!founding) return;
    try { const result = await shareReferral(founding.referralCode); setShareMessage(result === 'copied' ? 'Invite link copied.' : 'Invite ready to share.'); } catch { setShareMessage('Sharing was cancelled.'); }
  };
  const toggleAnalytics = async () => {
    const next = !analyticsEnabled;
    setAnalyticsEnabledState(next);
    await setTelemetryEnabled(next);
  };

  const logout = async () => { await signOut(); router.replace('/(auth)/login'); };
  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalVisible(false);
    setDeleteConfirmation('');
    setError('');
  };
  const confirmDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true); setError('');
    const result = await deleteAccount();
    setDeleting(false);
    if (result.error) setError(result.error);
    else { setDeleteModalVisible(false); setDeleteConfirmation(''); router.replace('/(auth)/welcome'); }
  };
  const backup = { goals, milestones, tasks, activity, checkIns, progressEntries, focusSessions, taskDependencies };
  const runExport = async (kind: 'backup' | 'csv' | 'max-csv' | 'max-calendar') => { setExporting(true); setExportMessage(''); try { if (kind === 'backup') await exportWorkspaceBackup(backup); else if (kind === 'csv') await exportProgressCsv(backup); else if (kind === 'max-csv') await exportMaxPortfolioCsv(backup); else await exportMaxCalendar(backup); setExportMessage(kind === 'backup' ? 'Backup ready to save or share.' : kind === 'max-calendar' ? 'MAX calendar plan ready.' : 'Progress export ready.'); } catch (value) { setExportMessage(value instanceof Error ? value.message : 'Could not export your data.'); } finally { setExporting(false); } };

  return <>
    <Screen scrollable contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.avatar}>{profile?.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} /> : <Text variant="heading">{profile?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'D'}</Text>}</View>
        <View style={styles.flex}><Text variant="title">{profile?.displayName || 'Your profile'}</Text><Text color="secondary">{user?.email ?? (demoMode ? 'Demo executor' : 'Signed out')}</Text></View>
        {!demoMode ? <Pressable accessibilityRole="button" onPress={openProfileEditor} style={styles.editProfile}><Ionicons name="create-outline" color={colors.accent} size={18} /><Text variant="label" color="accent">Edit</Text></Pressable> : null}
      </View>
      {demoMode ? <Card style={styles.demo}><Text variant="eyebrow" color="accent">DEMO MODE</Text><Text color="secondary">Add Supabase environment values to enable live accounts and cloud data.</Text></Card> : null}
      {isOwner ? <Pressable onPress={() => router.push('/owner')}><LinearGradient colors={[palette.muted, colors.surfaceElevated]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.owner}><View style={styles.ownerIcon}><Ionicons name="pulse" color={colors.onAccent} size={22} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">OWNER ONLY</Text><Text variant="heading">DOIT command centre</Text><Text variant="caption" color="secondary">Growth, activation, retention, subscriptions, referrals, and feedback.</Text></View><Ionicons name="chevron-forward" color={colors.accent} size={20} /></LinearGradient></Pressable> : null}
      {founding ? <LinearGradient colors={[palette.muted, colors.surfaceElevated]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.founding}>
        <View style={styles.foundingTop}><View style={styles.foundingMark}><Ionicons name="rocket" color={colors.onAccent} size={21} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">DOIT FOUNDING 50</Text><Text variant="heading">{founding.foundingNumber ? `Founding Member #${founding.foundingNumber}` : 'Founding invites'}</Text></View>{founding.foundingNumber ? <View style={styles.foundingBadge}><Text variant="caption" color="accent">#{founding.foundingNumber}</Text></View> : null}</View>
        <Text color="secondary">Invite people who need a clearer next move. Their signup is attributed to your founding link.</Text>
        <View style={styles.foundingStats}><View style={styles.foundingStat}><Text variant="heading">{founding.successfulInvites}</Text><Text variant="caption" color="muted">joined through you</Text></View><View style={styles.foundingStat}><Text variant="heading">{foundingStatus?.spotsRemaining ?? '—'}</Text><Text variant="caption" color="muted">founding spots left</Text></View></View>
        <Button label="Invite someone" icon="share-social-outline" onPress={invite} />
        {shareMessage ? <Text variant="caption" color="accent">{shareMessage}</Text> : null}
      </LinearGradient> : null}
      <Pressable onPress={() => router.push('/pro')}>
        <LinearGradient colors={[palette.muted, colors.surfaceElevated]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pro}>
          <View style={styles.proTop}><Ionicons name={isMax ? 'flash' : 'diamond'} color={colors.accent} size={23} /><View style={styles.flex}><Text variant="heading">{planName}</Text><Text variant="caption" color="accent">{isPro ? (status === 'trialing' ? `${trialDaysLeft} trial days left` : isMax ? 'Maximum system active' : 'Active') : 'Choose the system that fits you'}</Text></View><Ionicons name="chevron-forward" color={colors.textSecondary} /></View>
          <Text color="secondary">{isMax ? 'Your highest-capacity AI planning, adaptations, history, and intelligence are ready.' : isPro ? 'Your advanced planning and Weekly Review are ready. Upgrade to MAX for the highest limits.' : 'Pro adds serious capacity. MAX unlocks DOIT at full strength.'}</Text>
        </LinearGradient>
      </Pressable>
      <Card style={styles.appearance}>
        <View style={styles.appearanceHeading}>
          <View style={[styles.appearanceIcon, { backgroundColor: palette.muted }]}><Ionicons name={colorMode === 'dark' ? 'moon-outline' : 'sunny-outline'} color={palette.accent} size={21} /></View>
          <View style={styles.flex}><Text variant="heading">Appearance</Text><Text variant="caption" color="muted">Make DOIT feel comfortable wherever you work.</Text></View>
        </View>
        <Text variant="label">Mode</Text>
        <View accessibilityRole="radiogroup" style={styles.modeGrid}>
          {([['dark', 'Dark', 'moon'], ['light', 'Light', 'sunny']] as [ColorMode, string, keyof typeof Ionicons.glyphMap][]).map(([mode, label, icon]) => {
            const selected = colorMode === mode;
            return <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setColorMode(mode)} style={[styles.modeOption, selected && styles.modeOptionSelected]}><View style={[styles.modePreview, mode === 'light' && styles.modePreviewLight]}><Ionicons name={icon} color={mode === 'light' ? '#343941' : '#F5F7F8'} size={20} /></View><Text variant="label" color={selected ? 'accent' : 'secondary'}>{label}</Text>{selected ? <Ionicons name="checkmark-circle" color={colors.accent} size={19} /> : null}</Pressable>;
          })}
        </View>
        <View style={styles.appearanceDivider} />
        <Text variant="label">Accent colour</Text>
        <View accessibilityRole="radiogroup" style={styles.colourGrid}>
          {(Object.entries(accentPalettes) as [AccentId, (typeof accentPalettes)[AccentId]][]).map(([id, option]) => {
            const selected = accentId === id;
            const optionAccent = colorMode === 'light' ? option.lightAccent : option.accent;
            const optionMuted = colorMode === 'light' ? option.lightMuted : option.muted;
            const optionOnAccent = colorMode === 'light' ? option.lightOnAccent : option.onAccent;
            return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${option.label} app colour`} onPress={() => setAccentId(id)} style={[styles.colourOption, selected && { backgroundColor: optionMuted, borderColor: optionAccent }]}> 
              <View style={[styles.swatch, { backgroundColor: optionAccent }]}>{selected ? <Ionicons name="checkmark" color={optionOnAccent} size={17} /> : null}</View>
              <Text variant="caption" style={selected ? { color: optionAccent } : undefined}>{option.label}</Text>
            </Pressable>;
          })}
        </View>
      </Card>
      <View style={styles.settingsGroup}>
        <Setting icon="chatbubble-ellipses-outline" title="Help shape DOIT" detail="Send an idea, report a bug, or tell us what works" onPress={() => router.push('/feedback')} />
        {Platform.OS === 'web' ? <Setting icon="newspaper-outline" title="Version logs" detail="See what changed in every recent DOIT update" onPress={() => router.push('/version-logs')} /> : null}
        {Platform.OS !== 'web' ? <Setting icon="notifications-outline" title="Notifications" detail="Daily action and evening check-in times" onPress={() => router.push('/settings/notifications')} /> : null}
        <Setting icon="calendar-outline" title="Calendar & time blocks" detail={Platform.OS === 'web' ? 'Download upcoming actions as calendar events' : 'Turn upcoming actions into calendar events'} onPress={() => router.push('/calendar')} />
        {Platform.OS === 'android' ? <Setting icon="apps-outline" title="Home-screen widget" detail="Long-press your Android home screen, tap Widgets, then choose DOIT AI" complete /> : null}
        <Setting icon="sparkles-outline" title="AI adaptation" detail="DOIT replaces blocked actions automatically" complete />
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: analyticsEnabled }} onPress={toggleAnalytics} style={styles.setting}><View style={styles.settingIcon}><Ionicons name="analytics-outline" color={colors.textSecondary} size={20} /></View><View style={styles.settingCopy}><Text variant="label">Help improve DOIT</Text><Text variant="caption" color="muted">Anonymous product analytics · never your goal text</Text></View><View style={[styles.toggle, analyticsEnabled && styles.toggleOn]}><View style={[styles.toggleThumb, analyticsEnabled && styles.toggleThumbOn]} /></View></Pressable>
      </View>
      <Card style={styles.backup}>
        <View style={styles.appearanceHeading}><View style={[styles.appearanceIcon, { backgroundColor: palette.muted }]}><Ionicons name="shield-checkmark-outline" color={palette.accent} size={21} /></View><View style={styles.flex}><Text variant="heading">Export & backup</Text><Text variant="caption" color="muted">Keep a private copy of your goals, actions, progress, check-ins, and focus history.</Text></View></View>
        <Button label={exporting ? 'Preparing…' : 'Download full backup'} disabled={exporting} icon="download-outline" onPress={() => runExport('backup')} />
        <Button label="Export progress as CSV" disabled={exporting} variant="secondary" icon="document-text-outline" onPress={() => runExport('csv')} />
        {isMax ? <><Button label="Export MAX portfolio summary" disabled={exporting} variant="secondary" icon="analytics-outline" onPress={() => runExport('max-csv')} /><Button label="Export full plan to calendar" disabled={exporting} variant="secondary" icon="calendar-outline" onPress={() => runExport('max-calendar')} /></> : <Pressable onPress={() => router.push('/pro?tier=max')} style={styles.maxExport}><Ionicons name="flash-outline" color={colors.accent} size={18} /><View style={styles.flex}><Text variant="label">MAX exports</Text><Text variant="caption" color="muted">Portfolio summary and full calendar plan</Text></View><Ionicons name="lock-closed-outline" color={colors.textMuted} size={16} /></Pressable>}
        <Text variant="caption" color="muted">Backups contain your goal data. Store them somewhere private; passwords and payment details are never included.</Text>
        {exportMessage ? <Text variant="caption" color="accent">{exportMessage}</Text> : null}
      </Card>
      {desktopInfo ? <Card style={styles.about}>
        <View style={styles.appearanceHeading}><View style={[styles.appearanceIcon, { backgroundColor: palette.muted }]}><Ionicons name="desktop-outline" color={palette.accent} size={21} /></View><View style={styles.flex}><Text variant="heading">About DOIT AI</Text><Text variant="caption" color="muted">Desktop version {desktopInfo.appVersion} · {desktopInfo.platform === 'win32' ? 'Windows' : desktopInfo.platform === 'darwin' ? 'macOS' : desktopInfo.platform}</Text></View></View>
        <View style={styles.versionRow}><View><Text variant="label">Updates</Text><Text variant="caption" color={desktopUpdate.state.phase === 'error' ? 'danger' : 'muted'}>{desktopUpdate.state.phase === 'checking' ? 'Checking for a new version…' : desktopUpdate.state.phase === 'available' ? `Version ${desktopUpdate.state.availableVersion} is available` : desktopUpdate.state.phase === 'downloading' ? `Downloading · ${desktopUpdate.state.percent ?? 0}%` : desktopUpdate.state.phase === 'downloaded' ? 'Update downloaded and ready' : desktopUpdate.state.message ?? 'DOIT checks automatically when it starts.'}</Text></View><Ionicons name={desktopUpdate.state.phase === 'downloaded' ? 'checkmark-circle' : 'cloud-download-outline'} color={desktopUpdate.state.phase === 'downloaded' ? colors.success : colors.textSecondary} size={22} /></View>
        {desktopUpdate.state.phase === 'downloaded' ? <Button label="Restart and update" icon="refresh" onPress={desktopUpdate.install} /> : desktopUpdate.state.phase === 'available' ? <Button label={`Download version ${desktopUpdate.state.availableVersion}`} icon="download-outline" onPress={desktopUpdate.download} /> : <Button label="Check for updates" variant="secondary" icon="refresh-outline" disabled={desktopUpdate.state.phase === 'checking' || desktopUpdate.state.phase === 'downloading'} onPress={desktopUpdate.check} />}
        <Text variant="caption" color="muted">Electron {desktopInfo.electronVersion} · Updates are verified against the official DOIT AI GitHub release feed.</Text>
      </Card> : null}
      <Card style={styles.devices}>
        <View style={styles.appearanceHeading}><View style={[styles.appearanceIcon, { backgroundColor: palette.muted }]}><Ionicons name="phone-portrait-outline" color={palette.accent} size={21} /></View><View style={styles.flex}><Text variant="heading">Your devices</Text><Text variant="caption" color="muted">DOIT keeps each login independent. Sign out a device you no longer use.</Text></View></View>
        {devicesLoading && !devices.length ? <Text variant="caption" color="muted">Checking your active devices…</Text> : null}
        {devices.map((device) => {
          const current = device.id === currentDeviceId;
          const lastSeen = new Date(device.lastSeenAt);
          const detail = current ? 'This device · active now' : `Last active ${Number.isNaN(lastSeen.getTime()) ? 'recently' : lastSeen.toLocaleString()}`;
          return <View key={device.id} style={styles.deviceRow}><View style={styles.deviceIcon}><Ionicons name={device.appKind === 'installed-web' ? 'apps-outline' : device.platform === 'web' ? 'desktop-outline' : 'phone-portrait-outline'} color={current ? colors.accent : colors.textSecondary} size={19} /></View><View style={styles.flex}><Text variant="label">{device.label}</Text><Text variant="caption" color={current ? 'accent' : 'muted'}>{detail}</Text></View>{!current ? <Pressable accessibilityRole="button" accessibilityLabel={`Sign out ${device.label}`} onPress={() => revokeDevice(device.id)} style={styles.deviceSignOut}><Text variant="caption" color="danger">Sign out</Text></Pressable> : <Ionicons name="checkmark-circle" color={colors.success} size={20} />}</View>;
        })}
        {devicesError ? <Text variant="caption" color="danger">{devicesError}</Text> : null}
      </Card>
      <Card style={styles.account}>
        <Text variant="heading">Account</Text>
        <Button label="Log out" variant="secondary" onPress={logout} />
        <Pressable onPress={() => { setError(''); setDeleteModalVisible(true); }} style={styles.delete}><Text variant="label" color="danger">Delete account</Text></Pressable>
      </Card>
    </Screen>

    <Modal visible={deleteModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={closeDeleteModal}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable accessibilityLabel="Close delete account dialog" style={StyleSheet.absoluteFill} onPress={closeDeleteModal} />
        <View accessibilityViewIsModal style={styles.deleteDialog}>
          <View style={styles.dangerIcon}><Ionicons name="trash-outline" color={colors.danger} size={24} /></View>
          <View style={styles.dialogHeading}>
            <Text variant="title" style={styles.dialogTitle}>Delete your account?</Text>
            <Text variant="caption" color="secondary">This permanently deletes your goals, actions, progress, check-ins, and account data. This cannot be undone.</Text>
          </View>
          <View style={styles.confirmCopy}>
            <Text variant="caption" color="secondary">Type <Text variant="label">Delete</Text> to confirm.</Text>
            <Input autoCapitalize="words" autoCorrect={false} value={deleteConfirmation} onChangeText={(value) => { setDeleteConfirmation(value); setError(''); }} placeholder="Delete" returnKeyType="done" onSubmitEditing={confirmDelete} />
          </View>
          {error ? <Text variant="caption" color="danger">{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canDelete || deleting }} disabled={!canDelete || deleting} onPress={confirmDelete} style={[styles.confirmDelete, canDelete && styles.confirmDeleteReady]}>
            <Ionicons name="trash" color={canDelete ? '#FFFFFF' : colors.textMuted} size={18} />
            <Text variant="label" style={[styles.confirmDeleteText, canDelete && styles.confirmDeleteTextReady]}>{deleting ? 'Deleting…' : 'Delete account forever'}</Text>
          </Pressable>
          <Pressable disabled={deleting} onPress={closeDeleteModal} style={styles.cancelDelete}><Text variant="label" color="secondary">Cancel</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={profileModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !profileSaving && setProfileModalVisible(false)}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable accessibilityLabel="Close profile editor" style={StyleSheet.absoluteFill} onPress={() => !profileSaving && setProfileModalVisible(false)} />
        <View accessibilityViewIsModal style={styles.profileDialog}>
          <View style={styles.profileDialogTop}><View><Text variant="eyebrow" color="accent">YOUR IDENTITY</Text><Text variant="title">Edit profile</Text></View><Pressable hitSlop={12} onPress={() => !profileSaving && setProfileModalVisible(false)}><Ionicons name="close" color={colors.textSecondary} size={24} /></Pressable></View>
          <View style={styles.avatarEditor}>
            <View style={styles.avatarLarge}>{profileAvatar ? <Image source={{ uri: profileAvatar }} style={styles.avatarImage} /> : <Text variant="title">{profileName.trim()?.[0]?.toUpperCase() || 'D'}</Text>}</View>
            <View style={styles.flex}><Text variant="label">Profile picture</Text><Text variant="caption" color="muted">Square photos work best. Maximum 5 MB.</Text><Pressable disabled={profileSaving} onPress={chooseProfilePicture} style={styles.photoButton}><Ionicons name="image-outline" color={colors.accent} size={17} /><Text variant="caption" color="accent">Choose photo</Text></Pressable></View>
          </View>
          <Input label="Name" value={profileName} onChangeText={setProfileName} placeholder="Your name" autoCapitalize="words" autoComplete="name" />
          <View style={styles.genderField}><Text variant="label">Gender</Text><Text variant="caption" color="muted">Used only to personalise your DOIT experience.</Text>
            <View accessibilityRole="radiogroup" style={styles.genderOptions}>
              {([['male', 'Male'], ['woman', 'Woman'], ['prefer_not_to_say', 'Prefer not to say']] as [ProfileGender, string][]).map(([value, label]) => {
                const selected = profileGender === value;
                return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setProfileGender(value)} style={[styles.genderOption, selected && styles.genderOptionSelected]}><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View><Text variant="caption" color={selected ? 'accent' : 'secondary'}>{label}</Text></Pressable>;
              })}
            </View>
          </View>
          {profileError ? <Text variant="caption" color="danger">{profileError}</Text> : null}
          <Button label={profileSaving ? 'Saving…' : 'Save profile'} disabled={profileSaving} icon="checkmark" onPress={saveProfile} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

function Setting({ icon, title, detail, onPress, complete }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress?: () => void; complete?: boolean }) {
  const content = <><View style={styles.settingIcon}><Ionicons name={icon} color={colors.textSecondary} size={20} /></View><View style={styles.settingCopy}><Text variant="label">{title}</Text><Text variant="caption" color="muted">{detail}</Text></View><Ionicons name={complete ? 'checkmark-circle' : 'chevron-forward'} color={complete ? colors.success : colors.textMuted} /></>;
  return onPress ? <Pressable onPress={onPress} style={styles.setting}>{content}</Pressable> : <View style={styles.setting}>{content}</View>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatar: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accent, borderRadius: radius.pill, borderWidth: 1, height: 58, justifyContent: 'center', overflow: 'hidden', width: 58 },
  avatarImage: { height: '100%', width: '100%' }, editProfile: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 42, paddingHorizontal: spacing.md },
  flex: { flex: 1 }, demo: { gap: spacing.xs }, owner: { alignItems: 'center', borderColor: colors.accentBorder, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg }, ownerIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 46, justifyContent: 'center', width: 46 }, founding: { borderColor: colors.accentBorder, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, overflow: 'hidden', padding: spacing.lg }, foundingTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, foundingMark: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, foundingBadge: { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, foundingStats: { flexDirection: 'row', gap: spacing.sm }, foundingStat: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, gap: spacing.xxs, padding: spacing.md },
  pro: { borderColor: colors.accentMuted, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  proTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  settingsGroup: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', paddingHorizontal: spacing.md },
  setting: { alignItems: 'center', borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 76 },
  settingIcon: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  settingCopy: { flex: 1, gap: spacing.xxs }, account: { gap: spacing.md }, backup: { gap: spacing.md }, maxExport: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.accentMuted, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 62, paddingHorizontal: spacing.md }, about: { gap: spacing.md }, versionRow: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingHorizontal: spacing.md }, devices: { gap: spacing.md }, deviceRow: { alignItems: 'center', borderTopColor: colors.borderSubtle, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 66, paddingTop: spacing.sm }, deviceIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 }, deviceSignOut: { alignItems: 'center', backgroundColor: colors.dangerMuted, borderRadius: radius.pill, justifyContent: 'center', minHeight: 36, paddingHorizontal: spacing.sm },
  appearance: { gap: spacing.md }, appearanceHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, appearanceIcon: { alignItems: 'center', borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, modeGrid: { flexDirection: 'row', gap: spacing.sm }, modeOption: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 62, paddingHorizontal: spacing.sm }, modeOptionSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent }, modePreview: { alignItems: 'center', backgroundColor: '#17191D', borderColor: '#30343B', borderRadius: radius.sm, borderWidth: 1, height: 38, justifyContent: 'center', width: 42 }, modePreviewLight: { backgroundColor: '#F7F8FA', borderColor: '#D5D9DF' }, appearanceDivider: { backgroundColor: colors.borderSubtle, height: 1 }, colourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, colourOption: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexBasis: '40%', flexDirection: 'row', flexGrow: 1, gap: spacing.sm, minHeight: 52, minWidth: 140, paddingHorizontal: spacing.sm }, swatch: { alignItems: 'center', borderRadius: radius.pill, height: 28, justifyContent: 'center', width: 28 },
  toggle: { backgroundColor: colors.border, borderRadius: radius.pill, height: 26, justifyContent: 'center', paddingHorizontal: 3, width: 44 }, toggleOn: { backgroundColor: colors.accent }, toggleThumb: { backgroundColor: colors.textSecondary, borderRadius: radius.pill, height: 20, width: 20 }, toggleThumbOn: { alignSelf: 'flex-end', backgroundColor: colors.onAccent },
  delete: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  modalRoot: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing.lg },
  deleteDialog: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md, maxWidth: 420, padding: spacing.lg, width: '100%' },
  dangerIcon: { alignItems: 'center', backgroundColor: colors.dangerMuted, borderColor: colors.danger, borderRadius: radius.pill, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  dialogHeading: { gap: spacing.xs }, dialogTitle: { fontSize: 23, lineHeight: 29 }, confirmCopy: { gap: spacing.xs },
  confirmDelete: { alignItems: 'center', backgroundColor: colors.dangerMuted, borderColor: colors.dangerMuted, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 52, opacity: 0.72, paddingHorizontal: spacing.md },
  confirmDeleteReady: { backgroundColor: colors.danger, borderColor: colors.danger, opacity: 1 },
  confirmDeleteText: { color: colors.textMuted }, confirmDeleteTextReady: { color: '#FFFFFF' },
  cancelDelete: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  profileDialog: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing.lg, maxWidth: 520, padding: spacing.lg, width: '100%' },
  profileDialogTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, avatarEditor: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md }, avatarLarge: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accent, borderRadius: radius.pill, borderWidth: 1, height: 76, justifyContent: 'center', overflow: 'hidden', width: 76 }, photoButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, minHeight: 36 }, genderField: { gap: spacing.xs }, genderOptions: { gap: spacing.xs }, genderOption: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md }, genderOptionSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent }, radio: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 1, height: 18, justifyContent: 'center', width: 18 }, radioSelected: { borderColor: colors.accent }, radioDot: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 10, width: 10 },
});
