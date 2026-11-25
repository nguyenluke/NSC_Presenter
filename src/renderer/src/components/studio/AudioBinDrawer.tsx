import React, { useEffect, useRef, useState } from 'react'
import { FolderPlus, Music, Square, Trash2, Volume2 } from 'lucide-react'
import { AudioCategory, AudioTrack } from '@shared/types'

interface AudioBinDrawerProps {
  tracks: AudioTrack[]
  onImportAudio: (category: AudioCategory) => Promise<void>
  onDeleteAudio: (id: number) => Promise<void>
}

const PAD_KEYS: { key: string; freq: number }[] = [
  { key: 'C', freq: 130.81 },
  { key: 'D', freq: 146.83 },
  { key: 'E', freq: 164.81 },
  { key: 'F', freq: 174.61 },
  { key: 'G', freq: 196.0 },
  { key: 'A', freq: 220.0 },
  { key: 'B', freq: 246.94 }
]

/**
 * ProPresenter 7 "Audio Bin" + Built-In Worship Leader Ambient Prayer Pads!
 * 1. Built-in warm worship synth pad in Keys C..B with smooth 2.2s worship fade-in / fade-out!
 * 2. Import `.mp3` / `.wav` / `.m4a` walk-in music or backing pads with smooth fade-out!
 */
export const AudioBinDrawer: React.FC<AudioBinDrawerProps> = ({
  tracks,
  onImportAudio,
  onDeleteAudio
}) => {
  const [activePadKey, setActivePadKey] = useState<string | null>(null)
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null)
  const [volume, setVolume] = useState(0.55)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const padGainRef = useRef<GainNode | null>(null)
  const padOscsRef = useRef<OscillatorNode[]>([])
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null)

  const stopAmbientPadSmoothly = (): void => {
    const ctx = audioCtxRef.current
    const gain = padGainRef.current
    const oscs = padOscsRef.current
    if (ctx && gain) {
      const now = ctx.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0.0001, now + 2.0)
      setTimeout(() => {
        oscs.forEach((o) => {
          try {
            o.stop()
          } catch {
            // already stopped
          }
        })
      }, 2100)
    }
    padGainRef.current = null
    padOscsRef.current = []
    setActivePadKey(null)
  }

  const togglePadKey = (keyName: string, rootFreq: number): void => {
    if (activePadKey === keyName) {
      stopAmbientPadSmoothly()
      return
    }

    stopAmbientPadSmoothly()

    const ctx = audioCtxRef.current || new AudioContext()
    audioCtxRef.current = ctx

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime)
    masterGain.gain.linearRampToValueAtTime(volume * 0.28, ctx.currentTime + 2.2)

    // Warm low-pass filter so the worship pad sounds like a lush analog synth pad
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(520, ctx.currentTime)

    filter.connect(masterGain)
    masterGain.connect(ctx.destination)

    // Root + Fifth + Octave warm worship drone chord (never clashes with major/minor!)
    const ratios = [1, 1.498, 2, 2.005]
    const oscs = ratios.map((ratio, idx) => {
      const osc = ctx.createOscillator()
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle'
      osc.frequency.setValueAtTime(rootFreq * ratio, ctx.currentTime)
      osc.connect(filter)
      osc.start()
      return osc
    })

    padGainRef.current = masterGain
    padOscsRef.current = oscs
    setActivePadKey(keyName)
  }

  useEffect(() => {
    if (padGainRef.current && audioCtxRef.current) {
      padGainRef.current.gain.setTargetAtTime(
        volume * 0.28,
        audioCtxRef.current.currentTime,
        0.2
      )
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    return () => {
      stopAmbientPadSmoothly()
      htmlAudioRef.current?.pause()
    }
  }, [])

  const playOrFadeOutTrack = (track: AudioTrack): void => {
    if (playingTrackId === track.id && htmlAudioRef.current) {
      const el = htmlAudioRef.current
      const startVol = el.volume
      let step = 0
      const fade = setInterval(() => {
        step++
        el.volume = Math.max(0, startVol * (1 - step / 15))
        if (step >= 15) {
          clearInterval(fade)
          el.pause()
          setPlayingTrackId(null)
        }
      }, 120)
      return
    }

    htmlAudioRef.current?.pause()
    const audio = new Audio(track.url)
    audio.loop = track.category === 'Worship Pads'
    audio.volume = volume
    audio.play()
    audio.onended = () => setPlayingTrackId(null)
    htmlAudioRef.current = audio
    setPlayingTrackId(track.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Audio Bin & Worship Pads
        </span>
        <div className="flex items-center gap-1.5 w-28">
          <Volume2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-orange-500 h-1"
          />
        </div>
      </div>

      {/* 1. Built-in Instant Worship Prayer Pads (Keys C–B) */}
      <div className="p-3 rounded-lg bg-[#18191c] border border-[#32353e] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">
            Instant Ambient Prayer Pad
          </span>
          {activePadKey && (
            <button
              onClick={stopAmbientPadSmoothly}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <Square className="w-2.5 h-2.5 fill-current" /> Fade Out
            </button>
          )}
        </div>
        <p className="text-[10px] text-zinc-400">
          Smooth synth pad for prayer, transitions, or speaking (fades in/out gently):
        </p>
        <div className="grid grid-cols-7 gap-1">
          {PAD_KEYS.map(({ key, freq }) => {
            const isPlaying = activePadKey === key
            return (
              <button
                key={key}
                onClick={() => togglePadKey(key, freq)}
                className={`py-2 rounded font-mono text-xs font-bold transition ${
                  isPlaying
                    ? 'bg-[#ff6b00] text-white shadow-[0_0_10px_rgba(255,107,0,0.5)]'
                    : 'bg-[#262930] hover:bg-[#323640] text-zinc-200'
                }`}
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Imported MP3 / WAV Pre-Service & Worship Tracks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">MP3 / WAV Audio Tracks</span>
          <button
            onClick={() => onImportAudio('Pre-Service Music')}
            className="px-2.5 py-1 rounded bg-[#2e323c] hover:bg-[#3a3f4b] text-[11px] font-semibold text-cyan-300 flex items-center gap-1"
          >
            <FolderPlus className="w-3 h-3" /> + Import Audio
          </button>
        </div>

        {tracks.length === 0 ? (
          <div className="p-3 rounded border border-dashed border-[#343741] text-[11px] text-zinc-500 text-center">
            Import pre-service background songs or MP3 worship pads here.
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((t) => {
              const active = playingTrackId === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => playOrFadeOutTrack(t)}
                  className={`group px-2.5 py-2 rounded cursor-pointer flex items-center justify-between text-xs ${
                    active
                      ? 'bg-emerald-600/25 border border-emerald-500/50 text-emerald-200'
                      : 'bg-[#18191c] hover:bg-[#262930] text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {active && <span className="text-[10px] font-bold">Fade Out</span>}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteAudio(t.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
