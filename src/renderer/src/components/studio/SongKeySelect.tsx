import React from 'react'

const NOTES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
const label = (key: string): string => key.replace('#', '♯').replace('b', '♭')

export const SongKeySelect: React.FC<{
  id?: string
  value: string
  onChange: (key: string) => void
  className?: string
}> = ({ id, value, onChange, className }) => {
  const known = value === '—' || NOTES.some((note) => value === note || value === `${note}m`)
  return (
    <select id={id} aria-label="Song key" value={value}
      onChange={(event) => onChange(event.target.value)} className={className}>
      <option value="—">Not set</option>
      {!known && <option value={value}>{value ? `${value} (current)` : 'Not set (current)'}</option>}
      <optgroup label="Major">
        {NOTES.map((note) => <option key={note} value={note}>{label(note)}</option>)}
      </optgroup>
      <optgroup label="Minor">
        {NOTES.map((note) => <option key={note} value={`${note}m`}>{label(note)}m</option>)}
      </optgroup>
    </select>
  )
}
