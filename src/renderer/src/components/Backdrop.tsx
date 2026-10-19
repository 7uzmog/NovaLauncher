import { AnimatePresence, motion } from 'motion/react'
import { useLauncher } from '../store/launcher'
import { GameBanner } from './GameArt'

/** Bannière floutée du jeu sélectionné, en fond de toute l'application. */
export function Backdrop() {
  const games = useLauncher((s) => s.snapshot.games)
  const backdropId = useLauncher((s) => s.backdropId)
  const game = games.find((g) => g.id === backdropId) ?? games[0]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {game && (
          <motion.div
            key={game.id}
            className="absolute -inset-16"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 0.55, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <GameBanner game={game} className="blur-[60px] saturate-150" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_0%,var(--color-bg)_75%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/70 to-bg" />
    </div>
  )
}
