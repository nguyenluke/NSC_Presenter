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

## Section shortcuts and custom text positions

Section shortcut badges follow the selected song's arrangement from left to right, including repeated sections. For `Intro → Verse → Chorus → Verse → Chorus`, the default keys are `1 → 2 → 3 → 4 → 5`. They cue the first slide of that section occurrence, so these keys differ from the individual slide card numbers. Additional section occurrences can still be clicked or reached with slide navigation. Number-row and numpad keys work for default section bindings.

Open **Keys → Customize shortcuts** to add/remove key combinations, then **Save shortcuts**. Duplicates and common reserved combinations are rejected. **Restore defaults** fills the editor with the standard bindings; Save keeps them. Typing, editing, and dialogs pause presentation shortcuts. Output-window **Esc** remains an emergency exit regardless of customized operator bindings. Keyboard settings are saved in `NSC_Data/keyboard-shortcuts.json` on this PC, outside the song sync and database backup.

Open **Text**, choose an audience screen (or all screens), then **Customize text position**. Drag the preview or use horizontal/vertical position, box width, alignment, and language spacing controls. **Apply layout** sends the draft to the chosen screen(s) and saves it in the local screen profile. Preview edits alone do not change live output. Custom layouts stay inside the canvas and below audience notices; narrow the text box to move it farther left or right. Check your longest lyrics in preview and adjust sizes/width as needed.

**Top**, **Center**, and **Bottom** remain immediate presets. A Theme also returns to its preset position. Previous custom settings are retained for later adjustments. Each audience screen may have a different layout; Stage retains its separate confidence-monitor layout. Custom screen settings travel in the SQLite backup but are not shared through song sync.

Run `npm run test:studio` for shortcut, persistence, section-order, actual rendering, and operator UI checks in isolated test data.

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

## Timer overtime, text styling, sermon documents, and logos (0.1.4)

Countdowns stay running after zero: **+00:01** means one second overtime. They turn amber in the final minute and red at zero and throughout overtime. The operator and Stage displays show **OVERTIME**. Pause freezes the current value; resetting or choosing a preset starts a fresh countdown. Ordinary elapsed timers remain green.

Open **Text** and choose the audience screen(s) to format. Basic size, color, language, and position controls stay visible. Open **Advanced text settings** to reveal each language’s font picker, custom installed-font name, bold, italic, horizontal stretch, and letter-spacing controls. Advanced settings start collapsed whenever the Text panel opens; hiding them preserves your saved styling. **Reset text to defaults** inside Advanced restores centered bilingual text, the default fonts, 64/42 px sizes, white/gold colors, and the default custom-position draft for the selected screen(s), without changing screen assignments. These settings save locally per screen. Install custom fonts on the computer running Presenter; unavailable fonts fall back to the system sans-serif. Applying a theme restores that theme's default typography.

Use **+ Import Media** in any media bin and select a PDF or PowerPoint file; it opens as a sermon deck in **Sermon & Events**. The picker includes documents by default, with a dedicated **Sermon Documents (PDF / PowerPoint)** filter. You can also open **Media → Sermon & Events → Import PDF / PowerPoint**. Choose a `.pdf`, `.ppt`, or `.pptx` file, up to 100 MB and 200 pages. PDF rendering works offline without Office. PowerPoint files first require Microsoft PowerPoint or LibreOffice installed on the PC; close PowerPoint before using native conversion. If conversion fails, export the presentation to PDF and import that PDF. Native PowerPoint automation could not be verified in this development environment because Windows denied COM activation; rehearse this path on your church PC or use the tested PDF path.

Documents import as ordered, static page images. Animations, embedded video, and slide transitions do not carry over. Importing or opening a deck does not change live output: click a page to project it, then use next/previous shortcuts to move through its pages. Section-number shortcuts are paused while viewing a document. Use **Back to songs** to return to song navigation. Stage displays the current sermon page. Deleting a document removes its whole deck and playlist references from the library, while keeping its image files on disk.

Imported page images live in your selected **Media Folder**, with document metadata in local SQLite. Copy that folder together with your database backup when moving computers. Sermon files, fonts, logos, and screen settings are not uploaded through song sync. Original PDF/PowerPoint files are left unchanged.

Audience logo replacement already existed. Import the redesigned image under **Media → Logos**, click its tile to choose it, then use **Logo** to display it. The chosen logo is now remembered across restarts and fitted without cropping. Importing a new logo selects it immediately; if Logo is already live, the output updates.

Developers: `npm run test:documents` checks offline PDF rendering, ordered page persistence, cancellation rollback, and database write failure recovery in an isolated Electron profile. The optional `NSC_TEST_POWERPOINT=1` environment variable also tests native PowerPoint conversion where automation is available.
