// Prépare la publication d'une version d'un jeu : zip du build, SHA-256, taille, mise à jour de games.json.
//
//   npm run package-game -- <dossier du build> --id mon-jeu --version 1.0.0 --exe MonJeu.exe [options]
//
// Options :
//   --name "Mon Jeu"            nom affiché (obligatoire pour un nouveau jeu)
//   --github compte/depot       le zip sera publié en release GitHub (URL calculée automatiquement)
//   --base-url https://…/       sinon : dossier en ligne où vous uploaderez le zip
//   --notes "Ajout X;Fix Y"     notes de version (séparées par ;)
//   --manifest games.json       manifeste à mettre à jour (créé s'il n'existe pas)
//
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import yazl from 'yazl'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i]
    else opts._.push(argv[i])
  }
  return opts
}

function die(msg) {
  console.error(`✘ ${msg}`)
  process.exit(1)
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

function zipFolder(folder, out) {
  return new Promise((res, rej) => {
    const zip = new yazl.ZipFile()
    for (const file of walk(folder)) zip.addFile(file, relative(folder, file).split(sep).join('/'))
    zip.outputStream.pipe(createWriteStream(out)).on('close', res).on('error', rej)
    zip.end()
  })
}

function sha256(file) {
  return new Promise((res, rej) => {
    const h = createHash('sha256')
    createReadStream(file).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej)
  })
}

const o = parseArgs(process.argv.slice(2))
const folder = o._[0] && resolve(o._[0])
if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) die('Indiquez le dossier du build du jeu en premier argument.')
if (!o.id || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(o.id)) die('--id requis (lettres, chiffres, - et _), ex. --id mon-jeu')
if (!o.version || !/^\d+\.\d+\.\d+/.test(o.version)) die('--version requis au format semver, ex. --version 1.0.0')

const manifestPath = resolve(root, o.manifest ?? 'games.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { games: [] }
const existing = manifest.games.find((g) => g.id === o.id)
const exe = o.exe ?? existing?.executable
if (!exe) die('--exe requis (chemin de l’exécutable dans le dossier, ex. --exe MonJeu.exe)')
if (!existsSync(join(folder, exe))) die(`Exécutable introuvable : ${join(folder, exe)}`)
if (!existing && !o.name) die('Nouveau jeu : --name "Nom du jeu" requis')

const outDir = join(root, 'publish')
mkdirSync(outDir, { recursive: true })
const zipName = `${o.id}-${o.version}.zip`
const zipPath = join(outDir, zipName)
console.log(`→ Compression de ${folder}…`)
await zipFolder(folder, zipPath)
const size = statSync(zipPath).size
const hash = await sha256(zipPath)

let downloadUrl
if (o.github) downloadUrl = `https://github.com/${o.github}/releases/download/v${o.version}/${zipName}`
else if (o['base-url']) downloadUrl = o['base-url'].replace(/\/?$/, '/') + zipName
else downloadUrl = existing?.downloadUrl ? existing.downloadUrl.replace(/[^/]*$/, zipName) : `https://VOTRE-HEBERGEMENT/${zipName}`

const notes = o.notes ? o.notes.split(';').map((s) => s.trim()).filter(Boolean) : ['Mise à jour']
const entry = {
  ...(existing ?? {
    id: o.id,
    name: o.name,
    tagline: '',
    description: '',
    developer: '',
    genres: [],
    icon: '',
    logo: '',
    banner: '',
    screenshots: []
  }),
  ...(o.name ? { name: o.name } : {}),
  version: o.version,
  downloadUrl,
  sha256: hash,
  size,
  executable: exe,
  changelog: [
    { version: o.version, date: new Date().toISOString().slice(0, 10), notes },
    ...(existing?.changelog ?? []).filter((c) => c.version !== o.version)
  ]
}
manifest.games = existing ? manifest.games.map((g) => (g.id === o.id ? entry : g)) : [...manifest.games, entry]
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

console.log(`
✔ ${relative(root, zipPath)}  (${(size / 1048576).toFixed(1)} Mo)
  sha256 : ${hash}
✔ ${relative(root, manifestPath)} mis à jour (${existing ? 'jeu existant' : 'nouveau jeu'} « ${entry.name} » v${o.version})

Étapes suivantes :`)
if (o.github) {
  console.log(`  1. gh release create v${o.version} "${zipPath}" --repo ${o.github} --title "v${o.version}" --notes "${notes.join(' / ')}"`)
} else {
  console.log(`  1. Uploadez ${zipName} pour qu'il soit accessible à : ${downloadUrl}`)
}
console.log(`  2. Publiez ${basename(manifestPath)} (ex. git add ${basename(manifestPath)} && git commit && git push)`)
if (!existing) console.log('  3. Complétez description, images (icon, logo, banner, screenshots) et genres dans le manifeste.')
