import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ net: {}, protocol: {} }))

const { loadManifest } = await import('../src/main/manifest')

const dir = mkdtempSync(join(tmpdir(), 'nova-manifest-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

let n = 0
function manifest(games: unknown[]): string {
  const file = join(dir, `games-${n++}.json`)
  writeFileSync(file, JSON.stringify({ games }))
  return file
}

const released = {
  id: 'crypt-survivor',
  name: 'Crypt Survivor',
  description: 'Survie',
  version: '2.2.1',
  downloadUrl: 'https://example.com/crypt-survivor-2.2.1.zip',
  executable: 'CryptSurvivor.exe'
}

const dev = {
  id: 'cest-qui-lidiot',
  name: "C'EST QUI L'IDIOT?",
  status: 'development',
  tagline: 'Dans cette usine, tout le monde fait n’importe quoi.',
  description: 'Party game',
  genres: ['Party Game', 'Multijoueur'],
  logo: 'assets/logo.png',
  banner: 'assets/banner.jpg'
}

describe('jeu en développement', () => {
  it('se charge sans version, downloadUrl ni executable', async () => {
    const games = await loadManifest(manifest([dev]), '')
    expect(games).toHaveLength(1)
    const g = games[0]
    expect(g.status).toBe('development')
    expect(g.version).toBe('')
    expect(g.downloadUrl).toBe('')
    expect(g.executable).toBe('')
    expect(g.error).toBeUndefined()
    expect(g.genres).toEqual(['Party Game', 'Multijoueur'])
    expect(decodeURIComponent(g.banner ?? '')).toMatch(/assets[\\/]banner\.jpg$/)
  })

  it("n'est jamais téléchargeable, même si une URL est présente", async () => {
    const [g] = await loadManifest(manifest([{ ...dev, version: '0.1.0', downloadUrl: 'https://example.com/x.zip', size: 10 }]), '')
    expect(g.downloadUrl).toBe('')
    expect(g.size).toBeUndefined()
    expect(g.version).toBe('0.1.0')
  })

  it("n'interroge pas GitHub", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const [g] = await loadManifest(manifest([{ ...dev, github: { repo: 'owner/repo' } }]), '')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(g.source).toBe('manifest')
    fetchSpy.mockRestore()
  })

  it('cohabite avec un jeu publié', async () => {
    const games = await loadManifest(manifest([released, dev]), '')
    expect(games.map((g) => [g.id, g.status])).toEqual([
      ['crypt-survivor', 'released'],
      ['cest-qui-lidiot', 'development']
    ])
    expect(games[0].downloadUrl).toBe(released.downloadUrl)
  })
})

describe('un jeu en développement ne casse jamais les autres', () => {
  it.each([
    ['id invalide', { ...dev, id: 'pas valide !' }],
    ['nom manquant', { ...dev, name: '' }],
    ['id en double avec un jeu publié', { ...dev, id: released.id }],
    ['version non textuelle', { ...dev, version: 12 }]
  ])('%s : ignoré avec un avertissement', async (_label, broken) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const games = await loadManifest(manifest([released, broken]), '')
    expect(games.map((g) => g.id)).toEqual([released.id])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('jeu en développement'))
    warn.mockRestore()
  })

  it('id en double entre deux jeux en développement : le premier est gardé', async () => {
    const games = await loadManifest(manifest([dev, { ...dev, name: 'Doublon' }, released]), '')
    expect(games.map((g) => g.name)).toEqual([dev.name, released.name])
  })

  it('champs de types inattendus : nettoyés, pas d’erreur', async () => {
    const [, g] = await loadManifest(
      manifest([released, { ...dev, genres: 'Party', screenshots: { a: 1 }, changelog: 'x', sha256: 42, args: [1, 'ok'] }]),
      ''
    )
    expect(g.genres).toEqual([])
    expect(g.screenshots).toEqual([])
    expect(g.changelog).toEqual([])
    expect(g.sha256).toBeUndefined()
    expect(g.args).toEqual(['ok'])
  })
})

describe('hideTitle', () => {
  it('vaut true seulement si le manifeste le demande explicitement', async () => {
    const games = await loadManifest(
      manifest([{ ...dev, hideTitle: true }, { ...released, hideTitle: 'oui' }, { ...released, id: 'autre' }]),
      ''
    )
    expect(games.map((g) => g.hideTitle)).toEqual([true, false, false])
  })
})

describe('jeux publiés : validation inchangée', () => {
  it('executable manquant → manifeste invalide', async () => {
    const { executable: _omit, ...noExe } = released
    await expect(loadManifest(manifest([noExe]), '')).rejects.toThrow(/executable/)
  })

  it('version manquante → manifeste invalide', async () => {
    const { version: _omit, ...noVersion } = released
    await expect(loadManifest(manifest([noVersion]), '')).rejects.toThrow(/version/)
  })

  it('statut inconnu → manifeste invalide', async () => {
    await expect(loadManifest(manifest([{ ...released, status: 'beta' }]), '')).rejects.toThrow(/statut inconnu/)
  })

  it('"released" explicite est accepté', async () => {
    const [g] = await loadManifest(manifest([{ ...released, status: 'released' }]), '')
    expect(g.status).toBe('released')
  })
})
