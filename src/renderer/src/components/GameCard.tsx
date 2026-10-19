import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import type { Game } from '@shared/types'
import { useLauncher } from '../store/launcher'
import { gameStatus, overallProgress, STATUS_LABEL } from '../lib/status'
import { formatBytes } from '../lib/format'
import { GameBanner, GameLogo } from './GameArt'

const CHIP: Record<string, string> = {
  installed: 'bg-white/10 text-fg',
  'update-available': 'bg-update/20 text-update',
  running: 'bg-success/20 text-success',
  installing: 'bg-accent/25 text-accent-strong',
  'not-installed': 'bg-black/40 text-muted',
  unavailable: 'bg-danger/15 text-danger'
}

export function GameCard({ game, index }: { game: Game; index: number }) {
  const snapshot = useLauncher((s) => s.snapshot)
  const navigate = useLauncher((s) => s.navigate)
  const setBackdrop = useLauncher((s) => s.setBackdrop)
  const launch = useLauncher((s) => s.launch)
  const status = gameStatus(game, snapshot)
  const progress = snapshot.installing[game.id]
  const installed = snapshot.installed[game.id]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onMouseEnter={() => setBackdrop(game.id)}
      onClick={() => navigate({ name: 'game', id: game.id })}
      data-testid={`game-card-${game.id}`}
      className="group relative cursor-pointer overflow-hidden rounded-[var(--radius-card)] bg-panel-2 ring-1 ring-line transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8),0_0_0_1px_var(--color-line-strong)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <GameBanner game={game} className="transition-transform duration-700 ease-[var(--ease-snappy)] group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel-2 via-panel-2/20 to-transparent" />
        <div className="absolute inset-x-5 bottom-3">
          <GameLogo game={game} className="h-14 max-w-[70%]" textClassName="text-2xl" />
        </div>
        <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${CHIP[status]}`}>
          {status === 'installing' && progress ? `${Math.round(overallProgress(progress) * 100)}%` : STATUS_LABEL[status]}
        </span>
        {status === 'installed' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              void launch(game.id)
            }}
            title="Jouer"
            className="absolute bottom-3 right-3 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-accent text-white opacity-0 shadow-lg shadow-accent/40 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:scale-110"
          >
            <Play size={18} fill="currentColor" className="ml-0.5" />
          </button>
        )}
      </div>

      <div className="px-5 pb-4 pt-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-[15px] font-semibold">{game.name}</h3>
          <span className="shrink-0 text-xs tabular-nums text-subtle">
            v{installed?.version ?? game.version}
            {status === 'update-available' && <span className="text-update"> → {game.version}</span>}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-muted">{game.tagline ?? game.description}</p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-subtle">
          {game.genres.slice(0, 2).map((g) => (
            <span key={g} className="rounded-md bg-white/5 px-2 py-0.5">
              {g}
            </span>
          ))}
          <span className="ml-auto tabular-nums">{formatBytes(game.size)}</span>
        </div>
      </div>

      {progress && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${overallProgress(progress) * 100}%` }} />
        </div>
      )}
    </motion.div>
  )
}
