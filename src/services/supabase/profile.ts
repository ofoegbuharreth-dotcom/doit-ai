import type { User } from '@supabase/supabase-js';

import { supabase } from './client';

export type ProfileGender = 'male' | 'woman' | 'prefer_not_to_say';

export interface DoitProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  avatarPath?: string;
  gender: ProfileGender;
}

const defaultGender: ProfileGender = 'prefer_not_to_say';

function profileFromUser(user: User): DoitProfile {
  return {
    id: user.id,
    displayName: String(user.user_metadata?.name ?? user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? '').trim() || 'Executor',
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? undefined,
    gender: (user.user_metadata?.gender as ProfileGender | undefined) ?? defaultGender,
  };
}

export async function getMyProfile(user: User): Promise<DoitProfile> {
  const fallback = profileFromUser(user);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, gender')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return fallback;
  const storedAvatar = data.avatar_url ?? fallback.avatarUrl;
  let displayAvatar = storedAvatar ?? undefined;
  if (storedAvatar && !/^https?:\/\//i.test(storedAvatar)) {
    const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(storedAvatar, 60 * 60 * 24 * 7);
    displayAvatar = signed?.signedUrl;
  }
  return {
    id: data.id,
    displayName: data.display_name?.trim() && !(data.display_name === 'Executor' && fallback.displayName !== 'Executor') ? data.display_name.trim() : fallback.displayName,
    avatarUrl: displayAvatar,
    avatarPath: storedAvatar ?? undefined,
    gender: (data.gender as ProfileGender | null) ?? fallback.gender,
  };
}

export async function uploadMyAvatar(userId: string, uri: string, mimeType?: string | null) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('DOIT could not read that image. Choose another photo.');
  const body = await response.arrayBuffer();
  const contentType = mimeType || response.headers.get('content-type') || 'image/jpeg';
  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/profile.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType, upsert: true });
  if (error) throw error;
  const { data, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signedError) throw signedError;
  return { path, url: `${data.signedUrl}&v=${Date.now()}` };
}

export async function saveMyProfile(user: User, values: Omit<DoitProfile, 'id'>) {
  const displayName = values.displayName.trim();
  if (displayName.length < 2) throw new Error('Use at least 2 characters for your name.');
  if (displayName.length > 80) throw new Error('Keep your name under 80 characters.');

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: displayName,
    avatar_url: values.avatarPath ?? values.avatarUrl ?? null,
    gender: values.gender,
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const { data, error: authError } = await supabase.auth.updateUser({
    data: { name: displayName, display_name: displayName, avatar_url: values.avatarPath ?? values.avatarUrl ?? null, gender: values.gender },
  });
  if (authError) throw authError;
  return data.user;
}
