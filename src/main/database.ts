import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { PendingSong, SharedSong, validateSharedSong } from '../shared/songSync'
import { app } from 'electron'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import {
  AudioCategory,
  AudioTrack,
  MediaAsset,
  MediaBin,
  OutputProfile,
  ServiceItem,
  Song,
  SongInput
} from '@shared/types'

export class PresenterDatabase {
  private SQL!: SqlJsStatic
  private db!: Database
  private dbFilePath: string

  constructor(dataDir = path.join(app.getPath('userData'), 'NSC_Data')) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    this.dbFilePath = path.join(dataDir, 'nsc_library.sqlite')
  }

  public getStorageDirectory(): string {
    return path.dirname(this.dbFilePath)
  }

  public getDatabaseFilePath(): string {
    return this.dbFilePath
  }

  public async init(): Promise<void> {
    const wasmCandidates = [
      path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(process.resourcesPath || '', 'app.asar/node_modules/sql.js/dist/sql-wasm.wasm')
    ]
    const wasmPath = wasmCandidates.find((p) => fs.existsSync(p))

    this.SQL = await initSqlJs({
      locateFile: () => wasmPath || 'sql-wasm.wasm'
    })

    this.loadFromDisk()
  }

  public loadFromDisk(): void {
    if (fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath)
      this.db = new this.SQL.Database(fileBuffer)
    } else {
      this.db = new this.SQL.Database()
    }

    if (fs.existsSync(this.dbFilePath) &&
        !this.db.exec("SELECT name FROM sqlite_master WHERE name = 'song_sync'").length &&
        !fs.existsSync(this.dbFilePath + '.before-sync.bak')) {
      fs.copyFileSync(this.dbFilePath, this.dbFilePath + '.before-sync.bak')
    }
    this.createSchema()
    this.seedDefaultsIfNeeded()
    for (const song of this.getAllSongs()) {
      if (!this.syncRowByLocalId(song.id)) this.markSongDirty(song.id, song)
    }
    this.db.run("INSERT OR IGNORE INTO sync_settings VALUES ('songs_initialized', '1')")
    this.persist()
  }

  private persist(): void {
    const binaryArray = this.db.export()
    const temporaryPath = this.dbFilePath + '.tmp'
    fs.writeFileSync(temporaryPath, Buffer.from(binaryArray))
    fs.renameSync(temporaryPath, this.dbFilePath)
  }

  private createSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS song_sync (
        shared_id TEXT PRIMARY KEY,
        local_id INTEGER UNIQUE,
        revision INTEGER NOT NULL DEFAULT 0,
        mutation_id TEXT NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 1,
        deleted INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_primary TEXT NOT NULL,
        title_secondary TEXT DEFAULT '',
        author TEXT DEFAULT '',
        musical_key TEXT DEFAULT 'G',
        bpm INTEGER DEFAULT 72,
        sections_json TEXT NOT NULL,
        arrangement_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        bin TEXT NOT NULL,
        media_type TEXT NOT NULL,
        url TEXT NOT NULL,
        fit_mode TEXT DEFAULT 'cover'
      );

      CREATE TABLE IF NOT EXISTS audio_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        url TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS output_profiles (
        id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL
      );
    `)
  }

  private seedDefaultsIfNeeded(): void {
    // 1. Seed initial Audience + Stage screens (user can freely add/remove as many screens as needed!)
    const existingProfiles = this.getOutputProfiles()
    if (existingProfiles.length === 0) {
      const defaults: OutputProfile[] = [
        {
          id: 'audience-main',
          name: 'Main LED Wall',
          screenType: 'audience',
          enabled: false,
          windowMode: 'virtual',
          assignedDisplayId: null,
          languageMode: 'both',
          primaryFontSize: 64,
          secondaryFontSize: 42,
          primaryColor: '#FFFFFF',
          secondaryColor: '#FCD34D',
          dimOpacity: 0.35,
          verticalAlign: 'center'
        },
        {
          id: 'stage-main',
          name: 'Stage Display (Back TV)',
          screenType: 'stage',
          enabled: false,
          windowMode: 'virtual',
          assignedDisplayId: null,
          languageMode: 'both',
          primaryFontSize: 60,
          secondaryFontSize: 40,
          primaryColor: '#FFFFFF',
          secondaryColor: '#FDE047',
          dimOpacity: 0,
          verticalAlign: 'center'
        }
      ]
      for (const p of defaults) {
        this.saveOutputProfile(p, false)
      }
    } else {
      // Smoothly upgrade any older profile records missing `screenType`
      for (const p of existingProfiles) {
        if (!p.screenType) {
          p.screenType = p.id.includes('stage') ? 'stage' : 'audience'
          this.saveOutputProfile(p, false)
        }
      }
    }

    // 2. Seed starter worship atmosphere visuals
    const existingMedia = this.getMediaAssets()
    if (existingMedia.length === 0) {
      const starterVisuals: Omit<MediaAsset, 'id'>[] = [
        {
          title: 'Deep Sanctuary Horizon',
          bin: 'Worship Designs',
          mediaType: 'atmosphere',
          url: 'radial-gradient(circle at 50% 25%, #1e3a8a 0%, #0f172a 55%, #020617 100%)',
          fitMode: 'cover'
        },
        {
          title: 'Amber Glory Glow',
          bin: 'Worship Designs',
          mediaType: 'atmosphere',
          url: 'radial-gradient(ellipse at 50% 80%, #9a3412 0%, #431407 50%, #090b0f 100%)',
          fitMode: 'cover'
        },
        {
          title: 'Emerald Still Waters',
          bin: 'Worship Designs',
          mediaType: 'atmosphere',
          url: 'linear-gradient(135deg, #064e3b 0%, #0f172a 55%, #1e1b4b 100%)',
          fitMode: 'cover'
        },
        {
          title: 'Royal Violet Presence',
          bin: 'Worship Designs',
          mediaType: 'atmosphere',
          url: 'radial-gradient(circle at 30% 20%, #581c87 0%, #1e1b4b 55%, #030712 100%)',
          fitMode: 'cover'
        },
        {
          title: 'NSC Church Welcome Graphic',
          bin: 'Logos',
          mediaType: 'atmosphere',
          url: 'radial-gradient(circle at 50% 50%, #1d4ed8 0%, #0b1120 70%)',
          fitMode: 'cover'
        }
      ]
      for (const m of starterVisuals) {
        this.addMediaAsset(m, false)
      }
    }

    // 3. Seed Bilingual Worship Songs
    const existingSongs = this.getAllSongs()
    if (existingSongs.length === 0 &&
        !this.db.exec("SELECT value FROM sync_settings WHERE key = 'songs_initialized'").length) {
      const sampleSongs: SongInput[] = [
        {
          titlePrimary: 'Đấng Mở Đường',
          titleSecondary: 'Way Maker',
          author: 'Sinach',
          musicalKey: 'G',
          bpm: 68,
          arrangement: ['v1', 'c1', 'v2', 'c1', 'b1', 'c1'],
          sections: [
            {
              id: 'v1',
              type: 'Verse',
              label: 'Verse 1',
              slides: [
                {
                  id: 'wm-1',
                  primaryText: 'Chúa đang ở đây, hành động giữa chúng con\nCon tôn thờ Ngài, con tôn thờ Ngài',
                  secondaryText: 'You are here, moving in our midst\nI worship You, I worship You',
                  chords: 'C          G\nD          Em'
                },
                {
                  id: 'wm-2',
                  primaryText: 'Chúa đang ở đây, biến đổi mọi tấm lòng\nCon tôn thờ Ngài, con tôn thờ Ngài',
                  secondaryText: 'You are here, turning lives around\nI worship You, I worship You',
                  chords: 'C          G\nD          Em'
                }
              ]
            },
            {
              id: 'c1',
              type: 'Chorus',
              label: 'Chorus',
              slides: [
                {
                  id: 'wm-3',
                  primaryText: 'Đấng mở đường, Đấng làm phép lạ, Đấng giữ lời hứa\nÁnh sáng trong bóng đêm, Chúa ơi chính Ngài',
                  secondaryText: 'Way maker, miracle worker, promise keeper\nLight in the darkness, my God, that is who You are',
                  chords: 'C          G\nD          Em'
                }
              ]
            },
            {
              id: 'v2',
              type: 'Verse',
              label: 'Verse 2',
              slides: [
                {
                  id: 'wm-4',
                  primaryText: 'Chúa đang ở đây, chữa lành mọi đớn đau\nCon tôn thờ Ngài, con tôn thờ Ngài',
                  secondaryText: 'You are here, healing every heart\nI worship You, I worship You',
                  chords: 'C          G\nD          Em'
                }
              ]
            },
            {
              id: 'b1',
              type: 'Bridge',
              label: 'Bridge',
              slides: [
                {
                  id: 'wm-5',
                  primaryText: 'Dù mắt chẳng thấy nhưng Ngài đang hành động\nDù chẳng cảm biết nhưng Ngài đang hành động',
                  secondaryText: "Even when I don't see it, You're working\nEven when I don't feel it, You're working",
                  chords: 'C          G\nD          Em'
                },
                {
                  id: 'wm-6',
                  primaryText: 'Ngài chẳng ngơi nghỉ, Ngài chẳng ngơi nghỉ bao giờ!',
                  secondaryText: 'You never stop, You never stop working!',
                  chords: 'C          G          D          Em'
                }
              ]
            }
          ]
        },
        {
          titlePrimary: 'Sự Tốt Lành Của Chúa',
          titleSecondary: 'Goodness of God',
          author: 'Bethel Music',
          musicalKey: 'A',
          bpm: 63,
          arrangement: ['v1', 'c1', 'b1', 'c1'],
          sections: [
            {
              id: 'v1',
              type: 'Verse',
              label: 'Verse 1',
              slides: [
                {
                  id: 'gog-1',
                  primaryText: 'Con yêu Chúa, ôi ơn thương xót chẳng hề ngơi\nTrọn đời con được giữ trong tay Ngài',
                  secondaryText: 'I love You, Lord, oh Your mercy never fails me\nAll my days, I have been held in Your hands',
                  chords: 'A          D          A\nF#m        E          D'
                }
              ]
            },
            {
              id: 'c1',
              type: 'Chorus',
              label: 'Chorus',
              slides: [
                {
                  id: 'gog-3',
                  primaryText: 'Trọn cả đời con Chúa luôn thành tín\nTrọn cả đời con Chúa quá tốt lành',
                  secondaryText: 'All my life You have been faithful\nAll my life You have been so, so good',
                  chords: 'D                     A\nD                     A       E'
                }
              ]
            },
            {
              id: 'b1',
              type: 'Bridge',
              label: 'Bridge',
              slides: [
                {
                  id: 'gog-5',
                  primaryText: 'Sự tốt lành Chúa cứ theo con, cứ theo con mãi\nCon dâng trọn đời sống nơi chân Ngài',
                  secondaryText: 'Your goodness is running after, it is running after me\nWith my life laid down, I am surrendered now',
                  chords: 'A/C#       D          E       F#m\nA/C#       D          E       A'
                }
              ]
            }
          ]
        }
      ]

      for (const s of sampleSongs) {
        this.saveSong(s, false)
      }
      for (const song of this.getAllSongs()) {
        this.addServiceItem('song', song.id, false)
      }
    }
  }

  public getAllSongs(): Song[] {
    const stmt = this.db.prepare('SELECT * FROM songs ORDER BY updated_at DESC, id DESC')
    const results: Song[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      results.push({
        id: Number(row.id),
        titlePrimary: String(row.title_primary),
        titleSecondary: String(row.title_secondary || ''),
        author: String(row.author || ''),
        musicalKey: String(row.musical_key || 'G'),
        bpm: Number(row.bpm || 72),
        sections: JSON.parse(String(row.sections_json || '[]')),
        arrangement: JSON.parse(String(row.arrangement_json || '[]')),
        updatedAt: String(row.updated_at)
      })
    }
    stmt.free()
    return results
  }

  public saveSong(input: SongInput, shouldPersist = true): Song {
    const now = new Date().toISOString()
    const sectionsJson = JSON.stringify(input.sections)
    const arrangementJson = JSON.stringify(
      input.arrangement.length > 0 ? input.arrangement : input.sections.map((s) => s.id)
    )

    // Saving an unchanged song must not create another pending cloud change.
    const existing = input.id ? this.getAllSongs().find((song) => song.id === input.id) : undefined
    if (existing && existing.titlePrimary === input.titlePrimary &&
        existing.titleSecondary === input.titleSecondary && existing.author === input.author &&
        existing.musicalKey === input.musicalKey && existing.bpm === input.bpm &&
        JSON.stringify(existing.sections) === sectionsJson &&
        JSON.stringify(existing.arrangement) === arrangementJson) return existing

    if (input.id) {
      this.db.run(
        `UPDATE songs
         SET title_primary = ?, title_secondary = ?, author = ?, musical_key = ?, bpm = ?,
             sections_json = ?, arrangement_json = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.titlePrimary,
          input.titleSecondary,
          input.author,
          input.musicalKey,
          input.bpm,
          sectionsJson,
          arrangementJson,
          now,
          input.id
        ]
      )
      this.markSongDirty(input.id)
      if (shouldPersist) this.persist()
      return this.getAllSongs().find((s) => s.id === input.id)!
    } else {
      this.db.run(
        `INSERT INTO songs (title_primary, title_secondary, author, musical_key, bpm, sections_json, arrangement_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.titlePrimary,
          input.titleSecondary,
          input.author,
          input.musicalKey,
          input.bpm,
          sectionsJson,
          arrangementJson,
          now
        ]
      )
      const idRes = this.db.exec('SELECT last_insert_rowid() AS id')
      const newId = Number(idRes[0].values[0][0])
      this.markSongDirty(newId)
      if (shouldPersist) this.persist()
      return this.getAllSongs().find((s) => s.id === newId)!
    }
  }

  public deleteSong(id: number): void {
    if (!this.getAllSongs().some((song) => song.id === id)) return
    this.markSongDirty(id)
    this.db.run('UPDATE song_sync SET deleted = 1, local_id = NULL WHERE local_id = ?', [id])
    this.db.run('DELETE FROM songs WHERE id = ?', [id])
    this.db.run("DELETE FROM service_items WHERE item_type = 'song' AND target_id = ?", [id])
    this.persist()
  }

  private syncRowByLocalId(id: number): Record<string, unknown> | undefined {
    const stmt = this.db.prepare('SELECT * FROM song_sync WHERE local_id = ?')
    try { stmt.bind([id]); return stmt.step() ? stmt.getAsObject() : undefined }
    finally { stmt.free() }
  }

  private newSharedId(song: Song): string {
    // Bundled examples represent the same songs across fresh installations.
    const sampleIds: Record<string, string> = {
      'wm-1': '9ee00290-6ef2-4df9-83aa-5d3025a50001',
      'gog-1': '9ee00290-6ef2-4df9-83aa-5d3025a50002'
    }
    const candidate = sampleIds[song.sections[0]?.slides[0]?.id ?? '']
    if (candidate) {
      const stmt = this.db.prepare('SELECT shared_id FROM song_sync WHERE shared_id = ?')
      try { stmt.bind([candidate]); if (!stmt.step()) return candidate }
      finally { stmt.free() }
    }
    return randomUUID()
  }

  private markSongDirty(id: number, existingSong?: Song): void {
    const song = existingSong ?? this.getAllSongs().find((entry) => entry.id === id)
    if (!song) throw new Error('Song no longer exists.')
    const { id: _id, updatedAt: _updatedAt, ...payload } = song
    const existing = this.syncRowByLocalId(id)
    this.db.run(`INSERT INTO song_sync
      (shared_id, local_id, revision, mutation_id, dirty, deleted, payload_json)
      VALUES (?, ?, 0, ?, 1, 0, ?)
      ON CONFLICT(local_id) DO UPDATE SET mutation_id = excluded.mutation_id,
        dirty = 1, payload_json = excluded.payload_json`,
      [String(existing?.shared_id ?? this.newSharedId(song)), id, randomUUID(), JSON.stringify(payload)])
  }

  public checkSharedLibrary(identity: string): void {
    const rows = this.db.exec("SELECT value FROM sync_settings WHERE key = 'library'")
    if (rows.length && rows[0].values[0][0] !== identity) {
      throw new Error('This local library is linked to another project/library ID. Restore the original connection settings.')
    }
  }

  public bindSharedLibrary(identity: string): void {
    this.checkSharedLibrary(identity)
    this.db.run("INSERT OR IGNORE INTO sync_settings VALUES ('library', ?)", [identity])
    this.persist()
  }

  public getPendingSongs(): PendingSong[] {
    const stmt = this.db.prepare('SELECT * FROM song_sync WHERE dirty = 1 ORDER BY shared_id')
    const pending: PendingSong[] = []
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject()
        pending.push({ sharedId: String(row.shared_id), revision: Number(row.revision),
          mutationId: String(row.mutation_id), deleted: Boolean(row.deleted),
          payload: JSON.parse(String(row.payload_json)) })
      }
    } finally { stmt.free() }
    return pending
  }

  public acknowledgeSong(sent: PendingSong, revision: number): void {
    // Retain pending edits made while the network request was in flight.
    this.db.run(`UPDATE song_sync SET revision = ?, dirty = CASE WHEN mutation_id = ? THEN 0 ELSE 1 END
      WHERE shared_id = ?`, [revision, sent.mutationId, sent.sharedId])
    this.persist()
  }

  public applySharedSong(remote: SharedSong, discardLocal = false): boolean {
    validateSharedSong(remote)
    const stmt = this.db.prepare('SELECT * FROM song_sync WHERE shared_id = ?')
    let existing: Record<string, unknown> | undefined
    try { stmt.bind([remote.id]); existing = stmt.step() ? stmt.getAsObject() : undefined }
    finally { stmt.free() }
    if (existing && !discardLocal && (existing.dirty || Number(existing.revision) >= remote.revision)) return false
    this.db.run('BEGIN')
    try {
      const localId = existing?.local_id == null ? undefined : Number(existing.local_id)
      let savedId: number | null = localId ?? null
      if (remote.deleted) {
        if (localId !== undefined) {
          this.db.run('DELETE FROM songs WHERE id = ?', [localId])
          this.db.run("DELETE FROM service_items WHERE item_type = 'song' AND target_id = ?", [localId])
        }
        savedId = null
      } else {
        const saved = this.saveSong({ ...remote.payload, id: localId }, false)
        savedId = saved.id
        this.db.run('DELETE FROM song_sync WHERE local_id = ?', [saved.id])
      }
      this.db.run(`INSERT INTO song_sync
        (shared_id, local_id, revision, mutation_id, dirty, deleted, payload_json)
        VALUES (?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(shared_id) DO UPDATE SET local_id = excluded.local_id,
          revision = excluded.revision, mutation_id = excluded.mutation_id, dirty = 0,
          deleted = excluded.deleted, payload_json = excluded.payload_json`,
        [remote.id, savedId, remote.revision, remote.mutation_id, Number(remote.deleted), JSON.stringify(remote.payload)])
      this.db.run('COMMIT')
    } catch (error) { this.db.run('ROLLBACK'); throw error }
    this.persist()
    return true
  }

  public keepLocalSong(sharedId: string, revision: number): void {
    this.db.run('UPDATE song_sync SET revision = ?, mutation_id = ?, dirty = 1 WHERE shared_id = ?',
      [revision, randomUUID(), sharedId])
    this.persist()
  }

  public getMediaAssets(): MediaAsset[] {
    const stmt = this.db.prepare('SELECT * FROM media_assets ORDER BY id DESC')
    const assets: MediaAsset[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      assets.push({
        id: Number(row.id),
        title: String(row.title),
        bin: String(row.bin) as MediaBin,
        mediaType: String(row.media_type) as MediaAsset['mediaType'],
        url: String(row.url),
        fitMode: (String(row.fit_mode) as 'cover' | 'contain') || 'cover'
      })
    }
    stmt.free()
    return assets
  }

  public addMediaAsset(asset: Omit<MediaAsset, 'id'>, shouldPersist = true): MediaAsset {
    this.db.run(
      'INSERT INTO media_assets (title, bin, media_type, url, fit_mode) VALUES (?, ?, ?, ?, ?)',
      [asset.title, asset.bin, asset.mediaType, asset.url, asset.fitMode]
    )
    const idRes = this.db.exec('SELECT last_insert_rowid() AS id')
    const newId = Number(idRes[0].values[0][0])
    if (shouldPersist) this.persist()
    return { ...asset, id: newId }
  }

  public deleteMediaAsset(id: number): void {
    this.db.run('DELETE FROM media_assets WHERE id = ?', [id])
    this.db.run("DELETE FROM service_items WHERE item_type = 'media' AND target_id = ?", [id])
    this.persist()
  }

  public getAudioTracks(): AudioTrack[] {
    const stmt = this.db.prepare('SELECT * FROM audio_tracks ORDER BY id DESC')
    const tracks: AudioTrack[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      tracks.push({
        id: Number(row.id),
        title: String(row.title),
        category: String(row.category) as AudioCategory,
        url: String(row.url)
      })
    }
    stmt.free()
    return tracks
  }

  public addAudioTrack(track: Omit<AudioTrack, 'id'>): AudioTrack {
    this.db.run('INSERT INTO audio_tracks (title, category, url) VALUES (?, ?, ?)', [
      track.title,
      track.category,
      track.url
    ])
    const idRes = this.db.exec('SELECT last_insert_rowid() AS id')
    const newId = Number(idRes[0].values[0][0])
    this.persist()
    return { ...track, id: newId }
  }

  public deleteAudioTrack(id: number): void {
    this.db.run('DELETE FROM audio_tracks WHERE id = ?', [id])
    this.persist()
  }

  public getServiceItems(): ServiceItem[] {
    const stmt = this.db.prepare('SELECT * FROM service_items ORDER BY sort_order ASC, id ASC')
    const items: ServiceItem[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      items.push({
        id: Number(row.id),
        itemType: String(row.item_type) as 'song' | 'media',
        targetId: Number(row.target_id),
        sortOrder: Number(row.sort_order)
      })
    }
    stmt.free()
    return items
  }

  public addServiceItem(itemType: 'song' | 'media', targetId: number, shouldPersist = true): ServiceItem[] {
    const existing = this.getServiceItems()
    this.db.run(
      'INSERT INTO service_items (item_type, target_id, sort_order) VALUES (?, ?, ?)',
      [itemType, targetId, existing.length]
    )
    if (shouldPersist) this.persist()
    return this.getServiceItems()
  }

  public removeServiceItem(id: number): ServiceItem[] {
    this.db.run('DELETE FROM service_items WHERE id = ?', [id])
    this.persist()
    return this.getServiceItems()
  }

  public reorderServiceItems(orderedIds: number[]): ServiceItem[] {
    orderedIds.forEach((id, index) => {
      this.db.run('UPDATE service_items SET sort_order = ? WHERE id = ?', [index, id])
    })
    this.persist()
    return this.getServiceItems()
  }

  public getOutputProfiles(): OutputProfile[] {
    const stmt = this.db.prepare('SELECT * FROM output_profiles')
    const profiles: OutputProfile[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const parsed = JSON.parse(String(row.profile_json)) as OutputProfile
      if (!parsed.screenType) {
        parsed.screenType = parsed.id.includes('stage') ? 'stage' : 'audience'
      }
      profiles.push(parsed)
    }
    stmt.free()
    return profiles
  }

  public saveOutputProfile(profile: OutputProfile, shouldPersist = true): OutputProfile[] {
    this.db.run(
      'INSERT OR REPLACE INTO output_profiles (id, profile_json) VALUES (?, ?)',
      [profile.id, JSON.stringify(profile)]
    )
    if (shouldPersist) this.persist()
    return this.getOutputProfiles()
  }

  public deleteOutputProfile(id: string): OutputProfile[] {
    this.db.run('DELETE FROM output_profiles WHERE id = ?', [id])
    this.persist()
    return this.getOutputProfiles()
  }
}
