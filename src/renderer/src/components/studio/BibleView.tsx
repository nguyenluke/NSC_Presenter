import React, { useMemo, useState } from 'react'
import { BookOpen, Plus, Search, Send } from 'lucide-react'
import { SlideCue, SongInput } from '@shared/types'

interface ScriptureVerse {
  id: string
  refVi: string
  refEn: string
  textVi: string
  textEn: string
}

const BUILTIN_SCRIPTURES: ScriptureVerse[] = [
  {
    id: 'jn-3-16',
    refVi: 'Giăng 3:16',
    refEn: 'John 3:16',
    textVi:
      'Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con một của Ngài, hầu cho hễ ai tin Con ấy không bị hư mất mà được sự sống đời đời.',
    textEn:
      'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.'
  },
  {
    id: 'ps-23-1',
    refVi: 'Thi Thiên 23:1–2',
    refEn: 'Psalm 23:1–2',
    textVi:
      'Đức Giê-hô-va là Đấng chăn giữ tôi; tôi sẽ chẳng thiếu thốn gì. Ngài khiến tôi an nghỉ nơi đồng cỏ xanh tươi, dẫn tôi đến mé nước bình tịnh.',
    textEn:
      'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters.'
  },
  {
    id: 'ps-23-4',
    refVi: 'Thi Thiên 23:4',
    refEn: 'Psalm 23:4',
    textVi:
      'Dầu khi tôi đi trong trũng bóng chết, tôi cũng chẳng sợ tai họa nào; vì Chúa ở cùng tôi.',
    textEn:
      'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me.'
  },
  {
    id: 'rom-8-28',
    refVi: 'Rô-ma 8:28',
    refEn: 'Romans 8:28',
    textVi:
      'Vả, chúng ta biết rằng mọi sự hiệp lại làm ích cho kẻ yêu mến Đức Chúa Trời, tức là cho kẻ được gọi theo ý muốn Ngài đã định.',
    textEn:
      'And we know that for those who love God all things work together for good, for those who are called according to his purpose.'
  },
  {
    id: 'phil-4-6',
    refVi: 'Phi-líp 4:6–7',
    refEn: 'Philippians 4:6–7',
    textVi:
      'Chớ lo phiền chi hết, nhưng trong mọi sự hãy dùng lời cầu nguyện, nài xin, và sự tạ ơn mà trình các sự cầu xin của mình cho Đức Chúa Trời.',
    textEn:
      'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.'
  },
  {
    id: 'phil-4-13',
    refVi: 'Phi-líp 4:13',
    refEn: 'Philippians 4:13',
    textVi: 'Tôi làm được mọi sự nhờ Đấng ban thêm sức cho tôi.',
    textEn: 'I can do all things through him who strengthens me.'
  },
  {
    id: 'isa-40-31',
    refVi: 'Ê-sai 40:31',
    refEn: 'Isaiah 40:31',
    textVi:
      'Nhưng ai trông đợi Đức Giê-hô-va thì chắc được sức mới, cất cánh bay cao như chim ưng; chạy mà không mệt nhọc, đi mà không mòn mỏi.',
    textEn:
      'But they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary.'
  },
  {
    id: 'jer-29-11',
    refVi: 'Giê-rê-mi 29:11',
    refEn: 'Jeremiah 29:11',
    textVi:
      'Đức Giê-hô-va phán: Vì Ta biết ý tưởng Ta nghĩ đối cùng các ngươi, là ý tưởng bình an, không phải tai họa, để cho các ngươi được sự trông cậy trong lúc cuối cùng.',
    textEn:
      'For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.'
  }
]

interface BibleViewProps {
  onProjectSlide: (title: string, current: SlideCue, next: SlideCue | null) => Promise<void>
  onSaveAsPlaylistItem: (input: SongInput) => Promise<void>
}

/**
 * ProPresenter 7 "Bible" Mode:
 * Lets volunteers search & project Bilingual Scripture verses in 1 click during a sermon,
 * OR paste any custom Bible verse on the fly and project/save it to Sunday's Playlist!
 */
