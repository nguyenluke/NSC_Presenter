import React, { useState } from 'react'
import { Check, Plus, SplitSquareVertical, Trash2 } from 'lucide-react'
import { SectionType, Song, SongInput, SongSection } from '@shared/types'
import { getProPresenterBarColor } from './SongEditorView'

interface ReflowEditorViewProps {
  song: Song | null
  onSave: (input: SongInput) => Promise<void>
  onSwitchToShow: () => void
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * ProPresenter 7 "Reflow" Editor:
 * Left side: Rapid continuous text blocks per slide/section (like typing in a doc)
 * Right side: Live 16:9 Slide Thumbnails updating in real time!
 */
export const ReflowEditorView: React.FC<ReflowEditorViewProps> = ({
  song,
  onSave,
  onSwitchToShow
}) => {
  const [titlePrimary, setTitlePrimary] = useState(song?.titlePrimary ?? 'New Worship Song')
  const [titleSecondary, setTitleSecondary] = useState(song?.titleSecondary ?? '')
  const [musicalKey, setMusicalKey] = useState(song?.musicalKey ?? 'G')
  const [sections, setSections] = useState<SongSection[]>(
    song?.sections ?? [
      {
        id: 'sec-v1',
        type: 'Verse',
        label: 'Verse 1',
        slides: [{ id: uid('sl'), primaryText: '', secondaryText: '', chords: '' }]
      }
    ]
  )
  const [arrangement, setArrangement] = useState<string[]>(
    song?.arrangement ?? sections.map((s) => s.id)
  )
  const [saving, setSaving] = useState(false)

  const addSection = (type: SectionType): void => {
    const count = sections.filter((s) => s.type === type).length + 1
    const label = type === 'Chorus' && count === 1 ? 'Chorus' : `${type} ${count}`
    const newSec: SongSection = {
      id: uid('sec'),
      type,
      label,
      slides: [{ id: uid('sl'), primaryText: '', secondaryText: '', chords: '' }]
    }
    setSections([...sections, newSec])
    setArrangement([...arrangement, newSec.id])
  }

  const insertSlideBreak = (secId: string, afterIdx: number): void => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s
        const nextSlides = [...s.slides]
        nextSlides.splice(afterIdx + 1, 0, {
          id: uid('sl'),
          primaryText: '',
          secondaryText: '',
          chords: ''
        })
        return { ...s, slides: nextSlides }
      })
    )
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    await onSave({
      id: song?.id,
      titlePrimary: titlePrimary.trim() || 'Untitled Song',
      titleSecondary: titleSecondary.trim(),
      author: song?.author ?? '',
      musicalKey,
      bpm: song?.bpm ?? 70,
      sections,
      arrangement: arrangement.length > 0 ? arrangement : sections.map((s) => s.id)
    })
    setSaving(false)
    onSwitchToShow()
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1e1f23]">
      {/* Reflow Sub-Toolbar */}
      <div className="px-4 py-2 bg-[#26282e] border-b border-[#343740] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <input
            value={titlePrimary}
            onChange={(e) => setTitlePrimary(e.target.value)}
            placeholder="Primary Song Title"
            className="px-2.5 py-1 rounded bg-[#17181c] border border-[#3a3d47] text-xs font-bold text-white w-56"
          />
          <input
            value={titleSecondary}
            onChange={(e) => setTitleSecondary(e.target.value)}
            placeholder="Secondary Title (English/VN)"
            className="px-2.5 py-1 rounded bg-[#17181c] border border-[#3a3d47] text-xs text-amber-200 w-52"
          />
          <div className="flex items-center gap-1 ml-2">
            {(['Verse', 'Chorus', 'Bridge', 'Tag'] as SectionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addSection(t)}
                className="px-2.5 py-1 rounded bg-[#32353f] hover:bg-[#3d414d] text-[11px] font-semibold text-zinc-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-orange-400" /> {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save & Return to Show'}
          </button>
        </div>
      </div>

      {/* ProPresenter Reflow Split View: Left = Text Flow | Right = Live Slide Preview Grid */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Continuous Reflow Text Blocks */}
        <div className="w-[46%] border-r border-[#343740] overflow-y-auto p-4 space-y-4 bg-[#1a1b1f]">
          {sections.map((sec) => (
            <div
              key={sec.id}
              className="rounded-lg border border-[#343740] bg-[#23252b] overflow-hidden"
            >
              <div
                className={`px-3 py-1.5 ${getProPresenterBarColor(
                  sec.type
                )} flex items-center justify-between text-xs font-bold text-white`}
              >
                <input
                  value={sec.label}
                  onChange={(e) =>
                    setSections(
                      sections.map((s) => (s.id === sec.id ? { ...s, label: e.target.value } : s))
                    )
                  }
                  className="bg-transparent border-b border-white/30 focus:outline-none text-xs font-bold text-white w-36"
                />
                {sections.length > 1 && (
                  <button
                    onClick={() => {
                      setSections(sections.filter((s) => s.id !== sec.id))
                      setArrangement(arrangement.filter((id) => id !== sec.id))
                    }}
                    className="opacity-80 hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="p-3 space-y-3">
                {sec.slides.map((sl, idx) => (
                  <div key={sl.id} className="space-y-1.5 pb-2.5 border-b border-[#32353e] last:border-b-0">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                      <span>SLIDE {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => insertSlideBreak(sec.id, idx)}
                        className="text-orange-400 hover:text-orange-300 flex items-center gap-1"
                      >
                        <SplitSquareVertical className="w-3 h-3" /> + Insert Slide Break Below
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={sl.primaryText}
                      onChange={(e) =>
                        setSections(
                          sections.map((s) =>
                            s.id === sec.id
                              ? {
                                  ...s,
                                  slides: s.slides.map((item) =>
                                    item.id === sl.id
                                      ? { ...item, primaryText: e.target.value }
                                      : item
                                  )
                                }
                              : s
                          )
                        )
                      }
                      placeholder="Language 1 lyrics..."
                      className="w-full p-2 rounded bg-[#141518] border border-[#343740] text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                    <textarea
                      rows={2}
                      value={sl.secondaryText}
                      onChange={(e) =>
                        setSections(
                          sections.map((s) =>
                            s.id === sec.id
                              ? {
                                  ...s,
                                  slides: s.slides.map((item) =>
                                    item.id === sl.id
                                      ? { ...item, secondaryText: e.target.value }
                                      : item
                                  )
                                }
                              : s
                          )
                        )
                      }
                      placeholder="Language 2 translation..."
                      className="w-full p-2 rounded bg-[#141518] border border-[#343740] text-xs text-amber-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Real-Time 16:9 Slide Cards Preview */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#16171a]">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Live Reflow Slide Preview
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {sections.flatMap((sec) =>
              sec.slides.map((sl, idx) => (
                <div
                  key={sl.id}
                  className="rounded-md overflow-hidden ring-1 ring-[#32353e] bg-black flex flex-col"
                >
                  <div className="aspect-video p-3 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-white whitespace-pre-line line-clamp-3">
                      {sl.primaryText || '—'}
                    </p>
                    {sl.secondaryText && (
                      <p className="text-[10px] italic text-amber-300 mt-1 whitespace-pre-line line-clamp-2">
                        {sl.secondaryText}
                      </p>
                    )}
                  </div>
                  <div
                    className={`px-2.5 py-1 ${getProPresenterBarColor(
                      sec.type
                    )} text-[10px] font-bold text-white`}
                  >
                    {sec.label} ({idx + 1})
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
