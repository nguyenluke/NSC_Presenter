export const SHORTCUT_ACTIONS: ReadonlyArray<readonly [string, string]> = [
  ['search', 'Search songs'], ['next', 'Next slide'], ['previous', 'Previous slide'],
  ['clearText', 'Clear lyrics'], ['clearMedia', 'Clear background'],
  ['logo', 'Toggle church logo'], ['blackout', 'Toggle blackout'],
  ...Array.from({ length: 9 }, (_, i) => [`section${i + 1}`, `Section ${i + 1} in arrangement`] as const)
]
export type ShortcutBindings = Record<string, string[]>

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  search: ['Control+KeyF', 'Meta+KeyF'], next: ['Space', 'ArrowRight', 'ArrowDown'],
  previous: ['ArrowLeft', 'ArrowUp'], clearText: ['Escape', 'F1'], clearMedia: ['F2'],
  logo: ['F3'], blackout: ['F4'],
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`section${i + 1}`, [`Digit${i + 1}`]]))
}

interface KeyInput { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }
export function shortcutFromEvent(event: KeyInput): string {
  if (/^(Control|Shift|Alt|Meta)(Left|Right)$/.test(event.code)) return ''
  return [event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift',
    event.metaKey && 'Meta', event.code].filter(Boolean).join('+')
}

export function shortcutLabel(binding: string): string {
  return binding.split('+').map((part) => {
    const names: Record<string, string> = { Control: 'Ctrl', Meta: 'Cmd', Space: 'Space',
      ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' }
    return names[part] ?? part.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ')
  }).join(' + ')
}

export function validateShortcuts(value: unknown): ShortcutBindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid shortcut settings.')
  const input = value as Record<string, unknown>
  const result: ShortcutBindings = {}
  const used = new Map<string, string>()
  for (const [action] of SHORTCUT_ACTIONS) {
    const bindings = input[action]
    if (!Array.isArray(bindings) || bindings.length > 6) throw new Error(`Choose up to six shortcuts for ${action}.`)
    result[action] = bindings.map((binding) => {
      if (typeof binding !== 'string' || binding.length > 70 ||
          !/^(Control\+)?(Alt\+)?(Shift\+)?(Meta\+)?(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Space|Enter|Escape|Arrow(Left|Right|Up|Down)|F([1-9]|1[0-2])|Home|End|PageUp|PageDown|Backspace|Delete|Insert|Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash|Backslash|Backquote)$/.test(binding)) {
        throw new Error('Use a letter, number, function key, arrow or supported navigation key.')
      }
      const parts = binding.split('+')
      const code = parts[parts.length - 1]
      if (code === 'F5' || code === 'F12' || (parts.includes('Alt') && code === 'F4') ||
          (parts.includes('Control') && parts.includes('Alt') && code === 'Delete') ||
          ((parts.includes('Control') || parts.includes('Meta')) && ['KeyR', 'KeyW', 'KeyQ', 'KeyT', 'KeyN', 'KeyI', 'KeyJ'].includes(code))) {
        throw new Error('That combination is reserved for the app or operating system. Choose another.')
      }
      if (used.has(binding)) throw new Error(`${shortcutLabel(binding)} is assigned more than once (${used.get(binding)}). Remove it there first.`)
      used.set(binding, SHORTCUT_ACTIONS.find(([id]) => id === action)![1])
      return binding
    })
  }
  return result
}

export function findShortcutAction(bindings: ShortcutBindings, event: KeyInput): string | undefined {
  const binding = shortcutFromEvent(event)
  // Number row and numpad share section keys by default; explicit numpad assignments take priority.
  const direct = SHORTCUT_ACTIONS.find(([action]) => bindings[action]?.includes(binding))?.[0]
  if (direct) return direct
  const numberRow = binding.replace(/Numpad([0-9])$/, 'Digit$1')
  return SHORTCUT_ACTIONS.find(([action]) => action.startsWith('section') && bindings[action]?.includes(numberRow))?.[0]
}
