import path from 'path'
import { BrowserWindow, screen } from 'electron'
import { DisplayInfo, LivePresentationState, OutputProfile } from '@shared/types'
import { getAppIconPath } from './appIcon'

/**
 * Dynamic Real-Life Multi-Screen Router (ProPresenter "Configure Screens" Engine):
 * - Automatically detects ANY number of HDMI / DisplayPort / USB-C monitors plugged into the PC.
 * - Supports hot-plugging cables live without restarting the app!
 * - Supports 1, 2, 3, 4, or 8+ user-created Audience and Stage screens.
 * - Includes an Emergency Escape shortcut (`Esc` inside an output window) so an operator
 *   can NEVER lock themselves out if they accidentally put Fullscreen on their primary monitor!
 */
export class DisplayRouter {
  private outputWindows = new Map<string, BrowserWindow>()
  private identifyWindows: BrowserWindow[] = []
  private preloadPath: string
  private onDisplaysChanged?: (displays: DisplayInfo[]) => void
  private onEmergencyDisableProfile?: (profileId: string) => void

  constructor(
    preloadPath: string,
    onDisplaysChanged?: (displays: DisplayInfo[]) => void,
    onEmergencyDisableProfile?: (profileId: string) => void
  ) {
    this.preloadPath = preloadPath
    this.onDisplaysChanged = onDisplaysChanged
    this.onEmergencyDisableProfile = onEmergencyDisableProfile
  }

  public attachHotplugListeners(): void {
    const notify = (): void => {
      if (this.onDisplaysChanged) {
        this.onDisplaysChanged(this.getDisplays())
      }
    }
    screen.on('display-added', notify)
    screen.on('display-removed', notify)
    screen.on('display-metrics-changed', notify)
  }

  public getDisplays(): DisplayInfo[] {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((d, idx) => ({
      id: d.id,
      index: idx + 1,
      label: d.label || (d.id === primaryId ? 'Built-in / Main Desk Display' : `External Screen ${idx + 1}`),
      width: d.bounds.width,
      height: d.bounds.height,
      x: d.bounds.x,
      y: d.bounds.y,
      isPrimary: d.id === primaryId
    }))
  }

