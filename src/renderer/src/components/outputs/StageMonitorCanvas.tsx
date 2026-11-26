import React, { useEffect, useState } from 'react'
import { LivePresentationState, OutputProfile } from '@shared/types'

interface StageMonitorCanvasProps {
  liveState: LivePresentationState
  profile: OutputProfile
}

export function formatTimerSeconds(totalSec: number): string {
  const mins = Math.floor(Math.abs(totalSec) / 60)
  const secs = Math.abs(totalSec) % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * Back TV Stage / Confidence Monitor Renderer (1920x1080 Virtual Reference Canvas)
 * Designed specifically for the Worship Leader, Band & Pastor:
 * - Zero distracting motion backgrounds (pure high-contrast black)
 * - Huge Wall Clock + Countdown/Elapsed Timer
 * - Current Bilingual Lyrics + Optional Chord Cues
 * - Dimmed NEXT SLIDE preview so you always see the upcoming line early
 * - Private Flashing Stage Alert Banner from the Media Booth
 */
export const StageMonitorCanvas: React.FC<StageMonitorCanvasProps> = ({ liveState, profile }) => {
  const [clockText, setClockText] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )

  useEffect(() => {
    const id = setInterval(() => {
      setClockText(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }, 1000)
    return () => clearInterval(id)
  }, [])

  if (liveState.blackout) {
    return <div className="w-[1920px] h-[1080px] bg-black" />
  }

  const current = liveState.clearText ? null : liveState.currentSlide
  const next = liveState.clearText ? null : liveState.nextSlide
  const isTimerUrgent =
    liveState.timerMode === 'countdown' && liveState.timerSeconds <= 60 && liveState.timerSeconds > 0
  const isTimerExpired = liveState.timerMode === 'countdown' && liveState.timerSeconds === 0

  const showPrimary = profile.languageMode === 'both' || profile.languageMode === 'primary'
  const showSecondary = profile.languageMode === 'both' || profile.languageMode === 'secondary'

  return (
    <div className="w-[1920px] h-[1080px] bg-black text-white flex flex-col justify-between p-12 select-none overflow-hidden">
      {/* TOP HEADER: Wall Clock | Active Song + Key | Countdown Timer */}
      <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-6">
        <div className="flex items-center gap-6">
          <div className="text-6xl font-mono font-bold tracking-wider text-zinc-100">
            {clockText}
          </div>
          {liveState.activeSongTitle && (
            <div className="px-5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center gap-4">
              <span className="text-3xl font-semibold text-zinc-300">
                {liveState.activeSongTitle}
              </span>
              {liveState.activeSongKey && (
                <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-3xl font-bold">
                  KEY: {liveState.activeSongKey}
                </span>
              )}
            </div>
          )}
        </div>

        <div
          className={`px-7 py-2 rounded-2xl border-2 font-mono text-6xl font-extrabold tracking-wider ${
            isTimerExpired
              ? 'bg-red-950/90 border-red-500 text-red-400 animate-pulse'
              : isTimerUrgent
                ? 'bg-amber-950/80 border-amber-400 text-amber-300'
                : 'bg-zinc-900 border-zinc-700 text-emerald-400'
          }`}
        >
          {liveState.timerMode === 'countdown' ? 'TIMER ' : 'ELAPSED '}
          {formatTimerSeconds(liveState.timerSeconds)}
        </div>
      </div>

      {/* CENTER: CURRENT SLIDE (Huge High-Contrast Lyrics + Optional Chords) */}
      <div className="flex-1 flex flex-col justify-center py-6">
        {current ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="px-4 py-1 rounded-md bg-red-600 text-white text-2xl font-bold uppercase tracking-wider">
                LIVE • {current.sectionLabel}
              </span>
              {liveState.stageShowChords && current.chords && (
                <span className="font-mono text-3xl font-bold text-cyan-400 tracking-wide">
                  Chords: {current.chords.replace(/\n/g, '  |  ')}
                </span>
              )}
            </div>

            {showPrimary && (
              <div
                className="font-extrabold whitespace-pre-line leading-[1.18]"
                style={{
                  fontSize: `${profile.primaryFontSize}px`,
                  color: profile.primaryColor
                }}
              >
                {current.primaryText}
              </div>
            )}

            {showSecondary && current.secondaryText && (
              <div
                className="font-semibold whitespace-pre-line leading-[1.22]"
                style={{
                  fontSize: `${profile.secondaryFontSize}px`,
                  color: profile.secondaryColor
                }}
              >
                {current.secondaryText}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-5xl font-semibold text-zinc-600 uppercase tracking-widest">
            {liveState.foregroundMedia
              ? `Showing Graphic: ${liveState.foregroundMedia.title}`
              : 'Stage Ready — Waiting for Slide Cue'}
          </div>
        )}
      </div>

      {/* BOTTOM: NEXT SLIDE PREVIEW + STAGE ALERT BANNER */}
      <div className="border-t-2 border-zinc-800 pt-6 space-y-5">
        <div className="min-h-[150px] flex flex-col justify-center">
          {next ? (
            <div className="space-y-2 opacity-80">
              <div className="flex items-center gap-3">
                <span className="px-3 py-0.5 rounded bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-xl font-bold uppercase tracking-wider">
                  NEXT • {next.sectionLabel}
                </span>
              </div>
              {showPrimary && (
                <div className="text-4xl font-semibold text-zinc-300 whitespace-pre-line line-clamp-2">
                  {next.primaryText}
                </div>
              )}
              {showSecondary && next.secondaryText && (
                <div className="text-3xl text-zinc-400 italic whitespace-pre-line line-clamp-1">
                  {next.secondaryText}
                </div>
              )}
            </div>
          ) : (
            <div className="text-3xl font-medium text-zinc-600 uppercase tracking-wider">
              End of Song Arrangement
            </div>
          )}
        </div>

        {liveState.stageAlert.trim() !== '' && (
          <div className="w-full py-4 px-8 rounded-2xl bg-amber-500 text-black font-black text-4xl uppercase tracking-wide text-center shadow-lg animate-pulse whitespace-pre-line break-words">
            ⚠ BOOTH MESSAGE: {liveState.stageAlert}
          </div>
        )}
      </div>
    </div>
  )
}
