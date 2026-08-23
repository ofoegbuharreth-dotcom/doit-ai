import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';
import { isShareCancellation } from './share';

const PENDING_REFERRAL_KEY = 'doit:pending-referral';
export const FOUNDING_LIMIT = 50;

export type FoundingStatus = { spotsClaimed: number; spotsRemaining: number; validReferral: boolean };
export type FoundingProfile = { referralCode: string; foundingNumber?: number; successfulInvites: number };
export type FeedbackCategory = 'idea' | 'confusing' | 'bug' | 'love';

function normaliseReferralCode(value?: string | null) {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(code) ? code : undefined;
}

export async function getFoundingStatus(referralCode?: string): Promise<FoundingStatus> {
  if (!isSupabaseConfigured) return { spotsClaimed: 0, spotsRemaining: FOUNDING_LIMIT, validReferral: false };
  const { data, error } = await supabase.rpc('get_founding_50_status', { p_referral_code: normaliseReferralCode(referralCode) ?? null });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    spotsClaimed: Number(row?.spots_claimed ?? 0),
    spotsRemaining: Number(row?.spots_remaining ?? FOUNDING_LIMIT),
    validReferral: Boolean(row?.valid_referral),
  };
}

export async function captureReferralCode(value?: string | null) {
  const code = normaliseReferralCode(value);
  if (!code) return false;
  try {
    const status = await getFoundingStatus(code);
    if (!status.validReferral) return false;
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
    return true;
  } catch {
    // Keep the public code locally if the status request is temporarily down;
    // the signup trigger remains the final authority and ignores invalid codes.
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
    return true;
  }
}

export async function getPendingReferralCode() {
  return normaliseReferralCode(await AsyncStorage.getItem(PENDING_REFERRAL_KEY));
}

export async function clearPendingReferralCode() {
  await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
}

export async function getMyFoundingProfile(): Promise<FoundingProfile | undefined> {
  if (!isSupabaseConfigured) return undefined;
  const { data, error } = await supabase.rpc('get_my_founding_profile');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.referral_code) return undefined;
  return {
    referralCode: String(row.referral_code),
    foundingNumber: row.founding_number == null ? undefined : Number(row.founding_number),
    successfulInvites: Number(row.successful_invites ?? 0),
  };
}

export function referralUrl(code: string) {
  return `https://doit-ai.pages.dev/?ref=${encodeURIComponent(code)}`;
}

export async function shareReferral(code: string) {
  const url = referralUrl(code);
  const message = `I’m building my goals with DOIT AI. Join the Founding 50 and turn your goal into one clear next move: ${url}`;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join the DOIT AI Founding 50', text: message, url });
        return 'shared' as const;
      } catch (error) {
        if (isShareCancellation(error)) return 'cancelled' as const;
        throw error;
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return 'copied' as const;
    }
  }
  const result = await Share.share({ title: 'Join the DOIT AI Founding 50', message, url });
  if (result.action === Share.dismissedAction) return 'cancelled' as const;
  return 'shared' as const;
}

export async function submitProductFeedback(input: { userId: string; category: FeedbackCategory; rating?: number; message: string; source?: string }) {
  const message = input.message.trim();
  if (message.length < 3) throw new Error('Tell us a little more before sending.');
  if (message.length > 2000) throw new Error('Keep feedback under 2,000 characters.');
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('product_feedback').insert({
    user_id: input.userId,
    category: input.category,
    rating: input.rating ?? null,
    message,
    source: input.source ?? 'profile',
  });
  if (error) throw error;
}
