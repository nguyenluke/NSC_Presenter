# NSC Presenter Studio

A custom, offline-first **Bilingual Multi-Screen Worship & Live Visual Desktop App** built with **Electron + React + TypeScript + Tailwind CSS + SQLite**, designed in the dark tactile studio style of **ProPresenter 7** and **Resolume Arena**.

## Quick Start (Development)

Make sure you are using **Node 20+** (you have Node `24.22.1` installed via `nvm`):

```bash
cd /Users/nguyentran/Working/Coding/NSC_Presenter
nvm use 24.22.1
npm install
npm run dev
```

## Building Standalone Installers

For installation, transferring songs/media, and setting up the church screens, follow [the deployment guide](docs/DEPLOYMENT.md).

- **Windows Church PC (`.exe` installer):**
  ```bash
  npm run dist:win
  ```
- **macOS (`.dmg` installer):**
  ```bash
  npm run dist:mac
  ```

## Booth Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` / `Right Arrow` | Next bilingual slide |
| `Left Arrow` | Previous slide |
| `1` – `9` | Jump immediately to Song Section `1`–`9` in the arrangement |
| `F1` / `Esc` | **Clear Text** (keeps visual design / motion loop playing!) |
| `F2` | **Clear Background** |
| `F3` | **Logo Override** (shows Church Welcome graphic) |
| `F4` | **Master Blackout** |

## Senior SE Codebase Map

- `src/shared/types.ts` — Shared TypeScript interfaces (like Java DTOs/POJOs) shared across backend & UI.
- `src/main/database.ts` — Offline SQLite engine (`nsc_library.sqlite`) storing bilingual songs, visual media assets, Sunday setlists, and GPU output profiles.
- `src/main/displayManager.ts` — Dynamic GPU Multi-Screen Router (`screen.getAllDisplays()`, hot-plug detection, Display Identifier badges, Virtual vs. Fullscreen projector windows).
- `src/main/index.ts` — Electron Main Process, custom `nsc-media://` local visual streaming protocol, and IPC handlers.
- `src/preload/index.ts` — Secure `window.nscApi` bridge between Main and React windows.
- `src/renderer/src/components/outputs/` — 1920×1080 4-Layer Audience Compositor (`AudienceCanvas.tsx`), Back Stage Confidence Monitor (`StageMonitorCanvas.tsx`), and WYSIWYG Scaler (`ScaledMonitorFrame.tsx`).
- `src/renderer/src/views/OperatorStudioView.tsx` — Dark Studio Operator Booth Control Center.

## Choose where imported media is stored

In the Media Bin, click **Media Folder** below **+ Import Media**, then **Choose Media Folder**. Choose a dedicated folder on your preferred drive. The app copies existing library images, videos, and audio into it, remembers it on this PC, and uses it for future imports. Original files stay intact. A conflicting filename stops the change instead of overwriting anything.

Songs and the SQLite database remain in their current location; built-in generated pads need no files. The folder setting is local to each PC and is not included in song sync or database backups. If using an external drive, keep it connected. To recover after a drive disconnect, reconnect it or choose a folder containing the same media files. When transferring to another PC, copy the media folder separately from the database backup, then select it in **Media Folder**.

Run `node --test tests/media-storage.test.cjs` to verify copying, collisions, failure recovery, and saved folder settings.

## Worship pad sounds

Open **Audio**, choose **Pad sound**, then click one of the 12 keys. Five original, offline synthesized sounds are included:

- **Warm Sanctuary:** warm analog layers for full-band worship.
- **Still Waters:** soft, rounded tones for quiet prayer.
- **Open Sky:** airy layers and a spacious upper glow.
- **Radiant Shimmer:** bright, slowly moving octave layers.
- **Deep Prayer:** dark, low tones beneath speaking or prayer.

Switching sounds or keys crossfades over 2.8 seconds. Click the playing key or **Fade Out** to stop; the reverb tail decays naturally. Root/fifth/octave voicings work under major or minor songs. Sharp/flat labels share the same pitch. Volume includes zero for mute. Leaving the Audio drawer fades the pad out.

These are original sounds inspired by spacious ambient worship pads, not recordings from Atmosphere V3. No downloads, database storage, or network access are needed for built-in pads. Imported MP3/WAV playback remains separate.

Run `npm run test:pads` to render the real Web Audio engine offline in an isolated hidden Electron window and check levels, stereo, fades, and rapid crossfades without playing through speakers.

## Shared songs with Supabase PostgreSQL

The cloud icon beside **Worship Songs** opens the shared-library panel. It supports manual song sync, offline edits, safe retries, and conflict choices. SQLite still serves presentation locally; media and playlists remain on this PC.

Follow [the setup guide](docs/SHARED_LIBRARY.md) to create a free Supabase project, run the SQL migration, create a member account, and connect both PCs. Never put database passwords or service-role keys into the app.

Run `npm run test:sync` for PostgreSQL/RLS and offline-sync integration tests, then `npm run typecheck` and `npm run build`.
