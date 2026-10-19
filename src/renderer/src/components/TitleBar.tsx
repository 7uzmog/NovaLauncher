import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X, RefreshCcw } from 'lucide-react'
import { BRANDING } from '@shared/branding'
import { useLauncher } from '../store/launcher'
import { BrandMark } from './BrandMark'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const updater = useLauncher((s) => s.updater)

  useEffect(() => {
    void window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <header
      className="drag relative z-30 flex h-10 shrink-0 items-center justify-between border-b border-line bg-bg/60 pl-4 backdrop-blur-xl"
      onDoubleClick={() => window.api.window.toggleMaximize()}
    >
      <div className="flex items-center gap-2.5 text-[13px] font-semibold tracking-wide text-fg/90">
        <BrandMark size={18} />
        {BRANDING.name}
      </div>

      <div className="flex h-full items-center">
        {updater.state === 'downloaded' && (
          <button
            onClick={() => window.api.updater.install()}
            className="no-drag mr-3 flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success transition hover:bg-success/25"
          >
            <RefreshCcw size={12} /> Redémarrer pour mettre à jour ({updater.version})
          </button>
        )}
        <WinButton label="Réduire" onClick={() => window.api.window.minimize()}>
          <Minus size={15} />
        </WinButton>
        <WinButton label={maximized ? 'Restaurer' : 'Agrandir'} onClick={() => window.api.window.toggleMaximize()}>
          {maximized ? <Copy size={12} className="-scale-x-100" /> : <Square size={12} />}
        </WinButton>
        <WinButton label="Fermer" danger onClick={() => window.api.window.close()}>
          <X size={16} />
        </WinButton>
      </div>
    </header>
  )
}

function WinButton(props: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`no-drag grid h-full w-12 place-items-center text-muted transition-colors duration-150 ${
        props.danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-white/8 hover:text-fg'
      }`}
    >
      {props.children}
    </button>
  )
}
