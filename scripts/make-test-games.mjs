// Génère deux jeux de test réels (exécutables Windows compilés avec le csc.exe de .NET Framework),
// leurs zips, leurs visuels SVG, puis écrit games.example.json (v1) et games.example.v2.json (mise à jour).
//
//   npm run make:test-games
//
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import yazl from 'yazl'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tg = join(root, 'test-games')
const build = join(tg, 'build')
const dist = join(tg, 'dist')
const assets = join(tg, 'assets')

const GAMES = [
  {
    id: 'neon-runner',
    name: 'Neon Runner',
    exe: 'NeonRunner.exe',
    colors: ['#ff2e88', '#3a0ca3'],
    hue: 320,
    versions: ['1.0.0', '1.1.0'],
    nested: null
  },
  {
    id: 'echoes-of-aether',
    name: 'Echoes of Aether',
    exe: 'bin/EchoesOfAether.exe',
    colors: ['#22d3ee', '#0b3d2e'],
    hue: 175,
    versions: ['2.3.0'],
    // Zip contenant un dossier parent unique : le launcher doit l'aplatir.
    nested: 'Echoes of Aether'
  }
]

function findCsc() {
  const candidates = [
    'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',
    'C:/Windows/Microsoft.NET/Framework/v4.0.30319/csc.exe'
  ]
  return candidates.find(existsSync)
}

function compile(game, version, out) {
  const csc = findCsc()
  if (!csc) throw new Error('csc.exe introuvable : ce script nécessite Windows avec .NET Framework 4.x')
  const src = readFileSync(join(tg, 'src', 'DemoGame.cs'), 'utf8')
    .replaceAll('__NAME__', game.name)
    .replaceAll('__VERSION__', version)
    .replaceAll('__COLOR_A__', game.colors[0])
    .replaceAll('__COLOR_B__', game.colors[1])
  const tmp = join(build, `${game.id}-${version}.cs`)
  writeFileSync(tmp, src, 'utf8')
  mkdirSync(dirname(out), { recursive: true })
  execFileSync(
    csc,
    ['/nologo', '/target:winexe', '/codepage:65001', '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', `/out:${out}`, tmp],
    { stdio: 'inherit' }
  )
}

function zipDir(files, outPath) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile()
    for (const [name, data] of files) {
      if (typeof data === 'string' && existsSync(data)) zip.addFile(data, name)
      else zip.addBuffer(Buffer.isBuffer(data) ? data : Buffer.from(data), name, { compress: !Buffer.isBuffer(data) })
    }
    zip.outputStream.pipe(createWriteStream(outPath)).on('close', resolve).on('error', reject)
    zip.end()
  })
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

// ---------- Visuels SVG (placeholders "réalistes") ----------
const banner = (g) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g.colors[1]}"/><stop offset="1" stop-color="#05060a"/></linearGradient>
    <radialGradient id="sun" cx="68%" cy="42%" r="40%"><stop offset="0" stop-color="${g.colors[0]}" stop-opacity=".95"/><stop offset="1" stop-color="${g.colors[0]}" stop-opacity="0"/></radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g.colors[0]}" stop-opacity=".7"/><stop offset="1" stop-color="${g.colors[0]}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#g)"/>
  <rect width="1920" height="1080" fill="url(#sun)"/>
  <circle cx="1300" cy="460" r="210" fill="${g.colors[0]}" opacity=".85"/>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="1060" y="${470 + i * 26}" width="480" height="${6 + i * 2}" fill="${g.colors[1]}"/>`).join('')}
  <path d="M0 720 L320 540 L520 650 L760 480 L1000 700 L1200 620 L1500 720 L1920 560 L1920 1080 L0 1080Z" fill="#05060a" opacity=".85"/>
  <g stroke="url(#floor)" stroke-width="2" opacity=".8">
    ${Array.from({ length: 13 }, (_, i) => `<line x1="${960 + (i - 6) * 60}" y1="760" x2="${960 + (i - 6) * 420}" y2="1080"/>`).join('')}
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${780 + i * i * 9}" x2="1920" y2="${780 + i * i * 9}"/>`).join('')}
  </g>
</svg>`

const logo = (g) => {
  // Taille de police adaptée à la longueur du nom pour ne jamais déborder.
  const fontSize = Math.min(150, Math.floor(1150 / (g.name.length * 0.68)))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240">
  <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${g.colors[0]}"/></linearGradient></defs>
  <text x="0" y="${60 + fontSize * 0.72}" font-family="Segoe UI, Arial Black, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="-3" fill="url(#t)">${g.name.toUpperCase()}</text>
  <rect x="4" y="${80 + fontSize * 0.8}" width="260" height="10" rx="5" fill="${g.colors[0]}"/>
</svg>`
}

const icon = (g) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><linearGradient id="i" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g.colors[0]}"/><stop offset="1" stop-color="${g.colors[1]}"/></linearGradient></defs>
  <rect width="256" height="256" rx="56" fill="url(#i)"/>
  <text x="128" y="170" text-anchor="middle" font-family="Segoe UI, Arial Black, sans-serif" font-weight="900" font-size="120" fill="#fff">${g.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</text>
</svg>`

const screenshot = (g, n) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <defs><linearGradient id="s" x1="0" y1="0" x2="${n % 2}" y2="1"><stop offset="0" stop-color="${g.colors[1]}"/><stop offset="1" stop-color="#05060a"/></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#s)"/>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="${80 + i * 130}" y="${520 - ((i * 37 * (n + 1)) % 260)}" width="90" height="${200 + ((i * 37 * (n + 1)) % 260)}" rx="6" fill="${g.colors[0]}" opacity="${0.25 + (i % 3) * 0.2}"/>`).join('')}
  <circle cx="${300 + n * 280}" cy="220" r="70" fill="#fff" opacity=".9"/>
  <text x="40" y="680" font-family="Segoe UI, sans-serif" font-size="28" fill="#fff" opacity=".6">${g.name} — capture ${n + 1}</text>
