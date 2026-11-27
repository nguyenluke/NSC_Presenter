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

test('sermon next/previous uses document order and returning to songs restores song navigation', async (t) => {
  t.after(()=>{delete global.window})
  const pages=[3,1,2].map(page=>({id:page,title:`Page ${page}`,bin:'Sermon & Events',mediaType:'image',url:`nsc-media://asset/${page}.png`,
    fitMode:'contain',documentId:'sermon',documentTitle:'Sermon',documentPage:page,documentPages:3}))
  let liveState={...useStudioStore.getState().liveState}
  global.window={nscApi:{updateLiveState:async patch=>(liveState={...liveState,...patch})}}
  useStudioStore.setState({mediaAssets:pages,selectedDocumentId:null,liveState})
  await useStudioStore.getState().triggerForegroundGraphic(pages.find(page=>page.documentPage===1))
  assert.equal(liveState.currentSlide,null);assert.equal(liveState.activeSongId,null)
  await useStudioStore.getState().stepSlide(1)
  assert.equal(liveState.foregroundMedia.documentPage,2)
  await useStudioStore.getState().stepSlide(-1)
  assert.equal(liveState.foregroundMedia.documentPage,1)
  useStudioStore.getState().selectSongForDeck(10)
  assert.equal(useStudioStore.getState().selectedDocumentId,null)
})

test('number shortcuts cue the visible song even when a different song is live', async (t) => {
  t.after(() => { delete global.window })
  const makeSong = (id, title) => ({ id, titlePrimary: title, titleSecondary: '', author: '',
    musicalKey: 'C', bpm: 72, updatedAt: '', arrangement: ['v1', 'c1'], sections: [
      { id: 'v1', label: 'Verse', type: 'Verse', slides: [{ id: `verse-${id}`, primaryText: title, secondaryText: '' }] },
      { id: 'c1', label: 'Chorus', type: 'Chorus', slides: [{ id: `chorus-${id}`, primaryText: title, secondaryText: '' }] }
    ] })
  const songs = [makeSong(1, 'Live song'), makeSong(2, 'Visible song')]
  let liveState = { ...useStudioStore.getState().liveState, activeSongId: 1 }
  global.window = { nscApi: { updateLiveState: async (patch) => (liveState = { ...liveState, ...patch }) } }
  useStudioStore.setState({ songs, selectedSongId: 2, temporarySongs: {}, liveState })
  await useStudioStore.getState().jumpToSectionNumber(2)
  assert.equal(liveState.activeSongId, 2)
  assert.equal(liveState.currentSlide.id, 'chorus-2')
})

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
