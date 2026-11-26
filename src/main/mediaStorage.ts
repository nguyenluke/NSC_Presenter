import fs from 'fs'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { MediaStorageStatus } from '../shared/types'

export function mediaFileName(url: string): string | null {
  if (!url.startsWith('nsc-media://asset/')) return null
  const parsed = new URL(url)
  const name = decodeURIComponent(parsed.pathname.slice(1))
  if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) {
    throw new Error('Invalid media file reference.')
  }
  return name
}

async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

export class MediaStorage {
  private directory: string
  private configFile: string
  busy = false

  constructor(private dataDirectory: string) {
    this.configFile = path.join(dataDirectory, 'media-location.json')
    this.directory = path.join(dataDirectory, 'media')
    if (fs.existsSync(this.configFile)) {
      const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'))
      if (typeof config.directory !== 'string' || !path.isAbsolute(config.directory)) {
        throw new Error('Invalid media folder setting in media-location.json.')
      }
      this.directory = config.directory
    } else {
      fs.mkdirSync(this.directory, { recursive: true })
    }
  }

  getStatus(): MediaStorageStatus {
    let available = false
    try { available = fs.statSync(this.directory).isDirectory() } catch { /* disconnected drive */ }
    return { directory: this.directory, available }
  }

  getDirectory(): string { return this.directory }

  getImportDirectory(): string {
    if (this.busy) throw new Error('Wait for the media folder copy to finish before importing files.')
    if (!this.getStatus().available) {
      throw new Error('Your media folder is unavailable. Reconnect its drive or choose a folder in Media Folder.')
    }
    return this.directory
  }

  async changeDirectory(destination: string, fileNames: string[]): Promise<MediaStorageStatus & { copied: number }> {
    if (this.busy) throw new Error('A media folder copy is already in progress.')
    if (!path.isAbsolute(destination)) throw new Error('Choose an absolute media folder path.')
    this.busy = true
    const previous = this.directory
    const tempConfig = `${this.configFile}.${randomUUID()}.tmp`
    try {
      const target = await fs.promises.realpath(destination)
      if (!(await fs.promises.stat(target)).isDirectory()) throw new Error('Choose a folder for your media.')
      await fs.promises.access(target, fs.constants.W_OK)
      const originalPath = await fs.promises.realpath(previous).catch(() => '')
      const comparable = (value: string): string => process.platform === 'win32' ? value.toLowerCase() : value
      if (comparable(target) === comparable(originalPath)) return { ...this.getStatus(), copied: 0 }
      const copies: Array<{ source: string; destination: string }> = []
      for (const name of new Set(fileNames)) {
        if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name) || path.basename(name) !== name) {
          throw new Error('Invalid media file name.')
        }
        const source = path.join(previous, name)
        const dest = path.join(target, name)
        const [sourceStat, destStat] = await Promise.all([
          fs.promises.stat(source).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return null
            throw error
          }),
          fs.promises.stat(dest).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return null
            throw error
          })
        ])
        if (destStat) {
          if (!destStat.isFile() || (sourceStat && (!sourceStat.isFile() || sourceStat.size !== destStat.size ||
              await hashFile(source) !== await hashFile(dest)))) {
            throw new Error(`A different file named "${name}" already exists in that folder. Choose another folder; no files were overwritten.`)
          }
        } else if (sourceStat?.isFile()) {
          copies.push({ source, destination: dest })
        } else {
          throw new Error(`Missing media: "${name}". Reconnect the original drive or choose a folder already containing your media.`)
        }
      }
      for (const copy of copies) {
        await fs.promises.copyFile(copy.source, copy.destination, fs.constants.COPYFILE_EXCL)
      }
      // Switch the setting only after all files have copied successfully.
      await fs.promises.mkdir(this.dataDirectory, { recursive: true })
      await fs.promises.writeFile(tempConfig, JSON.stringify({ directory: target }, null, 2), { flag: 'wx' })
      await fs.promises.rename(tempConfig, this.configFile)
      this.directory = target
      return { ...this.getStatus(), copied: copies.length }
    } catch (error) {
      // Partial copies can be reused on retry; the original folder remains active.
      throw new Error(`Media folder unchanged. ${error instanceof Error ? error.message : 'Could not copy media.'}`)
    } finally {
      await fs.promises.unlink(tempConfig).catch(() => {})
      this.busy = false
    }
  }
}
