import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import electronUpdater from 'electron-updater'
import type { LauncherUpdateState } from '@shared/types'

const { autoUpdater } = electronUpdater

type Listener = (s: LauncherUpdateState) => void

/** Faux tant qu'electron-builder.yml pointe encore sur le dépôt d'exemple OWNER/REPO. */
function isPublishConfigured(): boolean {
  // app-update.yml est généré par electron-builder à partir de la section "publish".
  const config = join(process.resourcesPath, 'app-update.yml')
  if (!existsSync(config)) return false
  return !/^owner:\s*OWNER\s*$/m.test(readFileSync(config, 'utf8'))
}

function firstLine(err: unknown): string {
  return String((err as Error)?.message ?? err).split('\n')[0].slice(0, 200)
}

/** Auto-update du launcher via electron-updater (GitHub Releases, cf. electron-builder.yml). */
export class LauncherUpdater {
  private state: LauncherUpdateState = { state: 'idle' }
  private listeners = new Set<Listener>()

  constructor() {
    if (!app.isPackaged) {
      this.state = { state: 'disabled', reason: 'Mode développement' }
      return
    }
    if (!isPublishConfigured()) {
      this.state = { state: 'disabled', reason: 'dépôt GitHub non configuré dans electron-builder.yml' }
      return
    }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }))
    autoUpdater.on('update-available', (info) => this.set({ state: 'available', version: info.version }))
    autoUpdater.on('update-not-available', () => this.set({ state: 'not-available' }))
    autoUpdater.on('download-progress', (p) => this.set({ state: 'downloading', percent: p.percent }))
    autoUpdater.on('update-downloaded', (info) => this.set({ state: 'downloaded', version: info.version }))
    autoUpdater.on('error', (err) => this.set({ state: 'error', message: firstLine(err) }))
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
      this.set({ state: 'error', message: firstLine(err) })
    }
  }

  install(): void {
    if (this.state.state === 'downloaded') autoUpdater.quitAndInstall(false, true)
  }
}
