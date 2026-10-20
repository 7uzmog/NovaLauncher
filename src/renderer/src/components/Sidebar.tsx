import { motion } from 'motion/react'
import { LayoutGrid, RefreshCw, Settings } from 'lucide-react'
import { useState } from 'react'
import type { Game } from '@shared/types'
import { useLauncher, type View } from '../store/launcher'
import { gameStatus, overallProgress } from '../lib/status'
import { GameIcon } from './GameArt'

export function Sidebar() {
  const { snapshot, view, navigate, refresh, appInfo, setBackdrop } = useLauncher()
  const [spinning, setSpinning] = useState(false)

  const onRefresh = async () => {
    setSpinning(true)
    await refresh().finally(() => setTimeout(() => setSpinning(false), 400))
  }

  return (
    <aside className="glass relative z-20 flex w-64 shrink-0 flex-col border-r border-line">
      <nav className="space-y-1 p-3">
        <NavItem view={{ name: 'library' }} current={view} onClick={navigate} icon={<LayoutGrid size={17} />}>
          Bibliothèque
        </NavItem>
        <NavItem view={{ name: 'settings' }} current={view} onClick={navigate} icon={<Settings size={17} />}>
          Paramètres
        </NavItem>
      </nav>

      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          Mes jeux · {snapshot.games.length}
        </span>
        <button
          onClick={onRefresh}
          title="Actualiser le catalogue"
          className="rounded-md p-1 text-subtle transition hover:bg-white/5 hover:text-fg"
        >
          <RefreshCw size={13} className={spinning ? 'animate-spin' : ''} />
        </button>
      </div>

      <div
        className="scroll-area flex-1 space-y-0.5 px-2 pb-3"
        onMouseLeave={() => setBackdrop(view.name === 'game' ? view.id : null)}
      >
        {snapshot.games.map((g) => (
          <SidebarGame
            key={g.id}
            game={g}
            active={view.name === 'game' && view.id === g.id}
            onClick={() => navigate({ name: 'game', id: g.id })}
          />
        ))}
        {snapshot.games.length === 0 && (
          <p className="px-3 py-4 text-xs leading-relaxed text-subtle">
            Aucun jeu. Vérifiez l’URL du manifeste dans les Paramètres.
          </p>
        )}
      </div>

      <div className="border-t border-line px-5 py-3 text-[11px] text-subtle">
        v{appInfo?.version ?? '—'}
        {snapshot.manifestError && <span className="ml-2 text-danger">· hors-ligne</span>}
      </div>
    </aside>
  )
}

function NavItem(props: {
  view: View
  current: View
  onClick: (v: View) => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const active = props.current.name === props.view.name
  return (
    <button
      onClick={() => props.onClick(props.view)}
      className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
      }`}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-line"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <span className="relative">{props.icon}</span>
      <span className="relative">{props.children}</span>
    </button>
  )
}

function SidebarGame({ game, active, onClick }: { game: Game; active: boolean; onClick: () => void }) {
  const snapshot = useLauncher((s) => s.snapshot)
  const setBackdrop = useLauncher((s) => s.setBackdrop)
  const status = gameStatus(game, snapshot)
  const progress = snapshot.installing[game.id]

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setBackdrop(game.id)}
      data-testid={`sidebar-game-${game.id}`}
      data-status={status}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
        active ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
      }`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent" />}
      <GameIcon
        game={game}
        size={34}
        className={`transition ${
          status === 'development'
            ? 'opacity-45 grayscale'
            : status === 'not-installed' || status === 'unavailable'
              ? 'opacity-60 grayscale-[40%]'
              : ''
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] font-medium ${status === 'development' && !active ? 'text-subtle' : ''}`}>
          {game.name}
        </div>
        {progress ? (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${overallProgress(progress) * 100}%` }}
            />
          </div>
        ) : (
          <div className="truncate text-[11px] text-subtle">
            {status === 'running' && <span className="text-success">En cours</span>}
            {status === 'update-available' && <span className="text-update">Mise à jour disponible</span>}
            {status === 'installed' && 'Installé'}
            {status === 'not-installed' && 'Non installé'}
            {status === 'unavailable' && 'Indisponible'}
            {status === 'development' && 'En développement'}
          </div>
        )}
      </div>
      {status === 'running' && <span className="h-2 w-2 animate-pulse rounded-full bg-success" />}
      {status === 'update-available' && <span className="h-2 w-2 rounded-full bg-update" />}
    </button>
  )
}
