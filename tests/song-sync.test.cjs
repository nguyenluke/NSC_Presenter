const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

// Run main-process TypeScript under Node without launching Electron.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  })
  module._compile(outputText, filename)
}
const { PresenterDatabase } = require('../src/main/database.ts')
const { SongLibrarySync, validateLibraryConfig } = require('../src/main/songSync.ts')
const { validateSongPayload } = require('../src/shared/songSync.ts')

const songInput = (title) => ({ titlePrimary: title, titleSecondary: 'English', author: 'NSC', musicalKey: 'G', bpm: 72,
  sections: [{ id: 'v1', label: 'Verse 1', type: 'Verse', slides: [{ id: 's1', primaryText: 'Chúa yêu con', secondaryText: 'God loves me' }] }],
  arrangement: ['v1', 'v1'] })

test('PostgreSQL song library, permissions, and offline synchronization', async (t) => {
  const pg = new PGlite()
  const folders = []
  t.after(async () => {
    await pg.close()
    for (const dir of folders) fs.rmSync(dir, { recursive: true, force: true })
  })
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;`)
  const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/001_shared_song_library.sql'), 'utf8')
  await pg.exec(migration)
  await pg.exec(migration) // Re-running setup must preserve existing tables and grants.
  const libraryId = randomUUID()
  const users = [randomUUID(), randomUUID(), randomUUID()]
  await pg.query('insert into public.nsc_libraries(id,name) values ($1,$2)', [libraryId, 'NSC'])
  for (const id of users) await pg.query('insert into auth.users values ($1)', [id])
  for (const id of users.slice(0, 2)) await pg.query('insert into public.nsc_library_members values ($1,$2)', [libraryId, id])

  async function asUser(id, action, role = 'authenticated') {
    await pg.exec('begin')
    try {
      await pg.exec(`set local role ${role}`)
      if (id) await pg.query("select set_config('request.jwt.claim.sub', $1, true)", [id])
      const result = await action()
      await pg.exec('commit')
      return result
    } catch (error) { await pg.exec('rollback'); throw error }
  }

  let offline = false
  let loseNextPushResponse = false
  let expireNextAccess = false
  let refreshCount = 0
  let afterPush = null
  const fetchMock = async (input, init = {}) => {
    if (offline) throw new Error('network down')
    const url = new URL(input)
    const body = init.body ? JSON.parse(init.body) : undefined
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') refreshCount++
      const id = body.refresh_token?.slice(8) || users[Number(body.email?.split('@')[0]) || 0]
      return Response.json({ access_token: `access-${id}`, refresh_token: `refresh-${id}`, user: { email: `${users.indexOf(id)}@nsc.test` } })
    }
    const id = init.headers.Authorization?.slice('Bearer access-'.length)
    if (expireNextAccess) { expireNextAccess = false; return new Response('', { status: 401 }) }
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 })
    try {
      if (url.pathname === '/rest/v1/rpc/nsc_push_song') {
        const result = await asUser(id, () => pg.query('select public.nsc_push_song($1,$2,$3,$4,$5,$6) as result',
          [body.p_library_id, body.p_id, body.p_revision, body.p_mutation_id, body.p_deleted, body.p_payload]))
        if (afterPush) { const action = afterPush; afterPush = null; action() }
        if (loseNextPushResponse) { loseNextPushResponse = false; throw new TypeError('lost response') }
        return Response.json(result.rows[0].result)
      }
      if (url.pathname === '/rest/v1/nsc_libraries') {
        const result = await asUser(id, () => pg.query('select id from public.nsc_libraries where id = $1', [url.searchParams.get('id').slice(3)]))
        return Response.json(result.rows)
      }
      if (url.pathname === '/rest/v1/nsc_songs') {
        const filter = url.searchParams.get('id')
        const condition = filter?.startsWith('eq.') ? 'and id = $2' : filter?.startsWith('gt.') ? 'and id > $2' : ''
        const params = [url.searchParams.get('library_id').slice(3)]
        if (condition) params.push(filter.slice(3))
        // Force pages of two rows to verify pagination below the requested limit.
        const result = await asUser(id, () => pg.query(`select id, revision, mutation_id, deleted, payload
          from public.nsc_songs where library_id = $1 ${condition} order by id limit 2`, params))
        return Response.json(result.rows)
      }
      return new Response('', { status: 404 })
    } catch (error) {
      if (error instanceof TypeError) throw error
      return new Response('', { status: error.code === '42501' ? 403 : 400 })
    }
  }
  const config = { url: 'https://nsc-test.supabase.co', publishableKey: 'sb_publishable_test', libraryId }
  async function device(userIndex = 0, keepSamples = false) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-test-')); folders.push(dir)
    const db = new PresenterDatabase(dir)
    await db.init()
    // Remove sample data; retain deletion tombstones, just as a real PC does.
    if (!keepSamples) for (const song of db.getAllSongs()) db.deleteSong(song.id)
    const sync = new SongLibrarySync(db, fetchMock)
    await sync.configure(config)
    await sync.signIn(`${userIndex}@nsc.test`, 'test-password')
    return { db, sync, dir }
  }

  await t.test('RLS isolates libraries and RPC denies nonmembers and anonymous users', async () => {
    const request = [libraryId, randomUUID(), 0, randomUUID(), false, songInput('Permissions')]
    await assert.rejects(asUser(users[2], () => pg.query('select public.nsc_push_song($1,$2,$3,$4,$5,$6)', request)), /membership required/)
    await assert.rejects(asUser(null, () => pg.query('select public.nsc_push_song($1,$2,$3,$4,$5,$6)', request), 'anon'), /permission denied/)
    const visible = await asUser(users[2], () => pg.query('select * from public.nsc_songs'))
    assert.equal(visible.rows.length, 0)
    await assert.rejects(asUser(users[0], () => pg.query('insert into public.nsc_library_members values ($1,$2)', [libraryId, users[2]])), /permission denied/)
    await assert.rejects(asUser(users[0], () => pg.query('delete from public.nsc_songs')), /permission denied/)
    const otherId = randomUUID()
    await pg.query('insert into public.nsc_libraries values ($1,$2)', [otherId, 'Other church'])
    const libraries = await asUser(users[0], () => pg.query('select * from public.nsc_libraries'))
    assert.deepEqual(libraries.rows.map((row) => row.id), [libraryId])
  })

  await t.test('SQL rejects malformed embedded slides and accepts equivalent independent uploads', async () => {
    const malformed = songInput('Invalid slide')
    malformed.sections[0].slides[0].primaryText = null
    await assert.rejects(asUser(users[0], () => pg.query('select public.nsc_push_song($1,$2,$3,$4,$5,$6)',
      [libraryId, randomUUID(), 0, randomUUID(), false, malformed])), /Invalid song payload/)
    const id = randomUUID()
    const input = songInput('Equivalent edits')
    for (const user of users.slice(0, 2)) {
      const result = await asUser(user, () => pg.query('select public.nsc_push_song($1,$2,$3,$4,$5,$6) as result',
        [libraryId, id, 0, randomUUID(), false, input]))
      assert.equal(result.rows[0].result.applied, true)
      assert.equal(result.rows[0].result.song.revision, 1)
    }
  })

  await t.test('starter songs have the same shared IDs across fresh installations', async () => {
    const first = await device(0, true)
    const second = await device(1, true)
    assert.deepEqual(first.db.getPendingSongs().map((song) => song.sharedId), second.db.getPendingSongs().map((song) => song.sharedId))
    assert.equal(first.db.getAllSongs().length, 2)
  })

  const a = await device(0)
  const b = await device(1)
  let sharedId
  await t.test('songs round-trip through PostgreSQL without changing local playlist references', async () => {
    const saved = a.db.saveSong(songInput('Bilingual test'))
    sharedId = a.db.getPendingSongs().find((song) => song.payload.titlePrimary === saved.titlePrimary).sharedId
    a.db.addServiceItem('song', saved.id)
    await a.sync.synchronize(); await b.sync.synchronize()
    const downloaded = b.db.getAllSongs().find((song) => song.titlePrimary === 'Bilingual test')
    assert.deepEqual(downloaded.sections, saved.sections)
    assert.deepEqual(downloaded.arrangement, ['v1', 'v1'])
    b.db.addServiceItem('song', downloaded.id)
    a.db.saveSong({ ...saved, titlePrimary: 'Updated bilingual test' })
    await a.sync.synchronize(); await b.sync.synchronize()
    assert.equal(b.db.getAllSongs().find((song) => song.id === downloaded.id).titlePrimary, 'Updated bilingual test')
    assert.equal(b.db.getServiceItems()[0].targetId, downloaded.id)
  })

  await t.test('offline edits persist across restart, and sessions do not', async () => {
    a.db.saveSong(songInput('Offline song'))
    offline = true
    await assert.rejects(a.sync.synchronize(), /remain saved locally/)
    const reopened = new PresenterDatabase(a.dir); await reopened.init()
    assert.ok(reopened.getPendingSongs().some((song) => song.payload.titlePrimary === 'Offline song'))
    const sync = new SongLibrarySync(reopened, fetchMock)
    assert.equal(sync.status().email, null)
    assert.equal(JSON.stringify(sync.status()).includes('access-'), false)
    offline = false
    await a.sync.synchronize()
  })

  await t.test('lost upload responses retry idempotently', async () => {
    const saved = a.db.saveSong(songInput('Retry song'))
    const pending = a.db.getPendingSongs().find((song) => song.payload.titlePrimary === saved.titlePrimary)
    loseNextPushResponse = true
    await assert.rejects(a.sync.synchronize(), /remain saved locally/)
    await a.sync.synchronize()
    const result = await pg.query('select revision from public.nsc_songs where id = $1', [pending.sharedId])
    assert.equal(result.rows[0].revision, 1)
    assert.equal(a.db.getPendingSongs().length, 0)
  })

  await t.test('edits made while an upload is in flight remain pending', async () => {
    const saved = a.db.saveSong(songInput('In flight'))
    afterPush = () => a.db.saveSong({ ...saved, titlePrimary: 'Edited during upload' })
    await a.sync.synchronize()
    assert.ok(a.db.getPendingSongs().some((song) => song.payload.titlePrimary === 'Edited during upload'))
    await a.sync.synchronize()
    assert.equal(a.db.getPendingSongs().length, 0)
  })

  await t.test('concurrent edits require an explicit choice and reject stale conflict decisions', async () => {
    await b.sync.synchronize()
    const localA = a.db.getAllSongs().find((song) => song.titlePrimary === 'Updated bilingual test')
    const localB = b.db.getAllSongs().find((song) => song.titlePrimary === 'Updated bilingual test')
    a.db.saveSong({ ...localA, titlePrimary: 'Home edit' })
    b.db.saveSong({ ...localB, titlePrimary: 'Church edit' })
    await a.sync.synchronize()
    let report = await b.sync.synchronize()
    assert.equal(report.conflicts.length, 1)
    assert.equal(b.db.getAllSongs().find((song) => song.id === localB.id).titlePrimary, 'Church edit')
    a.db.saveSong({ ...localA, titlePrimary: 'Newer home edit' }); await a.sync.synchronize()
    await assert.rejects(b.sync.resolve(sharedId, 'local', report.conflicts[0].revision), /changed again/)
    report = await b.sync.synchronize()
    await b.sync.resolve(sharedId, 'local', report.conflicts[0].revision)
    await b.sync.synchronize(); await a.sync.synchronize()
    assert.equal(a.db.getAllSongs().find((song) => song.id === localA.id).titlePrimary, 'Church edit')
    a.db.saveSong({ ...localA, titlePrimary: 'Shared winner' }); await a.sync.synchronize()
    b.db.saveSong({ ...localB, titlePrimary: 'Discard this edit' })
    report = await b.sync.synchronize()
    await b.sync.resolve(sharedId, 'shared', report.conflicts[0].revision)
    assert.equal(b.db.getAllSongs().find((song) => song.id === localB.id).titlePrimary, 'Shared winner')
  })

  await t.test('deletions remove remote playlist references and do not re-seed deleted libraries', async () => {
    const local = a.db.getAllSongs().find((song) => song.titlePrimary === 'Shared winner')
    a.db.deleteSong(local.id); await a.sync.synchronize(); await b.sync.synchronize()
    assert.ok(!b.db.getAllSongs().some((song) => song.titlePrimary === 'Shared winner'))
    assert.equal(b.db.getServiceItems().length, 0)
    const c = await device()
    const reopened = new PresenterDatabase(c.dir); await reopened.init()
    assert.equal(reopened.getAllSongs().length, 0)
    assert.equal(reopened.getPendingSongs().length, 2)
  })

  await t.test('expired access tokens refresh once, and sign-out clears the session offline', async () => {
    expireNextAccess = true
    await a.sync.synchronize()
    assert.equal(refreshCount, 1)
    offline = true
    await assert.rejects(a.sync.signOut(), /remain saved locally/)
    assert.equal(a.sync.status().email, null)
    offline = false
  })

  await t.test('a mistaken connection can be corrected before the first authorized sync', async () => {
    const c = await device(2)
    const wrong = { ...config, libraryId: randomUUID() }
    await c.sync.configure(wrong)
    await c.sync.signIn('2@nsc.test', 'test-password')
    await assert.rejects(c.sync.synchronize(), /Library access not found/)
    await c.sync.configure(config)
    await c.sync.signIn('0@nsc.test', 'test-password')
    await c.sync.synchronize()
    assert.equal(c.sync.status().config.libraryId, libraryId)
  })

  await t.test('configuration rejects privileged keys and changing library identity', async () => {
    assert.throws(() => validateLibraryConfig({ ...config, publishableKey: 'sb_secret_never-use' }), /publishable key/)
    assert.throws(() => validateLibraryConfig({ ...config, url: 'http://example.com' }), /HTTPS/)
    await assert.rejects(a.sync.configure({ ...config, libraryId: randomUUID() }), /linked to another/)
    assert.equal(a.sync.status().config.libraryId, libraryId)
    assert.throws(() => validateSongPayload({ ...songInput('Bad'), arrangement: ['missing'] }), /missing section/)
  })

  await t.test('legacy SQLite migration preserves songs, playlists, and an original-file backup', async () => {
    const initSqlJs = require('sql.js')
    const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
    const legacy = new SQL.Database()
    legacy.run(`create table songs (id integer primary key autoincrement, title_primary text, title_secondary text,
      author text, musical_key text, bpm integer, sections_json text, arrangement_json text, updated_at text);
      create table service_items(id integer primary key autoincrement, item_type text, target_id integer, sort_order integer);`)
    const input = songInput('Legacy song')
    legacy.run('insert into songs values (42,?,?,?,?,?,?,?,?)', [input.titlePrimary, input.titleSecondary, input.author,
      input.musicalKey, input.bpm, JSON.stringify(input.sections), JSON.stringify(input.arrangement), '2025-01-01'])
    legacy.run("insert into service_items values (7,'song',42,0)")
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-sync-test-')); folders.push(dir)
    const bytes = Buffer.from(legacy.export()); legacy.close()
    fs.writeFileSync(path.join(dir, 'nsc_library.sqlite'), bytes)
    const db = new PresenterDatabase(dir); await db.init()
    assert.equal(db.getAllSongs()[0].id, 42)
    assert.equal(db.getServiceItems()[0].targetId, 42)
    assert.equal(db.getPendingSongs()[0].payload.titlePrimary, 'Legacy song')
    assert.deepEqual(fs.readFileSync(path.join(dir, 'nsc_library.sqlite.before-sync.bak')), bytes)
    await db.init() // Reopening the migrated library must not overwrite the original backup.
    assert.equal(db.getPendingSongs().length, 1)
  })
})
