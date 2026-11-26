import fs from 'fs'
import path from 'path'
import { PresenterDatabase } from './database'
import {
  LibraryConfig, SharedSong, SongSyncResult, SongSyncStatus, UUID_PATTERN, validateSharedSong, validateSongPayload
} from '../shared/songSync'

interface Session {
  access_token: string
  refresh_token: string
  user: { email?: string }
}

export function validateLibraryConfig(value: LibraryConfig): LibraryConfig {
  const url = new URL(value.url.trim())
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Enter the HTTPS project URL, without a path or credentials.')
  }
  const key = value.publishableKey.trim()
  let isPublic = key.startsWith('sb_publishable_')
  if (!isPublic) {
    try { isPublic = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon' }
    catch { /* Not a legacy public key. */ }
  }
  if (!isPublic) throw new Error('Use a publishable key or legacy anon key. Never use a secret/service-role key.')
  if (!UUID_PATTERN.test(value.libraryId)) throw new Error('Enter the library UUID from the setup SQL.')
  return { url: url.origin, publishableKey: key, libraryId: value.libraryId.toLowerCase() }
}

// All network access and authentication stay in Electron main, outside React.
// Sessions are deliberately memory-only: no passwords/tokens in SQLite or backups.
export class SongLibrarySync {
  private config: LibraryConfig | null = null
  private session: Session | null = null
  private busy = false
  private readonly configPath: string

  constructor(private readonly db: PresenterDatabase, private readonly request = fetch) {
    this.configPath = path.join(db.getStorageDirectory(), 'shared-library.json')
    if (fs.existsSync(this.configPath)) {
      try { this.config = validateLibraryConfig(JSON.parse(fs.readFileSync(this.configPath, 'utf8'))) }
      catch { /* Invalid configuration never prevents offline startup. */ }
    }
  }

  public status(): SongSyncStatus {
    return { config: this.config, email: this.session?.user.email ?? null,
      pending: this.db.getPendingSongs().length, busy: this.busy }
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('A library operation is already running. Please wait.')
    this.busy = true
    try { return await action() } finally { this.busy = false }
  }

  public configure(value: LibraryConfig): Promise<void> {
    return this.exclusive(async () => {
      const config = validateLibraryConfig(value)
      this.db.checkSharedLibrary(`${config.url}/${config.libraryId}`)
      const temporaryPath = this.configPath + '.tmp'
      fs.writeFileSync(temporaryPath, JSON.stringify(config), { mode: 0o600 })
      fs.renameSync(temporaryPath, this.configPath)
      this.config = config
      this.session = null
    })
  }

