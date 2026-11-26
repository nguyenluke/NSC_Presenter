// Original synthesized sounds; no third-party recordings or soundpacks are bundled.
interface PadLayer {
  octave: number
  fifth?: boolean
  wave: OscillatorType
  weight: number
}

export interface PadSound {
  id: string
  name: string
  description: string
  cutoff: number
  motion: number
  detune: number
  wet: number
  level: number
  layers: PadLayer[]
}

export const PAD_SOUNDS: PadSound[] = [
  { id: 'sanctuary', name: 'Warm Sanctuary', description: 'Warm, wide analog layers for full-band worship.',
    cutoff: 1050, motion: 180, detune: 7, wet: 0.45, level: 1,
    layers: [
      { octave: -1, wave: 'sine', weight: 0.2 },
      { octave: 0, wave: 'sawtooth', weight: 0.4 },
      { octave: 0, fifth: true, wave: 'triangle', weight: 0.22 },
      { octave: 1, wave: 'triangle', weight: 0.18 }
    ] },
  { id: 'waters', name: 'Still Waters', description: 'Soft, rounded tones for prayer and quiet moments.',
    cutoff: 800, motion: 90, detune: 4, wet: 0.55, level: 0.5,
    layers: [
      { octave: -1, wave: 'sine', weight: 0.18 },
      { octave: 0, wave: 'sine', weight: 0.48 },
      { octave: 0, fifth: true, wave: 'sine', weight: 0.2 },
      { octave: 1, wave: 'triangle', weight: 0.14 }
    ] },
  { id: 'sky', name: 'Open Sky', description: 'Airy, spacious layers with a gentle upper glow.',
    cutoff: 2700, motion: 450, detune: 9, wet: 0.7, level: 0.8,
    layers: [
      { octave: 0, wave: 'triangle', weight: 0.38 },
      { octave: 0, fifth: true, wave: 'triangle', weight: 0.24 },
      { octave: 1, wave: 'sine', weight: 0.24 },
      { octave: 2, wave: 'sine', weight: 0.14 }
    ] },
  { id: 'radiant', name: 'Radiant Shimmer', description: 'Bright octave layers that slowly bloom and sparkle.',
    cutoff: 3800, motion: 650, detune: 6, wet: 0.65, level: 1,
    layers: [
      { octave: 0, wave: 'triangle', weight: 0.3 },
      { octave: 1, wave: 'sine', weight: 0.3 },
      { octave: 1, fifth: true, wave: 'triangle', weight: 0.22 },
      { octave: 2, wave: 'sine', weight: 0.18 }
    ] },
  { id: 'deep', name: 'Deep Prayer', description: 'Dark, low, enveloping tones beneath speaking or prayer.',
    cutoff: 430, motion: 65, detune: 5, wet: 0.5, level: 1,
    layers: [
      { octave: -2, wave: 'sine', weight: 0.22 },
      { octave: -1, wave: 'triangle', weight: 0.38 },
      { octave: -1, fifth: true, wave: 'sine', weight: 0.2 },
      { octave: 0, wave: 'triangle', weight: 0.2 }
    ] }
]

const FADE_SECONDS = 2.8
const REVERB_SECONDS = 4.5

// Seeded, gently darkened stereo noise makes a repeatable diffuse reverb tail.
function createReverb(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * REVERB_SECONDS)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  let seed = 4291
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel)
    let smooth = 0
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      smooth = smooth * 0.72 + (seed / 2147483648 - 1) * 0.28
      const envelope = Math.min(1, i / (ctx.sampleRate * 0.025)) * Math.exp(-7 * i / length)
      samples[i] = smooth * envelope
    }
  }
  return buffer
}

interface PadVoice {
  release: (seconds: number) => void
  dispose: () => void
}

/** One engine per audio drawer. Volume is independent of voice fade envelopes. */
export class WorshipPadEngine {
  private volume: GainNode
  private compressor: DynamicsCompressorNode
  private reverb: ConvolverNode
  private reverbTone: BiquadFilterNode
  private voices = new Set<PadVoice>()
  private active: PadVoice | null = null
  private disposed = false

