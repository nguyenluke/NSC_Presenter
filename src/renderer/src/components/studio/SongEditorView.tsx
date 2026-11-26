import React, { useState } from 'react'
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react'
import { SongSlidePreview } from './SongSlidePreview'
import { BilingualSlide, LivePresentationState, OutputProfile, SectionType, Song, SongInput, SongSection } from '@shared/types'

interface SongEditorViewProps {
  initialSong?: Song | null
  previewProfile?: OutputProfile
  liveState: LivePresentationState
  onCancel: () => void
  onSave: (input: SongInput) => Promise<void>
}

const SECTION_TYPES: SectionType[] = [
  'Intro',
  'Verse',
  'PreChorus',
  'Chorus',
  'Bridge',
  'Tag',
  'Outro'
]

export function getProPresenterBarColor(type: SectionType): string {
  switch (type) {
    case 'Chorus':
      return 'bg-[#e11d48]' // ProPresenter Coral/Red for Chorus
    case 'Bridge':
      return 'bg-[#9333ea]' // ProPresenter Purple for Bridge
    case 'PreChorus':
      return 'bg-[#059669]' // ProPresenter Green for Pre-Chorus
    case 'Tag':
    case 'Outro':
      return 'bg-[#d97706]' // Amber for Tag/Outro
    default:
      return 'bg-[#2563eb]' // ProPresenter Classic Blue for Verse
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * ProPresenter 7 "Edit" Mode Workspace:
 * Left: Visual slide list | Center/Right: Live 16:9 Slide Canvas + Clean Bilingual Inputs
 */
export const SongEditorView: React.FC<SongEditorViewProps> = ({
  initialSong,
  previewProfile,
  liveState,
  onCancel,
  onSave
}) => {
  const [titlePrimary, setTitlePrimary] = useState(initialSong?.titlePrimary ?? '')
  const [titleSecondary, setTitleSecondary] = useState(initialSong?.titleSecondary ?? '')
  const [author, setAuthor] = useState(initialSong?.author ?? '')
  const [musicalKey, setMusicalKey] = useState(initialSong?.musicalKey ?? 'G')
  const [bpm, setBpm] = useState(initialSong?.bpm ?? 70)

  const [sections, setSections] = useState<SongSection[]>(
    initialSong?.sections ?? [
      {
        id: 'sec-v1',
        type: 'Verse',
        label: 'Verse 1',
        slides: [{ id: uid('sl'), primaryText: '', secondaryText: '', chords: '' }]
      },
      {
        id: 'sec-c1',
        type: 'Chorus',
        label: 'Chorus',
        slides: [{ id: uid('sl'), primaryText: '', secondaryText: '', chords: '' }]
      }
    ]
  )
  const [arrangement, setArrangement] = useState<string[]>(
    initialSong?.arrangement ?? ['sec-v1', 'sec-c1']
  )

  const [activeSecId, setActiveSecId] = useState<string>(sections[0]?.id ?? 'sec-v1')
  const [activeSlideId, setActiveSlideId] = useState<string>(
    sections[0]?.slides[0]?.id ?? ''
  )
  const [showQuickPaste, setShowQuickPaste] = useState(false)
  const [quickPasteText, setQuickPasteText] = useState('')
  const [saving, setSaving] = useState(false)

  const activeSection = sections.find((s) => s.id === activeSecId) ?? sections[0]
  const activeSlide =
    activeSection?.slides.find((sl) => sl.id === activeSlideId) ?? activeSection?.slides[0]

  const addSection = (type: SectionType): void => {
    const count = sections.filter((s) => s.type === type).length + 1
    const label = type === 'Chorus' && count === 1 ? 'Chorus' : `${type} ${count}`
    const newSlideId = uid('sl')
    const newSec: SongSection = {
      id: uid('sec'),
      type,
      label,
      slides: [{ id: newSlideId, primaryText: '', secondaryText: '', chords: '' }]
    }
    setSections([...sections, newSec])
    setArrangement([...arrangement, newSec.id])
    setActiveSecId(newSec.id)
    setActiveSlideId(newSlideId)
  }

  const addSlideToCurrentSection = (): void => {
    if (!activeSection) return
    const newSlideId = uid('sl')
    setSections(
      sections.map((s) =>
        s.id === activeSection.id
          ? {
              ...s,
              slides: [
                ...s.slides,
                { id: newSlideId, primaryText: '', secondaryText: '', chords: '' }
              ]
            }
          : s
      )
    )
    setActiveSlideId(newSlideId)
  }

  const updateActiveSlide = (patch: Partial<BilingualSlide>): void => {
    if (!activeSection || !activeSlide) return
    setSections(
      sections.map((s) =>
        s.id === activeSection.id
          ? {
              ...s,
              slides: s.slides.map((sl) =>
                sl.id === activeSlide.id ? { ...sl, ...patch } : sl
              )
            }
          : s
      )
    )
  }

  const deleteSlide = (secId: string, slideId: string): void => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId || s.slides.length <= 1) return s
        const remaining = s.slides.filter((sl) => sl.id !== slideId)
        if (activeSlideId === slideId) {
          setActiveSlideId(remaining[0].id)
        }
        return { ...s, slides: remaining }
      })
    )
  }

  const deleteSection = (secId: string): void => {
    if (sections.length <= 1) return
    const remaining = sections.filter((s) => s.id !== secId)
    setSections(remaining)
    setArrangement(arrangement.filter((id) => id !== secId))
    if (activeSecId === secId) {
      setActiveSecId(remaining[0].id)
      setActiveSlideId(remaining[0].slides[0]?.id ?? '')
    }
  }

  const handleApplyQuickPaste = (): void => {
    const blocks = quickPasteText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)
    if (blocks.length === 0) return

    const generatedSlides: BilingualSlide[] = blocks.map((block) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length === 1) {
        return { id: uid('sl'), primaryText: lines[0], secondaryText: '', chords: '' }
      }
      const half = Math.ceil(lines.length / 2)
      return {
        id: uid('sl'),
        primaryText: lines.slice(0, half).join('\n'),
        secondaryText: lines.slice(half).join('\n'),
        chords: ''
      }
    })

    const newSec: SongSection = {
      id: uid('sec'),
      type: 'Verse',
      label: `Section ${sections.length + 1}`,
      slides: generatedSlides
    }
    setSections([...sections, newSec])
    setArrangement([...arrangement, newSec.id])
    setActiveSecId(newSec.id)
    setActiveSlideId(generatedSlides[0].id)
    setQuickPasteText('')
    setShowQuickPaste(false)
  }

  const handleSave = async (): Promise<void> => {
    if (!titlePrimary.trim()) return
    setSaving(true)
    await onSave({
      id: initialSong?.id,
      titlePrimary: titlePrimary.trim(),
      titleSecondary: titleSecondary.trim(),
      author: author.trim(),
      musicalKey: musicalKey.trim() || 'G',
      bpm: Number(bpm) || 70,
      sections,
      arrangement: arrangement.length > 0 ? arrangement : sections.map((s) => s.id)
    })
    setSaving(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#18191c]">
      {/* Top Song Info Bar */}
      <div className="px-5 py-3 bg-[#22242a] border-b border-[#32353e] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-64">
            <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-0.5">
              Song Title (Language 1) *
            </label>
            <input
              value={titlePrimary}
              onChange={(e) => setTitlePrimary(e.target.value)}
              placeholder="e.g. Đấng Mở Đường"
              className="w-full px-3 py-1.5 rounded-md bg-[#141518] border border-[#383b46] text-sm font-semibold text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="w-64">
            <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-0.5">
              Secondary Title (Language 2)
            </label>
            <input
              value={titleSecondary}
              onChange={(e) => setTitleSecondary(e.target.value)}
              placeholder="e.g. Way Maker"
              className="w-full px-3 py-1.5 rounded-md bg-[#141518] border border-[#383b46] text-sm text-amber-200 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="w-20">
            <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-0.5">
              Key
            </label>
            <input
              value={musicalKey}
              onChange={(e) => setMusicalKey(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#141518] border border-[#383b46] text-sm font-mono text-white text-center"
            />
          </div>
          <div className="w-44">
            <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-0.5">
              Artist / Author
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
              className="w-full px-2.5 py-1.5 rounded-md bg-[#141518] border border-[#383b46] text-sm text-zinc-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowQuickPaste(!showQuickPaste)}
            className="px-3 py-2 rounded-md bg-[#2c2f38] hover:bg-[#363a45] border border-[#424654] text-xs font-semibold text-cyan-300 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Quick Paste Lyrics
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-[#2c2f38] hover:bg-[#363a45] text-xs font-semibold text-zinc-200"
          >
            Back to Show
          </button>
          <button
            type="button"
            disabled={saving || !titlePrimary.trim()}
            onClick={handleSave}
            className="px-5 py-2 rounded-md bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Song'}
          </button>
        </div>
      </div>

      {/* Main ProPresenter Slide Reflow / Visual Editor Split */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT COLUMN: Visual Slide Thumbnails Grouped by Section */}
        <div className="w-80 bg-[#1e2025] border-r border-[#32353e] flex flex-col min-h-0">
          <div className="p-2.5 border-b border-[#32353e] flex items-center gap-1.5 flex-wrap">
            {(['Verse', 'Chorus', 'Bridge', 'Tag'] as SectionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addSection(t)}
                className="px-2.5 py-1 rounded bg-[#2b2e37] hover:bg-[#373b47] text-[11px] font-semibold text-zinc-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-orange-400" /> {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {sections.map((sec) => (
              <div key={sec.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                    {sec.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSecId(sec.id)
                        const id = uid('sl')
                        setSections(
                          sections.map((s) =>
                            s.id === sec.id
                              ? {
                                  ...s,
                                  slides: [
                                    ...s.slides,
                                    { id, primaryText: '', secondaryText: '', chords: '' }
                                  ]
                                }
                              : s
                          )
                        )
                        setActiveSlideId(id)
                      }}
                      className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold"
                    >
                      + Slide
                    </button>
                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteSection(sec.id)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {sec.slides.map((sl, idx) => {
                    const isSelected = activeSection?.id === sec.id && activeSlide?.id === sl.id
                    return (
                      <div
                        key={sl.id}
                        onClick={() => {
                          setActiveSecId(sec.id)
                          setActiveSlideId(sl.id)
                        }}
                        className={`rounded-md overflow-hidden cursor-pointer border-2 transition ${
                          isSelected
                            ? 'border-orange-500 shadow-[0_0_0_2px_rgba(249,115,22,0.25)]'
                            : 'border-[#32353e] hover:border-zinc-500'
                        }`}
                      >
                        <SongSlidePreview slide={sl} profile={previewProfile} liveState={liveState} />
                        <div
                          className={`px-2.5 py-1 ${getProPresenterBarColor(
                            sec.type
                          )} flex items-center justify-between text-[10px] font-bold text-white`}
                        >
                          <span>
                            {idx + 1}. {sec.label}
                          </span>
                          {sec.slides.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteSlide(sec.id, sl.id)
                              }}
                              className="opacity-80 hover:opacity-100"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER / RIGHT: Live 16:9 Slide Preview + Clean Side-by-Side Text Boxes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {showQuickPaste && (
            <div className="p-4 rounded-xl bg-[#22252e] border border-cyan-500/40 space-y-3">
              <div className="text-xs text-cyan-200 font-semibold">
                Paste lyrics separated by blank lines (Top line = Language 1, Bottom line = Language 2):
              </div>
              <textarea
                rows={5}
                value={quickPasteText}
                onChange={(e) => setQuickPasteText(e.target.value)}
                placeholder={`Chúa đang ở đây\nYou are here\n\nĐấng mở đường, làm phép lạ\nWay maker, miracle worker`}
                className="w-full p-3 rounded-lg bg-[#141518] border border-[#383b46] text-sm text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickPaste(false)}
                  className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyQuickPaste}
                  className="px-4 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Create Slides Automatically
                </button>
              </div>
            </div>
          )}

          {/* Live 16:9 Slide Preview Card */}
          {activeSection && activeSlide && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="w-full rounded border border-[#383b46] overflow-hidden bg-black">
                <SongSlidePreview slide={{ ...activeSlide, primaryText: activeSlide.primaryText || 'Type Language 1 lyrics below…' }} profile={previewProfile} liveState={liveState} />
                <div className={`px-4 py-1.5 ${getProPresenterBarColor(activeSection.type)} text-xs font-semibold text-white flex justify-between`}>
                  <span>{activeSection.label}</span><span>Slide Preview</span>
                </div>
              </div>

              {/* Section Type & Label Controls */}
              <div className="flex items-center justify-between gap-3 bg-[#22242a] p-3 rounded-lg border border-[#32353e]">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-zinc-400">Section Group:</label>
                  <select
                    value={activeSection.type}
                    onChange={(e) =>
                      setSections(
                        sections.map((s) =>
                          s.id === activeSection.id
                            ? { ...s, type: e.target.value as SectionType }
                            : s
                        )
                      )
                    }
                    className="px-2.5 py-1.5 rounded bg-[#141518] border border-[#383b46] text-xs font-semibold text-white"
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={activeSection.label}
                    onChange={(e) =>
                      setSections(
                        sections.map((s) =>
                          s.id === activeSection.id ? { ...s, label: e.target.value } : s
                        )
                      )
                    }
                    className="px-2.5 py-1.5 rounded bg-[#141518] border border-[#383b46] text-xs font-semibold text-white w-36"
                  />
                </div>

                <button
                  type="button"
                  onClick={addSlideToCurrentSection}
                  className="px-3 py-1.5 rounded bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold"
                >
                  + Add Next Slide in {activeSection.label}
                </button>
              </div>

              {/* Side-by-Side Bilingual Lyric Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#22242a] p-3.5 rounded-lg border border-[#32353e]">
                  <label className="block text-xs font-bold text-white mb-2">
                    Language 1 (Main Lyrics — Top)
                  </label>
                  <textarea
                    rows={4}
                    value={activeSlide.primaryText}
                    onChange={(e) => updateActiveSlide({ primaryText: e.target.value })}
                    placeholder="Enter Vietnamese / Primary lyrics..."
                    className="w-full p-3 rounded-md bg-[#141518] border border-[#383b46] text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="bg-[#22242a] p-3.5 rounded-lg border border-[#32353e]">
                  <label className="block text-xs font-bold text-amber-300 mb-2">
                    Language 2 (Translation — Bottom)
                  </label>
                  <textarea
                    rows={4}
                    value={activeSlide.secondaryText}
                    onChange={(e) => updateActiveSlide({ secondaryText: e.target.value })}
                    placeholder="Enter English / Secondary lyrics..."
                    className="w-full p-3 rounded-md bg-[#141518] border border-[#383b46] text-sm text-amber-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Optional Chords + Song Arrangement Order */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-5 bg-[#22242a] p-3.5 rounded-lg border border-[#32353e]">
                  <label className="block text-xs font-bold text-cyan-300 mb-1.5">
                    Back Stage TV Chords (Optional)
                  </label>
                  <input
                    value={activeSlide.chords ?? ''}
                    onChange={(e) => updateActiveSlide({ chords: e.target.value })}
                    placeholder="e.g.  C    G    D    Em"
                    className="w-full px-3 py-2 rounded bg-[#141518] border border-[#383b46] text-sm font-mono text-cyan-300"
                  />
                </div>

                <div className="col-span-7 bg-[#22242a] p-3.5 rounded-lg border border-[#32353e] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">
                      Song Arrangement (Reuse Chorus without retyping!)
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {sections.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setArrangement([...arrangement, s.id])}
                          className="px-2 py-0.5 rounded bg-[#2f333d] hover:bg-orange-500 text-[10px] font-bold text-white"
                        >
                          + {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {arrangement.map((secId, idx) => {
                      const sec = sections.find((s) => s.id === secId)
                      if (!sec) return null
                      return (
                        <span
                          key={`${secId}-${idx}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold text-white ${getProPresenterBarColor(
                            sec.type
                          )}`}
                        >
                          {sec.label}
                          <button
                            type="button"
                            onClick={() =>
                              setArrangement(arrangement.filter((_, i) => i !== idx))
                            }
                            className="opacity-75 hover:opacity-100"
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
