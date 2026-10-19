import { app } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BRANDING } from '@shared/branding'

/** %APPDATA%/<NomLauncher>/games */
export function defaultInstallDir(): string {
  return join(app.getPath('userData'), 'games')
}

/** En dev, on pointe sur games.example.json à la racine du projet. */
export function defaultManifestUrl(): string {
  if (!app.isPackaged) return pathToFileURL(join(app.getAppPath(), 'games.example.json')).toString()
  return BRANDING.defaultManifestUrl
}

/** Dossiers de travail placés dans le dossier d'installation (même volume = renommages atomiques). */
export function workDirs(installRoot: string) {
  return {
    downloads: join(installRoot, '.downloads'),
    staging: join(installRoot, '.staging'),
    trash: join(installRoot, '.trash')
  }
}
