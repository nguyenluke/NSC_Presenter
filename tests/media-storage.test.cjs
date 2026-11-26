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
const { MediaStorage, mediaFileName } = require('../src/main/mediaStorage.ts')
const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value

function fixture(t) {
  const tempRoot = fs.realpathSync(os.tmpdir())
  const dir = fs.mkdtempSync(path.join(tempRoot, 'nsc-media-storage-'))
  t.after(() => {
    if (comparable(path.dirname(fs.realpathSync(dir))) === comparable(tempRoot) && path.basename(dir).startsWith('nsc-media-storage-')) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
  const data = path.join(dir, 'data')
  const target = path.join(dir, 'chosen')
  fs.mkdirSync(target)
  const storage = new MediaStorage(data)
  return { dir, data, target, storage, original: storage.getDirectory() }
}

test('media relocation preserves files and references and persists across restart', async (t) => {
  const { data, target, storage, original } = fixture(t)
  const names = ['image.png', 'video.mp4', 'audio.wav']
  for (const name of names) fs.writeFileSync(path.join(original, name), `media:${name}`)
  fs.writeFileSync(path.join(original, 'unrelated.json'), 'not a library asset')
  const urls = names.map(name => `nsc-media://asset/${encodeURIComponent(name)}`)
  const changing = storage.changeDirectory(target, urls.map(mediaFileName))
  assert.throws(() => storage.getImportDirectory(), /copy to finish/)
  await assert.rejects(storage.changeDirectory(target, names), /already in progress/)
  assert.equal((await changing).copied, 3)
  for (const name of names) {
    assert.deepEqual(fs.readFileSync(path.join(target, name)), fs.readFileSync(path.join(original, name)))
  }
  assert.equal(fs.existsSync(path.join(target, 'unrelated.json')), false)
  const reopened = new MediaStorage(data)
  assert.equal(comparable(reopened.getImportDirectory()), comparable(fs.realpathSync(target)))
  for (const url of urls) assert.ok(fs.existsSync(path.join(reopened.getDirectory(), mediaFileName(url))))
  assert.equal((await reopened.changeDirectory(target, names)).copied, 0)
})

test('preflight rejects collisions and missing files without switching or overwriting', async (t) => {
  const { data, target, storage, original } = fixture(t)
  fs.writeFileSync(path.join(original, 'a.png'), 'new file')
  fs.writeFileSync(path.join(original, 'b.mp4'), 'original')
  fs.writeFileSync(path.join(target, 'b.mp4'), 'conflict')
  await assert.rejects(storage.changeDirectory(target, ['a.png', 'b.mp4']), /different file/)
  assert.equal(fs.existsSync(path.join(target, 'a.png')), false)
  assert.equal(fs.readFileSync(path.join(target, 'b.mp4'), 'utf8'), 'conflict')
  assert.equal(storage.getDirectory(), original)
  assert.equal(fs.existsSync(path.join(data, 'media-location.json')), false)
  await assert.rejects(storage.changeDirectory(target, ['missing.wav']), /Missing media/)
  assert.equal(storage.busy, false)
  await assert.rejects(storage.changeDirectory(target, ['../outside.mp4']), /Invalid media file/)
})

test('identical destination files are reused and a disconnected folder can be relinked', async (t) => {
  const { dir, data, target, storage, original } = fixture(t)
  fs.writeFileSync(path.join(original, 'image.png'), 'identical')
  fs.writeFileSync(path.join(target, 'image.png'), 'identical')
  assert.equal((await storage.changeDirectory(target, ['image.png'])).copied, 0)
  fs.writeFileSync(path.join(data, 'media-location.json'), JSON.stringify({ directory: path.join(dir, 'disconnected') }))
  const disconnected = new MediaStorage(data)
  assert.equal(disconnected.getStatus().available, false)
  assert.throws(() => disconnected.getImportDirectory(), /unavailable/)
  assert.equal((await disconnected.changeDirectory(target, ['image.png'])).available, true)
})

test('a configuration write failure keeps the original folder active and allows retry', async (t) => {
  const { data, target, storage, original } = fixture(t)
  fs.writeFileSync(path.join(original, 'video.mp4'), 'safe original')
  fs.mkdirSync(path.join(data, 'media-location.json')) // Cannot replace a directory with a config file.
  await assert.rejects(storage.changeDirectory(target, ['video.mp4']), /Media folder unchanged/)
  assert.equal(storage.getDirectory(), original)
  assert.equal(fs.readFileSync(path.join(original, 'video.mp4'), 'utf8'), 'safe original')
  assert.equal(fs.readdirSync(data).some(name => name.endsWith('.tmp')), false)
  fs.rmdirSync(path.join(data, 'media-location.json'))
  assert.equal((await storage.changeDirectory(target, ['video.mp4'])).copied, 0)
})

test('only local media references provide filenames', () => {
  assert.equal(mediaFileName('linear-gradient(red, blue)'), null)
  assert.equal(mediaFileName('https://example.com/video.mp4'), null)
  assert.equal(mediaFileName('nsc-media://asset/my%20video.mp4'), 'my video.mp4')
  assert.throws(() => mediaFileName('nsc-media://asset/a%2Fb.mp4'), /Invalid media/)
  assert.throws(() => mediaFileName('nsc-media://asset/..%5Csecret'), /Invalid media/)
})
