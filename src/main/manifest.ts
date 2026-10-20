import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import semver from 'semver'
import type { ChangelogEntry, Game, Manifest, ManifestGameEntry } from '@shared/types'
import { resolveGithubRelease } from './github'
import { allowAssetRoot, toAssetUrl } from './assets'

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i

/** Accepte une URL http(s), une URL file:// ou un chemin local absolu. */
export function normalizeLocation(location: string): string {
  const trimmed = location.trim()
  if (isAbsolute(trimmed) && !/^[a-z]+:\/\//i.test(trimmed)) return pathToFileURL(trimmed).toString()
  return trimmed
}

export async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  if (url.startsWith('file:')) return readFile(fileURLToPath(url), 'utf8')
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Cache-Control': 'no-cache' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} en lisant ${url}`)
  return res.text()
}

export function cleanVersion(v: string | undefined): string {
  if (!v) return '0.0.0'
  return semver.clean(v, { loose: true }) ?? semver.coerce(v)?.version ?? v
}

/** Vrai si `remote` est plus récente que `local`. */
export function isNewer(remote: string, local: string): boolean {
  const r = semver.valid(cleanVersion(remote))
  const l = semver.valid(cleanVersion(local))
  if (r && l) return semver.gt(r, l)
  return remote !== local
}

function resolveUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value, base).toString()
  } catch {
    return undefined
  }
}

/** Les images file:// passent par le protocole nova-asset:// (le renderer n'a pas accès au disque). */
function resolveImage(value: string | undefined, base: string): string | undefined {
  const url = resolveUrl(value, base)
  if (!url) return undefined
  return url.startsWith('file:') ? toAssetUrl(fileURLToPath(url)) : url
}

function pickExecutable(entry: ManifestGameEntry): string {
  const perPlatform = entry.executables?.[process.platform as 'win32' | 'darwin' | 'linux']
  return perPlatform ?? entry.executable ?? ''
}

function isDevelopment(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as ManifestGameEntry).status === 'development'
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])
const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

function validateEntry(e: unknown, index: number): ManifestGameEntry {
  const entry = e as ManifestGameEntry
  if (!entry || typeof entry !== 'object') throw new Error(`Jeu #${index} invalide`)
  if (!ID_RE.test(entry.id ?? '')) throw new Error(`Jeu #${index} : id invalide "${entry.id}" (lettres, chiffres, - et _)`)
  if (!entry.name) throw new Error(`Jeu "${entry.id}" : champ "name" manquant`)
  if (entry.status !== undefined && entry.status !== 'released' && entry.status !== 'development')
    throw new Error(`Jeu "${entry.id}" : statut inconnu "${entry.status}" (released ou development)`)
  // Un jeu en développement n'a pas encore de build : seuls id et name sont requis.
  if (entry.status === 'development') return entry
  if (!entry.executable && !entry.executables) throw new Error(`Jeu "${entry.id}" : champ "executable" manquant`)
  if (!entry.github && (!entry.downloadUrl || !entry.version))
    throw new Error(`Jeu "${entry.id}" : "downloadUrl" et "version" requis (ou une source "github")`)
  return entry
}

async function resolveEntry(entry: ManifestGameEntry, base: string, githubToken: string): Promise<Game> {
  const dev = isDevelopment(entry)
  const game: Game = {
    id: entry.id,
    name: String(entry.name),
    tagline: text(entry.tagline),
    description: text(entry.description) ?? '',
    developer: text(entry.developer),
    genres: strings(entry.genres),
    icon: resolveImage(text(entry.icon), base),
    logo: resolveImage(text(entry.logo), base),
    banner: resolveImage(text(entry.banner), base),
    screenshots: strings(entry.screenshots)
      .map((s) => resolveImage(s, base))
      .filter((s): s is string => !!s),
    accentColor: text(entry.accentColor),
    hideTitle: entry.hideTitle === true,
    version: dev && !entry.version ? '' : cleanVersion(entry.version),
    // En développement, jamais de téléchargement, même si une URL traîne dans le manifeste.
    downloadUrl: dev ? '' : (resolveUrl(entry.downloadUrl, base) ?? ''),
    sha256: text(entry.sha256)?.toLowerCase(),
    size: dev ? undefined : entry.size,
    executable: pickExecutable(entry),
    args: strings(entry.args),
    changelog: Array.isArray(entry.changelog) ? entry.changelog : [],
    source: entry.github && !dev ? 'github' : 'manifest',
    status: dev ? 'development' : 'released'
  }

  if (entry.github && !dev) {
    try {
      const rel = await resolveGithubRelease(entry.github, githubToken)
      game.version = cleanVersion(rel.version)
      game.downloadUrl = rel.downloadUrl
      game.size = rel.size
      game.sha256 = rel.sha256 ?? game.sha256
      if (!game.changelog.some((c) => cleanVersion(c.version) === game.version)) {
        const fromRelease: ChangelogEntry = { version: game.version, date: rel.date, notes: rel.notes }
        game.changelog = [fromRelease, ...game.changelog]
      }
    } catch (err) {
      // On garde les infos du manifeste si présentes (fallback), sinon le jeu est indisponible.
      if (!game.downloadUrl) game.error = `GitHub : ${(err as Error).message}`
    }
  }
  game.changelog = [...game.changelog].sort((a, b) => {
    const va = semver.valid(cleanVersion(a.version))
    const vb = semver.valid(cleanVersion(b.version))
    return va && vb ? semver.rcompare(va, vb) : 0
  })
  return game
}

export async function loadManifest(location: string, githubToken: string): Promise<Game[]> {
  const url = normalizeLocation(location)
  if (url.startsWith('file:')) allowAssetRoot(dirname(fileURLToPath(url)))
  const raw = await fetchText(url)
  let data: Manifest
  try {
    data = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Manifeste JSON invalide : ${(err as Error).message}`)
  }
  if (!data || !Array.isArray(data.games)) throw new Error('Manifeste invalide : tableau "games" manquant')
  const games = await Promise.all(
    selectEntries(data.games).map((e) =>
      resolveEntry(e, url, githubToken).catch((err: Error) => {
        if (!isDevelopment(e)) throw err
        console.warn(`[manifest] jeu en développement "${e.id}" ignoré : ${err.message}`)
        return null
      })
    )
  )
  return games.filter((g): g is Game => g !== null)
}

/**
 * Valide les entrées. Une erreur sur un jeu publié invalide tout le manifeste (comportement
 * historique) ; un jeu en développement fautif est ignoré pour ne jamais bloquer les autres.
 */
function selectEntries(raw: unknown[]): ManifestGameEntry[] {
  const valid: ManifestGameEntry[] = []
  raw.forEach((e, i) => {
    try {
      valid.push(validateEntry(e, i))
    } catch (err) {
      if (!isDevelopment(e)) throw err
      console.warn(`[manifest] jeu en développement ignoré : ${(err as Error).message}`)
    }
  })
  const released = new Set<string>()
  for (const e of valid.filter((e) => !isDevelopment(e))) {
    if (released.has(e.id)) throw new Error(`Manifeste invalide : id "${e.id}" en double`)
    released.add(e.id)
  }
  const seenDev = new Set<string>()
  return valid.filter((e) => {
    if (!isDevelopment(e)) return true
    if (released.has(e.id) || seenDev.has(e.id)) {
      console.warn(`[manifest] jeu en développement ignoré : id "${e.id}" en double`)
      return false
    }
    seenDev.add(e.id)
    return true
  })
}
