import React, { useState } from 'react'
import { textStyle } from '@shared/textStyle'
import { Check, Palette, X } from 'lucide-react'
import { LivePresentationState, OutputProfile } from '@shared/types'
import { ScaledMonitorFrame } from '../outputs/ScaledMonitorFrame'
import { PRESENTATION_THEMES, PresentationTheme } from './presentationThemes'

interface ThemePickerProps {
  profile: OutputProfile | undefined
  liveState: LivePresentationState
  onApply: (theme: PresentationTheme) => Promise<void>
  onClose: () => void
}

export const ThemePicker: React.FC<ThemePickerProps> = ({ profile, liveState, onApply, onClose }) => {
  const [applying, setApplying] = useState<string | null>(null)
  const [error, setError] = useState('')
  const sampleState: LivePresentationState = { ...liveState, activeBackground: null,
    foregroundMedia: null, clearText: false, clearBackground: false, blackout: false,
    showLogo: false, audienceMessage: '', currentSlide: {
      id: 'theme-preview', primaryText: 'Tôn vinh Chúa cùng nhau', secondaryText: 'Together we lift our praise',
      sectionId: 'theme', sectionLabel: 'Preview', sectionType: 'Verse', globalIndex: 0
    } }

  return (
    <section role="dialog" aria-label="Slide themes" className="studio-popover studio-theme-picker">
      <header className="studio-popover-header"><span className="flex items-center gap-2"><Palette size={14} />Theme presets</span><button onClick={onClose} aria-label="Close themes" className="studio-icon-button"><X size={14} /></button></header>
      <p className="px-3 pt-2 text-[11px] text-zinc-400">One click applies a complete look to all audience screens.</p>
      <p className="px-3 pt-1 text-[10px] leading-relaxed text-zinc-500">Presets replace text sizes, colors, languages, and position. Use Text to fine-tune afterward.</p>
      {profile ? (
        <div className="grid grid-cols-2 gap-2.5 p-3">
          {PRESENTATION_THEMES.map((theme) => {
            const selected = Object.entries(theme.settings).every(([key, value]) =>
              profile[key as keyof OutputProfile] === value) &&
              JSON.stringify(textStyle(profile.primaryTextStyle, false)) === JSON.stringify(textStyle(undefined, false)) &&
              JSON.stringify(textStyle(profile.secondaryTextStyle, true)) === JSON.stringify(textStyle(undefined, true))
            return (
              <button key={theme.id} disabled={applying !== null} aria-label={`Apply ${theme.name} theme`} aria-pressed={selected}
                className={`studio-theme-card ${selected ? 'is-selected' : ''}`}
                onClick={async () => {
                  setApplying(theme.id); setError('')
                  try { await onApply(theme) }
                  catch (err) { setError(err instanceof Error ? err.message : 'Could not apply theme.'); setApplying(null) }
                }}>
                <ScaledMonitorFrame liveState={sampleState} profile={{ ...profile, ...theme.settings, primaryTextStyle: {}, secondaryTextStyle: {}, screenType: 'audience' }} staticMedia className="w-full aspect-video" />
                <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                  <div className="min-w-0"><div className="text-[11px] font-semibold truncate">{applying === theme.id ? 'Applying…' : theme.name}</div><div className="text-[10px] text-zinc-400 truncate">{theme.description}</div></div>
                  {selected && <Check size={13} className="text-blue-400 shrink-0" />}
                </div>
              </button>
            )
          })}
        </div>
      ) : <p className="p-3 text-xs text-zinc-400">Add an audience screen in Configure Screens to apply themes.</p>}
      {error && <p role="alert" className="px-3 pb-3 text-xs text-red-300">{error}</p>}
    </section>
  )
}
