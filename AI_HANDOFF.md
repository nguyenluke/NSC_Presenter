# NSC Presenter — Complete AI Handoff & Context Document

> **How to use this file on another PC with any AI assistant (Antigravity, Cursor, Claude Code, Copilot, ChatGPT):**
> Clone or pull `https://github.com/nguyenluke/NSC_Presenter.git`, open the `NSC_Presenter` folder, and send this prompt to the AI:
>
> ```text
> Read AI_HANDOFF.md completely first. You are my Senior Software Engineer and coding assistant. Understand everything we already built, preserve the ProPresenter 7 UI/UX and architecture rules in AI_HANDOFF.md, and help me continue building and learning on NSC Presenter.
> ```

---

## 1. User Role, Learning Goal & Real-Life Church Context

- **The User & Your Role:**
  - The user is a **Worship Leader** at **NSC Church** and an **intermediate web developer with Java experience** who is learning desktop app development (**Electron + TypeScript + React**).
  - **Your Role as AI:** Act as both **Senior Software Engineer** and **hands-on assistant**. Make sure the app works reliably in real Sunday services, explain desktop/Electron concepts clearly (connecting TypeScript/IPC/DAO concepts to Web & Java where helpful), and explain new UI features simply so church volunteers/newbies can operate them easily.
- **Physical Church Venue Setup:**
  - Moving into a bigger sanctuary equipped with:
    1. **1x Large Center LED Screen**
    2. **2x Side Monitor TVs** (left & right audience views)
    3. **1x Back Stage / Confidence Monitor TV** (for worship leader, band, and pastor: current/next lyrics, chords, wall clock, countdown timer, private booth alerts)
    4. **1x Operator Booth PC** (Windows PC at church; user also codes/preps on macOS)
  - The app must dynamically detect **any number of physical screens** (`1` to `N` HDMI/DisplayPort outputs on the PC GPU) rather than hardcoding a fixed screen count.
- **Bilingual Worship Requirement:**
  - NSC Church worships in **2 languages simultaneously** (e.g., **Vietnamese** as Primary Language 1 + **English** as Secondary Language 2 on the same slide).
  - Every song slide and scripture slide natively pairs `primaryText` and `secondaryText` with independent font sizes, colors, and per-screen `both | primary | secondary` display modes.

---

## 2. Tech Stack & Build Commands

| Layer | Technology | Why Chosen / Notes |
| :--- | :--- | :--- |
| **Desktop Runtime** | **Electron `^33.2.0`** + **`electron-vite ^2.3.0`** | Multi-display GPU window management (`screen.getAllDisplays()`), frameless projector windows, custom media streaming protocol. |
| **Language** | **TypeScript `^5.6.3`** | Strict shared interfaces across `main`, `preload`, and `renderer`. |
| **UI & Styling** | **React `^18.3.1` + Tailwind CSS `^3.4.15` + `lucide-react`** | Modeled directly on Renewed Vision's official **ProPresenter 7** interface. |
| **State Management** | **Zustand `^5.0.1`** + **Electron IPC** | `<2ms` state synchronization across Operator window and all live Audience/Stage projector windows. |
| **Database** | **`sql.js ^1.12.0`** (WASM SQLite) | **Crucial Design Decision:** Saves a real SQLite binary file (`nsc_library.sqlite`) locally on disk with **zero native C++ `node-gyp` compilation**, so `npm install` works identically on Windows and macOS without Visual Studio C++ Build Tools! |
| **Packaging** | **`electron-builder ^25.1.8`** | Builds standalone Windows NSIS `.exe` (`npm run dist:win`) and macOS `.dmg` (`npm run dist:mac`). |

### Commands (Requires Node 20+, `.nvmrc` = `24.22.1`)
```bash
npm install          # Install all dependencies
npm run dev          # Launch NSC Presenter in hot-reload development mode
npm run typecheck    # Run TypeScript checks on both tsconfig.node.json and tsconfig.web.json
npm run build        # Compile production bundles into out/main, out/preload, out/renderer
npm run dist:win     # Package Windows .exe installer into dist/
npm run dist:mac     # Package macOS .dmg installer into dist/
```

---

## 3. Complete Architecture & File-by-File Map

