import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import {
  AudioCategory,
  AudioTrack,
  InitialBootstrapPayload,
  LivePresentationState,
  MediaAsset,
  MediaBin,
  OutputProfile,
  SongInput
} from '@shared/types'
import { PresenterDatabase } from './database'
import { DisplayRouter } from './displayManager'
import { SongLibrarySync } from './songSync'
import { LibraryConfig } from '../shared/songSync'
import { MediaStorage, mediaFileName } from './mediaStorage'
import { getAppIconPath } from './appIcon'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'nsc-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

let operatorWindow: BrowserWindow | null = null
let db: PresenterDatabase
let songLibrary: SongLibrarySync
let displayRouter: DisplayRouter
let timerInterval: NodeJS.Timeout | null = null
let mediaStorage: MediaStorage
let choosingMediaFolder = false

let liveState: LivePresentationState = {
  activeSongId: null,
  activeSongTitle: '',
  activeSongKey: '',
  activeSlideGlobalIndex: -1,
  currentSlide: null,
  nextSlide: null,
  activeBackground: null,
  foregroundMedia: null,
  clearText: false,
  clearBackground: false,
  blackout: false,
  showLogo: false,
  logoMedia: null,
  audienceMessage: '',
  stageAlert: '',
  stageShowChords: true,
  timerRunning: false,
  timerSeconds: 300,
  timerMode: 'countdown'
}

function getMediaDirectory(): string {
  return mediaStorage.getDirectory()
}

function createOperatorWindow(): void {
  const preloadPath = path.join(__dirname, '../preload/index.js')
  const isMac = process.platform === 'darwin'

  operatorWindow = new BrowserWindow({
    title: 'NSC Presenter',
    icon: getAppIconPath(),
    width: 1700,
    height: 1000,
    minWidth: 1120,
    minHeight: 700,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 14, y: 18 } : undefined,
    backgroundColor: '#1e1f22',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  operatorWindow.on('ready-to-show', () => {
    operatorWindow?.show()
  })

  operatorWindow.on('closed', () => {
    operatorWindow = null
    displayRouter?.closeAllOutputs()
    app.quit()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    operatorWindow.loadURL(`${devUrl}#operator`)
  } else {
    operatorWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'operator' })
  }
}

function startLiveTimerLoop(): void {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (!liveState.timerRunning) return
    if (liveState.timerMode === 'countdown') {
      if (liveState.timerSeconds > 0) {
        liveState = { ...liveState, timerSeconds: liveState.timerSeconds - 1 }
      } else {
        liveState = { ...liveState, timerRunning: false }
      }
    } else {
      liveState = { ...liveState, timerSeconds: liveState.timerSeconds + 1 }
    }
    displayRouter.broadcast(liveState, db.getOutputProfiles(), operatorWindow)
  }, 1000)
}

