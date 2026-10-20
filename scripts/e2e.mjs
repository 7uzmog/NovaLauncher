// Test de bout en bout : installer → annuler → reprise après coupure → jouer → mettre à jour → désinstaller.
// Pilote la vraie application Electron via Playwright. Prérequis : `npm run make:test-games` puis `npx electron-vite build`.
//
//   npm run e2e
//
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'
import { startServer } from './serve-test-games.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shots = join(root, 'e2e-shots')
mkdirSync(shots, { recursive: true })
const userData = mkdtempSync(join(tmpdir(), 'nova-e2e-'))
const gamesDir = join(userData, 'games')

let step = 0
const ok = (msg) => console.log(`  ✔ ${++step}. ${msg}`)
const fail = (msg) => {
  throw new Error(msg)
}

const server = await startServer({ port: 0, rateMBps: 12 })
const app = await electron.launch({
  args: [root],
  cwd: root,
  env: { ...process.env, NOVA_USER_DATA: userData, NOVA_DEMO_AUTOCLOSE: '3', ELECTRON_ENABLE_LOGGING: '0' }
})
const errors = []
app.process().stderr?.on('data', (d) => {
  const s = String(d)
  if (/error/i.test(s) && !/Autofill|DevTools|GPU|gpu_|cache/i.test(s)) errors.push(`[main] ${s.trim()}`)
})
const page = await app.firstWindow()
page.on('pageerror', (e) => errors.push(`[renderer] ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
await page.setViewportSize({ width: 1280, height: 780 }).catch(() => undefined)

let current = 'neon-runner'
const actionButton = () => page.getByTestId(`game-page-${current}`).getByTestId('action-button')
const status = () => actionButton().getAttribute('data-status', { timeout: 2000 }).catch(() => null)
async function waitStatus(expected, timeout = 60000) {
  const t0 = Date.now()
  for (;;) {
    const s = await status()
    if (s === expected) return
    if (Date.now() - t0 > timeout) fail(`statut attendu "${expected}", obtenu "${s}"`)
    await page.waitForTimeout(150)
  }
}
const shot = (name) => page.screenshot({ path: join(shots, `${name}.png`) })
const openGame = async (id) => {
  current = id
  await page.getByRole('button', { name: 'Bibliothèque' }).first().click()
  await page.getByTestId(`game-card-${id}`).click()
  await page.getByTestId(`game-page-${id}`).waitFor()
  await page.waitForTimeout(600) // fin de la transition de page
}
const installedVersion = (id) => page.evaluate(async (id) => (await window.api.library.get()).installed[id]?.version, id)

try {
  console.log(`userData de test : ${userData}\nserveur : ${server.url}\n`)

  // 1. Démarrage sur le manifeste local (file://)
  await page.getByTestId('game-card-neon-runner').waitFor({ timeout: 20000 })
  await page.waitForTimeout(1200)
  await shot('01-library')
  ok('Bibliothèque affichée depuis games.example.json (file://)')

  // 1b. Jeu en développement : fiche visible, aucun téléchargement possible
  const devCard = page.getByTestId('game-card-project-tempest')
  if ((await devCard.innerText()).indexOf('En développement') === -1) fail('badge « En développement » absent de la carte')
  if ((await page.getByTestId('sidebar-game-project-tempest').getAttribute('data-status')) !== 'development')
    fail('barre latérale : statut development attendu')
  const installedCount = (await page.locator('body').innerText()).match(/(\d+) installés?/)?.[1]
  if (installedCount !== '0') fail(`compteur « installé » attendu à 0, obtenu ${installedCount}`)
  await openGame('project-tempest')
  if ((await status()) !== 'development') fail('page du jeu : statut development attendu')
  if (!(await actionButton().isDisabled())) fail('le badge « En développement » ne doit pas être cliquable')
  const refused = await page.evaluate(() => window.api.games.install('project-tempest'))
  if (refused.ok) fail("l'installation d'un jeu en développement doit être refusée")
  if (existsSync(join(gamesDir, 'project-tempest'))) fail('dossier créé pour un jeu en développement')
  await shot('01b-dev-game')
  ok('Jeu en développement : badge, barre latérale grisée, installation refusée, autres jeux chargés')

  // 2. Bascule sur le serveur HTTP
  await page.evaluate((url) => window.api.settings.set({ manifestUrl: url }), `${server.url}/games.example.json`)
  await page.evaluate(() => window.api.library.refresh())
  const snap = await page.evaluate(() => window.api.library.get())
  if (snap.manifestError || !snap.games[0].downloadUrl.startsWith('http')) fail(`manifeste HTTP : ${snap.manifestError}`)
  ok('Manifeste HTTP chargé, URLs relatives résolues')

  // 3. Page du jeu + annulation
  await openGame('neon-runner')
  await shot('02-game-page')
  if ((await status()) !== 'not-installed') fail('Neon Runner devrait être non installé')
  await actionButton().click()
  await waitStatus('installing')
  await page.waitForTimeout(700)
  await shot('03-installing')
  await page.getByRole('button', { name: "Annuler l'installation" }).click()
  await waitStatus('not-installed')
  if (existsSync(join(gamesDir, 'neon-runner'))) fail('dossier créé malgré annulation')
  ok('Installation annulée proprement (rien installé)')

  // 4. Coupure réseau en plein téléchargement puis reprise (HTTP Range)
  await actionButton().click()
  await waitStatus('installing')
  await page.waitForTimeout(800)
  server.dropConnections()
  await waitStatus('not-installed', 20000)
  await page.waitForTimeout(300)
  await shot('04-network-error')
  const before = server.requests.length
  await actionButton().click()
  await waitStatus('installed', 90000)
  const resumed = server.requests.slice(before).find((r) => r.path.endsWith('.zip') && r.range && !r.range.startsWith('bytes=0-'))
  if (!resumed) fail('pas de requête Range : la reprise ne fonctionne pas')
  if (!existsSync(join(gamesDir, 'neon-runner', 'NeonRunner.exe'))) fail('exe non installé')
  if (existsSync(join(gamesDir, '.staging', 'neon-runner'))) fail('staging non nettoyé')
  await shot('05-installed')
  ok(`Téléchargement repris après coupure (${resumed.range}), SHA-256 vérifié, extrait`)

  // 5. Jouer
  await actionButton().click()
  await waitStatus('running', 10000)
  await shot('06-running')
  await waitStatus('installed', 20000)
  // Le launcher se réduit au lancement d'un jeu : on restaure la fenêtre (animations suspendues sinon).
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore())
  await page.waitForTimeout(300)
  const played = await page.evaluate(async () => (await window.api.library.get()).installed['neon-runner'])
  if (!played.lastPlayedAt) fail('lastPlayedAt non enregistré')
  ok(`Jeu lancé, détecté "En cours", fermeture détectée (${played.playTimeSeconds}s de jeu)`)

  // 6. Mise à jour via le manifeste v2
  await page.evaluate((url) => window.api.settings.set({ manifestUrl: url }), `${server.url}/games.example.v2.json`)
  await page.evaluate(() => window.api.library.refresh())
  await page.waitForTimeout(400)
  await waitStatus('update-available', 5000)
  await shot('07-update-available')
  await actionButton().click()
  await waitStatus('installing')
  await waitStatus('installed', 90000)
  if ((await installedVersion('neon-runner')) !== '1.1.0') fail('version non mise à jour')
  if (!existsSync(join(gamesDir, 'neon-runner', 'data', 'dlc-shibuya.pak'))) fail('nouveaux fichiers absents')
  ok('Mise à jour 1.0.0 → 1.1.0 appliquée (remplacement atomique)')

  // 7. Jeu dont le zip a un dossier parent unique
  await openGame('echoes-of-aether')
  await actionButton().click()
  await waitStatus('installed', 90000)
  if (!existsSync(join(gamesDir, 'echoes-of-aether', 'bin', 'EchoesOfAether.exe'))) fail('dossier parent non aplati')
  await page.getByRole('button', { name: 'Notes de version', exact: true }).click()
  await page.waitForTimeout(400)
  await shot('08-changelog')
  ok('Echoes of Aether installé (zip avec dossier parent aplati)')

  // 8. Désinstallation avec confirmation
  await openGame('neon-runner')
  await page.getByRole('button', { name: "Plus d'options" }).click()
  await page.getByTestId('menu-Désinstaller').click()
  await page.waitForTimeout(300)
  await shot('09-confirm-uninstall')
  await page.getByTestId('confirm-ok').click()
  await waitStatus('not-installed', 15000)
  if (existsSync(join(gamesDir, 'neon-runner'))) fail('dossier non supprimé')
  ok('Désinstallation confirmée, dossier supprimé')

  // 9. Écrans restants
  await page.getByRole('button', { name: 'Bibliothèque' }).first().click()
  await page.waitForTimeout(800)
  await shot('10-library-final')
  await page.getByRole('button', { name: 'Paramètres' }).first().click()
  await page.waitForTimeout(600)
  await shot('11-settings')
  const toggle = page.getByRole('switch', { name: "Fermer le launcher au lancement d'un jeu" })
  await toggle.click()
  await page.waitForTimeout(200)
  if (!(await page.evaluate(() => window.api.settings.get())).closeOnLaunch) fail('paramètre non enregistré')
  await toggle.click()
  await page.waitForTimeout(200)
  if ((await page.evaluate(() => window.api.settings.get())).closeOnLaunch) fail('paramètre non rétabli')
  ok('Paramètres affichés et persistés (electron-store)')

  if (errors.length) fail(`erreurs détectées :\n${errors.join('\n')}`)
  console.log(`\nE2E OK — captures dans ${shots}`)
} catch (err) {
  await shot('zz-failure').catch(() => undefined)
  console.error(`\n✘ E2E ÉCHEC : ${err.message}`)
  if (errors.length) console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await app.close().catch(() => undefined)
  await server.close()
  rmSync(userData, { recursive: true, force: true, maxRetries: 5 })
}
