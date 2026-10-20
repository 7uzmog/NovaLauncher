import { describe, expect, it } from 'vitest'
import type { Game, LibrarySnapshot } from '@shared/types'
import { gameStatus, isOnDisk, STATUS_LABEL } from '../src/renderer/src/lib/status'

const game = (patch: Partial<Game> = {}): Game => ({
  id: 'g',
  name: 'G',
  description: '',
  genres: [],
  screenshots: [],
  version: '1.0.0',
  downloadUrl: 'https://example.com/g.zip',
  executable: 'G.exe',
  args: [],
  changelog: [],
  source: 'manifest',
  status: 'released',
  hideTitle: false,
  ...patch
})

const snap = (patch: Partial<LibrarySnapshot> = {}): LibrarySnapshot => ({
  games: [],
  installed: {},
  running: [],
  installing: {},
  updates: [],
  ...patch
})

const devGame = game({ status: 'development', version: '', downloadUrl: '', executable: '' })

describe('gameStatus', () => {
  it('jeu en développement → "development", pas "unavailable"', () => {
    expect(gameStatus(devGame, snap())).toBe('development')
    expect(STATUS_LABEL.development).toBe('En développement')
  })

  it('un jeu publié sans URL reste "unavailable"', () => {
    expect(gameStatus(game({ downloadUrl: '' }), snap())).toBe('unavailable')
  })

  it('un jeu déjà installé repassé en développement reste jouable', () => {
    const installed = { g: { id: 'g', version: '1.0.0', installDir: 'C:/g', executable: 'G.exe', installedAt: '' } }
    expect(gameStatus(devGame, snap({ installed }))).toBe('installed')
  })

  it('jeu publié non installé → "not-installed"', () => {
    expect(gameStatus(game(), snap())).toBe('not-installed')
  })
})

describe('isOnDisk (filtre « Installés »)', () => {
  it('exclut les jeux en développement, non installés et indisponibles', () => {
    expect(isOnDisk('development')).toBe(false)
    expect(isOnDisk('not-installed')).toBe(false)
    expect(isOnDisk('unavailable')).toBe(false)
    expect(isOnDisk('installed')).toBe(true)
    expect(isOnDisk('update-available')).toBe(true)
  })
})
