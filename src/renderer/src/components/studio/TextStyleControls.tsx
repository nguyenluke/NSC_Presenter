import React, { useState } from 'react'
import { TextStyle } from '@shared/types'
import { FONT_FAMILIES } from '@shared/textStyle'

export const TextStyleControls: React.FC<{ value?: TextStyle; secondary: boolean; onChange: (patch: TextStyle) => Promise<void> }> = ({ value, secondary, onChange }) => {
  const [custom, setCustom] = useState(Boolean(value?.fontFamily && !FONT_FAMILIES.includes(value.fontFamily)))
  const [family, setFamily] = useState(value?.fontFamily ?? '')
  const [error, setError] = useState('')
  const update = (patch: TextStyle): void => { setError(''); void onChange(patch).catch(err => setError(err.message)) }
  const prefix = secondary ? 'Language 2' : 'Language 1'
  return <div className="space-y-2">
    <select aria-label={`${prefix} font`} value={custom ? '__custom' : value?.fontFamily ?? ''} className="studio-field w-full"
      onChange={event => { setCustom(event.target.value === '__custom'); if (event.target.value !== '__custom') update({ fontFamily: event.target.value }) }}>
      <option value="">Default sans-serif</option>
      {FONT_FAMILIES.map(font => <option key={font} value={font}>{font}</option>)}
      <option value="__custom">Other installed font…</option>
    </select>
    {custom && <input aria-label={`${prefix} installed font name`} value={family} placeholder="Installed font family name"
      onChange={event => setFamily(event.target.value)} onBlur={() => update({ fontFamily: family.trim().slice(0,100) })}
      className="studio-field w-full" />}
    <div className="flex gap-2 text-[11px]">
      <button aria-label={`${prefix} bold`} aria-pressed={value?.bold ?? !secondary}
        onClick={() => update({ bold: !(value?.bold ?? !secondary) })} className="studio-field studio-style-button flex-1 font-bold">Bold</button>
      <button aria-label={`${prefix} italic`} aria-pressed={value?.italic ?? secondary}
        onClick={() => update({ italic: !(value?.italic ?? secondary) })} className="studio-field studio-style-button flex-1 italic">Italic</button>
    </div>
    {([['stretch','Width / stretch',70,140,100,'%'],['tracking','Letter spacing',-3,12,0,'px']] as const).map(([key,label,min,max,fallback,unit]) =>
      <label key={key} className="block text-[10px] text-zinc-400"><span className="flex justify-between"><span>{label}</span><span>{value?.[key] ?? fallback}{unit}</span></span>
        <input aria-label={`${prefix} ${label}`} type="range" className="w-full accent-blue-500" min={min} max={max} step={1} value={value?.[key] ?? fallback}
          onChange={event => update({ [key]: Number(event.target.value) })} />
      </label>)}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>
}
