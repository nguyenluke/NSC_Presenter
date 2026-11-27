import React from 'react'
import { LivePresentationState, MediaAsset } from '@shared/types'

export const DocumentDeck: React.FC<{ pages: MediaAsset[]; liveState: LivePresentationState; onCue: (asset: MediaAsset) => void; onClose: () => void }> = ({ pages, liveState, onCue, onClose }) => (
  <div className="flex flex-col flex-1 min-h-0">
    <header className="px-4 py-2 bg-[#232529] border-b border-[#141517] flex gap-3 items-center text-xs">
      <strong className="text-white flex-1 truncate">{pages[0]?.documentTitle ?? 'Sermon Document'} · {pages.length} pages</strong>
      <button className="text-cyan-300" onClick={onClose}>Back to songs</button>
    </header>
    <div className="flex-1 overflow-y-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
      {pages.map(page => <button key={page.id} aria-label={`Show document page ${page.documentPage}`} aria-pressed={liveState.foregroundMedia?.id === page.id}
        onClick={() => onCue(page)} className={`rounded overflow-hidden border-2 ${liveState.foregroundMedia?.id === page.id ? 'border-[#ff6b00]' : 'border-[#343741]'}`}>
        <img src={page.url} alt={`Page ${page.documentPage}`} className="w-full aspect-video object-contain bg-black" />
        <div className="px-2 py-1 text-xs text-white bg-[#32353e]">Page {page.documentPage} / {page.documentPages}</div>
      </button>)}
    </div>
    <p className="px-4 py-2 text-[11px] text-zinc-400">Click a page to cue it. Next / previous shortcuts move through the live document. Song section keys are paused while viewing this deck.</p>
  </div>
)
