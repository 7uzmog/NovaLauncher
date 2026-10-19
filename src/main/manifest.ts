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
  return perPlatform ?? entry.executable
}

function validateEntry(e: unknown, index: number): ManifestGameEntry {
  const entry = e as ManifestGameEntry
  if (!entry || typeof entry !== 'object') throw new Error(`Jeu #${index} invalide`)
  if (!ID_RE.test(entry.id ?? '')) throw new Error(`Jeu #${index} : id invalide "${entry.id}" (lettres, chiffres, - et _)`)
  if (!entry.name) throw new Error(`Jeu "${entry.id}" : champ "name" manquant`)
  if (!entry.executable && !entry.executables) throw new Error(`Jeu "${entry.id}" : champ "executable" manquant`)
  if (!entry.github && (!entry.downloadUrl || !entry.version))
    throw new Error(`Jeu "${entry.id}" : "downloadUrl" et "version" requis (ou une source "github")`)
  return entry
}

async function resolveEntry(entry: ManifestGameEntry, base: string, githubToken: string): Promise<Game> {
  const game: Game = {
    id: entry.id,
    name: entry.name,
    tagline: entry.tagline,
    description: entry.description ?? '',
    developer: entry.developer,
    genres: entry.genres ?? [],
    icon: resolveImage(entry.icon, base),
    logo: resolveImage(entry.logo, base),
    banner: resolveImage(entry.banner, base),
    screenshots: (entry.screenshots ?? []).map((s) => resolveImage(s, base)).filter((s): s is string => !!s),
    accentColor: entry.accentColor,
    version: cleanVersion(entry.version),
    downloadUrl: resolveUrl(entry.downloadUrl, base) ?? '',
    sha256: entry.sha256?.toLowerCase(),
    size: entry.size,
    executable: pickExecutable(entry),
    args: entry.args ?? [],
    changelog: entry.changelog ?? [],
    source: entry.github ? 'github' : 'manifest'
  }

  if (entry.github) {
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
  const entries = data.games.map(validateEntry)
  const ids = new Set<string>()
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error(`Manifeste invalide : id "${e.id}" en double`)
    ids.add(e.id)
  }
  return Promise.all(entries.map((e) => resolveEntry(e, url, githubToken)))
}
