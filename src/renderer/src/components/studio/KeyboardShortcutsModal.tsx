import React, { useState } from 'react'
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, ShortcutBindings, shortcutFromEvent, shortcutLabel, validateShortcuts } from '@shared/keyboardShortcuts'

export const KeyboardShortcutsModal: React.FC<{
  bindings: ShortcutBindings
  onSave: (bindings: ShortcutBindings) => Promise<void>
  onClose: () => void
}> = ({ bindings, onSave, onClose }) => {
  const [draft, setDraft] = useState(() => structuredClone(bindings))
  const [recording, setRecording] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6">
    <section role="dialog" aria-modal="true" aria-label="Customize keyboard shortcuts"
      onKeyDown={(event) => { if (event.key === 'Escape' && !recording && !busy) { event.preventDefault(); onClose() } }}
      className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-[#3a3d46] bg-[#232529] text-zinc-200 shadow-2xl">
      <header className="p-4 border-b border-[#3a3d46] font-bold text-sm">Customize Keyboard Shortcuts</header>
      <p className="p-4 pb-2 text-xs text-zinc-400">Settings apply only to this PC. Section numbers follow the visible arrangement, including repeated sections. Add a key, then press the combination you want. Editing fields and dialogs pause presentation shortcuts.</p>
      <div className="overflow-y-auto p-4 space-y-2">
        {SHORTCUT_ACTIONS.map(([action, label]) => <div key={action} className="rounded bg-[#18191c] p-2 flex gap-3 items-center justify-between flex-wrap">
          <span className="text-xs">{label}</span><div className="flex gap-1 items-center flex-wrap">
            {draft[action].map((binding) => <button key={binding} disabled={busy}
              title="Remove shortcut" aria-label={`Remove ${shortcutLabel(binding)} from ${label}`}
              onClick={() => { setDraft({ ...draft, [action]: draft[action].filter(key => key !== binding) }); setError('') }}
              className="px-2 py-1 rounded bg-[#32353e] text-xs font-mono">{shortcutLabel(binding)} ×</button>)}
            {recording === action ? <input autoFocus readOnly aria-label={`Record shortcut for ${label}`} value="Press shortcut…"
              onKeyDown={(event) => {
                event.preventDefault(); event.stopPropagation()
                if (event.repeat || event.nativeEvent.isComposing) return
                const binding = shortcutFromEvent(event)
                if (!binding) return
                const next = { ...draft, [action]: [...draft[action], binding] }
                try { setDraft(validateShortcuts(next)); setRecording(null); setError('') }
                catch (err) { setError((err as Error).message) }
              }} className="w-32 rounded border border-orange-500 bg-[#232529] p-1 text-xs" /> :
              <button disabled={busy || draft[action].length >= 6} onClick={() => { setRecording(action); setError('') }}
                className="text-xs text-cyan-300 px-2 py-1">+ Add key</button>}
            {recording === action && <button onClick={() => setRecording(null)} className="text-xs text-zinc-400">Cancel recording</button>}
          </div>
        </div>)}
      </div>
      {error && <p role="alert" className="px-4 py-2 text-xs text-red-300">{error}</p>}
      <footer className="p-4 border-t border-[#3a3d46] flex gap-2 justify-end text-xs">
        <button disabled={busy} onClick={() => { setDraft(structuredClone(DEFAULT_SHORTCUTS)); setRecording(null); setError('') }} className="mr-auto text-zinc-400">Restore defaults</button>
        <button disabled={busy} onClick={onClose} className="rounded bg-[#32353e] px-3 py-2">Cancel</button>
        <button disabled={busy || recording !== null} className="rounded bg-orange-500 px-3 py-2 font-semibold"
          onClick={() => { setBusy(true); void onSave(draft).then(onClose).catch(err => setError(err.message)).finally(() => setBusy(false)) }}>Save shortcuts</button>
      </footer>
    </section>
  </div>
}
