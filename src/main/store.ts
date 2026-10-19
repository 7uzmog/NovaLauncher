import Store from 'electron-store'
import type { InstalledGame, Settings } from '@shared/types'
import { defaultInstallDir, defaultManifestUrl } from './paths'

interface Schema {
  settings: Settings
  installed: Record<string, InstalledGame>
}

let store: Store<Schema> | null = null

function db(): Store<Schema> {
  if (!store) {
    store = new Store<Schema>({
      name: 'launcher',
      defaults: {
        settings: {
          manifestUrl: defaultManifestUrl(),
          installDir: defaultInstallDir(),
          launchAtStartup: false,
          autoCheckUpdates: true,
          closeOnLaunch: false,
          githubToken: ''
        },
        installed: {}
      }
    })
  }
  return store
}

export function getSettings(): Settings {
  const s = db().get('settings')
  return {
    ...s,
    manifestUrl: s.manifestUrl || defaultManifestUrl(),
    installDir: s.installDir || defaultInstallDir()
  }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  db().set('settings', next)
  return next
}

export function getInstalled(): Record<string, InstalledGame> {
  return db().get('installed')
}

export function setInstalled(game: InstalledGame): void {
  db().set(`installed.${game.id}`, game)
}

export function patchInstalled(id: string, patch: Partial<InstalledGame>): void {
  const cur = getInstalled()[id]
  if (cur) db().set(`installed.${id}`, { ...cur, ...patch })
}

export function removeInstalled(id: string): void {
  const all = { ...getInstalled() }
  delete all[id]
  db().set('installed', all)
}
