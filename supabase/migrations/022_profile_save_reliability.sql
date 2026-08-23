create or replace function public.update_my_profile(
  p_display_name text,
  p_avatar_path text,
  p_gender text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_profile public.profiles;
  clean_name text := trim(coalesce(p_display_name, ''));
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 80 then
    raise exception 'Display name must be between 2 and 80 characters';
  end if;
  if p_gender not in ('male', 'woman', 'prefer_not_to_say') then
    raise exception 'Invalid gender preference';
  end if;

  update public.profiles
  set display_name = clean_name,
      avatar_url = nullif(trim(coalesce(p_avatar_path, '')), ''),
      gender = p_gender,
      updated_at = now()
  where id = current_user_id
  returning * into saved_profile;

  if saved_profile.id is null then
    insert into public.profiles (id, display_name, avatar_url, gender, referral_code)
    values (
      current_user_id,
      clean_name,
      nullif(trim(coalesce(p_avatar_path, '')), ''),
      p_gender,
      upper(substr(replace(current_user_id::text, '-', ''), 1, 10))
    )
    returning * into saved_profile;
  end if;

  return saved_profile;
end;
$$;

revoke all on function public.update_my_profile(text, text, text) from public;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