function registerIpcHandlers(): void {
  const requireOperator = (event: Electron.IpcMainInvokeEvent): void => {
    if (!operatorWindow || event.sender !== operatorWindow.webContents ||
        event.senderFrame !== operatorWindow.webContents.mainFrame) {
      throw new Error('Only the operator window can manage the shared library.')
    }
  }
  const libraryPayload = () => ({ songs: db.getAllSongs(), serviceItems: db.getServiceItems(), status: songLibrary.status() })
  ipcMain.handle('nsc:media-storage-status', (event) => {
    requireOperator(event)
    return mediaStorage.getStatus()
  })
  ipcMain.handle('nsc:choose-media-folder', async (event) => {
    requireOperator(event)
    if (choosingMediaFolder || mediaStorage.busy) throw new Error('A media folder change is already in progress.')
    choosingMediaFolder = true
    try {
      const result = await dialog.showOpenDialog(operatorWindow!, {
        title: 'Choose a Folder for NSC Images, Videos and Audio',
        defaultPath: getMediaDirectory(),
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled || !result.filePaths[0]) return null
      const names = [...db.getMediaAssets(), ...db.getAudioTracks()]
        .map((asset) => mediaFileName(asset.url)).filter((name): name is string => name !== null)
      return await mediaStorage.changeDirectory(result.filePaths[0], names)
    } finally { choosingMediaFolder = false }
  })
  ipcMain.handle('nsc:library-status', (event) => { requireOperator(event); return songLibrary.status() })
  ipcMain.handle('nsc:library-configure', async (event, config: LibraryConfig) => {
    requireOperator(event)
    await songLibrary.configure(config)
    return songLibrary.status()
  })
  ipcMain.handle('nsc:library-sign-in', async (event, email: string, password: string) => {
    requireOperator(event)
    if (typeof email !== 'string' || typeof password !== 'string') throw new Error('Invalid sign-in details.')
    await songLibrary.signIn(email, password)
    return songLibrary.status()
  })
  ipcMain.handle('nsc:library-sign-out', async (event) => {
    requireOperator(event)
    await songLibrary.signOut()
    return songLibrary.status()
  })
  ipcMain.handle('nsc:library-sync', async (event) => {
    requireOperator(event)
    const result = await songLibrary.synchronize()
    return { ...libraryPayload(), result }
  })
  ipcMain.handle('nsc:library-resolve', async (event, sharedId: string, choice: 'local' | 'shared', revision: number) => {
    requireOperator(event)
    await songLibrary.resolve(sharedId, choice, revision)
    return libraryPayload()
  })

  ipcMain.handle('nsc:bootstrap', (): InitialBootstrapPayload => {
    const mediaAssets = db.getMediaAssets()
    if (!liveState.activeBackground && mediaAssets.length > 0) {
      liveState.activeBackground =
        mediaAssets.find((m) => m.bin === 'Worship Designs') || mediaAssets[0]
    }
    if (!liveState.logoMedia) {
      liveState.logoMedia = mediaAssets.find((m) => m.bin === 'Logos') || null
    }
    return {
      songs: db.getAllSongs(),
      mediaAssets,
      audioTracks: db.getAudioTracks(),
      serviceItems: db.getServiceItems(),
      outputProfiles: db.getOutputProfiles(),
      displays: displayRouter.getDisplays(),
      liveState,
      storagePath: db.getStorageDirectory()
    }
  })

  ipcMain.handle('nsc:update-live-state', (_e, partial: Partial<LivePresentationState>) => {
    liveState = { ...liveState, ...partial }
    displayRouter.broadcast(liveState, db.getOutputProfiles(), operatorWindow)
    return liveState
  })

  ipcMain.handle('nsc:save-song', (_e, input: SongInput) => {
    db.saveSong(input)
    return db.getAllSongs()
  })

  ipcMain.handle('nsc:delete-song', (_e, id: number) => {
    db.deleteSong(id)
    return {
      songs: db.getAllSongs(),
      serviceItems: db.getServiceItems()
    }
  })

  ipcMain.handle('nsc:add-service-item', (_e, payload: { itemType: 'song' | 'media'; targetId: number }) => {
    return db.addServiceItem(payload.itemType, payload.targetId)
  })

  ipcMain.handle('nsc:remove-service-item', (_e, id: number) => {
    return db.removeServiceItem(id)
  })

  ipcMain.handle('nsc:reorder-service-items', (_e, orderedIds: number[]) => {
    return db.reorderServiceItems(orderedIds)
  })

  // Import Visual Images & Looping Videos
  ipcMain.handle('nsc:import-visual-media', async (_e, targetBin: MediaBin): Promise<MediaAsset[]> => {
    if (!operatorWindow) return db.getMediaAssets()
    const result = await dialog.showOpenDialog(operatorWindow, {
      title: `Import Visuals into "${targetBin}"`,
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Visual Images & Motion Videos',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov']
        }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return db.getMediaAssets()
    }

    const mediaDir = mediaStorage.getImportDirectory()
    const videoExts = new Set(['.mp4', '.webm', '.mov'])

    for (const srcPath of result.filePaths) {
      const ext = path.extname(srcPath).toLowerCase()
      const baseName = path.basename(srcPath, ext)
      const safeFileName = `${Date.now()}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`
      fs.copyFileSync(srcPath, path.join(mediaDir, safeFileName))

      const created = db.addMediaAsset({
        title: baseName,
        bin: targetBin,
        mediaType: videoExts.has(ext) ? 'video' : 'image',
        url: `nsc-media://asset/${encodeURIComponent(safeFileName)}`,
        fitMode: 'cover'
      })

      if (targetBin === 'Logos') {
        liveState.logoMedia = created
      }
    }

    return db.getMediaAssets()
  })

  ipcMain.handle('nsc:delete-media', (_e, id: number) => {
    db.deleteMediaAsset(id)
    return db.getMediaAssets()
  })

  // Import Audio Tracks (Worship Prayer Pads & Walk-In Music)
  ipcMain.handle('nsc:import-audio-tracks', async (_e, category: AudioCategory): Promise<AudioTrack[]> => {
    if (!operatorWindow) return db.getAudioTracks()
    const result = await dialog.showOpenDialog(operatorWindow, {
      title: `Import Audio into "${category}"`,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'aac'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return db.getAudioTracks()
    }

    const mediaDir = mediaStorage.getImportDirectory()
    for (const srcPath of result.filePaths) {
      const ext = path.extname(srcPath).toLowerCase()
      const baseName = path.basename(srcPath, ext)
      const safeFileName = `audio_${Date.now()}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`
      fs.copyFileSync(srcPath, path.join(mediaDir, safeFileName))

      db.addAudioTrack({
        title: baseName,
        category,
        url: `nsc-media://asset/${encodeURIComponent(safeFileName)}`
      })
    }

    return db.getAudioTracks()
  })

  ipcMain.handle('nsc:delete-audio-track', (_e, id: number) => {
    db.deleteAudioTrack(id)
    return db.getAudioTracks()
  })

  // Dynamic Multi-Screen Routing (Add, Edit, Remove 1..N Screens)
  ipcMain.handle('nsc:get-displays', () => {
    return displayRouter.getDisplays()
  })

  ipcMain.handle('nsc:identify-displays', () => {
    displayRouter.identifyAllDisplays()
  })

  ipcMain.handle('nsc:save-output-profile', (_e, profile: OutputProfile) => {
    const updatedProfiles = db.saveOutputProfile(profile)
    displayRouter.syncOutputWindows(updatedProfiles, liveState, operatorWindow)
    return updatedProfiles
  })

  ipcMain.handle('nsc:delete-output-profile', (_e, id: string) => {
    const updatedProfiles = db.deleteOutputProfile(id)
    displayRouter.syncOutputWindows(updatedProfiles, liveState, operatorWindow)
    return updatedProfiles
  })

  // Portable Church Backup & Restore (.sqlite file to bring from home Mac to church PC!)
  ipcMain.handle('nsc:export-backup', async (): Promise<boolean> => {
    if (!operatorWindow) return false
    const res = await dialog.showSaveDialog(operatorWindow, {
      title: 'Export NSC Presenter Library Backup',
      defaultPath: `NSC_Church_Backup_${new Date().toISOString().slice(0, 10)}.sqlite`,
      filters: [{ name: 'NSC Presenter SQLite Library', extensions: ['sqlite'] }]
    })
    if (res.canceled || !res.filePath) return false
    fs.copyFileSync(db.getDatabaseFilePath(), res.filePath)
    return true
  })

  ipcMain.handle('nsc:import-backup', async (): Promise<InitialBootstrapPayload | null> => {
    if (!operatorWindow) return null
    if (songLibrary.status().busy) throw new Error('Wait for library synchronization to finish before restoring a backup.')
    const res = await dialog.showOpenDialog(operatorWindow, {
      title: 'Import NSC Presenter Library Backup',
      properties: ['openFile'],
      filters: [{ name: 'NSC Presenter SQLite Library', extensions: ['sqlite', 'db'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    if (songLibrary.status().busy) throw new Error('Wait for library synchronization to finish before restoring a backup.')
    fs.copyFileSync(res.filePaths[0], db.getDatabaseFilePath())
    db.loadFromDisk()
    displayRouter.syncOutputWindows(db.getOutputProfiles(), liveState, operatorWindow)
    return {
      songs: db.getAllSongs(),
      mediaAssets: db.getMediaAssets(),
      audioTracks: db.getAudioTracks(),
      serviceItems: db.getServiceItems(),
      outputProfiles: db.getOutputProfiles(),
      displays: displayRouter.getDisplays(),
      liveState,
      storagePath: db.getStorageDirectory()
    }
  })

  ipcMain.on('nsc:window-control', (_e, action: 'minimize' | 'maximize' | 'close') => {
    if (!operatorWindow) return
    if (action === 'minimize') operatorWindow.minimize()
    else if (action === 'maximize') {
      if (operatorWindow.isMaximized()) operatorWindow.unmaximize()
      else operatorWindow.maximize()
    } else if (action === 'close') {
      operatorWindow.close()
    }
  })
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('org.nscchurch.presenter')
  mediaStorage = new MediaStorage(path.join(app.getPath('userData'), 'NSC_Data'))
  protocol.handle('nsc-media', (request) => {
    const parsed = new URL(request.url)
    const fileName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
    const fullPath = path.join(getMediaDirectory(), path.basename(fileName))
    return net.fetch(pathToFileURL(fullPath).toString(), {
      headers: request.headers
    })
  })

  db = new PresenterDatabase()
  await db.init()
  songLibrary = new SongLibrarySync(db)

  const preloadPath = path.join(__dirname, '../preload/index.js')
  displayRouter = new DisplayRouter(
    preloadPath,
    (displays) => {
      if (operatorWindow && !operatorWindow.isDestroyed()) {
        operatorWindow.webContents.send('nsc:displays-changed', displays)
      }
    },
    (profileId) => {
      // Triggered when user presses ESC inside an output window to safely exit fullscreen
      const existing = db.getOutputProfiles().find((p) => p.id === profileId)
      if (existing) {
        const updated = db.saveOutputProfile({ ...existing, enabled: false })
        displayRouter.broadcast(liveState, updated, operatorWindow)
      }
    }
  )
  displayRouter.attachHotplugListeners()

  registerIpcHandlers()
  createOperatorWindow()
  startLiveTimerLoop()
})

app.on('window-all-closed', () => {
  if (timerInterval) clearInterval(timerInterval)
  app.quit()
})
