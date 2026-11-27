import React, { useState } from 'react'
import { AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Type, X } from 'lucide-react'
import { LivePresentationState, OutputProfile } from '@shared/types'
import { CustomTextPositionEditor } from './CustomTextPositionEditor'
import { TextStyleControls } from './TextStyleControls'
import { DEFAULT_TEXT_LAYOUT } from '@shared/textLayout'
import { PRESENTATION_THEMES } from './presentationThemes'

interface Props {
  profiles: OutputProfile[]
  liveState: LivePresentationState
  onChange: (target: string, patch: Partial<OutputProfile>) => Promise<void>
  onClose: () => void
}

export const TextFormattingPopover: React.FC<Props> = ({ profiles, liveState, onChange, onClose }) => {
  const [target, setTarget] = useState('all')
  const [error, setError] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [styleRevision, setStyleRevision] = useState(0)
  const profile = profiles.find((item) => item.id === target) ?? profiles[0]
  const activeTarget = target === 'all' || profiles.some((item) => item.id === target) ? target : 'all'
  const targets = activeTarget === 'all' ? profiles : profiles.filter((item) => item.id === activeTarget)
  const mixed = (key: keyof OutputProfile) => targets.some((item) => item[key] !== profile?.[key])
  const update = async (patch: Partial<OutputProfile>): Promise<void> => {
    setError('')
    try { await onChange(activeTarget, patch) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update text formatting.') }
  }
  return (
    <section role="dialog" aria-label="Text formatting" className="studio-popover studio-text-popover">
      <header className="studio-popover-header"><span className="flex items-center gap-2"><Type size={14} />Text formatting</span><button aria-label="Close text formatting" onClick={onClose} className="studio-icon-button"><X size={14} /></button></header>
      <p className="px-3 pt-3 text-[11px] leading-relaxed text-zinc-400">Fine-tune size, color, language, and position for the screens you choose.</p>
      {profile ? <div className="p-3 space-y-4">
        <label className="block space-y-1 text-[11px] text-zinc-400"><span>Audience screen</span><select aria-label="Formatting target" value={activeTarget} onChange={(event) => setTarget(event.target.value)} className="studio-field w-full"><option value="all">All audience screens</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div><div className="studio-field-label">Languages {mixed('languageMode') && <span className="text-amber-300">· Mixed</span>}</div><div className="studio-segmented grid grid-cols-3">{([['both', 'Both'], ['primary', 'Language 1'], ['secondary', 'Language 2']] as const).map(([mode, label]) => <button key={mode} aria-pressed={!mixed('languageMode') && profile.languageMode === mode} onClick={() => void update({ languageMode: mode })}>{label}</button>)}</div></div>
        <div><div className="studio-field-label">Text position {mixed('verticalAlign') && <span className="text-amber-300">· Mixed</span>}</div><div className="studio-segmented grid grid-cols-3">{([
          ['top', 'Top', AlignVerticalJustifyStart], ['center', 'Center', AlignVerticalJustifyCenter], ['bottom', 'Bottom', AlignVerticalJustifyEnd]
        ] as const).map(([position, label, Icon]) => <button key={position} aria-label={`Align text ${position}`} aria-pressed={!mixed('verticalAlign') && profile.verticalAlign === position} onClick={() => void update({ verticalAlign: position })}><Icon size={15} /><span>{label}</span></button>)}</div></div>
        <button aria-expanded={showCustom} onClick={() => setShowCustom(!showCustom)}
          className="studio-field w-full text-left">{profile.verticalAlign === 'custom' ? 'Custom position active' : 'Customize text position'} · {showCustom ? 'Hide editor' : 'Open editor'}</button>
        {showCustom && activeTarget === 'all' && <p className="text-[10px] text-zinc-400">Preview uses {profile.name}. Apply layout updates all audience screens. Choose one screen above for an independent layout.</p>}
        {showCustom && <CustomTextPositionEditor key={activeTarget} profile={profile} liveState={liveState}
          onApply={(layout) => onChange(activeTarget, { verticalAlign: 'custom', customTextLayout: layout })} />}
        {(['primary', 'secondary'] as const).map((language) => {
          const sizeKey = language === 'primary' ? 'primaryFontSize' : 'secondaryFontSize'
          const colorKey = language === 'primary' ? 'primaryColor' : 'secondaryColor'
          const label = language === 'primary' ? 'Language 1' : 'Language 2'
          return <div key={language} className="space-y-2"><div className="studio-field-label flex justify-between"><span>{label}</span><span>{mixed(sizeKey) ? 'Mixed sizes' : `${profile[sizeKey]} px`}</span></div><div className="flex items-center gap-2"><input aria-label={`${label} font size`} type="range" min={24} max={120} value={profile[sizeKey]} onChange={(event) => void update({ [sizeKey]: Number(event.target.value) })} className="flex-1 min-w-0 accent-blue-500" /><input aria-label={`${label} text color`} type="color" value={profile[colorKey]} onChange={(event) => void update({ [colorKey]: event.target.value })} className="studio-color-input" /></div>
          </div>
        })}
        <button aria-expanded={showAdvanced} aria-controls="advanced-text-settings" onClick={() => setShowAdvanced(!showAdvanced)}
          className="studio-field w-full text-left">Advanced text settings · {showAdvanced ? 'Hide' : 'Show'}</button>
        {showAdvanced && <div id="advanced-text-settings" className="space-y-4 border-t border-zinc-700 pt-3">
          {(['primary', 'secondary'] as const).map(language => {
            const styleKey = language === 'primary' ? 'primaryTextStyle' : 'secondaryTextStyle'
            return <div key={language} className="space-y-2">
              <div className="studio-field-label">{language === 'primary' ? 'Language 1 style' : 'Language 2 style'}</div>
              <TextStyleControls key={`${activeTarget}-${language}-${styleRevision}`} value={profile[styleKey]} secondary={language === 'secondary'} onChange={patch => onChange(activeTarget, { [styleKey]: patch })} />
            </div>
          })}
          <p className="text-[10px] text-zinc-500 leading-relaxed">Fonts must be installed on this PC; unavailable fonts use a fallback. Styles update previews and audience output.</p>
          <button disabled={resetting} className="studio-field w-full text-left disabled:opacity-40" onClick={async () => {
            setResetting(true); setError('')
            const clearedStyle = { fontFamily: undefined, bold: undefined, italic: undefined, stretch: undefined, tracking: undefined }
            try {
              await onChange(activeTarget, { ...PRESENTATION_THEMES[0].settings, customTextLayout: { ...DEFAULT_TEXT_LAYOUT },
                primaryTextStyle: clearedStyle, secondaryTextStyle: clearedStyle })
              setShowCustom(false); setStyleRevision(value => value + 1)
            } catch (err) { setError(err instanceof Error ? err.message : 'Could not reset text settings.') }
            finally { setResetting(false) }
          }}>{resetting ? 'Resetting…' : 'Reset text to defaults'}</button>
          <p className="text-[10px] text-zinc-500 leading-relaxed">Restores centered bilingual text, white + gold, default fonts and sizes for the selected screen(s). Applies immediately.</p>
        </div>}
        <p className="text-[10px] text-zinc-500 leading-relaxed">Top and bottom keep a safe margin.</p>
      </div> : <p className="p-3 text-xs text-zinc-400">Add an audience screen in Configure Screens to format lyrics.</p>}
      {error && <p role="alert" className="px-3 pb-3 text-xs text-red-300">{error}</p>}
    </section>
  )
}
