-- Trace: invite-only sign-up and profile creation, as triggers on auth.users.
--
-- A new auth user is allowed only if it is anonymous (the demo) or its email is
-- in private.allowed_emails (compared lower-cased). Anything else makes the
-- insert fail, so Supabase Auth returns an error to the sign-up call.
-- The same check runs when an existing user's email changes or an anonymous
-- user is converted to a permanent one, so the demo cannot be used as a way
-- round the invite list.

create or replace function private.is_invited(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_email is not null
     and exists (select 1 from private.allowed_emails a where a.email = lower(btrim(p_email)));
$$;

create or replace function private.enforce_invite_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if private.is_invited(new.email) then
    return new;
  end if;
  raise exception 'invite_only'
    using errcode = '42501', hint = 'Trace is invite-only for now.';
end;
$$;

create or replace function private.guard_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A permanent account must always have an invited email.
  if not coalesce(new.is_anonymous, false)
     and (coalesce(old.is_anonymous, false) or new.email is distinct from old.email)
     and not private.is_invited(new.email) then
    raise exception 'invite_only'
      using errcode = '42501', hint = 'Trace is invite-only for now.';
  end if;
  -- An anonymous user cannot attach an uninvited email either.
  if coalesce(new.is_anonymous, false)
     and new.email is not null
     and new.email is distinct from old.email
     and not private.is_invited(new.email) then
    raise exception 'invite_only'
      using errcode = '42501', hint = 'Trace is invite-only for now.';
  end if;
  return new;
end;
$$;

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, is_demo)
  values (new.id, coalesce(new.is_anonymous, false))
  on conflict (id) do nothing;
  return null;
end;
$$;

revoke all on function private.is_invited(text) from public;
revoke all on function private.enforce_invite_only() from public;
revoke all on function private.guard_auth_user_update() from public;
revoke all on function private.create_profile_for_new_user() from public;

create trigger trace_enforce_invite_only
  before insert on auth.users
  for each row execute function private.enforce_invite_only();

create trigger trace_guard_auth_user_update
  before update of email, is_anonymous on auth.users
  for each row execute function private.guard_auth_user_update();

create trigger trace_create_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();
