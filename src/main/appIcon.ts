import path from 'path'
import { app } from 'electron'

export function getAppIconPath(): string {
  const file = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  return app.isPackaged
    ? path.join(process.resourcesPath, file)
    : path.join(app.getAppPath(), 'build', file)
}
