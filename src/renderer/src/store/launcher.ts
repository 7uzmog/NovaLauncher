import { create } from 'zustand'
import type { AppInfo, LauncherUpdateState, LibrarySnapshot, Settings } from '@shared/types'

export type View = { name: 'library' } | { name: 'game'; id: string } | { name: 'settings' }

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  title: string
  message?: string
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

interface LauncherState {
  ready: boolean
  snapshot: LibrarySnapshot
  settings: Settings | null
  appInfo: AppInfo | null
  updater: LauncherUpdateState
  view: View
  /** Jeu dont la bannière floutée est en arrière-plan. */
  backdropId: string | null
  toasts: Toast[]
  confirm: ConfirmRequest | null

  init(): Promise<void>
  navigate(view: View): void
  setBackdrop(id: string | null): void
  toast(t: Omit<Toast, 'id'>): void
  dismissToast(id: number): void
  ask(req: Omit<ConfirmRequest, 'resolve'>): Promise<boolean>
  closeConfirm(ok: boolean): void

  refresh(): Promise<void>
  install(id: string): Promise<void>
  cancel(id: string): Promise<void>
  launch(id: string): Promise<void>
  uninstall(id: string): Promise<void>
  saveSettings(patch: Partial<Settings>): Promise<void>
}

const EMPTY: LibrarySnapshot = { games: [], installed: {}, running: [], installing: {}, updates: [] }
let toastSeq = 0

export const useLauncher = create<LauncherState>((set, get) => ({
  ready: false,
  snapshot: EMPTY,
  settings: null,
  appInfo: null,
  updater: { state: 'idle' },
  view: { name: 'library' },
  backdropId: null,
  toasts: [],
  confirm: null,

  async init() {
    const api = window.api
    api.library.onChange((snapshot) => set({ snapshot, ready: get().ready || snapshot.games.length > 0 }))
    api.games.onProgress((p) =>
      set((s) =>
        // Ignore un événement tardif arrivé après la fin du job.
        s.snapshot.installing[p.gameId]
          ? { snapshot: { ...s.snapshot, installing: { ...s.snapshot.installing, [p.gameId]: p } } }
          : {}
      )
    )
    api.updater.onState((updater) => set({ updater }))
    const [snapshot, settings, appInfo, updater] = await Promise.all([
      api.library.get(),
      api.settings.get(),
      api.app.info(),
      api.updater.getState()
    ])
    set({ snapshot, settings, appInfo, updater })
    if (!snapshot.fetchedAt) await get().refresh()
    set({ ready: true })
  },

  navigate(view) {
    set({ view })
    if (view.name === 'game') set({ backdropId: view.id })
  },

  setBackdrop(backdropId) {
    set({ backdropId })
  },

  toast(t) {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => get().dismissToast(id), t.kind === 'error' ? 7000 : 4000)
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  ask(req) {
    return new Promise((resolve) => set({ confirm: { ...req, resolve } }))
  },

  closeConfirm(ok) {
    get().confirm?.resolve(ok)
    set({ confirm: null })
  },

  async refresh() {
    const snapshot = await window.api.library.refresh()
    set({ snapshot })
    if (snapshot.manifestError) {
      get().toast({ kind: 'error', title: 'Manifeste injoignable', message: snapshot.manifestError })
    }
  },

  async install(id) {
    const game = get().snapshot.games.find((g) => g.id === id)
    const isUpdate = !!get().snapshot.installed[id]
    const res = await window.api.games.install(id)
    if (res.ok) {
      get().toast({
        kind: 'success',
        title: isUpdate ? 'Mise à jour terminée' : 'Installation terminée',
        message: `${game?.name ?? id} ${game?.version ?? ''} est prêt.`
      })
    } else if (res.cancelled) {
      get().toast({ kind: 'info', title: 'Installation annulée', message: game?.name })
    } else {
      get().toast({ kind: 'error', title: `Échec : ${game?.name ?? id}`, message: res.error })
    }
  },

  async cancel(id) {
    await window.api.games.cancel(id)
  },

  async launch(id) {
    const res = await window.api.games.launch(id)
    if (!res.ok) get().toast({ kind: 'error', title: 'Lancement impossible', message: res.error })
  },

  async uninstall(id) {
    const game = get().snapshot.games.find((g) => g.id === id)
    const name = game?.name ?? id
    const ok = await get().ask({
      title: `Désinstaller ${name} ?`,
      message: 'Tous les fichiers du jeu seront supprimés de votre disque. Vos sauvegardes hors du dossier du jeu sont conservées.',
      confirmLabel: 'Désinstaller',
      danger: true
    })
    if (!ok) return
    const res = await window.api.games.uninstall(id)
    if (res.ok) get().toast({ kind: 'success', title: `${name} a été désinstallé` })
    else get().toast({ kind: 'error', title: 'Désinstallation impossible', message: res.error })
  },

  async saveSettings(patch) {
    const settings = await window.api.settings.set(patch)
    set({ settings })
  }
}))