```text
NSC_Presenter/
├── electron.vite.config.ts       # Vite config with @shared and @renderer path aliases
├── package.json                  # Scripts, dependencies, electron-builder config (bundles sql-wasm.wasm)
├── tailwind.config.js            # Tailwind v3 config
├── tsconfig.node.json            # Main + Preload TS config
├── tsconfig.web.json             # Renderer React TS config
└── src/
    ├── shared/
    │   └── types.ts              # Shared DTOs: Song, SongSection, BilingualSlide, MediaAsset,
    │                             # AudioTrack, ServiceItem, DisplayInfo, OutputProfile, LivePresentationState
    ├── main/
    │   ├── index.ts              # Electron entry, `nsc-media://` custom file streaming protocol,
    │   │                         # IPC handlers (`nsc:*`), live 1s countdown/elapsed timer, .sqlite backup/restore
    │   ├── database.ts           # PresenterDatabase (sql.js DAO) -> `<userData>/NSC_Data/nsc_library.sqlite`
    │   └── displayManager.ts     # DisplayRouter: GPU hot-plug detection, Identify Screen overlays,
    │                             # dynamic 1..N Audience/Stage BrowserWindows, Virtual vs Fullscreen, ESC safety exit
    ├── preload/
    │   ├── index.ts              # Secure contextBridge exposing `window.nscApi`
    │   └── index.d.ts            # Global `window.nscApi` TypeScript declaration
    └── renderer/
        ├── index.html            # Entry HTML
        └── src/
            ├── main.tsx          # React root
            ├── App.tsx           # Hash router (#operator, #output?profileId=..., #identify?num=...)
            ├── assets/
            │   └── studio.css    # Tailwind base, frameless drag regions, dark studio scrollbars
            ├── store/
            │   └── useStudioStore.ts # Zustand store + `flattenSongSlides()` arrangement engine
            ├── components/
            │   ├── outputs/
            │   │   ├── AudienceCanvas.tsx      # 1920x1080 4-layer compositor (Bg, Scrim/Graphic, Bilingual Text, Notice, Logo/Blackout)
            │   │   ├── StageMonitorCanvas.tsx  # 1920x1080 Back Stage TV (Clock, Timer, Key, Chords, Current/Next Slide, Stage Alert)
            │   │   └── ScaledMonitorFrame.tsx  # ResizeObserver scaler -> 100% WYSIWYG in mini preview & fullscreen TVs
            │   └── studio/
            │       ├── SongEditorView.tsx      # ProPresenter "Edit" mode (16:9 live preview, side-by-side bilingual inputs, Quick Paste)
            │       ├── ReflowEditorView.tsx    # ProPresenter "Reflow" mode (continuous text blocks + Insert Slide Break + live cards)
            │       ├── BibleView.tsx           # ProPresenter "Bible" mode (bilingual scripture search + spontaneous sermon verse projector)
            │       ├── AudioBinDrawer.tsx      # ProPresenter "Audio Bin" (WebAudio C–B Worship Prayer Pads + MP3/WAV player w/ smooth fade)
            │       ├── DisplayMatrixModal.tsx  # ProPresenter "Configure Screens" (visual monitor map, +Add/Delete 1..N Audience/Stage screens)
            │       └── QuickSearchModal.tsx    # Cmd/Ctrl+F fast song/lyric search & playlist adder
            └── views/
                ├── OperatorStudioView.tsx      # Official ProPresenter 7 5-zone main workspace
                └── OutputWindowView.tsx        # Standalone projector window & Screen Identification badge renderer
```

---

## 4. Features Already Built & Working

1. **Authentic ProPresenter 7 UI Layout (`OperatorStudioView.tsx`):**
   - **Zone 1 (Top Toolbar):** Icon-over-label `Search` (`Cmd/Ctrl+F`), `Text` (quick size/language popover), `Theme` (4 instant bilingual looks), `New Song` | centered segmented bar `Show | Edit | Reflow | Bible | Screens (N)` | `Media` toggle + stacked `Audience ●` & `Stage ●` master output switches.
   - **Zone 2 (Left Sidebar):** `Libraries` (filterable bilingual song catalog) on top + `Playlists` (Sunday Service order with `↑/↓` reordering and `×` remove) on bottom.
   - **Zone 3 (Center Canvas):** Song header with clickable colored Section Arrangement pills (`Keys 1–9`), true `16:9` WYSIWYG slide cards with ProPresenter's bottom colored label bars (Blue = Verse, Red/Coral = Chorus, Purple = Bridge, Green = Pre-Chorus) and glowing Orange (`#ff6b00`) active slide ring, Grid/List view toggle, and thumbnail Zoom slider.
   - **Zone 4 (Bottom Media Bin):** ProPresenter-style left folder column (`Worship Designs`, `Motion Loops`, `Sermon & Events`, `Logos`) + `+ Import Media` (copies local `.png`, `.jpg`, `.webp`, `.gif`, `.mp4`, `.webm`, `.mov` into `<userData>/NSC_Data/media/` and streams via `nsc-media://`).
   - **Zone 5 (Right Quadrant):**
     - **Upper Right:** Dynamic `16:9` Live Preview Monitor (switches across all configured Audience/Stage screens) + ProPresenter's **Vertical Clear Layer Column** on its right edge (`Clear All`, `Slide`, `Media`, `Logo`, `Black`) that lights up per active layer.
     - **Lower Right:** ProPresenter 7.5+ **Show Controls** drawer + far-right vertical icon rail (`Audio`, `Timers`, `Msgs`, `Screens`, `Keys`).
