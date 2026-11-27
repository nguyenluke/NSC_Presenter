/**
 * Shared TypeScript Models (DTOs) between Electron Main Process (Backend)
 * and React Renderer Windows (Operator UI + Dynamic Audience & Stage Outputs).
 */

export type SectionType = 'Intro' | 'Verse' | 'PreChorus' | 'Chorus' | 'Bridge' | 'Tag' | 'Outro'

export interface BilingualSlide {
  id: string
  primaryText: string   // Language 1 (e.g. Vietnamese)
  secondaryText: string // Language 2 (e.g. English)
  chords?: string       // Optional chord cues for Stage Screens
}

export interface SongSection {
  id: string
  type: SectionType
  label: string
  slides: BilingualSlide[]
}

export interface Song {
  id: number
  titlePrimary: string
  titleSecondary: string
  author: string
  musicalKey: string
  bpm: number
  sections: SongSection[]
  arrangement: string[]
  updatedAt: string
}

export interface SongInput {
  id?: number
  titlePrimary: string
  titleSecondary: string
  author: string
  musicalKey: string
  bpm: number
  sections: SongSection[]
  arrangement: string[]
}

export type MediaBin = 'Worship Designs' | 'Motion Loops' | 'Sermon & Events' | 'Logos'

export interface MediaStorageStatus {
  directory: string
  available: boolean
}

export interface MediaAsset {
  id: number
  title: string
  bin: MediaBin
  mediaType: 'image' | 'video' | 'atmosphere'
  url: string
  fitMode: 'cover' | 'contain'
  documentId?: string
  documentTitle?: string
  documentPage?: number
  documentPages?: number
}

export type AudioCategory = 'Worship Pads' | 'Pre-Service Music'

export interface AudioTrack {
  id: number
  title: string
  category: AudioCategory
  url: string
}

export interface ServiceItem {
  id: number
  itemType: 'song' | 'media'
  targetId: number
  sortOrder: number
}

export interface DisplayInfo {
  id: number
  index: number
  label: string
  width: number
  height: number
  x: number
  y: number
  isPrimary: boolean
}

export type ScreenType = 'audience' | 'stage'
export type LanguageMode = 'both' | 'primary' | 'secondary'

export interface CustomTextLayout {
  x: number
  y: number
  width: number
  align: 'left' | 'center' | 'right'
  languageGap: number
}

export interface TextStyle {
  fontFamily?: string
  bold?: boolean
  italic?: boolean
  stretch?: number
  tracking?: number
}

/**
 * Dynamic Output Screen Profile (ProPresenter "Configure Screens" model):
 * Users can create 1, 2, 3, 4, or more Audience or Stage screens dynamically
 * and map each one to ANY connected physical monitor/TV/LED processor!
 */
export interface OutputProfile {
  id: string
  name: string
  screenType: ScreenType
  enabled: boolean
  windowMode: 'fullscreen' | 'virtual'
  assignedDisplayId: number | null
  languageMode: LanguageMode
  primaryFontSize: number
  secondaryFontSize: number
  primaryColor: string
  secondaryColor: string
  dimOpacity: number
  verticalAlign: 'top' | 'center' | 'bottom' | 'custom'
  customTextLayout?: CustomTextLayout
  primaryTextStyle?: TextStyle
  secondaryTextStyle?: TextStyle
}

export interface SlideCue extends BilingualSlide {
  sectionId: string
  sectionLabel: string
  sectionType: SectionType
  globalIndex: number
}

export interface LivePresentationState {
  activeSongId: number | null
  activeSongTitle: string
  activeSongKey: string
  activeSlideGlobalIndex: number
  currentSlide: SlideCue | null
  nextSlide: SlideCue | null
  activeBackground: MediaAsset | null
  foregroundMedia: MediaAsset | null
  clearText: boolean
  clearBackground: boolean
  blackout: boolean
  showLogo: boolean
  logoMedia: MediaAsset | null
  audienceMessage: string // ProPresenter Audience Message / Childcare number ticker!
  stageAlert: string      // Private message shown ONLY on Stage screen(s)
  stageShowChords: boolean
  timerRunning: boolean
  timerSeconds: number
  timerMode: 'countdown' | 'elapsed'
}

export interface InitialBootstrapPayload {
  songs: Song[]
  mediaAssets: MediaAsset[]
  audioTracks: AudioTrack[]
  serviceItems: ServiceItem[]
  outputProfiles: OutputProfile[]
  displays: DisplayInfo[]
  liveState: LivePresentationState
  storagePath: string
}
