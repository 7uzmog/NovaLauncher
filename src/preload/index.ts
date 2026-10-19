import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type LauncherApi } from '@shared/api'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: LauncherApi = {
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url)
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.winMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.winToggleMax),
    close: () => ipcRenderer.send(IPC.winClose),
    isMaximized: () => ipcRenderer.invoke(IPC.winIsMax),
    onMaximizedChange: (cb) => subscribe(IPC.winMaxChanged, cb)
  },
  library: {
    get: () => ipcRenderer.invoke(IPC.libraryGet),
    refresh: () => ipcRenderer.invoke(IPC.libraryRefresh),
    onChange: (cb) => subscribe(IPC.libraryChanged, cb)
  },
  games: {
    install: (id) => ipcRenderer.invoke(IPC.gameInstall, id),
    cancel: (id) => ipcRenderer.invoke(IPC.gameCancel, id),
    launch: (id) => ipcRenderer.invoke(IPC.gameLaunch, id),
    uninstall: (id) => ipcRenderer.invoke(IPC.gameUninstall, id),
    openFolder: (id) => ipcRenderer.invoke(IPC.gameOpenFolder, id),
    onProgress: (cb) => subscribe(IPC.gameProgress, cb)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
    pickDirectory: () => ipcRenderer.invoke(IPC.settingsPickDir),
    pickManifestFile: () => ipcRenderer.invoke(IPC.settingsPickManifest)
  },
  updater: {
    check: () => ipcRenderer.invoke(IPC.updaterCheck),
    install: () => ipcRenderer.send(IPC.updaterInstall),
    getState: () => ipcRenderer.invoke(IPC.updaterGetState),
    onState: (cb) => subscribe(IPC.updaterState, cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
