-- Run in the Supabase SQL Editor. Safe to run again.
begin;

-- Validate embedded sections/slides at the database boundary too.
create or replace function public.nsc_valid_song_payload(payload jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  section jsonb;
  slide jsonb;
  section_ids text[] := array[]::text[];
  arrangement_id jsonb;
begin
  if payload is null or jsonb_typeof(payload) is distinct from 'object' or
     jsonb_typeof(payload -> 'titlePrimary') is distinct from 'string' or
     jsonb_typeof(payload -> 'titleSecondary') is distinct from 'string' or
     jsonb_typeof(payload -> 'author') is distinct from 'string' or
     jsonb_typeof(payload -> 'musicalKey') is distinct from 'string' or
     jsonb_typeof(payload -> 'bpm') is distinct from 'number' or
     jsonb_typeof(payload -> 'sections') is distinct from 'array' or
     jsonb_typeof(payload -> 'arrangement') is distinct from 'array' or
     octet_length(payload::text) > 1048576 then return false;
  end if;
  for section in select value from jsonb_array_elements(payload -> 'sections') loop
    if jsonb_typeof(section -> 'id') is distinct from 'string' or
       (section ->> 'id') = any(section_ids) or
       jsonb_typeof(section -> 'label') is distinct from 'string' or
       coalesce(section ->> 'type', '') not in ('Intro','Verse','PreChorus','Chorus','Bridge','Tag','Outro') or
       jsonb_typeof(section -> 'slides') is distinct from 'array' then return false;
    end if;
    section_ids := array_append(section_ids, section ->> 'id');
    for slide in select value from jsonb_array_elements(section -> 'slides') loop
      if jsonb_typeof(slide -> 'id') is distinct from 'string' or
         jsonb_typeof(slide -> 'primaryText') is distinct from 'string' or
         jsonb_typeof(slide -> 'secondaryText') is distinct from 'string' or
         (slide ? 'chords' and jsonb_typeof(slide -> 'chords') is distinct from 'string') then return false;
      end if;
    end loop;
  end loop;
  for arrangement_id in select value from jsonb_array_elements(payload -> 'arrangement') loop
    if jsonb_typeof(arrangement_id) <> 'string' or
       not ((arrangement_id #>> '{}') = any(section_ids)) then return false;
    end if;
  end loop;
  return true;
end;
$$;

create table if not exists public.nsc_libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.nsc_library_members (
  library_id uuid not null references public.nsc_libraries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (library_id, user_id)
);

create table if not exists public.nsc_songs (
  library_id uuid not null references public.nsc_libraries(id) on delete cascade,
  id uuid not null,
  revision integer not null check (revision > 0),
  mutation_id uuid not null,
  deleted boolean not null default false,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (library_id, id)
);

alter table public.nsc_libraries enable row level security;
alter table public.nsc_library_members enable row level security;
alter table public.nsc_songs enable row level security;

drop policy if exists nsc_read_own_membership on public.nsc_library_members;
create policy nsc_read_own_membership on public.nsc_library_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists nsc_read_library on public.nsc_libraries;
create policy nsc_read_library on public.nsc_libraries
  for select to authenticated using (exists (
    select 1 from public.nsc_library_members m
    where m.library_id = nsc_libraries.id and m.user_id = (select auth.uid())
  ));

drop policy if exists nsc_read_songs on public.nsc_songs;
create policy nsc_read_songs on public.nsc_songs
  for select to authenticated using (exists (
    select 1 from public.nsc_library_members m
    where m.library_id = nsc_songs.library_id and m.user_id = (select auth.uid())
  ));

-- Membership is administered in SQL Editor, never by the desktop client.
revoke all on public.nsc_libraries, public.nsc_library_members, public.nsc_songs from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.nsc_libraries, public.nsc_library_members, public.nsc_songs to authenticated;

-- Only this RPC may write songs. Revision checks and writes share one transaction.
create or replace function public.nsc_push_song(
  p_library_id uuid,
  p_id uuid,
  p_revision integer,
  p_mutation_id uuid,
  p_deleted boolean,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_song public.nsc_songs%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.nsc_library_members
    where library_id = p_library_id and user_id = auth.uid()
  ) then
    raise insufficient_privilege using message = 'Library membership required';
  end if;

  if p_id is null or p_mutation_id is null or p_revision is null or p_revision < 0 or
     p_deleted is null or not public.nsc_valid_song_payload(p_payload) then
    raise invalid_parameter_value using message = 'Invalid song payload';
  end if;

  if p_revision = 0 then
    insert into public.nsc_songs (library_id, id, revision, mutation_id, deleted, payload)
      values (p_library_id, p_id, 1, p_mutation_id, p_deleted, p_payload)
      on conflict (library_id, id) do nothing
      returning * into current_song;
    if found then
      return jsonb_build_object('applied', true, 'song', to_jsonb(current_song));
    end if;
  end if;

  select * into current_song from public.nsc_songs
    where library_id = p_library_id and id = p_id for update;
  if not found then
    raise invalid_parameter_value using message = 'Shared song is missing; restore the library backup';
  end if;

  -- A retried request after a lost response must not write a second revision.
  if current_song.mutation_id = p_mutation_id then
    if current_song.payload <> p_payload or current_song.deleted <> p_deleted then
      raise invalid_parameter_value using message = 'Mutation ID reused with different content';
    end if;
    return jsonb_build_object('applied', true, 'song', to_jsonb(current_song));
  end if;

  -- Independent PCs can make the same edit (or delete the same starter song).
  -- Identical content is already synchronized; no extra revision is necessary.
  if current_song.payload = p_payload and current_song.deleted = p_deleted then
    return jsonb_build_object('applied', true, 'song', to_jsonb(current_song));
  end if;

  if current_song.revision <> p_revision then
    return jsonb_build_object('applied', false, 'song', to_jsonb(current_song));
  end if;

  update public.nsc_songs set revision = revision + 1, mutation_id = p_mutation_id,
    deleted = p_deleted, payload = p_payload, updated_at = now()
    where library_id = p_library_id and id = p_id returning * into current_song;
  return jsonb_build_object('applied', true, 'song', to_jsonb(current_song));
end;
$$;

revoke all on function public.nsc_push_song(uuid, uuid, integer, uuid, boolean, jsonb) from public, anon;
grant execute on function public.nsc_push_song(uuid, uuid, integer, uuid, boolean, jsonb) to authenticated;

commit;