2. **Real-Life Dynamic Multi-Screen Engine (`displayManager.ts` + `DisplayMatrixModal.tsx`):**
   - Auto-detects plugged/unplugged HDMI/DisplayPort screens in real time and shows a green plug-and-play banner when a new TV/monitor is connected.
   - Users can create, rename, and delete **any number** of `audience` and `stage` screen profiles (`1` screen, `2` screens, `4` screens, `6+` screens).
   - Supports **Virtual Floating Window** mode (for testing multiple screens on 1 laptop) and **Real Fullscreen Borderless** mode mapped to any physical `display.id`.
   - **Emergency Safety Feature:** Pressing **`ESC`** while any output window is focused closes that output window and marks its profile `enabled: false`, preventing accidental lockout if Fullscreen is assigned to the primary desk screen.
3. **Bilingual Song Architecture (`database.ts` + `useStudioStore.ts`):**
   - Stores reusable `sections[]` + `arrangement[]` (e.g., `['v1', 'c1', 'v2', 'c1', 'b1', 'c1']`) so Choruses are never duplicated—editing Chorus once updates every Chorus in the song.
   - Pre-seeded with bilingual Vietnamese + English worship songs (*Đấng Mở Đường / Way Maker*, *Sự Tốt Lành Của Chúa / Goodness of God*) and worship atmosphere gradients.
4. **Worship Audio Bin, Bilingual Bible & Dual Messaging:**
   - **Built-in WebAudio Worship Prayer Pads** in keys `C, D, E, F, G, A, B` with smooth 2.2s analog-filtered fade-in/fade-out, plus `.mp3/.wav/.m4a` track import & fade-out.
   - **Dual Messages:** Private `stageAlert` (flashes on Stage screens only) + `audienceMessage` (top announcement/childcare banner on Audience screens without stopping lyrics).
   - **Portable `.sqlite` Backup Export & Restore** in `Configure Screens` for moving setups between home and church PCs.

---

## 5. Technical Guardrails (Important Rules for Next AI)

1. **Tailwind v3 Only:** This repo uses Tailwind CSS `v3.4.15`. Do **not** use Tailwind v4-only class names (like `rounded-xs` or `backdrop-blur-xs`; use `rounded-sm`, `backdrop-blur-sm`, or explicit bracket values like `ring-[3px]`).
2. **Zero Native C++ Node Addons:** Keep `sql.js` (or pure JS/WASM packages) so cloning and running on Windows church PCs never fails on missing Python / Visual Studio C++ build tools.
3. **Local Media Security:** Always serve local disk assets (images, videos, audio) through the registered `nsc-media://asset/<filename>` protocol in `src/main/index.ts`—never raw `file://` URLs inside React, which Chromium blocks when running on Vite's `http://localhost` dev server.
4. **Verify Every Change:** Always run `npm run typecheck && npm run build` before finishing any task.

---

## 6. Recommended Next Roadmap Milestones

When the user asks what to build or improve next, here are the highest-value next upgrades:
1. **Custom Non-16:9 LED Wall Resolution Support:** Add custom `canvasWidth` & `canvasHeight` (e.g., ultra-wide LED wall pixel dimensions like `2560×960` or `1920×720`) per `OutputProfile` in `DisplayMatrixModal.tsx` and `ScaledMonitorFrame.tsx` while keeping Side TVs at `1920×1080`.
2. **Full Offline 66-Book Bilingual Bible Importer:** Allow importing complete Vietnamese (VI1934 / NVB) + English (ESV / KJV / NIV) JSON/SQLite Bible files into `BibleView.tsx` with instant `Book Chapter:Verse` autocomplete (e.g., typing `Giăng 3:16` or `Jn 3:16-18`).
3. **Seamless Dual-Video Crossfade Engine:** Upgrade `AudienceCanvas.tsx` to use two alternating `<video>` buffers (`videoA` / `videoB`) so switching from one `.mp4` motion loop to another crossfades smoothly over 500ms with zero black flash.
4. **All-in-One `.nscbundle` Service Exporter:** Zip `nsc_library.sqlite` **plus** all referenced `.mp4`/`.png`/`.mp3` files in `NSC_Data/media/` into one `.zip` bundle so media files travel alongside songs from home laptop to church PC.
5. **Bulk Song Importer:** Import existing `.txt`, ChordPro (`.cho`), OpenLyrics `.xml`, or PowerPoint `.pptx` slide text directly into bilingual `Song` records.
6. **GitHub Actions Auto-Installer Pipeline:** Add `.github/workflows/build.yml` to automatically compile and publish Windows `.exe` and macOS `.dmg` installers on GitHub Releases.
