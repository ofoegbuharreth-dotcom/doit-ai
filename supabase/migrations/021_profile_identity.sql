alter table public.profiles
  add column if not exists gender text not null default 'prefer_not_to_say';

alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles
  add constraint profiles_gender_check
  check (gender in ('male', 'woman', 'prefer_not_to_say'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url, gender)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Executor'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    case
      when new.raw_user_meta_data->>'gender' in ('male', 'woman', 'prefer_not_to_say') then new.raw_user_meta_data->>'gender'
      else 'prefer_not_to_say'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users read their own avatar" on storage.objects;
create policy "users read their own avatar" on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update their own avatar" on storage.objects;
create policy "users update their own avatar" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
