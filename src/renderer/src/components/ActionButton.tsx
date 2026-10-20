import { AnimatePresence, motion } from 'motion/react'
import { Download, Hammer, Loader2, Play, RefreshCw, X, Ban } from 'lucide-react'
import type { Game } from '@shared/types'
import { useLauncher } from '../store/launcher'
import { gameStatus, overallProgress, PHASE_LABEL } from '../lib/status'
import { formatBytes, formatEta, formatSpeed } from '../lib/format'

/** Bouton principal contextuel : Installer / Jouer / Mettre à jour / progression / En cours. */
export function ActionButton({ game, size = 'lg' }: { game: Game; size?: 'lg' | 'sm' }) {
  const snapshot = useLauncher((s) => s.snapshot)
  const { install, launch, cancel } = useLauncher()
  const status = gameStatus(game, snapshot)
  const progress = snapshot.installing[game.id]
  const big = size === 'lg'
  const base = `relative overflow-hidden rounded-xl font-semibold transition-all duration-200 ${
    big ? 'h-14 min-w-[240px] px-8 text-[15px]' : 'h-10 min-w-[140px] px-5 text-sm'
  }`

  if (status === 'installing' && progress) {
    const pct = Math.round(overallProgress(progress) * 100)
    const label = progress.isUpdate ? 'Mise à jour' : 'Installation'
    const isDownloading = progress.phase === 'downloading'
    return (
      <div className="flex items-center gap-3">
        <div
          data-testid="action-button"
          data-status="installing"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`${base} flex flex-col justify-center bg-white/[0.06] ring-1 ring-line ${big ? 'w-[340px]' : 'w-[230px]'}`}>
          <motion.div
            className="shimmer absolute inset-y-0 left-0 overflow-hidden bg-accent/80"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ ease: 'easeOut', duration: 0.35 }}
          />
          <div className="relative flex items-center justify-between gap-3 whitespace-nowrap text-left">
            <span className="flex items-center gap-2 tabular-nums">
              <Loader2 size={big ? 16 : 14} className="animate-spin" />
              {label}… {pct}%
            </span>
            {big && <span className="text-xs font-medium text-white/70">{PHASE_LABEL[progress.phase]}</span>}
          </div>
        </div>
        <button
          onClick={() => cancel(game.id)}
          disabled={progress.phase === 'finalizing'}
          title="Annuler"
          aria-label="Annuler l'installation"
          className={`grid place-items-center rounded-xl bg-white/[0.06] text-muted ring-1 ring-line transition hover:bg-danger/20 hover:text-danger disabled:opacity-40 ${
            big ? 'h-14 w-14' : 'h-10 w-10'
          }`}
        >
          <X size={big ? 20 : 16} />
        </button>
        {big && (
          <div className="min-w-[150px] text-xs leading-5 text-muted tabular-nums">
            {isDownloading ? (
              <>
                <div>
                  {formatBytes(progress.receivedBytes)} / {formatBytes(progress.totalBytes)}
                </div>
                <div>
                  {formatSpeed(progress.speed)} · {formatEta(progress.eta)}
                </div>
              </>
            ) : (
              <div>{PHASE_LABEL[progress.phase]}…</div>
            )}
          </div>
        )}
      </div>
    )
  }

  const config = {
    'not-installed': {
      label: 'Installer',
      icon: <Download size={big ? 19 : 16} />,
      cls: 'bg-accent text-accent-fg hover:bg-accent-strong shadow-[0_10px_40px_-10px_var(--color-accent)]',
      onClick: () => install(game.id)
    },
    installed: {
      label: 'Jouer',
      icon: <Play size={big ? 19 : 16} fill="currentColor" />,
      cls: 'bg-accent text-accent-fg hover:bg-accent-strong shadow-[0_10px_40px_-8px_var(--color-accent)]',
      onClick: () => launch(game.id)
    },
    'update-available': {
      label: 'Mettre à jour',
      icon: <RefreshCw size={big ? 18 : 15} />,
      cls: 'bg-update text-black hover:brightness-110 shadow-[0_10px_40px_-10px_var(--color-update)]',
      onClick: () => install(game.id)
    },
    running: {
      label: 'En cours',
      icon: <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />,
      cls: 'bg-white/[0.06] text-fg ring-1 ring-success/40 cursor-default',
      onClick: undefined
    },
    unavailable: {
      label: 'Indisponible',
      icon: <Ban size={big ? 18 : 15} />,
      cls: 'bg-white/[0.05] text-subtle cursor-not-allowed',
      onClick: undefined
    },
    development: {
      label: 'En développement',
      icon: <Hammer size={big ? 18 : 15} />,
      cls: 'bg-accent/10 text-accent-strong ring-1 ring-accent/35 cursor-default',
      onClick: undefined
    },
    installing: {
      label: 'Préparation…',
      icon: <Loader2 size={16} className="animate-spin" />,
      cls: 'bg-white/[0.06] text-fg',
      onClick: undefined
    }
  }[status]

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.button
        key={status}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        whileHover={config.onClick ? { scale: 1.02 } : undefined}
        whileTap={config.onClick ? { scale: 0.97 } : undefined}
        disabled={!config.onClick}
        onClick={config.onClick}
        data-testid="action-button"
        data-status={status}
        className={`${base} flex items-center justify-center gap-2.5 ${config.cls}`}
      >
        {config.icon}
        {config.label}
        {big && status === 'not-installed' && game.size ? (
          <span className="font-medium opacity-70">· {formatBytes(game.size)}</span>
        ) : null}
      </motion.button>
    </AnimatePresence>
  )
}
