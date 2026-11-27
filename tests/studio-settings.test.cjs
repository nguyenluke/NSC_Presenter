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
const { tickTimer, timerDisplay } = require('../src/shared/timer.ts')
const { textStyle } = require('../src/shared/textStyle.ts')
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

test('countdowns continue into red overtime, pause safely, and ordinary elapsed timers remain green', () => {
  const initial = {timerSeconds:1,timerMode:'countdown',timerRunning:true}
  const zero = tickTimer(initial)
  assert.equal(zero.timerSeconds,0); assert.equal(zero.timerRunning,true)
  const overtime=tickTimer(zero)
  assert.equal(overtime.timerSeconds,-1)
  assert.equal(timerDisplay(-61,'countdown').time,'+01:01')
  assert.equal(timerDisplay(-61,'countdown').label,'OVERTIME')
  assert.equal(timerDisplay(-61,'countdown').textClass,'text-red-400')
  assert.equal(timerDisplay(30,'countdown').urgent,true)
  const paused={...overtime,timerRunning:false}
  assert.equal(tickTimer(paused),paused)
  assert.equal(tickTimer({timerSeconds:0,timerMode:'elapsed',timerRunning:true}).timerSeconds,1)
  assert.equal(timerDisplay(90,'elapsed').expired,false)
})

test('font styles preserve legacy defaults and remain independent per language/screen', async t => {
  assert.equal(textStyle(undefined,false).fontWeight,700)
  assert.equal(textStyle(undefined,true).fontStyle,'italic')
  const custom={fontFamily:'Arial',bold:false,italic:true,stretch:120,tracking:2}
  const style=textStyle(custom,false)
  assert.equal(style.fontWeight,400);assert.equal(style.fontStyle,'italic')
  assert.equal(style.width,`${10000/120}%`)
  const db=new PresenterDatabase(folder(t));await db.init()
  const profile=db.getOutputProfiles()[0], pending=db.getPendingSongs()
  db.saveOutputProfile({...profile,primaryTextStyle:custom,secondaryTextStyle:{fontFamily:'Georgia',bold:true,italic:false}})
  assert.equal(db.getOutputProfiles().find(p=>p.id===profile.id).primaryTextStyle.stretch,120)
  assert.equal(db.getOutputProfiles().find(p=>p.id===profile.id).secondaryTextStyle.italic,false)
  assert.deepEqual(db.getPendingSongs(),pending)
})

test('the chosen logo survives restart without changing songs or sync state', async t => {
  const dir=folder(t),db=new PresenterDatabase(dir);await db.init()
  const first=db.addMediaAsset({title:'First logo',bin:'Logos',mediaType:'image',url:'nsc-media://asset/first.png',fitMode:'contain'})
  db.addMediaAsset({title:'Second logo',bin:'Logos',mediaType:'image',url:'nsc-media://asset/second.png',fitMode:'contain'})
  const pending=db.getPendingSongs()
  db.setPreferredLogo(first.id)
  const reopened=new PresenterDatabase(dir);await reopened.init()
  assert.equal(reopened.getPreferredLogo().id,first.id)
  assert.deepEqual(reopened.getPendingSongs(),pending)
})
