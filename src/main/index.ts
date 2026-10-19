import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { handleAssetProtocol, registerAssetSchemePrivileges } from './assets'
import { registerIpc } from './ipc'
import { Library } from './library'
import { LauncherUpdater } from './updater'
import { getSettings } from './store'

// Dossier de données isolé (tests automatisés, profils multiples).
if (process.env.NOVA_USER_DATA) app.setPath('userData', process.env.NOVA_USER_DATA)

registerAssetSchemePrivileges()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let win: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  const createWindow = (): BrowserWindow => {
    const w = new BrowserWindow({
      width: 1280,
      height: 780,
      minWidth: 980,
      minHeight: 620,
      frame: false,
      show: false,
      backgroundColor: '#0b0d12',
      title: app.getName(),
      icon: join(__dirname, '../../resources/icon.png'),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    w.once('ready-to-show', () => {
      if (process.argv.includes('--hidden')) w.minimize()
      w.show()
    })

    // Liens externes → navigateur par défaut ; aucune navigation interne autorisée.
    w.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    w.webContents.on('will-navigate', (e, url) => {
      if (url !== w.webContents.getURL()) e.preventDefault()
    })

    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
      void w.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      void w.loadFile(join(__dirname, '../renderer/index.html'))
    }
    return w
  }

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.nova.launcher')
    handleAssetProtocol()

    const library = new Library()
    const updater = new LauncherUpdater()
    await library.init()

    win = createWindow()
    registerIpc(win, library, updater)
    void library.refresh()

    if (getSettings().autoCheckUpdates) setTimeout(() => void updater.check(), 3000)

    let quitting = false
    win.on('close', (e) => {
      if (quitting || !library.hasActiveWork()) return
      // Fermer pendant une installation : on annule proprement plutôt que de laisser des fichiers partiels.
      e.preventDefault()
      const choice = dialog.showMessageBoxSync(win!, {
        type: 'warning',
        buttons: ['Annuler et quitter', 'Continuer'],
        defaultId: 1,
        cancelId: 1,
        title: app.getName(),
        message: 'Une installation est en cours.',
        detail: "Quitter maintenant annulera l'installation. Votre version actuelle du jeu reste intacte."
      })
      if (choice !== 0) return
      quitting = true
      library.cancelAll()
      const wait = setInterval(() => {
        if (!library.hasActiveWork()) {
          clearInterval(wait)
          win?.close()
        }
      }, 100)
    })
  })

  app.on('window-all-closed', () => app.quit())
}
