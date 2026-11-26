# Install NSC Presenter on the church PC

NSC Presenter is a desktop application. Copy its standalone Windows build to the PC that runs the screens. You do not need web hosting, Node.js, VS Code, or a terminal on that PC. Supabase remains the shared song library; the service itself runs from local data.

## Run the standalone Windows ZIP

The initial deliverable is **NSC-Presenter-0.1.3-Windows-x64.zip**, for 64-bit Windows. It includes Electron, the app, SQLite/WASM, and the NSC icon.

1. Right-click the ZIP and choose **Extract All**.
2. Put the entire extracted folder somewhere permanent, such as `D:\NSC Presenter`.
3. Open **NSC Presenter.exe** inside that folder. Keep its DLLs and `resources` folder beside it; do not copy only the EXE or run it from inside the ZIP.
4. Optionally create a desktop shortcut to that EXE.

This opens the packaged app directly without `npm run dev`. Application files and your library/media are separate: replacing the extracted app folder for an update does not transfer or erase the library data in AppData.

This build is unsigned: no publisher signing certificate was configured. Windows may show an unknown-publisher or reputation warning. Code signing is a separate release step; see [electron-builder's Windows signing documentation](https://www.electron.build/code-signing-win.html). Use your own build or a trusted church distribution source. This preparation did not install the app or change Windows security settings.

The app does not automatically copy your prepared songs, playlists, media, or login session to a second PC.

## Optional installer

The NSIS installer is configured with the same icon, an install-location picker, desktop/Start Menu shortcuts, and retained app data on uninstall. However, this build environment could not run its `makensis.exe` compiler because Windows reported **Illegal System DLL Relocation**, so no completed Setup EXE is included in this delivery. The standalone ZIP is the available deployment option. A normal development terminal can attempt `npm run dist:win`; a successful installer will be `dist\NSC-Presenter-Setup-0.1.3-x64.exe`.

## Transfer your prepared library

1. On the preparation PC, use **Screens → Export Library Backup** to create a fresh `.sqlite` backup. Temporary song edits are excluded; save any edits you intend to transfer first.
2. Copy the app ZIP, that backup, and your current media folder to the church PC. Keep the media filenames unchanged. Find the current folder through **Media Bin → Media Folder**.
3. Extract and open NSC Presenter on the church PC. Use **Screens → Restore Library Backup** to load the backup. This transfers songs, playlists, and saved output profiles; recheck all output assignments for the church hardware.
4. Open **Media Bin → Media Folder → Choose Media Folder** and select the folder you copied. If all referenced media are already there, the app reuses them. Videos, pictures, and audio are not contained in the database backup.
5. For future song sharing, open the blue cloud beside **Worship Songs**. Enter the same Supabase project URL, public publishable/anon key, and library ID. Sign in with a library member account. Review pending saved changes before choosing **Sync songs**. Follow [SHARED_LIBRARY.md](SHARED_LIBRARY.md) for account and membership setup. Passwords and sessions are not transferred or stored.

Each PC remembers its own media folder choice. The database and media folder remain separate from the installed program. Song sync does not transfer playlists, media, or screen settings.

## Set up the sanctuary

1. Connect the audience displays and Stage TV. In Windows display settings, use **Extend** so the operator, audience, and Stage outputs can show different content.
2. In **Screens**, choose **Identify Physical Screens**. Assign each Audience/Stage profile to the correct connected monitor. Select **Real Fullscreen TV / LED Projector**, then enable the required profiles. Screen profiles are local to this PC; home monitor assignments may not match.
3. Select the church's audio interface/output in Windows sound settings. Test a pad at a low volume, then set the working level. Generated pads and imported audio play through the PC audio output.
4. Check bilingual text, each audience output, Stage current/next lyrics and keys, private messages, videos, pad sound/key changes, and slide navigation during rehearsal.
5. Sync saved songs before service, then verify you can run the prepared service without internet. Keep a fresh database backup and a separate copy of media files. Pressing **Esc** in an output window closes it and saves that output as OFF.

The standalone app has been built and its packaged resources checked. A full rehearsal on the church PC with its actual screens and sound system is still required before Sunday use.

## Build an update

On the development PC, update the app version in `package.json`, then run:

```powershell
npm run typecheck
npm run dist:win:zip
```

The ZIP appears in `dist`. Close the running app before replacing its program folder, use the same Windows account, and keep the same app ID/name so existing local data remains available. Automatic updates are not configured. Export a current database backup and preserve your media folder before updating. For an installer build instead, use `npm run dist:win`.

The app icon assets are in `build/`. Version 0.1.3 uses the hand-only logo centered inside a white rounded square with transparent outer corners and no lettering, with dedicated icon sizes from 16 to 256 px in `icon.ico` and a 512 px `icon.png`. The startup window is 1700 by 1000 px. Countdown presets offer every 5 minutes from 5 through 60 minutes.
