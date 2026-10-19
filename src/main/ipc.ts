import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/api'
import type { Settings } from '@shared/types'
import type { Library } from './library'
import type { LauncherUpdater } from './updater'
import { defaultInstallDir } from './paths'
import { getSettings, setSettings } from './store'

function applyLoginItem(enabled: boolean): void {
  if (!app.isPackaged) return // en dev, on n'enregistre pas electron.exe au démarrage de Windows
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

export function registerIpc(win: BrowserWindow, library: Library, updater: LauncherUpdater): void {
  const send = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  ipcMain.handle(IPC.appInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    defaultInstallDir: defaultInstallDir()
  }))
  ipcMain.handle(IPC.openExternal, (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url)
  })

  ipcMain.on(IPC.winMinimize, () => win.minimize())
  ipcMain.on(IPC.winToggleMax, () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  ipcMain.on(IPC.winClose, () => win.close())
  ipcMain.handle(IPC.winIsMax, () => win.isMaximized())
  win.on('maximize', () => send(IPC.winMaxChanged, true))
  win.on('unmaximize', () => send(IPC.winMaxChanged, false))

  ipcMain.handle(IPC.libraryGet, () => library.snapshot())
  ipcMain.handle(IPC.libraryRefresh, () => library.refresh())
  library.onChange((s) => send(IPC.libraryChanged, s))
  library.onProgress((p) => send(IPC.gameProgress, p))

  ipcMain.handle(IPC.gameInstall, (_e, id: string) => library.install(id))
  ipcMain.handle(IPC.gameCancel, (_e, id: string) => library.cancel(id))
  ipcMain.handle(IPC.gameLaunch, async (_e, id: string) => {
    const res = await library.launch(id)
    if (res.ok && !getSettings().closeOnLaunch) win.minimize()
    return res
  })
  ipcMain.handle(IPC.gameUninstall, (_e, id: string) => library.uninstall(id))
  ipcMain.handle(IPC.gameOpenFolder, (_e, id: string) => library.openFolder(id))

  ipcMain.handle(IPC.settingsGet, () => getSettings())
  ipcMain.handle(IPC.settingsSet, async (_e, patch: Partial<Settings>) => {
    const before = getSettings()
    const next = setSettings(patch)
    if (patch.launchAtStartup !== undefined) applyLoginItem(next.launchAtStartup)
    if (patch.autoCheckUpdates !== undefined) library.scheduleChecks()
    const sourceChanged =
      (patch.manifestUrl !== undefined && patch.manifestUrl !== before.manifestUrl) ||
      (patch.githubToken !== undefined && patch.githubToken !== before.githubToken)
    if (sourceChanged) void library.refresh()
    return next
  })
  ipcMain.handle(IPC.settingsPickDir, async () => {
    const res = await dialog.showOpenDialog(win, {
      title: "Dossier d'installation des jeux",
      defaultPath: getSettings().installDir,
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle(IPC.settingsPickManifest, async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Choisir un manifeste games.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    return res.canceled ? null : res.filePaths[0]
  })

  ipcMain.handle(IPC.updaterCheck, () => updater.check())
  ipcMain.on(IPC.updaterInstall, () => updater.install())
  ipcMain.handle(IPC.updaterGetState, () => updater.getState())
  updater.onState((s) => send(IPC.updaterState, s))
}
