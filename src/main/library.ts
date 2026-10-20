import { app, shell } from 'electron'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { Game, InstallProgress, InstallResult, LibrarySnapshot } from '@shared/types'
import { BRANDING } from '@shared/branding'
import { CancelledError, cleanupWorkDirs, installGame, removeDir } from './installer'
import { isNewer, loadManifest } from './manifest'
import { GameRunner } from './runner'
import { getInstalled, getSettings, patchInstalled, removeInstalled, setInstalled } from './store'

type Listener = (snapshot: LibrarySnapshot) => void
type ProgressListener = (p: InstallProgress) => void

interface Job {
  controller: AbortController
  progress: InstallProgress
  /** Pour le calcul de vitesse (moyenne glissante). */
  samples: { t: number; bytes: number }[]
  lastEmit: number
}

/** Point central : manifeste, installations, jeux lancés. Notifie le renderer à chaque changement. */
export class Library {
  private games: Game[] = []
  private manifestError?: string
  private fetchedAt?: string
  private jobs = new Map<string, Job>()
  private listeners = new Set<Listener>()
  private progressListeners = new Set<ProgressListener>()
  private refreshing: Promise<LibrarySnapshot> | null = null
  private timer: NodeJS.Timeout | null = null
  readonly runner = new GameRunner((id, seconds) => {
    const cur = getInstalled()[id]
    if (cur) patchInstalled(id, { playTimeSeconds: (cur.playTimeSeconds ?? 0) + seconds })
    this.emit()
  })

