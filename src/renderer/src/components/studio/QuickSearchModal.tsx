import React, { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Song } from '@shared/types'

interface QuickSearchModalProps {
  songs: Song[]
  onSelectSong: (song: Song) => void
  onAddToPlaylist: (song: Song) => void
  onCreateNew: () => void
  onClose: () => void
}

/**
 * ProPresenter 7 Top-Left "Search" Command Popup (Cmd+F / Toolbar Search icon)
 */
export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  songs,
  onSelectSong,
  onAddToPlaylist,
  onCreateNew,
  onClose
}) => {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return songs
    return songs.filter((s) => {
      if (
        s.titlePrimary.toLowerCase().includes(q) ||
        s.titleSecondary.toLowerCase().includes(q) ||
        s.author.toLowerCase().includes(q)
      ) {
        return true
      }
      return s.sections.some((sec) =>
        sec.slides.some(
          (sl) =>
            sl.primaryText.toLowerCase().includes(q) ||
            sl.secondaryText.toLowerCase().includes(q)
        )
      )
    })
  }, [songs, query])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl bg-[#25272d] border border-[#3d404a] shadow-2xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[#363942] flex items-center gap-3">
          <Search className="w-4 h-4 text-orange-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Library by Vietnamese or English title or lyrics..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-400 focus:outline-none"
          />
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-[#31343d]">
          {results.map((song) => (
            <div
              key={song.id}
              onClick={() => {
                onSelectSong(song)
                onClose()
              }}
              className="px-4 py-2.5 hover:bg-[#313540] cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-white">
                  {song.titlePrimary}{' '}
                  {song.titleSecondary && (
                    <span className="text-zinc-400 font-normal">— {song.titleSecondary}</span>
                  )}
                </div>
                <div className="text-xs text-zinc-400">
                  Key: {song.musicalKey} • {song.sections.length} sections
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToPlaylist(song)
                  onClose()
                }}
                className="px-2.5 py-1 rounded bg-[#3b404e] hover:bg-orange-500 text-xs font-semibold text-white"
              >
                + Playlist
              </button>
            </div>
          ))}

          {results.length === 0 && (
            <div className="p-6 text-center space-y-2">
              <div className="text-xs text-zinc-400">No matching song found in Library.</div>
              <button
                onClick={() => {
                  onClose()
                  onCreateNew()
                }}
                className="px-3 py-1.5 rounded bg-orange-500 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create New Bilingual Song
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
