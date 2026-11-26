import React, { useEffect, useRef, useState } from 'react'
import { FolderPlus, Music, Square, Trash2, Volume2 } from 'lucide-react'
import { PAD_KEYS } from './padKeys'
import { PAD_SOUNDS, WorshipPadEngine } from './worshipPads'
import { AudioCategory, AudioTrack } from '@shared/types'

interface AudioBinDrawerProps {
  tracks: AudioTrack[]
  onImportAudio: (category: AudioCategory) => Promise<void>
  onDeleteAudio: (id: number) => Promise<void>
}

/**
 * ProPresenter 7 "Audio Bin" + Built-In Worship Leader Ambient Prayer Pads!
 * 1. Five original stereo pad sounds in all 12 keys, with smooth 2.8s crossfades.
 * 2. Import `.mp3` / `.wav` / `.m4a` walk-in music or backing pads with smooth fade-out!
 */
export const AudioBinDrawer: React.FC<AudioBinDrawerProps> = ({
  tracks,
  onImportAudio,
  onDeleteAudio
}) => {
  const [audioError, setAudioError] = useState('')
  const [activePadKey, setActivePadKey] = useState<string | null>(null)
  const [padSoundId, setPadSoundId] = useState(PAD_SOUNDS[0].id)
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null)
  const [volume, setVolume] = useState(0.55)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const padEngineRef = useRef<WorshipPadEngine | null>(null)
  const activePadRef = useRef<string | null>(null)
  const padRequestRef = useRef(0)
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null)

  const stopAmbientPadSmoothly = (): void => {
    padRequestRef.current++
    padEngineRef.current?.stop()
    activePadRef.current = null
    setActivePadKey(null)
  }

  const startPad = async (keyName: string, rootFreq: number, soundId: string): Promise<void> => {
    const request = ++padRequestRef.current
    setAudioError('')
    try {
      const ctx = audioCtxRef.current || new AudioContext()
      audioCtxRef.current = ctx
      if (!padEngineRef.current) padEngineRef.current = new WorshipPadEngine(ctx, volume)
      if (ctx.state === 'suspended') await ctx.resume()
      if (request !== padRequestRef.current) return
      padEngineRef.current.play(rootFreq, PAD_SOUNDS.find((sound) => sound.id === soundId) ?? PAD_SOUNDS[0])
      activePadRef.current = keyName
      setActivePadKey(keyName)
    } catch {
      if (request !== padRequestRef.current) return
      stopAmbientPadSmoothly()
      setAudioError('Audio could not start. Check your audio output and try again.')
    }
  }

  const togglePadKey = (keyName: string, rootFreq: number): void => {
    if (activePadRef.current === keyName) {
      stopAmbientPadSmoothly()
    } else {
      void startPad(keyName, rootFreq, padSoundId)
    }
  }

  const changePadSound = (soundId: string): void => {
    setPadSoundId(soundId)
    const key = PAD_KEYS.find((key) => key.key === activePadRef.current)
    if (key) void startPad(key.key, key.freq, soundId)
  }

  useEffect(() => {
    padEngineRef.current?.setVolume(volume)
    if (htmlAudioRef.current) {
      htmlAudioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    return () => {
      padRequestRef.current++
      activePadRef.current = null
      const engine = padEngineRef.current
      const ctx = audioCtxRef.current
      padEngineRef.current = null
      audioCtxRef.current = null
      engine?.stop()
      // Let the fade and reverb finish before releasing the audio device.
      if (ctx) setTimeout(() => { engine?.dispose(); void ctx.close().catch(() => {}) }, 7600)
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
            aria-label="Audio volume"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-orange-500 h-1"
          />
        </div>
      </div>

      {/* 1. Built-in Instant Worship Prayer Pads (all 12 chromatic keys) */}
      <div className="p-3 rounded-lg bg-[#18191c] border border-[#32353e] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">
            Worship Ambient Pads
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
          Choose a sound and key. Changing either crossfades gently; click the playing key to fade out.
        </p>
        <label className="block text-[10px] font-semibold text-zinc-400 space-y-1">
          <span>Pad sound</span>
          <select aria-label="Pad sound" value={padSoundId} onChange={(event) => changePadSound(event.target.value)}
            className="w-full rounded bg-[#262930] border border-[#42454e] px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
            {PAD_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.name}</option>)}
          </select>
        </label>
        <p className="text-[10px] text-zinc-400">{PAD_SOUNDS.find((sound) => sound.id === padSoundId)?.description}</p>
        <p className="text-[10px] text-zinc-500">Root, fifth and octaves suit major or minor songs. Sharp/flat pairs share a pitch.</p>
        <div role="group" aria-label="Prayer pad keys" className="grid grid-cols-4 gap-1.5">
          {PAD_KEYS.map(({ key, label, freq }) => {
            const isPlaying = activePadKey === key
            return (
              <button
                key={key}
                aria-label={`${isPlaying ? 'Fade out' : 'Play'} ${label} pad`}
                aria-pressed={isPlaying}
                data-pad-key={key}
                title={`${label} · ${freq.toFixed(2)} Hz`}
                onClick={() => togglePadKey(key, freq)}
                className={`min-h-[44px] px-1 py-1.5 rounded font-mono text-xs font-bold flex flex-col items-center justify-center leading-tight transition ${
                  isPlaying
                    ? 'bg-[#ff6b00] text-white shadow-[0_0_10px_rgba(255,107,0,0.5)]'
                    : 'bg-[#262930] hover:bg-[#323640] text-zinc-200'
                }`}
              >
                <span>{label.split(' / ')[0]}</span>
                {label.includes(' / ') && <span className="text-[9px] font-medium opacity-75 mt-0.5">{label.split(' / ')[1]}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {audioError && <p role="alert" className="text-xs text-red-300">{audioError}</p>}

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
