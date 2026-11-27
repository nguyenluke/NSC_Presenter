import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { PresenterDatabase } from './database'
import { MediaStorage } from './mediaStorage'
import { MediaAsset } from '../shared/types'
import { DocumentImportProgress } from '../shared/documents'
import { presentationToPdf } from './presentationConversion'

export class DocumentImporter {
  busy = false
  private cancelled = false
  cancel(): void { this.cancelled = true }

  constructor(private db: PresenterDatabase, private storage: MediaStorage,
    private rendererFile = path.join(__dirname, '../renderer/index.html')) {}

  private async evaluate<T>(renderer: BrowserWindow, expression: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined
    try {
      const result = await Promise.race([
        renderer.webContents.executeJavaScript(`(async()=>{try{return {value:await (${expression})}}catch(error){return {error:error.message}}})()`),
        new Promise<never>((_resolve,reject) => { timer = setTimeout(() => reject(new Error('Document rendering timed out. Try exporting this file to a new PDF.')), 45000) })
      ])
      if (result.error) throw new Error(`Could not render document: ${result.error}`)
      return result.value as T
    } finally { if (timer) clearTimeout(timer) }
  }

  async import(source: string, progress: (value: DocumentImportProgress) => void) {
    if (this.busy) throw new Error('A sermon document is already being imported.')
    this.busy = true
    this.cancelled = false
    let scratch = ''
    let renderer: BrowserWindow | null = null
    const createdFiles: string[] = []
    let committed = false
    const checkCancelled = (): void => { if (this.cancelled) throw new Error('Document import cancelled. Your library was not changed.') }
    try {
      const mediaDirectory = this.storage.getImportDirectory()
      const extension = path.extname(source).toLowerCase()
      if (!['.pdf','.ppt','.pptx'].includes(extension)) throw new Error('Choose a PDF, PPT or PPTX file.')
      const stat = await fs.promises.stat(source)
      if (!stat.isFile() || stat.size > 100 * 1024 * 1024) throw new Error('Choose a document no larger than 100 MB.')
      scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nsc-document-'))
      progress({ phase: extension === '.pdf' ? 'Opening PDF' : 'Converting PowerPoint to PDF', completed: 0, total: 0 })
      const pdf = extension === '.pdf' ? source : await presentationToPdf(source, scratch)
      checkCancelled()
      const pdfStat = await fs.promises.stat(pdf)
      if (pdfStat.size > 100 * 1024 * 1024) throw new Error('The converted PDF exceeds 100 MB. Split it into smaller documents.')
      renderer = new BrowserWindow({ show: false, width: 1920, height: 1080,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })
      const devUrl = process.env.ELECTRON_RENDERER_URL
      if (devUrl) await renderer.loadURL(`${devUrl}#pdf-render`)
      else await renderer.loadFile(this.rendererFile, { hash: 'pdf-render' })
      await renderer.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const until=Date.now()+15000;const check=()=>window.nscPdfRenderer?resolve(true):Date.now()>until?reject(Error('Document renderer could not start.')):setTimeout(check,25);check()})`)
      const base64 = (await fs.promises.readFile(pdf)).toString('base64')
      const count = await this.evaluate<number>(renderer, `window.nscPdfRenderer.open(${JSON.stringify(base64)})`)
      if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Import documents with 1–200 pages. Split larger files before importing.')
      const documentId = randomUUID()
      const title = path.basename(source, path.extname(source))
      const pages: Omit<MediaAsset, 'id'>[] = []
      for (let page = 1; page <= count; page++) {
        checkCancelled()
        progress({ phase: 'Rendering pages', completed: page - 1, total: count })
        const encoded = await this.evaluate<string>(renderer, `window.nscPdfRenderer.page(${page})`)
        if (typeof encoded !== 'string' || encoded.length > 20 * 1024 * 1024) throw new Error('A document page could not be rendered.')
        const filename = `sermon_${documentId}_${String(page).padStart(4,'0')}.png`
        const file = path.join(mediaDirectory, filename)
        await fs.promises.writeFile(file, Buffer.from(encoded, 'base64'), { flag: 'wx' })
        createdFiles.push(file)
        pages.push({ title: `${title} — ${page}/${count}`, bin: 'Sermon & Events', mediaType: 'image',
          url: `nsc-media://asset/${filename}`, fitMode: 'contain', documentId, documentTitle: title, documentPage: page, documentPages: count })
      }
      checkCancelled()
      const mediaAssets = this.db.addDocumentPages(pages)
      committed = true
      progress({ phase: 'Imported', completed: count, total: count })
      return { mediaAssets, documentId }
    } finally {
      if (renderer && !renderer.isDestroyed()) renderer.destroy()
      if (!committed) for (const file of createdFiles) await fs.promises.unlink(file).catch(() => {})
      this.busy = false
      if (scratch) {
        const parent = await fs.promises.realpath(path.dirname(scratch))
        const tempRoot = await fs.promises.realpath(os.tmpdir())
        if (parent.toLowerCase() === tempRoot.toLowerCase() && path.basename(scratch).startsWith('nsc-document-')) {
          await fs.promises.rm(scratch, { recursive: true, force: true }).catch(() => {})
        }
      }
    }
  }
}
