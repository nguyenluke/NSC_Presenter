import React, { useEffect, useMemo, useState } from 'react'
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BookMarked,
  BookOpen,
  Clock,
  Edit3,
  Eraser,
  Film,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  List,
  ListMusic,
  Maximize2,
  MessageSquare,
  Minus,
  Monitor,
  Music2,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Trash2,
  Tv,
  Type,
  Volume2,
  X
} from 'lucide-react'
import { LanguageMode, MediaBin, Song } from '@shared/types'
import { ScaledMonitorFrame } from '../components/outputs/ScaledMonitorFrame'
import { formatTimerSeconds } from '../components/outputs/StageMonitorCanvas'
import { AudioBinDrawer } from '../components/studio/AudioBinDrawer'
import { BibleView } from '../components/studio/BibleView'
import { DisplayMatrixModal } from '../components/studio/DisplayMatrixModal'
import { QuickSearchModal } from '../components/studio/QuickSearchModal'
import { ReflowEditorView } from '../components/studio/ReflowEditorView'
import { getProPresenterBarColor, SongEditorView } from '../components/studio/SongEditorView'
import { flattenSongSlides, useStudioStore } from '../store/useStudioStore'

const MEDIA_BINS: MediaBin[] = ['Worship Designs', 'Motion Loops', 'Sermon & Events', 'Logos']

type CenterMode = 'show' | 'edit' | 'reflow' | 'bible'
type ShowControlDrawer = 'audio' | 'timers' | 'messages' | 'stage' | 'keys'