  private loadWindowRoute(win: BrowserWindow, hashRoute: string): void {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) {
      win.loadURL(`${devUrl}#${hashRoute}`)
    } else {
      win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: hashRoute })
    }
  }

  public syncOutputWindows(
    profiles: OutputProfile[],
    liveState: LivePresentationState,
    operatorWindow: BrowserWindow | null
  ): void {
    const allDisplays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const activeIds = new Set(profiles.map((p) => p.id))

    // Close windows for deleted profiles
    for (const [winId, win] of this.outputWindows) {
      if (!activeIds.has(winId)) {
        if (!win.isDestroyed()) win.close()
        this.outputWindows.delete(winId)
      }
    }

    profiles.forEach((profile, index) => {
      const existing = this.outputWindows.get(profile.id)

      if (!profile.enabled) {
        if (existing && !existing.isDestroyed()) {
          existing.close()
        }
        this.outputWindows.delete(profile.id)
        return
      }

      const matchedDisplay = allDisplays.find((d) => d.id === profile.assignedDisplayId)
      const fallbackExternal = allDisplays.find((d) => d.id !== primaryDisplay.id)
      const targetDisplay = matchedDisplay || fallbackExternal || primaryDisplay

      // Safety fallback: if user chose Fullscreen on their ONLY screen without explicitly picking the primary screen ID,
      // open as a Virtual Window so we don't cover their operator screen unexpectedly!
      const shouldGoFullscreen =
        profile.windowMode === 'fullscreen' &&
        (targetDisplay.id !== primaryDisplay.id || profile.assignedDisplayId === primaryDisplay.id)

      if (!existing || existing.isDestroyed()) {
        const offset = 45 + index * 40
        const win = new BrowserWindow({
          icon: getAppIconPath(),
          title: `NSC Output — ${profile.name} (Press ESC to exit fullscreen)`,
          x: shouldGoFullscreen ? targetDisplay.bounds.x : targetDisplay.bounds.x + offset,
          y: shouldGoFullscreen ? targetDisplay.bounds.y : targetDisplay.bounds.y + offset,
          width: shouldGoFullscreen ? targetDisplay.bounds.width : 640,
          height: shouldGoFullscreen ? targetDisplay.bounds.height : 360,
          frame: !shouldGoFullscreen,
          fullscreen: shouldGoFullscreen,
          alwaysOnTop: shouldGoFullscreen,
          autoHideMenuBar: true,
          backgroundColor: '#000000',
          webPreferences: {
            preload: this.preloadPath,
            contextIsolation: true,
            nodeIntegration: false
          }
        })

        this.loadWindowRoute(win, `output?profileId=${encodeURIComponent(profile.id)}`)

        // Real-life emergency escape: if an output window ever covers your desk monitor, press ESC to close it!
        win.webContents.on('before-input-event', (_event, input) => {
          if (input.type === 'keyDown' && input.key === 'Escape') {
            win.close()
            if (this.onEmergencyDisableProfile) {
              this.onEmergencyDisableProfile(profile.id)
            }
          }
        })

        win.webContents.on('did-finish-load', () => {
          if (!win.isDestroyed()) {
            win.webContents.send('nsc:state-sync', { liveState, outputProfiles: profiles })
          }
        })

        win.on('closed', () => {
          this.outputWindows.delete(profile.id)
        })

        this.outputWindows.set(profile.id, win)
      } else {
        if (shouldGoFullscreen) {
          existing.setFullScreen(false)
          existing.setBounds(targetDisplay.bounds)
          existing.setFullScreen(true)
          existing.setAlwaysOnTop(true, 'screen-saver')
        } else {
          if (existing.isFullScreen()) existing.setFullScreen(false)
          existing.setAlwaysOnTop(false)
        }
      }
    })

    if (operatorWindow && !operatorWindow.isDestroyed()) {
      operatorWindow.focus()
    }

    this.broadcast(liveState, profiles, operatorWindow)
  }

  public broadcast(
    liveState: LivePresentationState,
    outputProfiles: OutputProfile[],
    operatorWindow: BrowserWindow | null
  ): void {
    const payload = { liveState, outputProfiles }
    if (operatorWindow && !operatorWindow.isDestroyed()) {
      operatorWindow.webContents.send('nsc:state-sync', payload)
    }
    for (const [, win] of this.outputWindows) {
      if (!win.isDestroyed()) {
        win.webContents.send('nsc:state-sync', payload)
      }
    }
  }

  public identifyAllDisplays(): void {
    this.clearIdentifyWindows()
    const displays = this.getDisplays()

    for (const d of displays) {
      const badgeWidth = 540
      const badgeHeight = 250
      const win = new BrowserWindow({
        x: Math.round(d.x + (d.width - badgeWidth) / 2),
        y: Math.round(d.y + (d.height - badgeHeight) / 2),
        width: badgeWidth,
        height: badgeHeight,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        focusable: false,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
          preload: this.preloadPath,
          contextIsolation: true,
          nodeIntegration: false
        }
      })
      const labelParam = encodeURIComponent(`${d.label} • ${d.width}×${d.height}`)
      this.loadWindowRoute(win, `identify?num=${d.index}&label=${labelParam}`)
      this.identifyWindows.push(win)
    }

    setTimeout(() => {
      this.clearIdentifyWindows()
    }, 4000)
  }

  public clearIdentifyWindows(): void {
    for (const w of this.identifyWindows) {
      if (!w.isDestroyed()) w.close()
    }
    this.identifyWindows = []
  }

  public closeAllOutputs(): void {
    this.clearIdentifyWindows()
    for (const [, w] of this.outputWindows) {
      if (!w.isDestroyed()) w.close()
    }
    this.outputWindows.clear()
  }
}
