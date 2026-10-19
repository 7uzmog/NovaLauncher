import type {
  AppInfo,
  InstallProgress,
  InstallResult,
  LauncherUpdateState,
  LibrarySnapshot,
  Settings
} from './types'

/** API exposée au renderer par le preload (window.api). */
export interface LauncherApi {
  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(cb: (maximized: boolean) => void): () => void
  }
  library: {
    get(): Promise<LibrarySnapshot>
    refresh(): Promise<LibrarySnapshot>
    onChange(cb: (snapshot: LibrarySnapshot) => void): () => void
  }
  games: {
    install(id: string): Promise<InstallResult>
    cancel(id: string): Promise<void>
    launch(id: string): Promise<{ ok: boolean; error?: string }>
    uninstall(id: string): Promise<{ ok: boolean; error?: string }>
    openFolder(id: string): Promise<void>
    onProgress(cb: (p: InstallProgress) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
    pickDirectory(): Promise<string | null>
    pickManifestFile(): Promise<string | null>
  }
  updater: {
    check(): Promise<void>
    install(): void
    getState(): Promise<LauncherUpdateState>
    onState(cb: (s: LauncherUpdateState) => void): () => void
  }
}

export const IPC = {
  appInfo: 'app:info',
  openExternal: 'app:open-external',
  winMinimize: 'win:minimize',
  winToggleMax: 'win:toggle-max',
  winClose: 'win:close',
  winIsMax: 'win:is-max',
  winMaxChanged: 'win:max-changed',
  libraryGet: 'library:get',
  libraryRefresh: 'library:refresh',
  libraryChanged: 'library:changed',
  gameInstall: 'game:install',
  gameCancel: 'game:cancel',
  gameLaunch: 'game:launch',
  gameUninstall: 'game:uninstall',
  gameOpenFolder: 'game:open-folder',
  gameProgress: 'game:progress',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsPickDir: 'settings:pick-dir',
  settingsPickManifest: 'settings:pick-manifest',
  updaterCheck: 'updater:check',
  updaterInstall: 'updater:install',
  updaterGetState: 'updater:get-state',
  updaterState: 'updater:state'
} as const
