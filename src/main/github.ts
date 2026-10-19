import type { GithubSource } from '@shared/types'

export interface GithubRelease {
  version: string
  downloadUrl: string
  size: number
  sha256?: string
  date?: string
  notes: string
}

interface ApiAsset {
  name: string
  size: number
  browser_download_url: string
  /** Fourni par GitHub pour les assets récents : "sha256:<hex>" */
  digest?: string | null
}

interface ApiRelease {
  tag_name: string
  name?: string
  body?: string
  draft: boolean
  prerelease: boolean
  published_at?: string
  assets: ApiAsset[]
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; value: GithubRelease }>()

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nova-launcher',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (res.status === 404) throw new Error('dépôt ou release introuvable')
  if (res.status === 403 || res.status === 429) throw new Error('quota API GitHub atteint (ajoutez un jeton dans les Paramètres)')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

/** Lit la dernière release d'un dépôt GitHub (un dépôt = un jeu). */
export async function resolveGithubRelease(src: GithubSource, token: string): Promise<GithubRelease> {
  const key = `${src.repo}|${src.asset ?? ''}|${src.prerelease ? 1 : 0}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  let release: ApiRelease | undefined
  if (src.prerelease) {
    const list = await api<ApiRelease[]>(`/repos/${src.repo}/releases?per_page=10`, token)
    release = list.find((r) => !r.draft)
  } else {
    release = await api<ApiRelease>(`/repos/${src.repo}/releases/latest`, token)
  }
  if (!release) throw new Error('aucune release publiée')

  const matcher = src.asset ? globToRegExp(src.asset) : /\.zip$/i
  const asset = release.assets.find((a) => matcher.test(a.name))
  if (!asset) throw new Error(`aucun asset ne correspond à "${src.asset ?? '*.zip'}"`)

  let sha256 = asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : undefined
  if (!sha256) {
    // Convention alternative : un asset "<zip>.sha256" contenant le hash.
    const side = release.assets.find((a) => a.name.toLowerCase() === `${asset.name.toLowerCase()}.sha256`)
    if (side) {
      const res = await fetch(side.browser_download_url, { signal: AbortSignal.timeout(15000) })
      if (res.ok) sha256 = (await res.text()).trim().split(/\s+/)[0]?.toLowerCase()
    }
  }

  const value: GithubRelease = {
    version: release.tag_name,
    downloadUrl: asset.browser_download_url,
    size: asset.size,
    sha256,
    date: release.published_at?.slice(0, 10),
    notes: release.body?.trim() || release.name || ''
  }
  cache.set(key, { at: Date.now(), value })
  return value
}
