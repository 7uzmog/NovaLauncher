import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { InstalledGame } from '@shared/types'

interface RunningGame {
  child: ChildProcess
  startedAt: number
}

/** Lance les jeux et suit leur cycle de vie. */
export class GameRunner {
  private running = new Map<string, RunningGame>()

  constructor(private onExit: (id: string, seconds: number, code: number | null) => void) {}

  isRunning(id: string): boolean {
    return this.running.has(id)
  }

  list(): string[] {
    return [...this.running.keys()]
  }

  /**
   * @param detached si vrai, le jeu survit à la fermeture du launcher (option
   *                 « Fermer le launcher au lancement »).
   */
  launch(game: InstalledGame, args: string[], detached: boolean): Promise<void> {
    if (this.running.has(game.id)) return Promise.reject(new Error('Le jeu est déjà en cours'))
    const exe = join(game.installDir, game.executable)
    if (!existsSync(exe)) return Promise.reject(new Error(`Exécutable introuvable : ${exe}. Réinstallez le jeu.`))

    return new Promise((resolve, reject) => {
      const child = spawn(exe, args, {
        cwd: game.installDir,
        detached,
        stdio: 'ignore',
        windowsHide: false
      })
      child.once('error', (err) => {
        this.running.delete(game.id)
        reject(new Error(`Lancement impossible : ${err.message}`))
      })
      child.once('spawn', () => {
        this.running.set(game.id, { child, startedAt: Date.now() })
        if (detached) child.unref()
        resolve()
      })
      child.once('exit', (code) => {
        const entry = this.running.get(game.id)
        if (!entry || entry.child !== child) return
        this.running.delete(game.id)
        this.onExit(game.id, Math.round((Date.now() - entry.startedAt) / 1000), code)
      })
    })
  }
}