export const BibleView: React.FC<BibleViewProps> = ({
  onProjectSlide,
  onSaveAsPlaylistItem
}) => {
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string>('')
  const [customRef, setCustomRef] = useState('')
  const [customVi, setCustomVi] = useState('')
  const [customEn, setCustomEn] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return BUILTIN_SCRIPTURES
    return BUILTIN_SCRIPTURES.filter(
      (v) =>
        v.refVi.toLowerCase().includes(q) ||
        v.refEn.toLowerCase().includes(q) ||
        v.textVi.toLowerCase().includes(q) ||
        v.textEn.toLowerCase().includes(q)
    )
  }, [query])

  const projectVerse = async (v: ScriptureVerse, index: number): Promise<void> => {
    setActiveId(v.id)
    const nextItem = filtered[index + 1]
    const cue: SlideCue = {
      id: v.id,
      primaryText: `${v.textVi}\n— ${v.refVi}`,
      secondaryText: `${v.textEn}\n— ${v.refEn}`,
      sectionId: 'bible',
      sectionLabel: `${v.refVi} / ${v.refEn}`,
      sectionType: 'Verse',
      globalIndex: index
    }
    const nextCue: SlideCue | null = nextItem
      ? {
          id: nextItem.id,
          primaryText: `${nextItem.textVi}\n— ${nextItem.refVi}`,
          secondaryText: `${nextItem.textEn}\n— ${nextItem.refEn}`,
          sectionId: 'bible',
          sectionLabel: `${nextItem.refVi} / ${nextItem.refEn}`,
          sectionType: 'Verse',
          globalIndex: index + 1
        }
      : null
    await onProjectSlide(`${v.refVi} (${v.refEn})`, cue, nextCue)
  }

  const handleProjectCustom = async (): Promise<void> => {
    if (!customVi.trim() && !customEn.trim()) return
    const label = customRef.trim() || 'Scripture Reading'
    setActiveId('custom')
    await onProjectSlide(
      label,
      {
        id: 'custom-bible',
        primaryText: customRef ? `${customVi}\n— ${customRef}` : customVi,
        secondaryText: customEn,
        sectionId: 'bible',
        sectionLabel: label,
        sectionType: 'Verse',
        globalIndex: 0
      },
      null
    )
  }

  const handleSaveCustomToPlaylist = async (): Promise<void> => {
    if (!customVi.trim() && !customEn.trim()) return
    const title = customRef.trim() || 'Kinh Thánh / Scripture'
    await onSaveAsPlaylistItem({
      titlePrimary: title,
      titleSecondary: 'Scripture Slide',
      author: 'Bible',
      musicalKey: '',
      bpm: 0,
      arrangement: ['sec-bible'],
      sections: [
        {
          id: 'sec-bible',
          type: 'Verse',
          label: title,
          slides: [
            {
              id: `bible-${Date.now()}`,
              primaryText: customRef ? `${customVi}\n— ${customRef}` : customVi,
              secondaryText: customEn
            }
          ]
        }
      ]
    })
    setCustomRef('')
    setCustomVi('')
    setCustomEn('')
  }

  return (
    <div className="flex-1 flex min-h-0 bg-[#18191b]">
      {/* Left: Quick Custom Verse Projector (For any spontaneous sermon verse!) */}
      <div className="w-96 bg-[#232428] border-r border-[#141517] p-4 flex flex-col justify-between overflow-y-auto shrink-0">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <BookOpen className="w-4 h-4" />
            Quick Scripture Projector
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            When the Pastor calls out any verse mid-sermon, type or paste it here to project live or add to Sunday&apos;s Playlist:
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
              Book & Verse Reference
            </label>
            <input
              value={customRef}
              onChange={(e) => setCustomRef(e.target.value)}
              placeholder="e.g. Ма-thi-ơ 11:28 / Matthew 11:28"
              className="w-full px-3 py-1.5 rounded bg-[#16171a] border border-[#343741] text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
              Language 1 Scripture (Top)
            </label>
            <textarea
              rows={4}
              value={customVi}
              onChange={(e) => setCustomVi(e.target.value)}
              placeholder="Paste Vietnamese scripture text..."
              className="w-full p-2.5 rounded bg-[#16171a] border border-[#343741] text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-amber-300 mb-1">
              Language 2 Scripture (Bottom)
            </label>
            <textarea
              rows={4}
              value={customEn}
              onChange={(e) => setCustomEn(e.target.value)}
              placeholder="Paste English scripture text..."
              className="w-full p-2.5 rounded bg-[#16171a] border border-[#343741] text-xs text-amber-200"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleProjectCustom}
              className="flex-1 py-2 rounded-md bg-[#ff6b00] hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Project Live Now
            </button>
            <button
              onClick={handleSaveCustomToPlaylist}
              className="px-3 py-2 rounded-md bg-[#343741] hover:bg-[#414552] text-white text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Save to Playlist
            </button>
          </div>
        </div>
      </div>

      {/* Center/Right: Instant Bilingual Scripture Search & 16:9 Cards */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3.5 bg-[#232529] border-b border-[#141517] flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Scripture (e.g. John 3:16, Giăng, Thi Thiên 23, Romans 8)..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#151619] border border-[#353842] text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <span className="text-xs text-zinc-400">
            Click any card below to send straight to Audience & Stage screens
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
          {filtered.map((v, idx) => {
            const isLive = activeId === v.id
            return (
              <button
                key={v.id}
                onClick={() => projectVerse(v, idx)}
                className={`text-left rounded-lg overflow-hidden bg-[#0c0d10] flex flex-col justify-between transition ${
                  isLive
                    ? 'ring-[3px] ring-[#ff6b00] shadow-lg'
                    : 'ring-1 ring-[#33363f] hover:ring-zinc-400'
                }`}
              >
                <div className="p-4 space-y-2">
                  <p className="text-xs font-bold text-white leading-relaxed">{v.textVi}</p>
                  <p className="text-[11px] italic text-amber-300 leading-relaxed">{v.textEn}</p>
                </div>
                <div className="px-3 py-1.5 bg-[#059669] flex items-center justify-between text-[11px] font-bold text-white">
                  <span>{v.refVi}</span>
                  <span>{v.refEn}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
