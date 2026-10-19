import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Clock, FolderOpen, HardDrive, MoreHorizontal, RefreshCw, Tag, Trash2, CalendarClock } from 'lucide-react'
import type { ChangelogEntry, Game } from '@shared/types'
import { useLauncher } from '../store/launcher'
import { gameStatus } from '../lib/status'
import { formatBytes, formatDate, formatPlayTime, formatRelative } from '../lib/format'
import { ActionButton } from '../components/ActionButton'
import { GameBanner, GameLogo } from '../components/GameArt'
import { Lightbox } from '../components/Overlays'

type Tab = 'overview' | 'changelog'

export function GameView({ id }: { id: string }) {
  const game = useLauncher((s) => s.snapshot.games.find((g) => g.id === id))
  const navigate = useLauncher((s) => s.navigate)
  if (!game) {
    return (
      <div className="grid h-full place-items-center text-muted">
        <button onClick={() => navigate({ name: 'library' })}>Jeu introuvable — retour à la bibliothèque</button>
      </div>
    )
  }
  return <GameDetails game={game} />
}

function GameDetails({ game }: { game: Game }) {
  const snapshot = useLauncher((s) => s.snapshot)
  const { navigate, uninstall, refresh } = useLauncher()
  const [tab, setTab] = useState<Tab>('overview')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const status = gameStatus(game, snapshot)
  const installed = snapshot.installed[game.id]
  const accentStyle = game.accentColor
    ? ({ '--color-accent': game.accentColor, '--color-accent-strong': game.accentColor } as React.CSSProperties)
    : undefined

  return (
    <div style={accentStyle} data-testid={`game-page-${game.id}`} className="pb-16">
      {/* Héros */}
      <section className="relative h-[440px] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <GameBanner game={game} />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-bg/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-transparent to-transparent" />

        <button
          onClick={() => navigate({ name: 'library' })}
          className="glass absolute left-8 top-6 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-fg/85 ring-1 ring-line transition hover:text-fg"
        >
          <ArrowLeft size={14} /> Bibliothèque
        </button>

        <div className="absolute inset-x-10 bottom-8 max-w-[1300px]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
            <GameLogo game={game} className="mb-4 h-28 max-w-[520px]" textClassName="mb-4 text-6xl" />
            {game.tagline && <p className="max-w-xl text-[15px] leading-6 text-fg/80">{game.tagline}</p>}
          </motion.div>
        </div>
      </section>

      {/* Barre d'action */}
      <div className="sticky top-0 z-10 border-b border-line glass">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-10 py-4">
          <ActionButton game={game} />
          <div className="ml-4 hidden items-center gap-7 text-xs text-muted xl:flex">
            <Stat icon={<Tag size={14} />} label="Version">
              {installed ? `v${installed.version}` : `v${game.version}`}
              {status === 'update-available' && <span className="text-update"> → v{game.version}</span>}
            </Stat>
            <Stat icon={<HardDrive size={14} />} label="Taille">
              {formatBytes(installed?.sizeOnDisk ?? game.size)}
            </Stat>
            {installed && (
              <>
                <Stat icon={<Clock size={14} />} label="Temps de jeu">
                  {formatPlayTime(installed.playTimeSeconds)}
                </Stat>
                <Stat icon={<CalendarClock size={14} />} label="Dernière session">
                  {formatRelative(installed.lastPlayedAt)}
                </Stat>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {installed && (
              <IconButton title="Ouvrir le dossier d'installation" onClick={() => window.api.games.openFolder(game.id)}>
                <FolderOpen size={18} />
              </IconButton>
            )}
            <MoreMenu
              items={[
                { label: 'Rechercher des mises à jour', icon: <RefreshCw size={15} />, onClick: () => refresh() },
                ...(installed
                  ? [
                      { label: "Ouvrir le dossier d'installation", icon: <FolderOpen size={15} />, onClick: () => window.api.games.openFolder(game.id) },
                      {
                        label: 'Désinstaller',
                        icon: <Trash2 size={15} />,
                        danger: true,
                        disabled: status === 'running' || status === 'installing',
                        onClick: () => uninstall(game.id)
                      }
                    ]
                  : [])
              ]}
            />
          </div>
        </div>
      </div>

      {game.error && (
        <div className="mx-auto mt-6 max-w-[1400px] px-10">
          <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/25">{game.error}</div>
        </div>
      )}

      {/* Contenu */}
      <div className="mx-auto max-w-[1400px] px-10 pt-6">
        <div className="mb-6 flex gap-6 border-b border-line">
          {(
            [
              ['overview', 'Aperçu'],
              ['changelog', 'Notes de version']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative pb-3 text-sm font-medium transition-colors ${tab === key ? 'text-fg' : 'text-muted hover:text-fg'}`}
            >
              {label}
              {tab === key && <motion.span layoutId="game-tab" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'overview' ? (
              <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
                <div>
                  <p className="whitespace-pre-line text-[15px] leading-7 text-fg/80">{game.description}</p>
                  {game.screenshots.length > 0 && (
                    <>
                      <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-subtle">Captures d'écran</h2>
                      <div className="grid grid-cols-2 gap-4">
                        {game.screenshots.map((src, i) => (
                          <motion.button
                            key={src}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setLightbox(src)}
                            className="aspect-video cursor-zoom-in overflow-hidden rounded-xl ring-1 ring-line"
                          >
                            <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
                          </motion.button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <aside className="space-y-4">
                  <InfoCard game={game} />
                  {game.changelog[0] && (
                    <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-line">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">Dernière mise à jour</div>
                      <div className="text-sm font-semibold">v{game.changelog[0].version}</div>
                      <div className="mb-3 text-xs text-subtle">{formatDate(game.changelog[0].date)}</div>
                      <ChangelogNotes notes={game.changelog[0].notes} limit={3} />
                      <button onClick={() => setTab('changelog')} className="mt-3 text-xs font-medium text-accent-strong hover:underline">
                        Toutes les notes de version →
                      </button>
                    </div>
                  )}
                </aside>
              </div>
            ) : (
              <Changelog entries={game.changelog} installedVersion={installed?.version} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}

function Stat({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-subtle">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">{label}</div>
        <div className="font-medium tabular-nums text-fg/90">{children}</div>
      </div>
    </div>
  )
}

function InfoCard({ game }: { game: Game }) {
  const rows: [string, React.ReactNode][] = [
    ['Développeur', game.developer ?? '—'],
    ['Genres', game.genres.join(', ') || '—'],
    ['Version', `v${game.version}`],
    ['Taille', formatBytes(game.size)],
    ['Source', game.source === 'github' ? 'GitHub Releases' : 'Manifeste']
  ]
  return (
    <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-line">
      <dl className="space-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-subtle">{k}</dt>
            <dd className="text-right text-fg/90">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ChangelogNotes({ notes, limit }: { notes: ChangelogEntry['notes']; limit?: number }) {
  const lines = (Array.isArray(notes) ? notes : notes.split(/\r?\n/))
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((l) => l && !l.startsWith('#'))
  const shown = limit ? lines.slice(0, limit) : lines
  return (
    <ul className="space-y-1.5 text-sm leading-6 text-fg/75">
      {shown.map((l, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
          <span>{l}</span>
        </li>
      ))}
      {limit && lines.length > limit && <li className="text-xs text-subtle">+ {lines.length - limit} autre(s)</li>}
    </ul>
  )
}

function Changelog({ entries, installedVersion }: { entries: ChangelogEntry[]; installedVersion?: string }) {
  if (!entries.length) return <p className="text-sm text-muted">Aucune note de version.</p>
  return (
    <ol className="relative max-w-3xl border-l border-line pl-8">
      {entries.map((e, i) => (
        <motion.li
          key={e.version}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="relative pb-10"
        >
          <span
            className={`absolute -left-[37px] top-1 h-[11px] w-[11px] rounded-full ring-4 ring-bg ${i === 0 ? 'bg-accent' : 'bg-white/25'}`}
          />
          <div className="flex items-baseline gap-3">
            <h3 className="text-lg font-semibold">v{e.version}</h3>
            {e.date && <span className="text-xs text-subtle">{formatDate(e.date)}</span>}
            {installedVersion === e.version && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Installée
              </span>
            )}
          </div>
          <div className="mt-3">
            <ChangelogNotes notes={e.notes} />
          </div>
        </motion.li>
      ))}
    </ol>
  )
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.05] text-muted ring-1 ring-line transition hover:bg-white/10 hover:text-fg"
    >
      {children}
    </button>
  )
}

interface MenuItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <IconButton title="Plus d'options" onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={18} />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-[52px] z-20 w-64 origin-top-right rounded-xl bg-panel-3 p-1.5 shadow-2xl ring-1 ring-line-strong"
          >
            {items.map((it) => (
              <button
                key={it.label}
                disabled={it.disabled}
                data-testid={`menu-${it.label}`}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition disabled:pointer-events-none disabled:opacity-40 ${
                  it.danger ? 'text-danger hover:bg-danger/10' : 'text-fg/85 hover:bg-white/[0.06]'
                }`}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
