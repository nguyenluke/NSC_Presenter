import { create } from 'zustand'
import {
  AudioCategory,
  AudioTrack,
  DisplayInfo,
  LivePresentationState,
  MediaAsset,
  MediaBin,
  OutputProfile,
  ScreenType,
  ServiceItem,
  SlideCue,
  Song,
  SongInput
} from '@shared/types'

export function songSectionEntries(song: Song | undefined | null) {
  if (!song) return []
  let startIndex = 0
  const result: Array<{ section: Song['sections'][number]; startIndex: number; orderIndex: number }> = []
  for (const id of song.arrangement.length ? song.arrangement : song.sections.map(section => section.id)) {
    const section = song.sections.find(section => section.id === id)
    if (!section?.slides.length) continue
    result.push({ section, startIndex, orderIndex: result.length })
    startIndex += section.slides.length
  }
  return result
}

export function flattenSongSlides(song: Song | undefined | null): SlideCue[] {
  if (!song) return []
  const sectionOrder =
    song.arrangement && song.arrangement.length > 0
      ? song.arrangement
      : song.sections.map((s) => s.id)

  const cues: SlideCue[] = []
  let idx = 0

  for (const secId of sectionOrder) {
    const sec = song.sections.find((s) => s.id === secId)
    if (!sec) continue
    for (const slide of sec.slides) {
      cues.push({
        ...slide,
        sectionId: sec.id,
        sectionLabel: sec.label,
        sectionType: sec.type,
        globalIndex: idx++
      })
    }
  }
  return cues
}

interface StudioStore {
  initialized: boolean
  songs: Song[]
  temporarySongs: Record<number, Song>
  mediaAssets: MediaAsset[]
  audioTracks: AudioTrack[]
  serviceItems: ServiceItem[]
  outputProfiles: OutputProfile[]
  displays: DisplayInfo[]
  newlyDetectedDisplayAlert: boolean
  storagePath: string

  selectedSongId: number | null
  activeMediaBin: MediaBin
  liveState: LivePresentationState

  refreshLibrarySongs: () => Promise<void>
  bootstrap: () => Promise<void>
  dismissDisplayAlert: () => void
  selectSongForDeck: (songId: number) => void
  setActiveMediaBin: (bin: MediaBin) => void

  triggerSlide: (song: Song, globalIndex: number) => Promise<void>
  triggerAdHocSlide: (
    title: string,
    current: SlideCue,
    next: SlideCue | null
  ) => Promise<void>
  stepSlide: (delta: 1 | -1) => Promise<void>
  jumpToSectionNumber: (oneBasedSectionNum: number) => Promise<void>

  triggerBackgroundMedia: (asset: MediaAsset) => Promise<void>
  triggerForegroundGraphic: (asset: MediaAsset) => Promise<void>
  updateLiveFlags: (partial: Partial<LivePresentationState>) => Promise<void>

  saveSong: (input: SongInput) => Promise<Song | undefined>
  useSongTemporarily: (input: SongInput) => Promise<void>
  discardTemporarySong: (id: number) => Promise<void>
  deleteSong: (id: number) => Promise<void>

  addToService: (itemType: 'song' | 'media', targetId: number) => Promise<void>
  removeFromService: (id: number) => Promise<void>
  moveServiceItem: (id: number, direction: -1 | 1) => Promise<void>

  importVisuals: (bin: MediaBin) => Promise<void>
  deleteMedia: (id: number) => Promise<void>

  importAudioTracks: (category: AudioCategory) => Promise<void>
  deleteAudioTrack: (id: number) => Promise<void>

  refreshDisplays: () => Promise<void>
  identifyDisplays: () => Promise<void>
  createScreenProfile: (screenType: ScreenType, assignedDisplayId?: number | null) => Promise<OutputProfile>
  saveOutputProfile: (profile: OutputProfile) => Promise<void>
  deleteOutputProfile: (id: string) => Promise<void>

  exportBackup: () => Promise<boolean>
  importBackup: () => Promise<boolean>
}

