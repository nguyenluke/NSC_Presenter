# NSC Presenter: Supabase PostgreSQL shared songs

This integration adds a shared song library without changing the ProPresenter-style workspace. SQLite remains the local database for presentation and offline editing. PostgreSQL stores the shared copy of songs.

## What is included

- Bilingual songs, reusable sections, chords, keys, BPM, and arrangements synchronize manually.
- Existing songs are preserved and assigned stable shared IDs. Local numeric IDs remain unchanged, preserving playlist references.
- Local edits and deletion records survive app restarts. Upload retries are idempotent.
- Concurrent edits require a choice between this PC's version and the shared version. Neither silently overwrites the other.
- Project credentials are limited to a public publishable/anon key. Passwords and login tokens are never written to disk.
- Library membership is enforced by PostgreSQL row-level security and the write function.

Playlists, screen assignments, images, videos, and audio remain local in this version. It does not upload media files or automatically synchronize while you present. Each authorized member can edit all songs in their library.

## 1. Create your free project

1. Create an account at https://supabase.com and create a **Free** project.
2. Choose a region near the church and save the database password securely. Do not paste that password into NSC Presenter.
3. Wait for the project to finish provisioning.

The Free plan currently includes a 500 MB PostgreSQL database and 1 GB of separate file storage. It is not a timed trial. Free projects can pause after one week of inactivity, and automatic database backups are not included. Provider limits can change: https://supabase.com/pricing. Your prepared local songs remain available even when Supabase is unreachable.

## 2. Create the schema

Open **SQL Editor** in the Supabase dashboard. Paste and run the complete contents of:

```text
supabase/migrations/001_shared_song_library.sql
```

The script creates three tables, read policies, and the `nsc_push_song` write function. It can be run again safely. It does not delete existing songs. Do not disable RLS or grant desktop users direct table writes.

## 3. Create your account and church library

1. In **Authentication → Users**, create your email/password user. Use a confirmed account; if you invite a user instead, complete the invitation and password setup first.
2. Copy that user's UUID from the user record.
3. Run this in SQL Editor once:

```sql
insert into public.nsc_libraries (name)
values ('NSC Church')
returning id;
```

4. Copy the returned library UUID. Add your user as a member, replacing both placeholders with the real UUIDs:

```sql
insert into public.nsc_library_members (library_id, user_id)
values ('YOUR_LIBRARY_UUID'::uuid, 'YOUR_AUTH_USER_UUID'::uuid)
on conflict do nothing;
```

Use the **same library UUID** on your home and church PCs. To add another volunteer, create their Auth user and insert another membership row. Membership changes belong in SQL Editor; the app cannot grant itself access.

## 4. Connect NSC Presenter

1. Start the app with `npm run dev`, or use a newly built installer containing this change.
2. In the left sidebar, next to **Worship Songs**, click the blue **cloud** icon.
3. Enter the Supabase **project URL**, such as `https://your-project.supabase.co`.
4. From the project's API keys settings, copy the **publishable key** (`sb_publishable_...`). A legacy **anon** key also works. Never use a secret key, service-role key, or PostgreSQL connection string.
5. Paste the library UUID and choose **Save connection**.
6. Sign in with your Auth user's email and password.
7. Choose **Sync songs**. Pending local songs upload, and shared songs download.

The app saves the URL, public key, and library ID in `<userData>/NSC_Data/shared-library.json`. Login is memory-only, so you sign in again after restarting. Closing the panel does not sign out. Reopening it shows the current session and pending-change count.

On the second PC, repeat these steps with the same project and library ID. Use a member account. Songs independently created before syncing retain separate IDs even if their titles match. The two bundled starter examples use shared IDs across installations, so different edits to those examples may show a conflict rather than create duplicates.

After its first authorized sync, a local library stays bound to that project/library identity to prevent accidentally uploading one church's songs into another library. Restoring a backup from a different shared library requires its original connection settings.

## 5. Sunday workflow

1. At home, edit songs, open Shared Song Library, and sync.
2. At church, sync before rehearsal. Review song content and the local service playlist.
3. Make sure all media needed for the service has been imported onto that PC.
4. Run the service from local data. Slide changes never wait for a cloud request.
5. After any church edits, sync again to share them with home.

### Temporary service changes

- In Edit or Reflow, choose **Use Temporarily** to use a different key, lyrics, chords, or arrangement for this session. These edits stay in memory and are excluded from the local database, backups, and cloud uploads.
- Show mode displays a temporary-edits banner for that song. **Don't Save** restores its saved version, including the Stage key. Closing or reloading the app also discards temporary edits.
- **Save Song** keeps the current version in the local database and queues it for the next manual sync. New songs must be saved before they can use temporary edits.
- Discarding temporary edits leaves any previously saved pending changes intact. If there were no pending changes before editing, temporary edits and discarding them keep the pending count at zero. Saving an unchanged song does not create a new pending change.
- Sync continues to exchange saved versions while temporary edits are active. Discard restores the latest saved version if a sync downloaded an update during the session.

For a conflict, review both song payloads. **Keep this PC's version** stages it for the next upload. **Use shared version** replaces the pending local edit. Deletions are explicitly labeled. If the shared song changed again while you reviewed it, sync again before choosing. The currently projected slide stays as its live snapshot during song downloads; cue a slide to project updated content.

## Backups and recovery

- Existing SQLite libraries get a one-time `nsc_library.sqlite.before-sync.bak` copy before their first schema upgrade.
- Continue using the existing SQLite backup export. Current exports include songs and sync IDs, pending changes, and library identity. They do not include media files or login credentials.
- Copy the media folder separately when moving the complete setup. A database reference alone does not transfer a video or audio file.
- Prefer recent backups made after this upgrade. Old backups made before shared IDs existed import as independent songs and may create duplicates when synced.
- Do not delete shared song rows manually: soft-deletion records are needed by PCs that have been offline.
- An interrupted sync may have uploaded some songs. Retry; acknowledged changes stay saved and a repeated upload does not create a second revision.
- If access is denied, check Auth account confirmation and the membership row. An incorrect project/library ID can also produce an empty library or denied write.
- If a Free project is paused, resume it in Supabase's dashboard, then retry. Local presentation remains available.

## Development and verification

```bash
npm install
npm run test:sync
node --test tests/temporary-song-edits.test.cjs
npm run typecheck
npm run build
```

`test:sync` uses a development-only PostgreSQL WASM runtime (PGlite), real SQL/RLS policies, and isolated temporary SQLite files. Its HTTP fixture exercises the same main-process synchronization client without contacting Supabase. No native C++ build tools are required. A live-project smoke test is still needed after entering your project settings.

The layers are `React panel → preload IPC → SongLibrarySync → Supabase API → PostgreSQL`. `PresenterDatabase` remains the local DAO. The database's revision field is an optimistic-lock version: a write succeeds only when its base revision matches, similar to a Java persistence entity's version field. A mutation UUID makes retries safe after a lost network response.