</svg>`

const CHANGELOGS = {
  'neon-runner': [
    {
      version: '1.1.0',
      date: '2026-10-12',
      notes: ['Nouveau niveau : Les Toits de Shibuya', 'Mode chrono avec classement local', 'Correction du saut mural sur les écrans 144 Hz']
    },
    {
      version: '1.0.0',
      date: '2026-09-01',
      notes: ['Sortie initiale', '12 niveaux, 3 personnages jouables', 'Support manette Xbox et PlayStation']
    }
  ],
  'echoes-of-aether': [
    {
      version: '2.3.0',
      date: '2026-10-05',
      notes: ['Nouvelle zone : la Forêt Suspendue', 'Refonte de l’arbre de talents', 'Sauvegarde automatique toutes les 5 minutes']
    },
    { version: '2.2.0', date: '2026-08-20', notes: ['Ajout du mode photo', 'Optimisations : +20 % d’images par seconde'] }
  ]
}

const META = {
  'neon-runner': {
    tagline: 'Course effrénée sur les toits d’une mégalopole synthwave.',
    description:
      'Neon Runner est un jeu de plateforme nerveux où chaque seconde compte. Sautez, glissez et courez sur les murs à travers une ville baignée de néons.\n\nMaîtrisez le flow, enchaînez les combos et battez vos propres records en mode chrono.',
    developer: 'Studio Nova',
    genres: ['Action', 'Plateforme']
  },
  'echoes-of-aether': {
    tagline: 'Un RPG contemplatif dans un monde suspendu entre ciel et brume.',
    description:
      'Explorez les îles flottantes d’Aether, percez le secret des Échos et façonnez votre propre chemin grâce à un arbre de talents en constante évolution.\n\nUne aventure narrative d’une vingtaine d’heures, avec une bande-son originale.',
    developer: 'Studio Nova',
    genres: ['RPG', 'Aventure']
  }
}

// Jeu « en développement » : fiche seule, sans build ni visuels (placeholders).
const DEV_GAME = {
  id: 'project-tempest',
  name: 'Project Tempest',
  status: 'development',
  tagline: 'Prochainement : un jeu de tempêtes et de voiliers.',
  description: 'Jeu en cours de développement. Aucune version téléchargeable pour l’instant.',
  developer: 'Studio Nova',
  genres: ['Aventure', 'Navigation']
}

async function main() {
  rmSync(build, { recursive: true, force: true })
  mkdirSync(build, { recursive: true })
  mkdirSync(dist, { recursive: true })
  mkdirSync(assets, { recursive: true })

  const builtVersions = {}
  for (const g of GAMES) {
    writeFileSync(join(assets, `${g.id}-banner.svg`), banner(g))
    writeFileSync(join(assets, `${g.id}-logo.svg`), logo(g))
    writeFileSync(join(assets, `${g.id}-icon.svg`), icon(g))
    for (let n = 0; n < 3; n++) writeFileSync(join(assets, `${g.id}-shot${n + 1}.svg`), screenshot(g, n))

    for (const version of g.versions) {
      const exeOut = join(build, `${g.id}-${version}`, g.exe)
      console.log(`→ compile ${g.name} ${version}`)
      compile(g, version, exeOut)
      const prefix = g.nested ? `${g.nested}/` : ''
      // Données incompressibles pour avoir un téléchargement de taille réaliste (~20-30 Mo).
      const files = [
        [prefix + g.exe, exeOut],
        [prefix + 'README.txt', `${g.name} ${version}\nJeu de démonstration généré pour Nova Launcher.\n`],
        [prefix + 'data/core.pak', randomBytes(18 * 1024 * 1024)]
      ]
      if (version !== g.versions[0]) files.push([prefix + 'data/dlc-shibuya.pak', randomBytes(6 * 1024 * 1024)])
      const zipPath = join(dist, `${g.id}-${version}.zip`)
      await zipDir(files, zipPath)
      builtVersions[`${g.id}@${version}`] = { zipPath, size: statSync(zipPath).size, sha256: sha256(zipPath) }
      console.log(`  ${relative(root, zipPath)}  ${(statSync(zipPath).size / 1048576).toFixed(1)} Mo`)
    }
  }

  const manifestFor = (pick) => ({
    launcher: { name: 'Nova Launcher' },
    games: GAMES.map((g) => {
      const version = pick(g)
      const built = builtVersions[`${g.id}@${version}`]
      return {
        id: g.id,
        name: g.name,
        ...META[g.id],
        icon: `test-games/assets/${g.id}-icon.svg`,
        logo: `test-games/assets/${g.id}-logo.svg`,
        banner: `test-games/assets/${g.id}-banner.svg`,
        screenshots: [1, 2, 3].map((n) => `test-games/assets/${g.id}-shot${n}.svg`),
        version,
        downloadUrl: relative(root, built.zipPath).replaceAll('\\', '/'),
        sha256: built.sha256,
        size: built.size,
        executable: g.exe,
        changelog: CHANGELOGS[g.id].filter((c) => c.version <= version || g.id !== 'neon-runner')
      }
    }).concat(DEV_GAME)
  })

  writeFileSync(join(root, 'games.example.json'), JSON.stringify(manifestFor((g) => g.versions[0]), null, 2) + '\n')
  writeFileSync(join(root, 'games.example.v2.json'), JSON.stringify(manifestFor((g) => g.versions.at(-1)), null, 2) + '\n')
  console.log('\n✔ games.example.json (Neon Runner 1.0.0) et games.example.v2.json (Neon Runner 1.1.0) écrits.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
