// Twelve equal-tempered pitches starting at C3. Enharmonic names share a pitch.
export const PAD_KEYS = [
  ['C', 'C'], ['C#', 'C♯ / D♭'], ['D', 'D'], ['D#', 'D♯ / E♭'],
  ['E', 'E'], ['F', 'F'], ['F#', 'F♯ / G♭'], ['G', 'G'],
  ['G#', 'G♯ / A♭'], ['A', 'A'], ['A#', 'A♯ / B♭'], ['B', 'B']
].map(([key, label], semitone) => ({ key, label, freq: 220 * 2 ** ((semitone - 9) / 12) }))