  private async call(route: string, body?: unknown, authenticated = true, retry = true): Promise<unknown> {
    if (!this.config) throw new Error('Configure the shared library first.')
    if (authenticated && !this.session) throw new Error('Sign in before synchronizing.')
    let response: Response
    try {
      response = await this.request(`${this.config.url}${route}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { apikey: this.config.publishableKey, 'Content-Type': 'application/json',
          ...(authenticated ? { Authorization: `Bearer ${this.session!.access_token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000), redirect: 'error'
      })
    } catch {
      throw new Error('Cannot reach the shared library. Your songs remain saved locally. Check the internet and project status, then retry.')
    }
    if (response.status === 401 && authenticated && retry && this.session) {
      try {
        this.session = this.readSession(await this.call('/auth/v1/token?grant_type=refresh_token',
          { refresh_token: this.session.refresh_token }, false))
      } catch {
        this.session = null
        throw new Error('Your session expired. Sign in again; local songs are safe.')
      }
      return this.call(route, body, true, false)
    }
    if (!response.ok) {
      // Do not forward server bodies: they can contain request data or credentials.
      if (response.status === 400 && !authenticated) throw new Error('Sign-in failed. Check your email and password, or confirm the account in Supabase.')
      if (response.status === 401 || response.status === 403) throw new Error('Access denied. Check your account and library membership in Supabase.')
      if (response.status === 404) throw new Error('Shared library not found. Run the setup SQL and check the project URL.')
      throw new Error(`Shared library request failed (${response.status}). Check setup and membership, then retry. Local changes are preserved.`)
    }
    return response.status === 204 ? null : response.json()
  }

  private readSession(value: unknown): Session {
    const session = value as Session | null
    if (!session || typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string' ||
        typeof session.user?.email !== 'string') throw new Error('Invalid sign-in response.')
    return session
  }

  public signIn(email: string, password: string): Promise<void> {
    return this.exclusive(async () => {
      this.session = null
      this.session = this.readSession(await this.call('/auth/v1/token?grant_type=password',
        { email: email.trim(), password }, false))
    })
  }

  public signOut(): Promise<void> {
    return this.exclusive(async () => {
      try { if (this.session) await this.call('/auth/v1/logout', {}) }
      finally { this.session = null }
    })
  }

  private async readSongs(sharedId?: string): Promise<SharedSong[]> {
    if (!this.config) throw new Error('Configure the shared library first.')
    const rows: SharedSong[] = []
    let after = ''
    // Keyset pagination works even if Supabase's response cap is lower than 1000.
    while (true) {
      const query = new URLSearchParams({ select: 'id,revision,mutation_id,deleted,payload',
        library_id: `eq.${this.config.libraryId}`, order: 'id.asc', limit: '500' })
      if (sharedId) query.set('id', `eq.${sharedId}`)
      else if (after) query.set('id', `gt.${after}`)
      const page = await this.call(`/rest/v1/nsc_songs?${query}`)
      if (!Array.isArray(page)) throw new Error('Invalid shared library response.')
      if (!page.length) break
      for (const row of page) { validateSharedSong(row); rows.push(row) }
      if (sharedId) break
      const next = rows[rows.length - 1].id
      if (next <= after) throw new Error('Invalid shared library pagination.')
      after = next
    }
    return rows
  }

  public synchronize(): Promise<SongSyncResult> {
    return this.exclusive(async () => {
      if (!this.config || !this.session) throw new Error('Configure the library and sign in first.')
      const membership = await this.call(`/rest/v1/nsc_libraries?select=id&id=eq.${this.config.libraryId}&limit=1`)
      if (!Array.isArray(membership) || membership.length !== 1 || membership[0].id !== this.config.libraryId) {
        throw new Error('Library access not found. Check the library ID and add your account as a member in Supabase.')
      }
      this.db.bindSharedLibrary(`${this.config.url}/${this.config.libraryId}`)
      const result: SongSyncResult = { uploaded: 0, downloaded: 0, conflicts: [] }
      for (const pending of this.db.getPendingSongs()) {
        validateSongPayload(pending.payload)
        const response = await this.call('/rest/v1/rpc/nsc_push_song', {
          p_library_id: this.config.libraryId, p_id: pending.sharedId, p_revision: pending.revision,
          p_mutation_id: pending.mutationId, p_deleted: pending.deleted, p_payload: pending.payload
        }) as { applied: boolean; song: SharedSong }
        if (!response || typeof response.applied !== 'boolean') throw new Error('Invalid synchronization response.')
        validateSharedSong(response.song)
        if (response.song.id !== pending.sharedId) throw new Error('Unexpected shared song ID.')
        if (response.applied) {
          this.db.acknowledgeSong(pending, response.song.revision)
          result.uploaded++
        } else {
          result.conflicts.push({ sharedId: pending.sharedId, title: pending.payload.titlePrimary,
            revision: response.song.revision,
            localText: JSON.stringify(pending.payload, null, 2),
            sharedText: JSON.stringify(response.song.payload, null, 2),
            localDeleted: pending.deleted, sharedDeleted: response.song.deleted })
        }
      }
      // Validate the complete download before applying any remote records.
      const songs = await this.readSongs()
      for (const remote of songs) if (this.db.applySharedSong(remote)) result.downloaded++
      return result
    })
  }

  public resolve(sharedId: string, choice: 'local' | 'shared', revision: number): Promise<void> {
    return this.exclusive(async () => {
      if (!UUID_PATTERN.test(sharedId) || !['local', 'shared'].includes(choice)) throw new Error('Invalid conflict selection.')
      if (!this.db.getPendingSongs().some((song) => song.sharedId === sharedId)) {
        throw new Error('This song no longer has a pending conflict. Synchronize again.')
      }
      const [remote] = await this.readSongs(sharedId)
      if (!remote) throw new Error('Shared song not found. Check your library membership.')
      if (remote.revision !== revision) throw new Error('The shared song changed again. Synchronize to review its latest version.')
      if (choice === 'local') this.db.keepLocalSong(sharedId, remote.revision)
      else this.db.applySharedSong(remote, true)
    })
  }
}
