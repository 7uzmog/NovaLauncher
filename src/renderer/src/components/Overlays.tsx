import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { useLauncher } from '../store/launcher'

export function ConfirmDialog() {
  const confirm = useLauncher((s) => s.confirm)
  const close = useLauncher((s) => s.closeConfirm)

  useEffect(() => {
    if (!confirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, close])

  return (
    <AnimatePresence>
      {confirm && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => close(false)}
        >
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[440px] rounded-2xl bg-panel-2 p-6 shadow-2xl ring-1 ring-line-strong"
          >
            <div className="flex gap-4">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${confirm.danger ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'}`}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold">{confirm.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">{confirm.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-fg"
              >
                Annuler
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                data-testid="confirm-ok"
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  confirm.danger ? 'bg-danger hover:brightness-110' : 'bg-accent hover:bg-accent-strong'
                }`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const ICONS = {
  info: <Info size={18} className="text-accent" />,
  success: <CheckCircle2 size={18} className="text-success" />,
  error: <XCircle size={18} className="text-danger" />
}

export function Toasts() {
  const toasts = useLauncher((s) => s.toasts)
  const dismiss = useLauncher((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[360px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="glass pointer-events-auto flex gap-3 rounded-xl p-3.5 shadow-2xl ring-1 ring-line-strong"
          >
            <div className="mt-0.5">{ICONS[t.kind]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.message && <div className="mt-0.5 break-words text-xs leading-5 text-muted">{t.message}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="self-start rounded p-0.5 text-subtle hover:text-fg">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])
  return (
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/85 p-12 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.img
            src={src}
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="max-h-full max-w-full rounded-xl shadow-2xl ring-1 ring-line-strong"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-white/12'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow ${checked ? 'right-1' : 'left-1'}`}
      />
    </button>
  )
}
