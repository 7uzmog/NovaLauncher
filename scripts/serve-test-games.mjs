// Petit serveur HTTP statique pour tester le launcher "comme en ligne" :
// supporte les requêtes Range (reprise de téléchargement) et un débit bridé.
//
//   node scripts/serve-test-games.mjs [--port 8787] [--rate 8]   (rate en Mo/s, 0 = illimité)
//   puis, dans Paramètres → URL du manifeste : http://127.0.0.1:8787/games.example.json
//
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TYPES = { '.json': 'application/json', '.zip': 'application/zip', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' }

function allowed(rel) {
  return /^games\.example(\.v2)?\.json$/.test(rel) || rel.startsWith(`test-games${sep}dist${sep}`) || rel.startsWith(`test-games${sep}assets${sep}`)
}

export function startServer({ port = 8787, rateMBps = 0, log = () => {} } = {}) {
  const requests = []
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const rel = normalize(decodeURIComponent(url.pathname).replace(/^\/+/, ''))
    const file = join(root, rel)
    requests.push({ path: url.pathname, range: req.headers.range ?? null })
    log(`${req.method} ${url.pathname}${req.headers.range ? ` (${req.headers.range})` : ''}`)
    if (!allowed(rel) || !existsSync(file)) {
      res.writeHead(404).end('not found')
      return
    }
    const size = statSync(file).size
    let start = 0
    let end = size - 1
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')
    if (m) {
      start = Number(m[1])
      end = m[2] ? Number(m[2]) : size - 1
      if (start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end()
        return
      }
    }
    res.writeHead(m ? 206 : 200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      ...(m ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {})
    })
    const stream = createReadStream(file, { start, end, highWaterMark: 64 * 1024 })
    if (!rateMBps) {
      stream.pipe(res)
      return
    }
    // Débit bridé : on met le flux en pause entre deux blocs.
    const delay = (64 * 1024) / (rateMBps * 1024 * 1024) * 1000
    stream.on('data', (chunk) => {
      stream.pause()
      res.write(chunk)
      setTimeout(() => stream.resume(), delay)
    })
    stream.on('end', () => res.end())
    res.on('close', () => stream.destroy())
  })
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        requests,
        /** Coupe brutalement toutes les connexions (simule une perte réseau). */
        dropConnections: () => server.closeAllConnections(),
        close: () => new Promise((r) => { server.closeAllConnections(); server.close(r) })
      })
    )
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`)
    return i > 0 ? Number(process.argv[i + 1]) : def
  }
  const srv = await startServer({ port: arg('port', 8787), rateMBps: arg('rate', 0), log: console.log })
  console.log(`Serveur de test : ${srv.url}/games.example.json  (v2 : ${srv.url}/games.example.v2.json)`)
}