  async init(): Promise<void> {
    await cleanupWorkDirs(getSettings().installDir).catch(() => undefined)
    // Un jeu supprimé à la main n'est plus considéré comme installé.
    for (const g of Object.values(getInstalled())) {
      if (!existsSync(g.installDir)) removeInstalled(g.id)
    }
    this.scheduleChecks()
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  onProgress(l: ProgressListener): () => void {
    this.progressListeners.add(l)
    return () => this.progressListeners.delete(l)
  }

  snapshot(): LibrarySnapshot {
    const installed = getInstalled()
    return {
      games: this.games,
      installed,
      updates: this.games
        .filter((g) => installed[g.id] && g.downloadUrl && isNewer(g.version, installed[g.id].version))
        .map((g) => g.id),
      running: this.runner.list(),
      installing: Object.fromEntries([...this.jobs].map(([id, j]) => [id, j.progress])),
      manifestError: this.manifestError,
      fetchedAt: this.fetchedAt
    }
  }

  emit(): void {
    const snap = this.snapshot()
    for (const l of this.listeners) l(snap)
  }

  refresh(): Promise<LibrarySnapshot> {
    if (this.refreshing) return this.refreshing
    this.refreshing = (async () => {
      const settings = getSettings()
      try {
        this.games = await loadManifest(settings.manifestUrl, settings.githubToken)
        this.manifestError = undefined
        this.fetchedAt = new Date().toISOString()
      } catch (err) {
        // On garde la dernière liste connue : le launcher reste utilisable hors-ligne.
        this.manifestError = (err as Error).message
      }
      this.emit()
      return this.snapshot()
    })().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  scheduleChecks(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (!getSettings().autoCheckUpdates) return
    this.timer = setInterval(() => void this.refresh(), BRANDING.updateCheckIntervalMinutes * 60_000)
  }

  private findGame(id: string): Game {
    const game = this.games.find((g) => g.id === id)
    if (!game) throw new Error(`Jeu inconnu : ${id}`)
    return game
  }

  private updateProgress(id: string, patch: Partial<InstallProgress>): void {
    const job = this.jobs.get(id)
    if (!job) return
    const now = Date.now()
    job.progress = { ...job.progress, ...patch }

    if (patch.receivedBytes !== undefined) {
      job.samples.push({ t: now, bytes: patch.receivedBytes })
      while (job.samples.length > 2 && now - job.samples[0].t > 3000) job.samples.shift()
      const first = job.samples[0]
      const dt = (now - first.t) / 1000
      job.progress.speed = dt > 0.2 ? (patch.receivedBytes - first.bytes) / dt : job.progress.speed
      const remaining = job.progress.totalBytes - job.progress.receivedBytes
      job.progress.eta = job.progress.speed > 0 ? remaining / job.progress.speed : 0
    }
    // Limite à ~10 événements/s, sauf changement de phase.
    if (patch.phase === undefined && now - job.lastEmit < 100) return
    job.lastEmit = now
    for (const l of this.progressListeners) l(job.progress)
  }

  async install(id: string): Promise<InstallResult> {
    if (this.jobs.has(id)) return { ok: false, error: 'Installation déjà en cours' }
    if (this.runner.isRunning(id)) return { ok: false, error: 'Fermez le jeu avant de le mettre à jour' }
    let game: Game
    try {
      game = this.findGame(id)
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    if (game.status === 'development') return { ok: false, error: 'Ce jeu est en développement' }
    if (!game.downloadUrl) return { ok: false, error: game.error ?? 'Aucune URL de téléchargement' }

    const existing = getInstalled()[id]
    const controller = new AbortController()
    this.jobs.set(id, {
      controller,
      samples: [],
      lastEmit: 0,
      progress: {
        gameId: id,
        phase: 'queued',
        progress: 0,
        receivedBytes: 0,
        totalBytes: game.size ?? 0,
        speed: 0,
        eta: 0,
        isUpdate: !!existing
      }
    })
    this.emit()

    try {
      const installed = await installGame({
        game,
        installRoot: getSettings().installDir,
        existingDir: existing && existsSync(existing.installDir) ? existing.installDir : undefined,
        signal: controller.signal,
        onProgress: (p) => this.updateProgress(id, p)
      })
      setInstalled({
        ...installed,
        lastPlayedAt: existing?.lastPlayedAt,
        playTimeSeconds: existing?.playTimeSeconds
      })
      return { ok: true }
    } catch (err) {
      if (err instanceof CancelledError) return { ok: false, cancelled: true, error: err.message }
      return { ok: false, error: friendlyError(err as Error) }
    } finally {
      this.jobs.delete(id)
      this.emit()
    }
  }

  cancel(id: string): void {
    this.jobs.get(id)?.controller.abort()
  }

  cancelAll(): void {
    for (const job of this.jobs.values()) job.controller.abort()
  }

  async launch(id: string): Promise<{ ok: boolean; error?: string }> {
    const installed = getInstalled()[id]
    if (!installed) return { ok: false, error: "Ce jeu n'est pas installé" }
    if (this.jobs.has(id)) return { ok: false, error: 'Installation en cours' }
    const game = this.games.find((g) => g.id === id)
    const { closeOnLaunch } = getSettings()
    try {
      await this.runner.launch(installed, game?.args ?? [], closeOnLaunch)
      patchInstalled(id, { lastPlayedAt: new Date().toISOString() })
      this.emit()
      if (closeOnLaunch) setTimeout(() => app.quit(), 300)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async uninstall(id: string): Promise<{ ok: boolean; error?: string }> {
    const installed = getInstalled()[id]
    if (!installed) return { ok: true }
    if (this.runner.isRunning(id)) return { ok: false, error: 'Fermez le jeu avant de le désinstaller' }
    if (this.jobs.has(id)) return { ok: false, error: 'Installation en cours' }
    // Garde-fou : on ne supprime qu'un dossier nommé d'après l'id du jeu.
    if (basename(installed.installDir) !== id) {
      return { ok: false, error: `Dossier inattendu, suppression refusée : ${installed.installDir}` }
    }
    try {
      await removeDir(installed.installDir)
      removeInstalled(id)
      this.emit()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `Suppression impossible : ${(err as Error).message}` }
    }
  }

  async openFolder(id: string): Promise<void> {
    const installed = getInstalled()[id]
    if (installed) await shell.openPath(installed.installDir)
  }

  hasActiveWork(): boolean {
    return this.jobs.size > 0
  }
}

function friendlyError(err: Error): string {
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'ENOSPC') return 'Espace disque insuffisant'
  if (code === 'EACCES' || code === 'EPERM') return `Accès refusé : ${err.message}`
  const network = ['fetch failed', 'terminated', 'other side closed', 'aborted']
  if (network.includes(err.message) || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'UND_ERR_SOCKET')
    return 'Connexion perdue. Relancez : le téléchargement reprendra où il s’est arrêté.'
  return err.message
}