const defaultLiveState: LivePresentationState = {
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

export const useStudioStore = create<StudioStore>((set, get) => ({
  initialized: false,
  songs: [],
  temporarySongs: {},
  mediaAssets: [],
  audioTracks: [],
  serviceItems: [],
  outputProfiles: [],
  displays: [],
  newlyDetectedDisplayAlert: false,
  storagePath: '',

  selectedSongId: null,
  activeMediaBin: 'Worship Designs',
  liveState: defaultLiveState,

  bootstrap: async () => {
    const data = await window.nscApi.bootstrap()
    set({
      initialized: true,
      songs: data.songs,
      mediaAssets: data.mediaAssets,
      audioTracks: data.audioTracks,
      serviceItems: data.serviceItems,
      outputProfiles: data.outputProfiles,
      displays: data.displays,
      liveState: data.liveState,
      storagePath: data.storagePath,
      selectedSongId: data.songs[0]?.id ?? null
    })

    window.nscApi.onStateSync(({ liveState, outputProfiles }) => {
      set({ liveState, outputProfiles })
    })

    window.nscApi.onDisplaysChanged((newDisplays) => {
      const prevCount = get().displays.length
      set({
        displays: newDisplays,
        newlyDetectedDisplayAlert: newDisplays.length > prevCount
      })
    })
  },

  refreshLibrarySongs: async () => {
    const data = await window.nscApi.bootstrap()
    set((state) => ({ songs: data.songs, serviceItems: data.serviceItems,
      temporarySongs: Object.fromEntries(Object.entries(state.temporarySongs)
        .filter(([id]) => data.songs.some((song) => song.id === Number(id)))),
      selectedSongId: data.songs.some((song) => song.id === state.selectedSongId)
        ? state.selectedSongId : data.songs[0]?.id ?? null }))
  },

  dismissDisplayAlert: () => set({ newlyDetectedDisplayAlert: false }),

  selectSongForDeck: (songId) => {
    set({ selectedSongId: songId })
  },

  setActiveMediaBin: (bin) => {
    set({ activeMediaBin: bin })
  },

  triggerSlide: async (song, globalIndex) => {
    song = get().temporarySongs[song.id] ?? song
    const cues = flattenSongSlides(song)
    const current = cues[globalIndex] || null
    const next = cues[globalIndex + 1] || null

    const updated = await window.nscApi.updateLiveState({
      activeSongId: song.id,
      activeSongTitle: song.titleSecondary
        ? `${song.titlePrimary} / ${song.titleSecondary}`
        : song.titlePrimary,
      activeSongKey: song.musicalKey,
      activeSlideGlobalIndex: globalIndex,
      currentSlide: current,
      nextSlide: next,
      foregroundMedia: null,
      clearText: false,
      blackout: false,
      showLogo: false
    })
    set({ liveState: updated, selectedSongId: song.id })
  },

  triggerAdHocSlide: async (title, current, next) => {
    const updated = await window.nscApi.updateLiveState({
      activeSongId: null,
      activeSongTitle: title,
      activeSongKey: '',
      activeSlideGlobalIndex: current.globalIndex,
      currentSlide: current,
      nextSlide: next,
      foregroundMedia: null,
      clearText: false,
      blackout: false,
      showLogo: false
    })
    set({ liveState: updated })
  },

  stepSlide: async (delta) => {
    const { songs, selectedSongId, liveState, triggerSlide } = get()
    const targetSongId = liveState.activeSongId ?? selectedSongId
    const song = get().temporarySongs[targetSongId ?? -1] ?? songs.find((s) => s.id === targetSongId)
    if (!song) return

    const cues = flattenSongSlides(song)
    if (cues.length === 0) return

    const nextIdx =
      liveState.activeSongId === song.id
        ? Math.max(0, Math.min(cues.length - 1, liveState.activeSlideGlobalIndex + delta))
        : 0

    await triggerSlide(song, nextIdx)
  },

  jumpToSectionNumber: async (oneBasedSectionNum) => {
    const { songs, selectedSongId, liveState, triggerSlide } = get()
    const targetSongId = selectedSongId ?? liveState.activeSongId
    const song = get().temporarySongs[targetSongId ?? -1] ?? songs.find((s) => s.id === targetSongId)
    if (!song) return

    const cues = flattenSongSlides(song)
    const targetSlideIdx = songSectionEntries(song)[oneBasedSectionNum - 1]?.startIndex
    if (targetSlideIdx !== undefined && cues[targetSlideIdx]) {
      await triggerSlide(song, targetSlideIdx)
    }
  },

  triggerBackgroundMedia: async (asset) => {
    const updated = await window.nscApi.updateLiveState({
      activeBackground: asset,
      foregroundMedia: null,
      clearBackground: false,
      blackout: false,
      showLogo: false
    })
    set({ liveState: updated })
  },

  triggerForegroundGraphic: async (asset) => {
    const updated = await window.nscApi.updateLiveState({
      foregroundMedia: asset,
      blackout: false,
      showLogo: false
    })
    set({ liveState: updated })
  },

  updateLiveFlags: async (partial) => {
    const updated = await window.nscApi.updateLiveState(partial)
    set({ liveState: updated })
  },

  useSongTemporarily: async (input) => {
    const original = get().songs.find((song) => song.id === input.id)
    if (!original) throw new Error('Save a new song before using temporary edits.')
    const draft: Song = { ...structuredClone(input), id: original.id, updatedAt: original.updatedAt }
    set((state) => ({ temporarySongs: { ...state.temporarySongs, [draft.id]: draft } }))
    const { liveState } = get()
    if (liveState.activeSongId === draft.id) {
      const cues = flattenSongSlides(draft)
      const index = Math.max(0, Math.min(liveState.activeSlideGlobalIndex, cues.length - 1))
      await get().updateLiveFlags({ activeSongKey: draft.musicalKey,
        activeSongTitle: draft.titleSecondary ? `${draft.titlePrimary} / ${draft.titleSecondary}` : draft.titlePrimary,
        activeSlideGlobalIndex: index, currentSlide: cues[index] ?? null, nextSlide: cues[index + 1] ?? null })
    }
  },

  discardTemporarySong: async (id) => {
    const original = get().songs.find((song) => song.id === id)
    set((state) => {
      const temporarySongs = { ...state.temporarySongs }
      delete temporarySongs[id]
      return { temporarySongs }
    })
    const { liveState } = get()
    if (original && liveState.activeSongId === id) {
      const cues = flattenSongSlides(original)
      const index = Math.max(0, Math.min(liveState.activeSlideGlobalIndex, cues.length - 1))
      await get().updateLiveFlags({ activeSongKey: original.musicalKey,
        activeSongTitle: original.titleSecondary ? `${original.titlePrimary} / ${original.titleSecondary}` : original.titlePrimary,
        activeSlideGlobalIndex: index, currentSlide: cues[index] ?? null, nextSlide: cues[index + 1] ?? null })
    }
  },

  saveSong: async (input) => {
    const songs = await window.nscApi.saveSong(input)
    const saved = input.id ? songs.find((s) => s.id === input.id) : songs[0]
    const temporarySongs = { ...get().temporarySongs }
    if (saved) delete temporarySongs[saved.id]
    set({
      songs,
      temporarySongs,
      selectedSongId: saved?.id ?? get().selectedSongId
    })
    const { liveState, triggerSlide } = get()
    if (saved && liveState.activeSongId === saved.id && liveState.activeSlideGlobalIndex >= 0) {
      await triggerSlide(saved, liveState.activeSlideGlobalIndex)
    }
    return saved
  },

  deleteSong: async (id) => {
    const res = await window.nscApi.deleteSong(id)
    const temporarySongs = { ...get().temporarySongs }
    delete temporarySongs[id]
    set((state) => ({
      songs: res.songs,
      temporarySongs,
      serviceItems: res.serviceItems,
      selectedSongId:
        state.selectedSongId === id ? (res.songs[0]?.id ?? null) : state.selectedSongId
    }))
  },

  addToService: async (itemType, targetId) => {
    const serviceItems = await window.nscApi.addServiceItem(itemType, targetId)
    set({ serviceItems })
  },

  removeFromService: async (id) => {
    const serviceItems = await window.nscApi.removeServiceItem(id)
    set({ serviceItems })
  },

  moveServiceItem: async (id, direction) => {
    const items = [...get().serviceItems]
    const idx = items.findIndex((i) => i.id === id)
    const swapIdx = idx + direction
    if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return
    const temp = items[idx]
    items[idx] = items[swapIdx]
    items[swapIdx] = temp
    const reordered = await window.nscApi.reorderServiceItems(items.map((i) => i.id))
    set({ serviceItems: reordered })
  },

  importVisuals: async (bin) => {
    const mediaAssets = await window.nscApi.importVisualMedia(bin)
    set({ mediaAssets })
  },

  deleteMedia: async (id) => {
    const mediaAssets = await window.nscApi.deleteMedia(id)
    set({ mediaAssets })
  },

  importAudioTracks: async (category) => {
    const audioTracks = await window.nscApi.importAudioTracks(category)
    set({ audioTracks })
  },

  deleteAudioTrack: async (id) => {
    const audioTracks = await window.nscApi.deleteAudioTrack(id)
    set({ audioTracks })
  },

  refreshDisplays: async () => {
    const displays = await window.nscApi.getDisplays()
    set({ displays })
  },

  identifyDisplays: async () => {
    await window.nscApi.identifyDisplays()
  },

  createScreenProfile: async (screenType, assignedDisplayId = null) => {
    const { outputProfiles, displays } = get()
    const count = outputProfiles.filter((p) => p.screenType === screenType).length + 1
    const externalDisplay =
      assignedDisplayId !== null
        ? displays.find((d) => d.id === assignedDisplayId)
        : displays.find((d) => !d.isPrimary)

    const newProfile: OutputProfile = {
      id: `${screenType}-${Date.now()}`,
      name:
        screenType === 'stage'
          ? `Stage Display ${count}`
          : count === 1
            ? 'Main Audience Screen'
            : `Audience Screen ${count}`,
      screenType,
      enabled: false,
      windowMode: externalDisplay ? 'fullscreen' : 'virtual',
      assignedDisplayId: externalDisplay ? externalDisplay.id : null,
      languageMode: 'both',
      primaryFontSize: screenType === 'stage' ? 60 : 62,
      secondaryFontSize: screenType === 'stage' ? 40 : 40,
      primaryColor: '#FFFFFF',
      secondaryColor: screenType === 'stage' ? '#FDE047' : '#FCD34D',
      dimOpacity: screenType === 'stage' ? 0 : 0.35,
      verticalAlign: 'center'
    }

    const updated = await window.nscApi.saveOutputProfile(newProfile)
    set({ outputProfiles: updated })
    return newProfile
  },

  saveOutputProfile: async (profile) => {
    const outputProfiles = await window.nscApi.saveOutputProfile(profile)
    set({ outputProfiles })
  },

  deleteOutputProfile: async (id) => {
    const outputProfiles = await window.nscApi.deleteOutputProfile(id)
    set({ outputProfiles })
  },

  exportBackup: async () => {
    return window.nscApi.exportBackup()
  },

  importBackup: async () => {
    const data = await window.nscApi.importBackup()
    if (!data) return false
    set({
      songs: data.songs,
      temporarySongs: {},
      mediaAssets: data.mediaAssets,
      audioTracks: data.audioTracks,
      serviceItems: data.serviceItems,
      outputProfiles: data.outputProfiles,
      displays: data.displays,
      liveState: data.liveState,
      selectedSongId: data.songs[0]?.id ?? null
    })
    return true
  }
}))
