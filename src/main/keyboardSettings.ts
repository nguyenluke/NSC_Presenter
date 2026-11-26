import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { DEFAULT_SHORTCUTS, ShortcutBindings, validateShortcuts } from '../shared/keyboardShortcuts'

export class KeyboardSettings {
  private file: string
  constructor(directory: string) { this.file = path.join(directory, 'keyboard-shortcuts.json') }
  read(): ShortcutBindings {
    if (!fs.existsSync(this.file)) return structuredClone(DEFAULT_SHORTCUTS)
    return validateShortcuts(JSON.parse(fs.readFileSync(this.file, 'utf8')))
  }
  save(value: unknown): ShortcutBindings {
    const bindings = validateShortcuts(value)
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${randomUUID()}.tmp`
    try {
      fs.writeFileSync(temporary, JSON.stringify(bindings, null, 2), { flag: 'wx' })
      fs.renameSync(temporary, this.file)
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
    return bindings
  }
}
