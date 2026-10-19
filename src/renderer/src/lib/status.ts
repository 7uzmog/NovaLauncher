import type { Game, GameStatus, InstallPhase, InstallProgress, LibrarySnapshot } from '@shared/types'

export function gameStatus(game: Game, snap: LibrarySnapshot): GameStatus {
  if (snap.installing[game.id]) return 'installing'
  if (snap.running.includes(game.id)) return 'running'
  if (snap.installed[game.id]) return snap.updates.includes(game.id) ? 'update-available' : 'installed'
  if (game.error || !game.downloadUrl) return 'unavailable'
  return 'not-installed'
}

/** Poids de chaque phase dans la progression globale affichée. */
const PHASES: Record<InstallPhase, [number, number]> = {
  queued: [0, 0],
  downloading: [0, 0.82],
  verifying: [0.82, 0.88],
  extracting: [0.88, 0.98],
  finalizing: [0.98, 1]
}

export function overallProgress(p: InstallProgress): number {
  const [start, end] = PHASES[p.phase]
  return Math.max(0, Math.min(1, start + (end - start) * p.progress))
}

export const PHASE_LABEL: Record<InstallPhase, string> = {
  queued: 'Préparation',
  downloading: 'Téléchargement',
  verifying: 'Vérification',
  extracting: 'Extraction',
  finalizing: 'Finalisation'
}

export const STATUS_LABEL: Record<GameStatus, string> = {
  'not-installed': 'Non installé',
  installed: 'Installé',
  'update-available': 'Mise à jour',
  installing: 'Installation',
  running: 'En cours',
  unavailable: 'Indisponible'
}
