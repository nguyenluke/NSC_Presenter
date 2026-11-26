const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename)
const { DEFAULT_SHORTCUTS, validateShortcuts, findShortcutAction } = require('../src/shared/keyboardShortcuts.ts')
const { KeyboardSettings } = require('../src/main/keyboardSettings.ts')
const { normalizeTextLayout, customTextGeometry } = require('../src/shared/textLayout.ts')
const { PresenterDatabase } = require('../src/main/database.ts')
const { songSectionEntries } = require('../src/renderer/src/store/useStudioStore.ts')
const key = (code, modifiers = {}) => ({ code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...modifiers })

function folder(t) {
  const root = fs.realpathSync(os.tmpdir())
  const dir = fs.mkdtempSync(path.join(root, 'nsc-studio-settings-'))
  t.after(() => {
    const parent = fs.realpathSync(path.dirname(dir))
    if (parent.toLowerCase() === root.toLowerCase() && path.basename(dir).startsWith('nsc-studio-settings-')) fs.rmSync(dir, { recursive: true, force: true })
  })
  return dir
}

test('shortcuts preserve defaults, require exact modifiers, and handle numpad overrides', () => {
  const defaults = validateShortcuts(DEFAULT_SHORTCUTS)
  assert.equal(findShortcutAction(defaults, key('Digit3')), 'section3')
  assert.equal(findShortcutAction(defaults, key('Numpad3')), 'section3')
  assert.equal(findShortcutAction(defaults, key('KeyF', { ctrlKey: true })), 'search')
  assert.equal(findShortcutAction(defaults, key('Digit3', { ctrlKey: true })), undefined)
  const custom = structuredClone(defaults)
  custom.next = ['KeyN', 'Numpad3']
  custom.section3 = ['KeyC']
  const checked = validateShortcuts(custom)
  assert.equal(findShortcutAction(checked, key('KeyC')), 'section3')
  assert.equal(findShortcutAction(checked, key('Digit3')), undefined)
  assert.equal(findShortcutAction(checked, key('Numpad3')), 'next')
})

test('duplicate, unsupported and reserved shortcuts are rejected before saving', () => {
  for (const binding of ['Control+KeyF', 'Control+KeyR', 'Alt+F4', 'F5', 'F12', 'nonsense']) {
    const custom = structuredClone(DEFAULT_SHORTCUTS)
    custom.next = [binding]
    assert.throws(() => validateShortcuts(custom))
  }
})

test('keyboard settings survive restart and invalid saves preserve previous configuration', t => {
  const dir = folder(t)
  const settings = new KeyboardSettings(dir)
  const custom = settings.read()
  custom.next = ['KeyN']
  assert.notDeepEqual(custom, DEFAULT_SHORTCUTS)
  settings.save(custom)
  assert.deepEqual(new KeyboardSettings(dir).read(), custom)
  custom.previous = ['KeyN']
  assert.throws(() => settings.save(custom), /assigned more than once/)
  assert.deepEqual(new KeyboardSettings(dir).read().previous, DEFAULT_SHORTCUTS.previous)
})

test('section numbering matches visible valid arrangement entries, including repeats', () => {
  const song = { sections: [
    { id: 'v1', slides: [{ id: 'a' }, { id: 'b' }] },
    { id: 'empty', slides: [] }, { id: 'c1', slides: [{ id: 'c' }] }
  ], arrangement: ['missing', 'v1', 'empty', 'c1', 'v1', 'c1'] }
  assert.deepEqual(songSectionEntries(song).map(({ section, startIndex, orderIndex }) => [section.id, startIndex, orderIndex]),
    [['v1', 0, 0], ['c1', 2, 1], ['v1', 3, 2], ['c1', 5, 3]])
})

test('custom positioning clamps safely, preserves alignment and clears audience notices', () => {
  assert.deepEqual(normalizeTextLayout({ x: NaN, y: -10, width: 200, languageGap: -2, align: 'right' }),
    { x: 50, y: 0, width: 98, languageGap: 0, align: 'right' })
  const layout = normalizeTextLayout({ x: 0, y: 0, width: 30, languageGap: 12, align: 'left' })
  const geometry = customTextGeometry(layout, 220, 180)
  assert.equal(geometry.left, 16)
  assert.equal(geometry.top, 212)
  assert.ok(geometry.left + geometry.width <= 1904)
  const bottom = customTextGeometry(normalizeTextLayout({ y: 100 }), 220, 0)
  assert.equal(bottom.top + 220, 1064)
})

test('different custom layouts persist independently per screen and presets remain selectable', async t => {
  const dir = folder(t)
  const db = new PresenterDatabase(dir)
  await db.init()
  const audience = db.getOutputProfiles().find(profile => profile.screenType === 'audience')
  const customTextLayout = normalizeTextLayout({ x: 70, y: 80, width: 40, align: 'right', languageGap: 16 })
  db.saveOutputProfile({ ...audience, verticalAlign: 'custom', customTextLayout })
  db.saveOutputProfile({ ...audience, id: 'side-tv', verticalAlign: 'top' })
  const reopened = new PresenterDatabase(dir)
  await reopened.init()
  assert.deepEqual(reopened.getOutputProfiles().find(profile => profile.id === audience.id).customTextLayout, customTextLayout)
  assert.equal(reopened.getOutputProfiles().find(profile => profile.id === 'side-tv').verticalAlign, 'top')
  reopened.saveOutputProfile({ ...audience, verticalAlign: 'bottom', customTextLayout })
  assert.equal(reopened.getOutputProfiles().find(profile => profile.id === audience.id).verticalAlign, 'bottom')
})
