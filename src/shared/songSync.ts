import type { SongInput } from './types'

export interface LibraryConfig {
  url: string
  publishableKey: string
  libraryId: string
}

export interface SharedSong {
  id: string
  revision: number
  mutation_id: string
  deleted: boolean
  payload: SongInput
}

export interface PendingSong {
  sharedId: string
  revision: number
  mutationId: string
  deleted: boolean
  payload: SongInput
}

export interface SongSyncConflict {
  sharedId: string
  title: string
  revision: number
  localText: string
  sharedText: string
  localDeleted: boolean
  sharedDeleted: boolean
}

export interface SongSyncStatus {
  config: LibraryConfig | null
  email: string | null
  pending: number
  busy: boolean
}

export interface SongSyncResult {
  uploaded: number
  downloaded: number
  conflicts: SongSyncConflict[]
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateSongPayload(value: unknown): asserts value is SongInput {
  const song = value as SongInput | null
  if (!song || typeof song !== 'object' ||
      !['titlePrimary', 'titleSecondary', 'author', 'musicalKey'].every(
        (key) => typeof (song as unknown as Record<string, unknown>)[key] === 'string') ||
      !Number.isFinite(song.bpm) || !Array.isArray(song.sections) ||
      !Array.isArray(song.arrangement) || !song.arrangement.every((id) => typeof id === 'string')) {
    throw new Error('The library contains an invalid song.')
  }
  const types = ['Intro', 'Verse', 'PreChorus', 'Chorus', 'Bridge', 'Tag', 'Outro']
  const sectionIds = new Set<string>()
  for (const section of song.sections) {
    if (!section || typeof section.id !== 'string' || sectionIds.has(section.id) ||
        typeof section.label !== 'string' || !types.includes(section.type) || !Array.isArray(section.slides)) {
      throw new Error('The library contains an invalid song section.')
    }
    sectionIds.add(section.id)
    for (const slide of section.slides) {
      if (!slide || typeof slide.id !== 'string' || typeof slide.primaryText !== 'string' ||
          typeof slide.secondaryText !== 'string' ||
          (slide.chords !== undefined && typeof slide.chords !== 'string')) {
        throw new Error('The library contains an invalid bilingual slide.')
      }
    }
  }
  if (song.arrangement.some((id) => !sectionIds.has(id))) {
    throw new Error('The song arrangement references a missing section.')
  }
}

export function validateSharedSong(value: unknown): asserts value is SharedSong {
  const row = value as SharedSong | null
  if (!row || !UUID_PATTERN.test(row.id) || !UUID_PATTERN.test(row.mutation_id) ||
      !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.deleted !== 'boolean') {
    throw new Error('The shared library returned an invalid song revision.')
  }
  validateSongPayload(row.payload)
}
