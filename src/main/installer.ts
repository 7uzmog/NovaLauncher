import { createReadStream, existsSync } from 'node:fs'
import { chmod, mkdir, readdir, rename, rm, stat, statfs } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import extract from 'extract-zip'
import type { Game, InstallPhase, InstalledGame } from '@shared/types'
import { download } from './downloader'
import { workDirs } from './paths'

export interface PhaseProgress {
  phase: InstallPhase
  progress: number
  receivedBytes?: number
  totalBytes?: number
}

export interface InstallOptions {
  game: Game
  installRoot: string
  /** Dossier d'une installation existante (mise à jour : on garde son emplacement). */
  existingDir?: string
  signal: AbortSignal
  onProgress: (p: PhaseProgress) => void
}

export class CancelledError extends Error {
  constructor() {
    super('Installation annulée')
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** rename avec quelques essais : sous Windows l'antivirus / l'indexeur verrouille parfois brièvement. */
async function renameRetry(from: string, to: string, attempts = 6): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      return await rename(from, to)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (i >= attempts - 1 || !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '')) throw err
      await sleep(150 * (i + 1))
    }
  }
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

async function sha256File(path: string, signal: AbortSignal, onProgress: (p: number) => void): Promise<string> {
  const total = (await stat(path)).size || 1
  const hash = createHash('sha256')
  let done = 0
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20, signal })) {
    hash.update(chunk as Buffer)
    done += (chunk as Buffer).length
    onProgress(done / total)
  }
  return hash.digest('hex')
}

async function ensureFreeSpace(dir: string, needed: number): Promise<void> {
  if (!needed) return
  try {
    const s = await statfs(dir)
    const free = s.bavail * s.bsize
    if (free < needed) {
      const gb = (n: number) => (n / 1024 ** 3).toFixed(2)
      throw new Error(`Espace disque insuffisant : ${gb(needed)} Go requis, ${gb(free)} Go libres`)
    }
  } catch (err) {
    if ((err as Error).message.startsWith('Espace')) throw err
  }
}

/** Dossier racine du contenu : gère les zips qui contiennent un unique dossier parent. */
async function findContentRoot(staging: string, executable: string): Promise<string> {
  if (existsSync(join(staging, executable))) return staging
  const entries = await readdir(staging, { withFileTypes: true })
  if (entries.length === 1 && entries[0].isDirectory()) {
    const nested = join(staging, entries[0].name)
    if (existsSync(join(nested, executable))) return nested
  }
  throw new Error(`Exécutable introuvable dans l'archive : "${executable}"`)
}

/**
 * Flux complet : téléchargement (reprise possible) → SHA-256 → extraction dans un
 * dossier temporaire → remplacement atomique de l'ancienne version.
 * En cas d'échec, l'installation existante reste intacte.
 */
export async function installGame(opts: InstallOptions): Promise<InstalledGame> {
  const { game, installRoot, signal, onProgress } = opts
  const dirs = workDirs(installRoot)
  await Promise.all([mkdir(dirs.downloads, { recursive: true }), mkdir(dirs.staging, { recursive: true })])

  const zipPath = join(dirs.downloads, `${game.id}-${game.version}.zip`)
  const partPath = `${zipPath}.part`
  const stagingDir = join(dirs.staging, game.id)
  const targetDir = opts.existingDir ?? join(installRoot, game.id)
  let uncompressed = 0

  const checkAbort = () => {
    if (signal.aborted) throw new CancelledError()
  }

  try {
    await ensureFreeSpace(installRoot, (game.size ?? 0) * 2.5)

    // 1. Téléchargement — un zip complet déjà vérifiable est réutilisé.
    if (!(existsSync(zipPath) && game.sha256)) {
      await download({
        url: game.downloadUrl,
        dest: partPath,
        signal,
        expectedSize: game.size,
        onProgress: (received, total) =>
          onProgress({
            phase: 'downloading',
            progress: total ? received / total : 0,
            receivedBytes: received,
            totalBytes: total
          })
      })
      checkAbort()
      await renameRetry(partPath, zipPath)
    }

    // 2. Vérification d'intégrité.
    if (game.sha256) {
      onProgress({ phase: 'verifying', progress: 0 })
      const digest = await sha256File(zipPath, signal, (p) => onProgress({ phase: 'verifying', progress: p }))
      if (digest !== game.sha256.toLowerCase()) {
        await rm(zipPath, { force: true })
        throw new Error('Fichier corrompu : la signature SHA-256 ne correspond pas. Réessayez.')
      }
    }
    checkAbort()

    // 3. Extraction dans le dossier temporaire.
    await removeDir(stagingDir)
    await mkdir(stagingDir, { recursive: true })
    let done = 0
    onProgress({ phase: 'extracting', progress: 0 })
    await extract(zipPath, {
      dir: stagingDir,
      onEntry: (entry, zipfile) => {
        checkAbort()
        done++
        uncompressed += entry.uncompressedSize
        onProgress({ phase: 'extracting', progress: done / Math.max(1, zipfile.entryCount) })
      }
    })
    checkAbort()
    const contentRoot = await findContentRoot(stagingDir, game.executable)

    // 4. Remplacement de l'ancienne version (point de non-retour : plus d'annulation).
    onProgress({ phase: 'finalizing', progress: 0 })
    let trashed: string | null = null
    if (existsSync(targetDir)) {
      await mkdir(dirs.trash, { recursive: true })
      trashed = join(dirs.trash, `${game.id}-${Date.now()}`)
      try {
        await renameRetry(targetDir, trashed)
      } catch {
        throw new Error('Impossible de remplacer les fichiers : le jeu est-il encore ouvert ?')
      }
    }
    try {
      await renameRetry(contentRoot, targetDir)
    } catch (err) {
      if (trashed) await renameRetry(trashed, targetDir).catch(() => undefined)
      throw err
    }
    if (process.platform !== 'win32') await chmod(join(targetDir, game.executable), 0o755).catch(() => undefined)

    // Nettoyage (non bloquant pour l'utilisateur).
    await removeDir(stagingDir).catch(() => undefined)
    if (trashed) removeDir(trashed).catch(() => undefined)
    await rm(zipPath, { force: true }).catch(() => undefined)
    onProgress({ phase: 'finalizing', progress: 1 })

    return {
      id: game.id,
      version: game.version,
      installDir: targetDir,
      executable: game.executable,
      installedAt: new Date().toISOString(),
      sizeOnDisk: uncompressed || undefined
    }
  } catch (err) {
    await removeDir(stagingDir).catch(() => undefined)
    const cancelled = signal.aborted || err instanceof CancelledError || (err as Error).name === 'AbortError'
    if (cancelled) {
      // Annulation volontaire : on supprime les fichiers partiels.
      await rm(partPath, { force: true }).catch(() => undefined)
      await rm(zipPath, { force: true }).catch(() => undefined)
      throw new CancelledError()
    }
    // Échec réseau etc. : le .part est conservé pour reprendre au prochain essai.
    if (!game.sha256) await rm(zipPath, { force: true }).catch(() => undefined)
    throw err
  }
}

/** Au démarrage : supprime les restes d'installations interrompues. */
export async function cleanupWorkDirs(installRoot: string): Promise<void> {
  const dirs = workDirs(installRoot)
  await removeDir(dirs.staging).catch(() => undefined)
  await removeDir(dirs.trash).catch(() => undefined)
}
