import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { LauncherUpdateState } from '@shared/types'

const { autoUpdater } = electronUpdater

type Listener = (s: LauncherUpdateState) => void

/** Auto-update du launcher via electron-updater (GitHub Releases, cf. electron-builder.yml). */
export class LauncherUpdater {
  private state: LauncherUpdateState = { state: 'idle' }
  private listeners = new Set<Listener>()

  constructor() {
    if (!app.isPackaged) {
      this.state = { state: 'disabled', reason: 'Mode développement' }
      return
    }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }))
    autoUpdater.on('update-available', (info) => this.set({ state: 'available', version: info.version }))
    autoUpdater.on('update-not-available', () => this.set({ state: 'not-available' }))
    autoUpdater.on('download-progress', (p) => this.set({ state: 'downloading', percent: p.percent }))
    autoUpdater.on('update-downloaded', (info) => this.set({ state: 'downloaded', version: info.version }))
    autoUpdater.on('error', (err) => this.set({ state: 'error', message: err?.message ?? String(err) }))
  }

  onState(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  getState(): LauncherUpdateState {
    return this.state
  }

  private set(s: LauncherUpdateState): void {
    this.state = s
    for (const l of this.listeners) l(s)
  }

  async check(): Promise<void> {
    if (this.state.state === 'disabled') return
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.set({ state: 'error', message: (err as Error).message })
    }
  }

  install(): void {
    if (this.state.state === 'downloaded') autoUpdater.quitAndInstall(false, true)
  }
}
