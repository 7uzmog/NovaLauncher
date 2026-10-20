// Types partagés main / preload / renderer.

/** Entrée d'un jeu telle qu'écrite dans games.json. */
export interface ManifestGameEntry {
  id: string
  name: string
  /** Courte accroche affichée sur les cartes. */
  tagline?: string
  description: string
  developer?: string
  genres?: string[]
  /** Images : URL absolues, ou relatives à l'URL du manifeste. */
  icon?: string
  logo?: string
  banner?: string
  screenshots?: string[]
  /** Couleur d'accent optionnelle propre au jeu (#rrggbb). */
  accentColor?: string
  /** La bannière contient déjà le titre : ni logo ni nom affichés par-dessus. */
  hideTitle?: boolean
  version?: string
  downloadUrl?: string
  sha256?: string
  /** Taille du zip en octets. */
  size?: number
  /** Chemin de l'exécutable, relatif au dossier d'installation (facultatif en développement). */
  executable?: string
  /** Exécutable par plateforme, prioritaire sur `executable`. */
  executables?: Partial<Record<'win32' | 'darwin' | 'linux', string>>
  args?: string[]
  changelog?: ChangelogEntry[]
  /**
   * Source GitHub Releases : version, zip, taille, sha256 et notes de version
   * sont lus depuis la dernière release du dépôt.
   */
  github?: GithubSource
  /**
   * "development" : fiche affichée sans téléchargement (version, downloadUrl et
   * executable facultatifs). Défaut : "released".
   */
  status?: GameReleaseStatus
}

export type GameReleaseStatus = 'released' | 'development'

export interface GithubSource {
  /** "owner/repo" */
  repo: string
  /** Motif du nom d'asset (glob simple avec *). Défaut : premier .zip. */
  asset?: string
  /** Inclure les pre-releases. */
  prerelease?: boolean
}

export interface ChangelogEntry {
  version: string
  date?: string
  /** Liste de changements (ou texte markdown simple). */
  notes: string[] | string
}

export interface Manifest {
  launcher?: { name?: string; news?: string }
  games: ManifestGameEntry[]
}

/** Jeu résolu (manifeste + GitHub) prêt pour l'UI. */
export interface Game {
  id: string
  name: string
  tagline?: string
  description: string
  developer?: string
  genres: string[]
  icon?: string
  logo?: string
  banner?: string
  screenshots: string[]
  accentColor?: string
  hideTitle: boolean
  version: string
  downloadUrl: string
  sha256?: string
  size?: number
  executable: string
  args: string[]
  changelog: ChangelogEntry[]
  source: 'manifest' | 'github'
  status: GameReleaseStatus
  /** Erreur de résolution (ex : API GitHub injoignable). */
  error?: string
}

export interface InstalledGame {
  id: string
  version: string
  installDir: string
  executable: string
  installedAt: string
  sizeOnDisk?: number
  lastPlayedAt?: string
  playTimeSeconds?: number
}

export type InstallPhase = 'queued' | 'downloading' | 'verifying' | 'extracting' | 'finalizing'

export interface InstallProgress {
  gameId: string
  phase: InstallPhase
  /** 0..1 pour la phase courante. */
  progress: number
  receivedBytes: number
  totalBytes: number
  /** Octets/seconde. */
  speed: number
  /** Secondes restantes estimées. */
  eta: number
  isUpdate: boolean
}

export type GameStatus =
  | 'not-installed'
  | 'installed'
  | 'update-available'
  | 'installing'
  | 'running'
  | 'unavailable'
  | 'development'

export interface Settings {
  manifestUrl: string
  installDir: string
  launchAtStartup: boolean
  autoCheckUpdates: boolean
  closeOnLaunch: boolean
  /** Jeton GitHub optionnel (dépôts privés / quota API). */
  githubToken: string
}

export interface LibrarySnapshot {
  games: Game[]
  installed: Record<string, InstalledGame>
  running: string[]
  installing: Record<string, InstallProgress>
  /** Ids des jeux installés dont une version plus récente existe. */
  updates: string[]
  manifestError?: string
  fetchedAt?: string
}

export type LauncherUpdateState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }
  | { state: 'disabled'; reason: string }

export interface AppInfo {
  name: string
  version: string
  platform: string
  isPackaged: boolean
  defaultInstallDir: string
}

export type InstallResult = { ok: true } | { ok: false; cancelled?: boolean; error: string }