  constructor(private ctx: BaseAudioContext, initialVolume = 0.55) {
    this.volume = ctx.createGain()
    this.volume.gain.value = initialVolume
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -10
    this.compressor.knee.value = 12
    this.compressor.ratio.value = 3
    this.compressor.attack.value = 0.02
    this.compressor.release.value = 0.4
    this.volume.connect(this.compressor)
    this.compressor.connect(ctx.destination)
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = createReverb(ctx)
    this.reverbTone = ctx.createBiquadFilter()
    this.reverbTone.type = 'lowpass'
    this.reverbTone.frequency.value = 3600
    this.reverb.connect(this.reverbTone)
    this.reverbTone.connect(this.volume)
  }

  setVolume(volume: number): void {
    if (this.disposed) return
    this.volume.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.15)
  }

  play(rootFrequency: number, sound: PadSound): void {
    if (this.disposed) return
    const ctx = this.ctx
    const now = ctx.currentTime
    this.stop()
    // Rapid clicking must not accumulate an unlimited number of fading voices.
    for (const voice of [...this.voices].slice(0, Math.max(0, this.voices.size - 2))) {
      voice.release(0.08)
    }

    const nodes: AudioNode[] = []
    const sources: OscillatorNode[] = []
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(0.55 * sound.level, now + FADE_SECONDS)
    const dry = ctx.createGain()
    dry.gain.value = 1 - sound.wet * 0.45
    const wet = ctx.createGain()
    wet.gain.value = sound.wet
    envelope.connect(dry).connect(this.volume)
    envelope.connect(wet).connect(this.reverb)
    nodes.push(envelope, dry, wet)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = sound.cutoff
    filter.Q.value = 0.45
    filter.connect(envelope)
    const breath = ctx.createOscillator()
    breath.frequency.value = 0.045
    const breathDepth = ctx.createGain()
    breathDepth.gain.value = sound.motion
    breath.connect(breathDepth).connect(filter.frequency)
    breath.start(now)
    sources.push(breath)
    nodes.push(filter, breathDepth)

    sound.layers.forEach((layer, index) => {
      // Only root, fifth and octaves: usable underneath both major and minor songs.
      const frequency = rootFrequency * 2 ** (layer.octave + (layer.fifth ? 7 / 12 : 0))
      for (const side of [-1, 1]) {
        const osc = ctx.createOscillator()
        osc.type = layer.wave
        osc.frequency.value = frequency
        osc.detune.value = side * sound.detune
        const gain = ctx.createGain()
        gain.gain.value = layer.weight / 2
        const pan = ctx.createStereoPanner()
        pan.pan.value = side * (0.35 + index * 0.15)
        osc.connect(gain).connect(pan).connect(filter)
        const drift = ctx.createOscillator()
        drift.frequency.value = 0.065 + index * 0.017 + (side + 1) * 0.009
        const driftDepth = ctx.createGain()
        driftDepth.gain.value = 2.5
        drift.connect(driftDepth).connect(osc.detune)
        osc.start(now)
        drift.start(now)
        sources.push(osc, drift)
        nodes.push(gain, pan, driftDepth)
      }
    })

    let stopAt = Infinity
    let finished = false
    const voice: PadVoice = {
      release: (seconds) => {
        const time = ctx.currentTime
        if (finished || time + seconds >= stopAt) return
        stopAt = time + seconds
        // Hold the in-progress attack/release value before scheduling a new ramp.
        envelope.gain.cancelAndHoldAtTime(time)
        envelope.gain.linearRampToValueAtTime(0, stopAt)
        sources.forEach((source) => source.stop(stopAt + 0.02))
      },
      dispose: () => {
        if (finished) return
        finished = true
        sources.forEach((source) => { try { source.stop() } catch { /* already ended */ }; source.disconnect() })
        nodes.forEach((node) => node.disconnect())
        this.voices.delete(voice)
      }
    }
    sources[0].onended = voice.dispose
    this.voices.add(voice)
    this.active = voice
  }

  stop(): void {
    this.active?.release(FADE_SECONDS)
    this.active = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const voice of this.voices) voice.dispose()
    this.active = null
    this.reverb.disconnect()
    this.reverb.buffer = null
    this.reverbTone.disconnect()
    this.volume.disconnect()
    this.compressor.disconnect()
  }
}
