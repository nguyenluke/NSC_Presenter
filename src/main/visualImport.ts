import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { MediaAsset, MediaBin } from '../shared/types'
import type { DocumentImportProgress } from '../shared/documents'
import type { PresenterDatabase } from './database'
import type { MediaStorage } from './mediaStorage'
import type { DocumentImporter } from './documentImport'

const documentExtensions = new Set(['.pdf', '.ppt', '.pptx'])
const videoExtensions = new Set(['.mp4', '.webm', '.mov'])
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
export const VISUAL_IMPORT_FILTERS = [
  { name: 'Images, Videos & Sermon Documents', extensions: ['png','jpg','jpeg','webp','gif','mp4','webm','mov','pdf','ppt','pptx'] },
  { name: 'Sermon Documents (PDF / PowerPoint)', extensions: ['pdf','ppt','pptx'] },
  { name: 'Images & Videos', extensions: ['png','jpg','jpeg','webp','gif','mp4','webm','mov'] }
]

export async function importVisualFiles(files: string[], targetBin: MediaBin, db: PresenterDatabase,
  storage: MediaStorage, documents: DocumentImporter, progress: (value: DocumentImportProgress) => void): Promise<MediaAsset[]> {
  if (documents.busy || storage.busy) throw new Error('Wait for the current media operation to finish.')
  for (const source of files) {
    const extension = path.extname(source).toLowerCase()
    if (documentExtensions.has(extension)) {
      await documents.import(source, progress)
      continue
    }
    if (!imageExtensions.has(extension) && !videoExtensions.has(extension)) throw new Error('Choose an image, video, PDF or PowerPoint file.')
    const filename = randomUUID() + extension
    fs.copyFileSync(source, path.join(storage.getImportDirectory(), filename))
    const asset = db.addMediaAsset({ title: path.basename(source, path.extname(source)), bin: targetBin,
      mediaType: videoExtensions.has(extension) ? 'video' : 'image', url: 'nsc-media://asset/' + filename,
      fitMode: targetBin === 'Logos' ? 'contain' : 'cover' })
    if (targetBin === 'Logos') db.setPreferredLogo(asset.id)
  }
  return db.getMediaAssets()
}
