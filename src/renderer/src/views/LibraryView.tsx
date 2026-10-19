import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { useLauncher } from '../store/launcher'
import { gameStatus } from '../lib/status'
import { GameCard } from '../components/GameCard'
import { GameBanner, GameLogo } from '../components/GameArt'
import { ActionButton } from '../components/ActionButton'

type Filter = 'all' | 'installed' | 'updates'

export function LibraryView() {
  const { snapshot, navigate, ready } = useLauncher()
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const st = snapshot.games.map((g) => gameStatus(g, snapshot))
    return {
      all: st.length,
      installed: st.filter((s) => s !== 'not-installed' && s !== 'unavailable').length,
      updates: st.filter((s) => s === 'update-available').length
    }
  }, [snapshot])

  const games = snapshot.games.filter((g) => {
    const s = gameStatus(g, snapshot)
    if (filter === 'installed') return s !== 'not-installed' && s !== 'unavailable'
    if (filter === 'updates') return s === 'update-available'
    return true
  })

  // Mise en avant : dernier jeu joué, sinon le premier du catalogue.
  const featured = useMemo(() => {
    const played = Object.values(snapshot.installed)
      .filter((i) => i.lastPlayedAt)
      .sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''))[0]
    return snapshot.games.find((g) => g.id === played?.id) ?? snapshot.games[0]
  }, [snapshot])

  return (
    <div className="mx-auto max-w-[1400px] px-10 pb-16 pt-8">
      {snapshot.manifestError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/25">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Impossible de lire le manifeste</div>
            <div className="mt-0.5 text-danger/80">{snapshot.manifestError}</div>
          </div>
        </div>
      )}

      {featured && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="group relative mb-10 h-[320px] overflow-hidden rounded-[22px] ring-1 ring-line"
        >
          <GameBanner game={featured} className="absolute inset-0 transition-transform duration-[1.2s] group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/70 to-transparent" />
          <div className="relative flex h-full max-w-[560px] flex-col justify-end gap-4 p-9">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
              {snapshot.installed[featured.id]?.lastPlayedAt ? 'Reprendre' : 'À la une'}
            </span>
            <GameLogo game={featured} className="h-24 max-w-[420px]" textClassName="text-5xl" />
            <p className="line-clamp-2 text-sm leading-6 text-fg/75">{featured.tagline ?? featured.description}</p>
            <div className="flex items-center gap-3">
              <ActionButton game={featured} size="sm" />
              <button
                onClick={() => navigate({ name: 'game', id: featured.id })}
                className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-fg/80 transition hover:bg-white/10 hover:text-fg"
              >
                Voir la page <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </motion.section>
      )}

      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bibliothèque</h1>
          <p className="mt-1 text-sm text-muted">
            {counts.all} jeu{counts.all > 1 ? 'x' : ''} · {counts.installed} installé{counts.installed > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-line">
          {(
            [
              ['all', 'Tous', counts.all],
              ['installed', 'Installés', counts.installed],
              ['updates', 'Mises à jour', counts.updates]
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`relative rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                filter === key ? 'text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {filter === key && (
                <motion.span layoutId="lib-filter" className="absolute inset-0 rounded-lg bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
              )}
              <span className="relative">
                {label} <span className="text-subtle">{n}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {!ready && snapshot.games.length === 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[4/3.3] animate-pulse rounded-[var(--radius-card)] bg-white/[0.04]" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong py-16 text-center text-sm text-muted">
          {filter === 'updates' ? 'Tous vos jeux sont à jour.' : 'Aucun jeu à afficher.'}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {games.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
