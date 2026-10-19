import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLauncher } from './store/launcher'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Backdrop } from './components/Backdrop'
import { ConfirmDialog, Toasts } from './components/Overlays'
import { LibraryView } from './views/LibraryView'
import { GameView } from './views/GameView'
import { SettingsView } from './views/SettingsView'

export function App() {
  const init = useLauncher((s) => s.init)
  const view = useLauncher((s) => s.view)
  const scrollRef = useRef<HTMLElement>(null)

  useEffect(() => {
    void init()
  }, [init])

  // Retour en haut à chaque changement de page.
  const key = view.name === 'game' ? `game:${view.id}` : view.name
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [key])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg">
      <Backdrop />
      <TitleBar />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        <main ref={scrollRef} className="scroll-area relative min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {view.name === 'library' && <LibraryView />}
              {view.name === 'game' && <GameView id={view.id} />}
              {view.name === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toasts />
      <ConfirmDialog />
    </div>
  )
}
