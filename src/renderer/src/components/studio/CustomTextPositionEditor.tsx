import React, { useState } from 'react'
import { CustomTextLayout, LivePresentationState, OutputProfile } from '@shared/types'
import { normalizeTextLayout } from '@shared/textLayout'
import { ScaledMonitorFrame } from '../outputs/ScaledMonitorFrame'

export const CustomTextPositionEditor: React.FC<{
  profile: OutputProfile
  liveState: LivePresentationState
  onApply: (layout: CustomTextLayout) => Promise<void>
}> = ({ profile, liveState, onApply }) => {
  const [draft, setDraft] = useState(() => normalizeTextLayout(profile.customTextLayout ?? {
    y: profile.verticalAlign === 'top' ? 15 : profile.verticalAlign === 'bottom' ? 85 : 50
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const move = (element: HTMLDivElement, clientX: number, clientY: number): void => {
    const bounds = element.getBoundingClientRect()
    setDraft(current => normalizeTextLayout({ ...current,
      x: Math.round((clientX - bounds.left) / bounds.width * 100),
      y: Math.round((clientY - bounds.top) / bounds.height * 100) }))
  }
  const slide = liveState.currentSlide ?? { id: 'position-preview', primaryText: 'Ngợi khen Chúa\nBằng cả tấm lòng',
    secondaryText: 'Praise the Lord\nWith all my heart', sectionId: 'preview', sectionLabel: 'Preview', sectionType: 'Verse' as const, globalIndex: 0 }
  return <div className="space-y-3 rounded border border-[#42454e] bg-[#18191c] p-2">
    <p className="text-[10px] text-zinc-400">Drag in the preview or adjust below. Apply when ready. Layout stays inside the screen and below audience notices; narrow the box to move it farther left or right.</p>
    <div role="button" tabIndex={0} aria-label="Drag to position audience text" className="relative aspect-video cursor-move touch-none outline-none focus:ring-1 focus:ring-cyan-400"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event.currentTarget, event.clientX, event.clientY) }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event.currentTarget, event.clientX, event.clientY) }}
      onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onKeyDown={(event) => {
        const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
        if (delta) { event.preventDefault(); setDraft(normalizeTextLayout({ ...draft, x: draft.x + delta[0], y: draft.y + delta[1] })) }
      }}>
      <ScaledMonitorFrame staticMedia className="w-full aspect-video pointer-events-none" profile={{ ...profile, verticalAlign: 'custom', customTextLayout: draft }}
        liveState={{ ...liveState, currentSlide: slide, blackout: false, clearText: false, showLogo: false, foregroundMedia: null }} />
      <div className="absolute inset-0 border border-cyan-400/60 pointer-events-none" />
      <div className="absolute w-2 h-2 rounded-full border border-white bg-cyan-500 pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${draft.x}%`, top: `${draft.y}%` }} />
    </div>
    {([['x', 'Horizontal position', 0, 100, '%'], ['y', 'Vertical position', 0, 100, '%'],
      ['width', 'Text box width', 20, 98, '%'], ['languageGap', 'Language spacing', 0, 100, 'px']] as const).map(([key, label, min, max, unit]) =>
      <label key={key} className="block space-y-1 text-[10px] text-zinc-400"><span className="flex justify-between"><span>{label}</span><span>{draft[key]} {unit}</span></span>
        <input aria-label={label} type="range" min={min} max={max} step={1} value={draft[key]}
          onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })} className="w-full accent-cyan-400" />
      </label>)}
    <label className="flex justify-between items-center text-[10px] text-zinc-400">Text alignment
      <select aria-label="Custom text alignment" value={draft.align} className="studio-field" onChange={(event) => setDraft({ ...draft, align: event.target.value as CustomTextLayout['align'] })}>
        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
      </select>
    </label>
    <div className="flex justify-between gap-2 text-[11px]">
      <button disabled={busy} onClick={() => setDraft(normalizeTextLayout())} className="text-zinc-400">Reset layout</button>
      <button disabled={busy} onClick={() => { setBusy(true); setError(''); void onApply(draft).catch(err => setError(err.message)).finally(() => setBusy(false)) }}
        className="rounded bg-cyan-700 px-3 py-1.5 text-white font-semibold">{busy ? 'Applying…' : 'Apply layout'}</button>
    </div>
    {error && <p role="alert" className="text-[10px] text-red-300">{error}</p>}
  </div>
}