export const OperatorStudioView: React.FC = () => {
  const {
    initialized,
    bootstrap,
    songs,
    mediaAssets,
    audioTracks,
    serviceItems,
    outputProfiles,
    displays,
    newlyDetectedDisplayAlert,
    dismissDisplayAlert,
    storagePath,
    selectedSongId,
    activeMediaBin,
    liveState,
    selectSongForDeck,
    setActiveMediaBin,
    triggerSlide,
    triggerAdHocSlide,
    stepSlide,
    jumpToSectionNumber,
    triggerBackgroundMedia,
    triggerForegroundGraphic,
    updateLiveFlags,
    saveSong,
    deleteSong,
    addToService,
    removeFromService,
    moveServiceItem,
    importVisuals,
    deleteMedia,
    importAudioTracks,
    deleteAudioTrack,
    refreshDisplays,
    identifyDisplays,
    createScreenProfile,
    saveOutputProfile,
    deleteOutputProfile,
    exportBackup,
    importBackup
  } = useStudioStore()

  // 1. ProPresenter Toolbar States
  const [centerMode, setCenterMode] = useState<CenterMode>('show')
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showTextPopover, setShowTextPopover] = useState(false)
  const [showThemePopover, setShowThemePopover] = useState(false)
  const [showDisplayMatrix, setShowDisplayMatrix] = useState(false)
  const [mediaBinOpen, setMediaBinOpen] = useState(true)

  // 2. ProPresenter Slide Grid & Filter States
  const [libraryFilter, setLibraryFilter] = useState('')
  const [slideCardWidth, setSlideCardWidth] = useState(230)
  const [slideViewStyle, setSlideViewStyle] = useState<'grid' | 'list'>('grid')

  // 3. Dynamic Preview Monitor & Show Controls Rail States
  const [previewProfileId, setPreviewProfileId] = useState<string>('')
  const [activeShowControl, setActiveShowControl] = useState<ShowControlDrawer>('timers')
  const [stageMsgDraft, setStageMsgDraft] = useState('')
  const [audienceMsgDraft, setAudienceMsgDraft] = useState('')

  const isMac = navigator.userAgent.toLowerCase().includes('mac')

  useEffect(() => {
    if (!initialized) {
      bootstrap()
    }
  }, [initialized, bootstrap])

  // Global Booth Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowSearchModal(true)
        return
      }

      const target = e.target as HTMLElement | null
      if (
        (centerMode !== 'show' && centerMode !== 'bible') ||
        showDisplayMatrix ||
        showSearchModal ||
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT'))
      ) {
        return
      }

      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault()
        stepSlide(1)
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault()
        stepSlide(-1)
      } else if (e.code === 'F1' || e.code === 'Escape') {
        e.preventDefault()
        updateLiveFlags({ clearText: true, foregroundMedia: null })
      } else if (e.code === 'F2') {
        e.preventDefault()
        updateLiveFlags({ clearBackground: true, foregroundMedia: null })
      } else if (e.code === 'F3') {
        e.preventDefault()
        updateLiveFlags({ showLogo: !liveState.showLogo, blackout: false })
      } else if (e.code === 'F4') {
        e.preventDefault()
        updateLiveFlags({ blackout: !liveState.blackout })
      } else if (/^Digit[1-9]$/.test(e.code)) {
        e.preventDefault()
        jumpToSectionNumber(Number(e.code.replace('Digit', '')))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    centerMode,
    showDisplayMatrix,
    showSearchModal,
    liveState,
    stepSlide,
    updateLiveFlags,
    jumpToSectionNumber
  ])

  const selectedSong = useMemo(
    () => songs.find((s) => s.id === selectedSongId) ?? songs[0] ?? null,
    [songs, selectedSongId]
  )

  const deckSlides = useMemo(() => flattenSongSlides(selectedSong), [selectedSong])

  const filteredSongs = useMemo(() => {
    const q = libraryFilter.trim().toLowerCase()
    if (!q) return songs
    return songs.filter(
      (s) =>
        s.titlePrimary.toLowerCase().includes(q) ||
        s.titleSecondary.toLowerCase().includes(q)
    )
  }, [songs, libraryFilter])

  const binAssets = useMemo(
    () => mediaAssets.filter((m) => m.bin === activeMediaBin),
    [mediaAssets, activeMediaBin]
  )

  const audienceProfiles = outputProfiles.filter((p) => p.screenType === 'audience')
  const stageProfiles = outputProfiles.filter((p) => p.screenType === 'stage')
  const firstAudienceProfile = audienceProfiles[0] ?? outputProfiles[0]

  const activePreviewProfile =
    outputProfiles.find((p) => p.id === previewProfileId) ??
    firstAudienceProfile ??
    outputProfiles[0]

  const isAudienceOn = audienceProfiles.some((p) => p.enabled)
  const isStageOn = stageProfiles.some((p) => p.enabled)

  // Active Layer Indicator States
  const isSlideLayerLive = Boolean(liveState.currentSlide && !liveState.clearText && !liveState.blackout)
  const isMediaLayerLive = Boolean(
    ((liveState.activeBackground && !liveState.clearBackground) || liveState.foregroundMedia) &&
      !liveState.blackout
  )
  const isMessageLayerLive = Boolean(
    liveState.stageAlert.trim() !== '' || liveState.audienceMessage.trim() !== ''
  )
  const isPropsLogoLive = Boolean(liveState.showLogo && !liveState.blackout)
  const isAnyLayerLive =
    isSlideLayerLive || isMediaLayerLive || isMessageLayerLive || isPropsLogoLive || liveState.blackout

  const toggleAudienceOutputs = async (): Promise<void> => {
    const next = !isAudienceOn
    for (const p of audienceProfiles) {
      await saveOutputProfile({ ...p, enabled: next })
    }
  }

  const toggleStageOutput = async (): Promise<void> => {
    const next = !isStageOn
    for (const p of stageProfiles) {
      await saveOutputProfile({ ...p, enabled: next })
    }
  }

  const applyQuickThemePreset = async (
    preset: 'sanctuary' | 'lowerThird' | 'vnOnly' | 'bilingualCyan'
  ): Promise<void> => {
    for (const p of audienceProfiles) {
      if (preset === 'sanctuary') {
        await saveOutputProfile({
          ...p,
          languageMode: 'both',
          verticalAlign: 'center',
          primaryFontSize: 64,
          secondaryFontSize: 42,
          primaryColor: '#FFFFFF',
          secondaryColor: '#FCD34D'
        })
      } else if (preset === 'lowerThird') {
        await saveOutputProfile({
          ...p,
          languageMode: 'both',
          verticalAlign: 'bottom',
          primaryFontSize: 48,
          secondaryFontSize: 34
        })
      } else if (preset === 'vnOnly') {
        await saveOutputProfile({
          ...p,
          languageMode: 'primary',
          verticalAlign: 'center',
          primaryFontSize: 72
        })
      } else if (preset === 'bilingualCyan') {
        await saveOutputProfile({
          ...p,
          languageMode: 'both',
          verticalAlign: 'center',
          primaryColor: '#FFFFFF',
          secondaryColor: '#67E8F9'
        })
      }
    }
    setShowThemePopover(false)
  }

  const updateAudienceLanguageMode = async (mode: LanguageMode): Promise<void> => {
    for (const p of audienceProfiles) {
      await saveOutputProfile({ ...p, languageMode: mode })
    }
  }

  if (!initialized) {
    return (
      <div className="w-screen h-screen bg-[#1e1f22] flex items-center justify-center text-zinc-400 text-sm">
        Launching NSC Presenter...
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-[#1e1f22] text-zinc-100 flex flex-col overflow-hidden select-none">
      {/* =====================================================================
          ZONE 1: OFFICIAL PROPRESENTER 7 TOP TOOLBAR
         ===================================================================== */}
      <header
        className={`h-[56px] bg-[#2b2d31] border-b border-[#141517] flex items-center justify-between px-3 app-drag-region shrink-0 relative z-30 ${
          isMac ? 'pl-20' : 'pl-3'
        }`}
      >
        {/* LEFT GROUP: Search | Text | Theme | + New Song */}
        <div className="flex items-center gap-1 app-no-drag relative">
          <button
            onClick={() => setShowSearchModal(true)}
            className="px-3 py-1 rounded hover:bg-[#383a40] flex flex-col items-center gap-0.5 text-zinc-200"
            title="Search Songs & Lyrics (Cmd+F)"
          >
            <Search className="w-4 h-4" />
            <span className="text-[10px] font-medium text-zinc-300">Search</span>
          </button>

          <button
            onClick={() => {
              setShowTextPopover(!showTextPopover)
              setShowThemePopover(false)
            }}
            className={`px-3 py-1 rounded flex flex-col items-center gap-0.5 ${
              showTextPopover ? 'bg-[#3f4249] text-white' : 'hover:bg-[#383a40] text-zinc-200'
            }`}
          >
            <Type className="w-4 h-4" />
            <span className="text-[10px] font-medium text-zinc-300">Text</span>
          </button>

          <button
            onClick={() => {
              setShowThemePopover(!showThemePopover)
              setShowTextPopover(false)
            }}
            className={`px-3 py-1 rounded flex flex-col items-center gap-0.5 ${
              showThemePopover ? 'bg-[#3f4249] text-white' : 'hover:bg-[#383a40] text-zinc-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span className="text-[10px] font-medium text-zinc-300">Theme</span>
          </button>

          <div className="h-7 w-[1px] bg-[#3c3f46] mx-1" />

          <button
            onClick={() => {
              setEditingSong(null)
              setCenterMode('edit')
            }}
            className="px-3 py-1 rounded hover:bg-[#383a40] flex flex-col items-center gap-0.5 text-zinc-200"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-medium text-zinc-300">New Song</span>
          </button>

          {showTextPopover && firstAudienceProfile && (
            <div className="absolute left-12 top-14 w-64 p-3 rounded-lg bg-[#2b2d31] border border-[#454852] shadow-2xl space-y-3 z-50">
              <div className="text-[11px] font-bold uppercase text-zinc-400">
                Quick Lyric Formatting
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-300">Languages on Audience Screens:</label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ['both', 'Both'],
                      ['primary', 'Lang 1'],
                      ['secondary', 'Lang 2']
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => updateAudienceLanguageMode(mode)}
                      className={`py-1 rounded text-xs font-semibold ${
                        firstAudienceProfile.languageMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#1e1f22] text-zinc-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-300">
                  Main Lyric Size: {firstAudienceProfile.primaryFontSize}px
                </label>
                <input
                  type="range"
                  min={36}
                  max={96}
                  value={firstAudienceProfile.primaryFontSize}
                  onChange={(e) =>
                    saveOutputProfile({
                      ...firstAudienceProfile,
                      primaryFontSize: Number(e.target.value)
                    })
                  }
                  className="w-full accent-orange-500"
                />
              </div>
            </div>
          )}

          {showThemePopover && (
            <div className="absolute left-24 top-14 w-64 p-2 rounded-lg bg-[#2b2d31] border border-[#454852] shadow-2xl space-y-1 z-50">
              <div className="px-2 py-1 text-[11px] font-bold uppercase text-zinc-400">
                ProPresenter Slide Themes
              </div>
              <button
                onClick={() => applyQuickThemePreset('sanctuary')}
                className="w-full text-left px-3 py-2 rounded hover:bg-[#383b42] text-xs font-semibold text-white"
              >
                Center Bilingual (White + Gold)
              </button>
              <button
                onClick={() => applyQuickThemePreset('bilingualCyan')}
                className="w-full text-left px-3 py-2 rounded hover:bg-[#383b42] text-xs font-semibold text-cyan-200"
              >
                Modern Bilingual (White + Ice Blue)
              </button>
              <button
                onClick={() => applyQuickThemePreset('lowerThird')}
                className="w-full text-left px-3 py-2 rounded hover:bg-[#383b42] text-xs font-semibold text-zinc-200"
              >
                Lower-Third Broadcast (Bottom)
              </button>
              <button
                onClick={() => applyQuickThemePreset('vnOnly')}
                className="w-full text-left px-3 py-2 rounded hover:bg-[#383b42] text-xs font-semibold text-zinc-200"
              >
                Single Language Extra-Bold
              </button>
            </div>
          )}
        </div>

        {/* CENTER GROUP: Show | Edit | Reflow | Bible | Screens */}
        <div className="flex items-center bg-[#1b1c1f] p-1 rounded-lg border border-[#383a40] app-no-drag">
          <button
            onClick={() => setCenterMode('show')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              centerMode === 'show'
                ? 'bg-[#3b3e45] text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Show
          </button>

          <button
            onClick={() => {
              setEditingSong(selectedSong)
              setCenterMode('edit')
            }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              centerMode === 'edit'
                ? 'bg-[#3b3e45] text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>

          <button
            onClick={() => setCenterMode('reflow')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              centerMode === 'reflow'
                ? 'bg-[#3b3e45] text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            Reflow
          </button>

          <button
            onClick={() => setCenterMode('bible')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              centerMode === 'bible'
                ? 'bg-[#3b3e45] text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5 text-emerald-400" />
            Bible
          </button>

          <button
            onClick={() => {
              dismissDisplayAlert()
              setShowDisplayMatrix(true)
            }}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 text-zinc-300 hover:text-white transition"
          >
            <Sliders className="w-3.5 h-3.5 text-orange-400" />
            Screens ({displays.length})
          </button>
        </div>

        {/* RIGHT GROUP: Media Bin Toggle + Audience & Stage Master Switches */}
        <div className="flex items-center gap-2.5 app-no-drag">
          <button
            onClick={() => {
              setCenterMode('show')
              setMediaBinOpen(!mediaBinOpen)
            }}
            className={`px-3 py-1 rounded flex flex-col items-center gap-0.5 transition ${
              mediaBinOpen && centerMode === 'show'
                ? 'bg-blue-600/25 border border-blue-500/50 text-blue-200'
                : 'hover:bg-[#383a40] text-zinc-300'
            }`}
          >
            <Film className="w-4 h-4" />
            <span className="text-[10px] font-medium">Media</span>
          </button>

          <div className="h-7 w-[1px] bg-[#3c3f46]" />

          <div className="flex flex-col gap-1">
            <button
              onClick={toggleAudienceOutputs}
              className="flex items-center justify-between gap-2.5 px-2.5 py-0.5 rounded bg-[#1b1c1f] border border-[#383a40] hover:border-zinc-500 text-[10px] font-semibold"
              title="Toggle all Audience Screen Windows"
            >
              <span className="text-zinc-200">Audience ({audienceProfiles.length})</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isAudienceOn ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-500/70'
                }`}
              />
            </button>

            <button
              onClick={toggleStageOutput}
              className="flex items-center justify-between gap-2.5 px-2.5 py-0.5 rounded bg-[#1b1c1f] border border-[#383a40] hover:border-zinc-500 text-[10px] font-semibold"
              title="Toggle all Stage Screen Windows"
            >
              <span className="text-zinc-200">Stage ({stageProfiles.length})</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isStageOn ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-500/70'
                }`}
              />
            </button>
          </div>

          {!isMac && (
            <div className="flex items-center border-l border-[#3c3f46] pl-2">
              <button
                onClick={() => window.nscApi.windowControl('minimize')}
                className="p-1.5 rounded hover:bg-[#383a40] text-zinc-400 hover:text-white"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => window.nscApi.windowControl('maximize')}
                className="p-1.5 rounded hover:bg-[#383a40] text-zinc-400 hover:text-white"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => window.nscApi.windowControl('close')}
                className="p-1.5 rounded hover:bg-red-600 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* REAL-LIFE PLUG-AND-PLAY BANNER WHEN USER PLUGS IN AN EXTRA TV / PROJECTOR! */}
      {newlyDetectedDisplayAlert && (
        <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shrink-0">
          <span>
            ✓ New External Monitor/TV Detected ({displays.length} total screens connected)! Choose how you want to use it:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                dismissDisplayAlert()
                setShowDisplayMatrix(true)
              }}
              className="px-3 py-1 rounded bg-white text-emerald-900 font-bold"
            >
              Configure Screens
            </button>
            <button onClick={dismissDisplayAlert} className="opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MAIN WORKSPACE ROUTING: Edit | Reflow | Show + Bible + Right Preview
         ===================================================================== */}
      {centerMode === 'edit' ? (
        <SongEditorView
          initialSong={editingSong}
          onCancel={() => setCenterMode('show')}
          onSave={async (input) => {
            await saveSong(input)
            setCenterMode('show')
          }}
        />
      ) : centerMode === 'reflow' ? (
        <ReflowEditorView
          song={selectedSong}
          onSave={async (input) => {
            await saveSong(input)
          }}
          onSwitchToShow={() => setCenterMode('show')}
        />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* LEFT SIDEBAR + CENTER SLIDES OR BIBLE VIEW */}
          {centerMode === 'bible' ? (
            <BibleView
              onProjectSlide={triggerAdHocSlide}
              onSaveAsPlaylistItem={async (input) => {
                const saved = await saveSong(input)
                if (saved) {
                  await addToService('song', saved.id)
                  setCenterMode('show')
                }
              }}
            />
          ) : (
            <>
              {/* ZONE 2: LEFT SIDEBAR (Libraries Top + Playlists Bottom with Up/Down Reorder) */}
              <aside className="w-[256px] bg-[#232428] border-r border-[#141517] flex flex-col min-h-0 shrink-0">
                <div className="h-[52%] flex flex-col min-h-0 border-b border-[#141517]">
                  <div className="px-3 py-1.5 bg-[#2b2d31] border-b border-[#191a1d] flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Libraries
                    </span>
                    <button
                      onClick={() => {
                        setEditingSong(null)
                        setCenterMode('edit')
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-3 py-1.5 bg-[#282a2e] border-b border-[#1d1e22] flex items-center justify-between text-xs text-zinc-200 font-medium">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                      Worship Songs
                    </span>
                    <span className="text-[10px] text-zinc-400">{songs.length}</span>
                  </div>

                  <div className="p-1.5 border-b border-[#1d1e22]">
                    <input
                      value={libraryFilter}
                      onChange={(e) => setLibraryFilter(e.target.value)}
                      placeholder="Filter library..."
                      className="w-full px-2.5 py-1 rounded bg-[#18191c] border border-[#32343b] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto py-1">
                    {filteredSongs.map((song) => {
                      const isSelected = selectedSong?.id === song.id
                      return (
                        <div
                          key={song.id}
                          onClick={() => selectSongForDeck(song.id)}
                          className={`group px-3 py-1.5 cursor-pointer flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-[#2563eb] text-white'
                              : 'text-zinc-300 hover:bg-[#2d2f35]'
                          }`}
                        >
                          <div className="min-w-0 truncate pr-2">
                            <span className="font-medium">{song.titlePrimary}</span>
                            {song.titleSecondary && (
                              <span
                                className={`ml-1.5 text-[11px] ${
                                  isSelected ? 'text-blue-100' : 'text-zinc-500'
                                }`}
                              >
                                ({song.titleSecondary})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                addToService('song', song.id)
                              }}
                              className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 text-[10px] font-semibold text-white"
                            >
                              +Play
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteSong(song.id)
                              }}
                              className="p-0.5 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* PLAYLISTS */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="px-3 py-1.5 bg-[#2b2d31] border-b border-[#191a1d] flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Playlists
                    </span>
                    <span className="text-[10px] text-zinc-500">{serviceItems.length} items</span>
                  </div>

                  <div className="px-3 py-1.5 bg-[#282a2e] border-b border-[#1d1e22] flex items-center gap-1.5 text-xs text-amber-200 font-medium">
                    <ListMusic className="w-3.5 h-3.5 text-orange-400" />
                    Sunday Service Worship
                  </div>

                  <div className="flex-1 overflow-y-auto py-1">
                    {serviceItems.length === 0 && (
                      <div className="p-4 text-center text-[11px] text-zinc-500">
                        Hover a song in Library above and click <b>+Play</b> to add it to Sunday&apos;s Playlist.
                      </div>
                    )}

                    {serviceItems.map((item, idx) => {
                      const song =
                        item.itemType === 'song'
                          ? songs.find((s) => s.id === item.targetId)
                          : null
                      const asset =
                        item.itemType === 'media'
                          ? mediaAssets.find((m) => m.id === item.targetId)
                          : null
                      if (!song && !asset) return null

                      const isSelected = song ? selectedSong?.id === song.id : false
                      const isLive = song ? liveState.activeSongId === song.id : false

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (song) selectSongForDeck(song.id)
                            else if (asset) {
                              if (asset.bin === 'Sermon & Events') triggerForegroundGraphic(asset)
                              else triggerBackgroundMedia(asset)
                            }
                          }}
                          className={`group px-3 py-1.5 cursor-pointer flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-[#363942] text-white'
                              : 'text-zinc-300 hover:bg-[#2d2f35]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] font-mono w-4 text-right ${
                                isLive ? 'text-orange-400 font-bold' : 'text-zinc-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            {song ? (
                              <Music2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            )}
                            <span className="truncate font-medium">
                              {song ? song.titlePrimary : asset?.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                moveServiceItem(item.id, -1)
                              }}
                              className="p-0.5 text-zinc-400 hover:text-white"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                moveServiceItem(item.id, 1)
                              }}
                              className="p-0.5 text-zinc-400 hover:text-white"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFromService(item.id)
                              }}
                              className="p-0.5 text-zinc-400 hover:text-red-400"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </aside>

              {/* ZONE 3 & 4: CENTER SLIDE CANVAS + MEDIA BIN */}
              <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#18191b]">
                {selectedSong && (
                  <div className="px-4 py-2 bg-[#232529] border-b border-[#141517] flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {selectedSong.titlePrimary}
                        </span>
                        {selectedSong.titleSecondary && (
                          <span className="text-xs text-zinc-400">
                            ({selectedSong.titleSecondary})
                          </span>
                        )}
                        {selectedSong.musicalKey && (
                          <span className="px-1.5 py-0.5 rounded bg-[#32353d] text-[10px] font-mono text-amber-300">
                            Key {selectedSong.musicalKey}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {(selectedSong.arrangement.length > 0
                          ? selectedSong.arrangement
                          : selectedSong.sections.map((s) => s.id)
                        ).map((secId, arrIdx) => {
                          const sec = selectedSong.sections.find((s) => s.id === secId)
                          if (!sec) return null
                          return (
                            <button
                              key={`${secId}-${arrIdx}`}
                              onClick={() => jumpToSectionNumber(arrIdx + 1)}
                              className={`px-2 py-0.5 rounded-sm text-[10px] font-bold text-white ${getProPresenterBarColor(
                                sec.type
                              )}`}
                            >
                              {sec.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingSong(selectedSong)
                        setCenterMode('edit')
                      }}
                      className="px-2.5 py-1 rounded bg-[#32353d] hover:bg-[#3d414b] text-[11px] font-semibold text-zinc-200 shrink-0"
                    >
                      Edit Song
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4">
                  {selectedSong ? (
                    slideViewStyle === 'grid' ? (
                      <div
                        className="grid gap-3.5"
                        style={{
                          gridTemplateColumns: `repeat(auto-fill, minmax(${slideCardWidth}px, 1fr))`
                        }}
                      >
                        {deckSlides.map((cue) => {
                          const isLive =
                            liveState.activeSongId === selectedSong.id &&
                            liveState.activeSlideGlobalIndex === cue.globalIndex &&
                            !liveState.clearText &&
                            !liveState.blackout

                          return (
                            <button
                              key={`${cue.id}-${cue.globalIndex}`}
                              onClick={() => triggerSlide(selectedSong, cue.globalIndex)}
                              className={`text-left rounded overflow-hidden bg-black flex flex-col transition-all ${
                                isLive
                                  ? 'ring-[3px] ring-[#ff6b00] shadow-[0_0_20px_rgba(255,107,0,0.35)]'
                                  : 'ring-1 ring-[#33363f] hover:ring-zinc-400'
                              }`}
                            >
                              <div className="aspect-video w-full px-3.5 py-2.5 flex flex-col items-center justify-center text-center bg-[#08090b]">
                                <p className="text-xs font-bold text-white whitespace-pre-line line-clamp-3 leading-snug">
                                  {cue.primaryText || '—'}
                                </p>
                                {cue.secondaryText && (
                                  <p className="mt-1 text-[11px] italic text-amber-300 whitespace-pre-line line-clamp-2 leading-snug">
                                    {cue.secondaryText}
                                  </p>
                                )}
                              </div>

                              <div
                                className={`px-2.5 py-1 ${getProPresenterBarColor(
                                  cue.sectionType
                                )} flex items-center justify-between text-[11px] font-bold text-white`}
                              >
                                <span className="truncate">
                                  <span className="opacity-80 mr-1.5">{cue.globalIndex + 1}</span>
                                  {cue.sectionLabel}
                                </span>
                                {cue.chords && (
                                  <span className="text-[9px] font-mono bg-black/30 px-1 rounded truncate max-w-[75px]">
                                    {cue.chords.split('\n')[0]}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {deckSlides.map((cue) => {
                          const isLive =
                            liveState.activeSongId === selectedSong.id &&
                            liveState.activeSlideGlobalIndex === cue.globalIndex &&
                            !liveState.clearText
                          return (
                            <div
                              key={`${cue.id}-${cue.globalIndex}`}
                              onClick={() => triggerSlide(selectedSong, cue.globalIndex)}
                              className={`px-3 py-2 rounded cursor-pointer flex items-center gap-3 ${
                                isLive
                                  ? 'bg-[#ff6b00]/20 border border-[#ff6b00]'
                                  : 'bg-[#232529] border border-[#2f323a] hover:bg-[#2b2e35]'
                              }`}
                            >
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold text-white w-24 text-center shrink-0 ${getProPresenterBarColor(
                                  cue.sectionType
                                )}`}
                              >
                                {cue.globalIndex + 1}. {cue.sectionLabel}
                              </span>
                              <div className="text-xs text-white font-medium flex-1">
                                {cue.primaryText.replace(/\n/g, ' / ')}
                              </div>
                              <div className="text-xs text-amber-300 italic flex-1">
                                {cue.secondaryText.replace(/\n/g, ' / ')}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  ) : null}
                </div>

                {/* Slide Footer & Zoom */}
                <div className="h-7 px-3 bg-[#232529] border-t border-[#141517] flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSlideViewStyle('grid')}
                      className={`p-1 rounded ${
                        slideViewStyle === 'grid' ? 'bg-[#363942] text-white' : 'hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSlideViewStyle('list')}
                      className={`p-1 rounded ${
                        slideViewStyle === 'list' ? 'bg-[#363942] text-white' : 'hover:text-white'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <span className="ml-2 text-zinc-500">
                      Space / Arrows = Next/Prev Slide • Keys 1–9 = Jump Section
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500">Zoom</span>
                    <input
                      type="range"
                      min={170}
                      max={340}
                      value={slideCardWidth}
                      onChange={(e) => setSlideCardWidth(Number(e.target.value))}
                      className="w-24 accent-zinc-400 h-1"
                    />
                  </div>
                </div>

                {/* MEDIA BIN */}
                {mediaBinOpen && (
                  <section className="h-52 bg-[#1e1f23] border-t border-[#111214] flex min-h-0 shrink-0">
                    <div className="w-48 bg-[#232428] border-r border-[#141517] flex flex-col justify-between shrink-0">
                      <div>
                        <div className="px-3 py-1.5 bg-[#2b2d31] border-b border-[#191a1d] text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Media Bin
                        </div>
                        <div className="py-1">
                          {MEDIA_BINS.map((bin) => (
                            <button
                              key={bin}
                              onClick={() => setActiveMediaBin(bin)}
                              className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                                activeMediaBin === bin
                                  ? 'bg-[#2563eb] text-white font-semibold'
                                  : 'text-zinc-300 hover:bg-[#2d2f35]'
                              }`}
                            >
                              <Folder className="w-3.5 h-3.5 shrink-0 opacity-85" />
                              <span className="truncate">{bin}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-2 border-t border-[#191a1d]">
                        <button
                          onClick={() => importVisuals(activeMediaBin)}
                          className="w-full py-1.5 px-2.5 rounded bg-[#32353e] hover:bg-[#3e424d] text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                          + Import Media
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="flex-1 overflow-y-auto p-3">
                        {binAssets.length === 0 ? (
                          <div className="h-full border border-dashed border-[#343741] rounded flex items-center justify-center text-xs text-zinc-400">
                            Click &quot;+ Import Media&quot; on the left to add `.png`, `.jpg`, or `.mp4` visuals.
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 xl:grid-cols-6 gap-3">
                            {binAssets.map((asset) => {
                              const isStandalone = activeMediaBin === 'Sermon & Events'
                              const isActive = isStandalone
                                ? liveState.foregroundMedia?.id === asset.id
                                : liveState.activeBackground?.id === asset.id &&
                                  !liveState.clearBackground

                              return (
                                <div
                                  key={asset.id}
                                  onClick={() =>
                                    isStandalone
                                      ? triggerForegroundGraphic(asset)
                                      : triggerBackgroundMedia(asset)
                                  }
                                  className={`group relative rounded overflow-hidden aspect-video bg-black cursor-pointer ${
                                    isActive
                                      ? 'ring-[3px] ring-[#ff6b00]'
                                      : 'ring-1 ring-[#343741] hover:ring-zinc-400'
                                  }`}
                                >
                                  {asset.mediaType === 'atmosphere' ? (
                                    <div
                                      className="absolute inset-0"
                                      style={{ background: asset.url }}
                                    />
                                  ) : asset.mediaType === 'video' ? (
                                    <video
                                      src={asset.url}
                                      muted
                                      loop
                                      onMouseEnter={(e) => e.currentTarget.play()}
                                      onMouseLeave={(e) => e.currentTarget.pause()}
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />
                                  ) : (
                                    <img
                                      src={asset.url}
                                      alt={asset.title}
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />
                                  )}

                                  <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-black/75 flex items-center justify-between text-[10px] text-white">
                                    <span className="truncate">{asset.title}</span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          addToService('media', asset.id)
                                        }}
                                        className="px-1 rounded bg-white/20 text-[9px] font-bold"
                                      >
                                        +Play
                                      </button>
                                      {asset.mediaType !== 'atmosphere' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            deleteMedia(asset.id)
                                          }}
                                          className="text-zinc-400 hover:text-red-400"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="h-6 px-3 bg-[#232529] border-t border-[#141517] flex items-center justify-between text-[10px] text-zinc-400">
                        <span>
                          {activeMediaBin === 'Sermon & Events'
                            ? 'Mode: Standalone Presentation Slide'
                            : 'Mode: Background Layer (Plays smoothly behind lyrics)'}
                        </span>
                        <span>Transition: Dissolve (0.4s)</span>
                      </div>
                    </div>
                  </section>
                )}
              </main>
            </>
          )}

          {/* =================================================================
              ZONE 5: RIGHT QUADRANT (Dynamic Screen Preview + Clear Stack + Show Controls)
             ================================================================= */}
          <aside className="w-[388px] bg-[#232428] border-l border-[#141517] flex flex-col min-h-0 shrink-0">
            {/* UPPER RIGHT: DYNAMIC PREVIEW + VERTICAL CLEAR LAYER COLUMN */}
            <div className="p-3 bg-[#1d1e22] border-b border-[#141517] space-y-2">
              <div className="flex gap-2 items-stretch">
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="rounded overflow-hidden border border-[#343741] bg-black shadow-lg">
                    {activePreviewProfile && (
                      <ScaledMonitorFrame
                        liveState={liveState}
                        profile={activePreviewProfile}
                        className="w-full aspect-video"
                      />
                    )}
                  </div>

                  {/* Dynamic Screen Selector (Lists ALL user-created Audience & Stage screens!) */}
                  <div className="flex items-center justify-between gap-2 bg-[#26282e] px-2 py-1 rounded border border-[#32353e]">
                    <select
                      value={activePreviewProfile?.id ?? ''}
                      onChange={(e) => setPreviewProfileId(e.target.value)}
                      className="bg-transparent text-[11px] font-semibold text-white focus:outline-none flex-1 truncate"
                    >
                      {outputProfiles.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#232529] text-white">
                          {p.enabled ? '● ' : '○ '} {p.name} ({p.screenType})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowDisplayMatrix(true)}
                      className="text-[10px] font-bold text-orange-400 hover:text-orange-300 shrink-0"
                    >
                      + Screens
                    </button>
                  </div>
                </div>

                {/* VERTICAL CLEAR LAYER STACK */}
                <div className="w-[62px] flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() =>
                      updateLiveFlags({
                        clearText: true,
                        clearBackground: true,
                        foregroundMedia: null,
                        showLogo: false,
                        audienceMessage: '',
                        stageAlert: '',
                        blackout: false
                      })
                    }
                    className={`flex-1 rounded border text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 transition ${
                      isAnyLayerLive
                        ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white shadow'
                        : 'bg-[#26282e] border-[#32353e] text-zinc-500'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Clear All
                  </button>

                  <button
                    onClick={() =>
                      updateLiveFlags({ clearText: true, foregroundMedia: null })
                    }
                    className={`py-1.5 rounded border text-[9px] font-bold flex flex-col items-center justify-center transition ${
                      isSlideLayerLive
                        ? 'bg-[#ff6b00] border-orange-300 text-white'
                        : 'bg-[#26282e] border-[#32353e] text-zinc-500'
                    }`}
                  >
                    <Type className="w-3 h-3" />
                    Slide
                  </button>

                  <button
                    onClick={() =>
                      updateLiveFlags({ clearBackground: true, foregroundMedia: null })
                    }
                    className={`py-1.5 rounded border text-[9px] font-bold flex flex-col items-center justify-center transition ${
                      isMediaLayerLive
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-[#26282e] border-[#32353e] text-zinc-500'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    Media
                  </button>

                  <button
                    onClick={() =>
                      updateLiveFlags({ showLogo: !liveState.showLogo, blackout: false })
                    }
                    className={`py-1.5 rounded border text-[9px] font-bold flex flex-col items-center justify-center transition ${
                      isPropsLogoLive
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-[#26282e] border-[#32353e] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Tv className="w-3 h-3" />
                    Logo
                  </button>

                  <button
                    onClick={() => updateLiveFlags({ blackout: !liveState.blackout })}
                    className={`py-1.5 rounded border text-[9px] font-bold flex flex-col items-center justify-center transition ${
                      liveState.blackout
                        ? 'bg-black border-red-500 text-red-400 ring-1 ring-red-500'
                        : 'bg-[#26282e] border-[#32353e] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                    Black
                  </button>
                </div>
              </div>
            </div>

            {/* LOWER RIGHT: SHOW CONTROLS DRAWER + FAR-RIGHT VERTICAL ICON RAIL */}
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 overflow-y-auto p-3.5">
                {activeShowControl === 'audio' && (
                  <AudioBinDrawer
                    tracks={audioTracks}
                    onImportAudio={importAudioTracks}
                    onDeleteAudio={deleteAudioTrack}
                  />
                )}

                {activeShowControl === 'timers' && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Timers & Countdown
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#18191c] border border-[#32353e] text-center space-y-3">
                      <div className="text-3xl font-mono font-extrabold text-emerald-400">
                        {formatTimerSeconds(liveState.timerSeconds)}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateLiveFlags({ timerRunning: !liveState.timerRunning })
                          }
                          className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 ${
                            liveState.timerRunning
                              ? 'bg-amber-500 text-black'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {liveState.timerRunning ? (
                            <>
                              <Pause className="w-3.5 h-3.5" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" /> Start
                            </>
                          )}
                        </button>
                        <button
                          onClick={() =>
                            updateLiveFlags({
                              timerSeconds: 0,
                              timerMode: 'elapsed',
                              timerRunning: false
                            })
                          }
                          className="px-2.5 py-1.5 rounded bg-[#2b2e36] text-zinc-300 hover:text-white"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] text-zinc-400">Countdown Presets:</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[5, 10, 25, 45].map((m) => (
                          <button
                            key={m}
                            onClick={() =>
                              updateLiveFlags({
                                timerSeconds: m * 60,
                                timerMode: 'countdown',
                                timerRunning: false
                              })
                            }
                            className="py-1.5 rounded bg-[#2b2e36] hover:bg-[#363a44] text-xs font-mono text-zinc-200"
                          >
                            {m}:00
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeShowControl === 'messages' && (
                  <div className="space-y-4">
                    {/* 1. Private Stage Message */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-orange-300">
                        1. Stage Message (Back TV Only)
                      </div>
                      <input
                        value={stageMsgDraft}
                        onChange={(e) => setStageMsgDraft(e.target.value)}
                        placeholder="e.g. Wrap up chorus — Pastor ready"
                        className="w-full px-2.5 py-1.5 rounded bg-[#18191c] border border-[#32353e] text-xs text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateLiveFlags({ stageAlert: stageMsgDraft })}
                          className="flex-1 py-1.5 rounded bg-[#ff6b00] hover:bg-orange-500 text-white text-xs font-bold"
                        >
                          Show on Stage
                        </button>
                        <button
                          onClick={() => {
                            setStageMsgDraft('')
                            updateLiveFlags({ stageAlert: '' })
                          }}
                          className="px-3 py-1.5 rounded bg-[#2b2e36] text-xs text-zinc-200"
                        >
                          Hide
                        </button>
                      </div>
                    </div>

                    {/* 2. Audience Notice / Childcare Number Banner */}
                    <div className="pt-3 border-t border-[#32353e] space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        2. Audience Notice (Top Banner)
                      </div>
                      <input
                        value={audienceMsgDraft}
                        onChange={(e) => setAudienceMsgDraft(e.target.value)}
                        placeholder="e.g. Parent #104 needed in Kids Room"
                        className="w-full px-2.5 py-1.5 rounded bg-[#18191c] border border-[#32353e] text-xs text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateLiveFlags({ audienceMessage: audienceMsgDraft })}
                          className="flex-1 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                        >
                          Show to Audience
                        </button>
                        <button
                          onClick={() => {
                            setAudienceMsgDraft('')
                            updateLiveFlags({ audienceMessage: '' })
                          }}
                          className="px-3 py-1.5 rounded bg-[#2b2e36] text-xs text-zinc-200"
                        >
                          Hide
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeShowControl === 'stage' && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Screens & Stage Controls ({outputProfiles.length} Configured)
                    </div>

                    <div className="p-3 rounded bg-[#18191c] border border-[#32353e] flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white">Band Chords on Stage</div>
                        <div className="text-[10px] text-zinc-400">
                          Show guitar/keys chords on Stage TVs
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          updateLiveFlags({ stageShowChords: !liveState.stageShowChords })
                        }
                        className={`px-3 py-1 rounded text-xs font-bold ${
                          liveState.stageShowChords
                            ? 'bg-cyan-600 text-white'
                            : 'bg-[#2b2e36] text-zinc-400'
                        }`}
                      >
                        {liveState.stageShowChords ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {outputProfiles.map((prof) => (
                        <div
                          key={prof.id}
                          className="px-3 py-2 rounded bg-[#18191c] border border-[#32353e] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-zinc-200 truncate">
                              {prof.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 uppercase">
                              {prof.screenType} • {prof.windowMode}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              saveOutputProfile({ ...prof, enabled: !prof.enabled })
                            }
                            className={`px-2.5 py-1 rounded text-[10px] font-bold shrink-0 ${
                              prof.enabled
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#2b2e36] text-zinc-400 hover:text-white'
                            }`}
                          >
                            {prof.enabled ? 'LIVE' : 'OFF'}
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setShowDisplayMatrix(true)}
                      className="w-full py-2 rounded bg-[#2d3039] hover:bg-[#383c47] text-xs font-bold text-orange-300"
                    >
                      + Add / Choose Physical Screens...
                    </button>
                  </div>
                )}

                {activeShowControl === 'keys' && (
                  <div className="space-y-1.5 text-xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Keyboard Shortcuts
                    </div>
                    {[
                      ['Cmd/Ctrl + F', 'Search Songs'],
                      ['Space / →', 'Next Slide'],
                      ['←', 'Previous Slide'],
                      ['1 – 9', 'Jump to Song Section'],
                      ['Esc / F1', 'Clear Slide Lyrics'],
                      ['F2', 'Clear Background Media'],
                      ['F3', 'Toggle Church Logo'],
                      ['F4', 'Blackout Screens']
                    ].map(([key, action]) => (
                      <div
                        key={key}
                        className="px-2.5 py-1.5 rounded bg-[#18191c] flex items-center justify-between"
                      >
                        <span className="text-zinc-300">{action}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-[#2b2e36] font-mono text-[10px] text-orange-300">
                          {key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FAR-RIGHT VERTICAL SHOW CONTROLS STRIP (Audio | Timers | Msgs | Stage | Keys) */}
              <div className="w-12 bg-[#1b1c20] border-l border-[#141517] flex flex-col items-center py-2 gap-1.5 shrink-0">
                {(
                  [
                    { id: 'audio', icon: Volume2, label: 'Audio' },
                    { id: 'timers', icon: Clock, label: 'Timers' },
                    { id: 'messages', icon: MessageSquare, label: 'Msgs' },
                    { id: 'stage', icon: Tv, label: 'Screens' },
                    { id: 'keys', icon: Keyboard, label: 'Keys' }
                  ] as const
                ).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveShowControl(id)}
                    className={`w-10 py-2 rounded-md flex flex-col items-center gap-1 transition ${
                      activeShowControl === id
                        ? 'bg-[#343741] text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#26282f]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Modals */}
      {showSearchModal && (
        <QuickSearchModal
          songs={songs}
          onSelectSong={(song) => {
            selectSongForDeck(song.id)
            setCenterMode('show')
          }}
          onAddToPlaylist={(song) => addToService('song', song.id)}
          onCreateNew={() => {
            setEditingSong(null)
            setCenterMode('edit')
          }}
          onClose={() => setShowSearchModal(false)}
        />
      )}

      {showDisplayMatrix && (
        <DisplayMatrixModal
          displays={displays}
          profiles={outputProfiles}
          storagePath={storagePath}
          onClose={() => setShowDisplayMatrix(false)}
          onRefreshDisplays={refreshDisplays}
          onIdentifyDisplays={identifyDisplays}
          onCreateProfile={createScreenProfile}
          onUpdateProfile={saveOutputProfile}
          onDeleteProfile={deleteOutputProfile}
          onExportBackup={exportBackup}
          onImportBackup={importBackup}
        />
      )}
    </div>
  )
}
