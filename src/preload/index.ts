import { contextBridge, ipcRenderer } from 'electron'
import { LibraryConfig, SongSyncStatus, SongSyncResult } from '../shared/songSync'
import { ShortcutBindings } from '../shared/keyboardShortcuts'
import { DocumentImportProgress } from '../shared/documents'
import {
  AudioCategory,
  AudioTrack,
  DisplayInfo,
  InitialBootstrapPayload,
  LivePresentationState,
  MediaAsset,
  MediaBin,
  MediaStorageStatus,
  OutputProfile,
  ServiceItem,
  Song,
  SongInput
} from '@shared/types'

interface LibraryPayload { songs: Song[]; serviceItems: ServiceItem[]; status: SongSyncStatus }

const nscApi = {
  importSermonDocument: (): Promise<{ mediaAssets: MediaAsset[]; documentId: string } | null> => ipcRenderer.invoke('nsc:import-document'),
  cancelDocumentImport: (): Promise<void> => ipcRenderer.invoke('nsc:cancel-document-import'),
  deleteDocument: (id: string): Promise<{ mediaAssets: MediaAsset[]; serviceItems: ServiceItem[] }> => ipcRenderer.invoke('nsc:delete-document', id),
  onDocumentImportProgress: (callback: (progress: DocumentImportProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DocumentImportProgress): void => callback(progress)
    ipcRenderer.on('nsc:document-import-progress', handler)
    return () => ipcRenderer.removeListener('nsc:document-import-progress', handler)
  },
  getShortcuts: (): Promise<ShortcutBindings> => ipcRenderer.invoke('nsc:get-shortcuts'),
  saveShortcuts: (bindings: ShortcutBindings): Promise<ShortcutBindings> => ipcRenderer.invoke('nsc:save-shortcuts', bindings),
  mediaStorageStatus: (): Promise<MediaStorageStatus> => ipcRenderer.invoke('nsc:media-storage-status'),
  chooseMediaFolder: (): Promise<(MediaStorageStatus & { copied: number }) | null> => ipcRenderer.invoke('nsc:choose-media-folder'),
  libraryStatus: (): Promise<SongSyncStatus> => ipcRenderer.invoke('nsc:library-status'),
  configureLibrary: (config: LibraryConfig): Promise<SongSyncStatus> => ipcRenderer.invoke('nsc:library-configure', config),
  librarySignIn: (email: string, password: string): Promise<SongSyncStatus> => ipcRenderer.invoke('nsc:library-sign-in', email, password),
  librarySignOut: (): Promise<SongSyncStatus> => ipcRenderer.invoke('nsc:library-sign-out'),
  syncLibrary: (): Promise<LibraryPayload & { result: SongSyncResult }> => ipcRenderer.invoke('nsc:library-sync'),
  resolveLibraryConflict: (sharedId: string, choice: 'local' | 'shared', revision: number): Promise<LibraryPayload> =>
    ipcRenderer.invoke('nsc:library-resolve', sharedId, choice, revision),

  bootstrap: (): Promise<InitialBootstrapPayload> => ipcRenderer.invoke('nsc:bootstrap'),

  updateLiveState: (partial: Partial<LivePresentationState>): Promise<LivePresentationState> =>
    ipcRenderer.invoke('nsc:update-live-state', partial),

  saveSong: (input: SongInput): Promise<Song[]> => ipcRenderer.invoke('nsc:save-song', input),

  deleteSong: (id: number): Promise<{ songs: Song[]; serviceItems: ServiceItem[] }> =>
    ipcRenderer.invoke('nsc:delete-song', id),

  addServiceItem: (itemType: 'song' | 'media', targetId: number): Promise<ServiceItem[]> =>
    ipcRenderer.invoke('nsc:add-service-item', { itemType, targetId }),

  removeServiceItem: (id: number): Promise<ServiceItem[]> =>
    ipcRenderer.invoke('nsc:remove-service-item', id),

  reorderServiceItems: (orderedIds: number[]): Promise<ServiceItem[]> =>
    ipcRenderer.invoke('nsc:reorder-service-items', orderedIds),

  importVisualMedia: (targetBin: MediaBin): Promise<MediaAsset[]> =>
    ipcRenderer.invoke('nsc:import-visual-media', targetBin),

  deleteMedia: (id: number): Promise<MediaAsset[]> => ipcRenderer.invoke('nsc:delete-media', id),

  importAudioTracks: (category: AudioCategory): Promise<AudioTrack[]> =>
    ipcRenderer.invoke('nsc:import-audio-tracks', category),

  deleteAudioTrack: (id: number): Promise<AudioTrack[]> =>
    ipcRenderer.invoke('nsc:delete-audio-track', id),

  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('nsc:get-displays'),

  identifyDisplays: (): Promise<void> => ipcRenderer.invoke('nsc:identify-displays'),

  saveOutputProfile: (profile: OutputProfile): Promise<OutputProfile[]> =>
    ipcRenderer.invoke('nsc:save-output-profile', profile),

  deleteOutputProfile: (id: string): Promise<OutputProfile[]> =>
    ipcRenderer.invoke('nsc:delete-output-profile', id),

  exportBackup: (): Promise<boolean> => ipcRenderer.invoke('nsc:export-backup'),

  importBackup: (): Promise<InitialBootstrapPayload | null> =>
    ipcRenderer.invoke('nsc:import-backup'),

  windowControl: (action: 'minimize' | 'maximize' | 'close'): void =>
    ipcRenderer.send('nsc:window-control', action),

  onStateSync: (
    callback: (data: { liveState: LivePresentationState; outputProfiles: OutputProfile[] }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { liveState: LivePresentationState; outputProfiles: OutputProfile[] }
    ): void => callback(data)
    ipcRenderer.on('nsc:state-sync', handler)
    return () => ipcRenderer.removeListener('nsc:state-sync', handler)
  },

  onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, displays: DisplayInfo[]): void =>
      callback(displays)
    ipcRenderer.on('nsc:displays-changed', handler)
    return () => ipcRenderer.removeListener('nsc:displays-changed', handler)
  }
}

contextBridge.exposeInMainWorld('nscApi', nscApi)
export type NscApi = typeof nscApi
