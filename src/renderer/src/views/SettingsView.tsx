import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { FileJson, FolderOpen, Loader2, RotateCcw } from 'lucide-react'
import type { LauncherUpdateState } from '@shared/types'
import { BRANDING } from '@shared/branding'
import { useLauncher } from '../store/launcher'
import { Toggle } from '../components/Overlays'
import { formatRelative } from '../lib/format'

export function SettingsView() {
  const { settings, saveSettings, appInfo, updater, snapshot, refresh, toast } = useLauncher()
  const [manifestUrl, setManifestUrl] = useState(settings?.manifestUrl ?? '')
  const [token, setToken] = useState(settings?.githubToken ?? '')
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    setManifestUrl(settings?.manifestUrl ?? '')
    setToken(settings?.githubToken ?? '')
  }, [settings?.manifestUrl, settings?.githubToken])

  if (!settings) return null

  const applyManifest = async (url = manifestUrl) => {
    setReloading(true)
    await saveSettings({ manifestUrl: url.trim(), githubToken: token.trim() })
    await refresh()
    setReloading(false)
    if (!useLauncher.getState().snapshot.manifestError) toast({ kind: 'success', title: 'Catalogue mis à jour' })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-3xl px-10 pb-20 pt-10"
    >
      <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
      <p className="mt-1 text-sm text-muted">Les changements sont enregistrés automatiquement.</p>

      <Section title="Bibliothèque">
        <Row label="Dossier d'installation par défaut" hint="Les jeux déjà installés restent à leur emplacement actuel.">
          <div className="flex w-full items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-xs text-fg/80 ring-1 ring-line" title={settings.installDir}>
              {settings.installDir}
            </code>
            <SmallButton
              onClick={async () => {
                const dir = await window.api.settings.pickDirectory()
                if (dir) await saveSettings({ installDir: dir })
              }}
            >
              <FolderOpen size={14} /> Parcourir
            </SmallButton>
            {appInfo && settings.installDir !== appInfo.defaultInstallDir && (
              <SmallButton title="Rétablir le dossier par défaut" onClick={() => saveSettings({ installDir: appInfo.defaultInstallDir })}>
                <RotateCcw size={14} />
              </SmallButton>
            )}
          </div>
        </Row>
      </Section>

      <Section title="Comportement">
        <ToggleRow
          label="Lancer au démarrage de Windows"
          hint={appInfo?.isPackaged ? 'Le launcher démarre réduit.' : 'Actif uniquement dans la version installée.'}
          checked={settings.launchAtStartup}
          onChange={(v) => saveSettings({ launchAtStartup: v })}
        />
        <ToggleRow
          label="Fermer le launcher au lancement d'un jeu"
          hint="Sinon, le launcher est réduit pendant que vous jouez."
          checked={settings.closeOnLaunch}
          onChange={(v) => saveSettings({ closeOnLaunch: v })}
        />
        <ToggleRow
          label="Vérifier les mises à jour automatiquement"
          hint={`Jeux : toutes les ${BRANDING.updateCheckIntervalMinutes} min. Launcher : au démarrage.`}
          checked={settings.autoCheckUpdates}
          onChange={(v) => saveSettings({ autoCheckUpdates: v })}
        />
      </Section>

      <Section title="Source des jeux">
        <Row label="URL du manifeste (games.json)" hint={`Dernière lecture : ${formatRelative(snapshot.fetchedAt)}`}>
          <div className="flex w-full flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={manifestUrl}
                onChange={(e) => setManifestUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyManifest()}
                spellCheck={false}
                placeholder="https://…/games.json"
                className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-line transition focus:ring-accent"
              />
              <SmallButton
                title="Choisir un fichier local"
                onClick={async () => {
                  const file = await window.api.settings.pickManifestFile()
                  if (file) {
                    setManifestUrl(file)
                    await applyManifest(file)
                  }
                }}
              >
                <FileJson size={14} />
              </SmallButton>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                spellCheck={false}
                placeholder="Jeton GitHub (optionnel : dépôts privés / quota API)"
                className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-line transition focus:ring-accent"
              />
              <button
                onClick={() => applyManifest()}
                disabled={reloading}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
              >
                {reloading && <Loader2 size={14} className="animate-spin" />} Appliquer
              </button>
            </div>
            {snapshot.manifestError && <p className="text-xs text-danger">{snapshot.manifestError}</p>}
          </div>
        </Row>
      </Section>

      <Section title="Launcher">
        <Row label={`${appInfo?.name ?? BRANDING.name} v${appInfo?.version ?? '—'}`} hint={updaterLabel(updater)}>
          <div className="flex gap-2">
            {updater.state === 'downloaded' ? (
              <SmallButton accent onClick={() => window.api.updater.install()}>
                Redémarrer et installer
              </SmallButton>
            ) : (
              <SmallButton
                disabled={updater.state === 'disabled' || updater.state === 'checking' || updater.state === 'downloading'}
                onClick={() => window.api.updater.check()}
              >
                Rechercher une mise à jour
              </SmallButton>
            )}
          </div>
        </Row>
      </Section>
    </motion.div>
  )
}

function updaterLabel(s: LauncherUpdateState): string {
  switch (s.state) {
    case 'checking':
      return 'Recherche en cours…'
    case 'available':
      return `Version ${s.version} disponible, téléchargement…`
    case 'downloading':
      return `Téléchargement de la mise à jour : ${Math.round(s.percent)} %`
    case 'downloaded':
      return `Version ${s.version} prête à être installée.`
    case 'not-available':
      return 'Le launcher est à jour.'
    case 'error':
      return `Erreur : ${s.message}`
    case 'disabled':
      return `Mises à jour automatiques désactivées (${s.reason}).`
    default:
      return 'Mises à jour via GitHub Releases.'
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-subtle">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-line">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 px-5 py-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-subtle">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function ToggleRow(props: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div>
        <div className="text-sm font-medium">{props.label}</div>
        {props.hint && <div className="mt-0.5 text-xs text-subtle">{props.hint}</div>}
      </div>
      <Toggle checked={props.checked} onChange={props.onChange} label={props.label} />
    </div>
  )
}

function SmallButton(props: { onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean; accent?: boolean }) {
  return (
    <button
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition disabled:opacity-40 ${
        props.accent ? 'bg-accent text-accent-fg ring-transparent hover:bg-accent-strong' : 'bg-white/[0.05] text-fg/85 ring-line hover:bg-white/10'
      }`}
    >
      {props.children}
    </button>
  )
}
