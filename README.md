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

## Shared songs with Supabase PostgreSQL

The cloud icon beside **Worship Songs** opens the shared-library panel. It supports manual song sync, offline edits, safe retries, and conflict choices. SQLite still serves presentation locally; media and playlists remain on this PC.

Follow [the setup guide](docs/SHARED_LIBRARY.md) to create a free Supabase project, run the SQL migration, create a member account, and connect both PCs. Never put database passwords or service-role keys into the app.

Run `npm run test:sync` for PostgreSQL/RLS and offline-sync integration tests, then `npm run typecheck` and `npm run build`.
