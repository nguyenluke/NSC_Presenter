const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  })
  module._compile(outputText, filename)
}
const { PresenterDatabase } = require('../src/main/database.ts')
const { useStudioStore } = require('../src/renderer/src/store/useStudioStore.ts')

test('temporary service edits never persist or enter the song sync queue', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-temporary-song-'))
  t.after(() => { delete global.window; fs.rmSync(dir, { recursive: true, force: true }) })
  const db = new PresenterDatabase(dir)
  await db.init()
  for (const pending of db.getPendingSongs()) db.acknowledgeSong(pending, 1)
  const original = db.getAllSongs()[0]
  let saves = 0
  let liveState = { ...useStudioStore.getState().liveState }
  global.window = { nscApi: {
    updateLiveState: async (patch) => (liveState = { ...liveState, ...patch }),
    saveSong: async (input) => { saves++; db.saveSong(input); return db.getAllSongs() },
    bootstrap: async () => ({ songs: db.getAllSongs(), serviceItems: db.getServiceItems() })
  } }
  useStudioStore.setState({ songs: db.getAllSongs(), temporarySongs: {}, selectedSongId: original.id, liveState })
  const store = () => useStudioStore.getState()
  const before = fs.readFileSync(db.getDatabaseFilePath())
  await store().triggerSlide(original, 0)
  await store().updateLiveFlags({ blackout: true, clearText: true })
  await store().useSongTemporarily({ ...original, musicalKey: 'C#' })
  await store().useSongTemporarily({ ...original, musicalKey: 'Bb' })
  assert.equal(store().liveState.activeSongKey, 'Bb')
  assert.equal(store().liveState.blackout, true)
  assert.equal(store().liveState.clearText, true)
  assert.equal(store().songs[0].musicalKey, original.musicalKey)
  await store().stepSlide(1)
  assert.equal(store().liveState.activeSongKey, 'Bb')
  await store().refreshLibrarySongs()
  assert.equal(store().temporarySongs[original.id].musicalKey, 'Bb')
  assert.equal(db.getPendingSongs().length, 0)
  assert.equal(saves, 0)
  assert.deepEqual(fs.readFileSync(db.getDatabaseFilePath()), before)

  await store().discardTemporarySong(original.id)
  assert.equal(store().temporarySongs[original.id], undefined)
  assert.equal(store().liveState.activeSongKey, original.musicalKey)
  assert.equal(db.getPendingSongs().length, 0)
  await store().saveSong(original)
  assert.equal(db.getPendingSongs().length, 0, 'an unchanged Save does not queue an upload')

  await store().useSongTemporarily({ ...original, musicalKey: 'F#' })
  await store().saveSong(store().temporarySongs[original.id])
  assert.equal(store().temporarySongs[original.id], undefined)
  assert.equal(db.getPendingSongs().length, 1)
  assert.equal(db.getPendingSongs()[0].payload.musicalKey, 'F#')
  const pending = db.getPendingSongs()
  await store().useSongTemporarily({ ...store().songs.find(s => s.id === original.id), musicalKey: 'Eb' })
  await store().discardTemporarySong(original.id)
  assert.deepEqual(db.getPendingSongs(), pending, 'discard preserves unrelated previously saved pending changes')
  assert.equal(store().liveState.activeSongKey, 'F#')
  const reopened = new PresenterDatabase(dir)
  await reopened.init()
  assert.equal(reopened.getAllSongs().find(s => s.id === original.id).musicalKey, 'F#')
})
