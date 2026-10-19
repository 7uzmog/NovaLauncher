// Génère les icônes du launcher à partir de votre image source (png, jpg ou webp, fond blanc accepté).
//
//   npm run make:icon                      (utilise assets-src/icon-source.*)
//   npm run make:icon -- chemin/vers/mon-icone.png
//
// Le fond blanc est retiré (halos néon conservés en semi-transparence). Produit :
//   build/icon.png                    512×512  icône de l'exe / installeur
//   resources/icon.png                256×256  icône de la fenêtre / barre des tâches
//   src/renderer/src/assets/logo.png  256×256  logo de l'UI
import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv.slice(2).find((a) => !a.startsWith('-') && !a.endsWith('make-icon.mjs'))
const source =
  (arg && resolve(arg)) ||
  readdirSync(join(root, 'assets-src'))
    .filter((f) => f.startsWith('icon-source.'))
    .map((f) => join(root, 'assets-src', f))[0]
if (!source || !existsSync(source)) {
  console.error('Image source introuvable. Placez-la dans assets-src/icon-source.png (ou passez son chemin).')
  process.exit(1)
}
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(source).toLowerCase()]

// Exécuté dans une page Electron (canvas) : détourage + recadrage + redimensionnement.
const pageScript = (dataUrl) => `(async () => {
  const img = new Image()
  img.src = ${JSON.stringify(dataUrl)}
  await img.decode()
  const W = img.naturalWidth, H = img.naturalHeight
  const base = document.createElement('canvas'); base.width = W; base.height = H
  const bctx = base.getContext('2d'); bctx.drawImage(img, 0, 0)
  const src = bctx.getImageData(0, 0, W, H).data

  const light = (i) => Math.min(src[i], src[i + 1], src[i + 2]) >= 200
  function flood(seeds) {
    const mask = new Uint8Array(W * H), stack = []
    for (const [x, y] of seeds) { const p = y * W + x; if (light(p * 4) && !mask[p]) { mask[p] = 1; stack.push(p) } }
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && !mask[q] && light(q * 4)) { mask[q] = 1; stack.push(q) }
      }
    }
    return mask
  }
  function dilate(mask, r) {
    let cur = mask
    for (let k = 0; k < r; k++) {
      const next = cur.slice()
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (cur[p]) continue
        if ((x > 0 && cur[p - 1]) || (x < W - 1 && cur[p + 1]) || (y > 0 && cur[p - W]) || (y < H - 1 && cur[p + W])) next[p] = 1
      }
      cur = next
    }
    return cur
  }
  // Retire le blanc en conservant les halos (algorithme "color to alpha").
  function render(mask) {
    const out = new ImageData(new Uint8ClampedArray(src), W, H), d = out.data
    for (let p = 0; p < W * H; p++) {
      if (!mask[p]) continue
      const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2]
      const a = Math.max(255 - r, 255 - g, 255 - b) / 255
      if (a <= 0.02) { d[i + 3] = 0; continue }
      d[i] = Math.round((r - 255 * (1 - a)) / a)
      d[i + 1] = Math.round((g - 255 * (1 - a)) / a)
      d[i + 2] = Math.round((b - 255 * (1 - a)) / a)
      d[i + 3] = Math.round(a * 255)
    }
    return out
  }
  function exportSquare(data, size) {
    const c = document.createElement('canvas'); c.width = W; c.height = H
    c.getContext('2d').putImageData(data, 0, 0)
    // Recadrage sur le contenu visible.
    let x0 = W, y0 = H, x1 = 0, y1 = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data.data[(y * W + x) * 4 + 3] > 10) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    const side = Math.max(x1 - x0, y1 - y0) * 1.04, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const o = document.createElement('canvas'); o.width = size; o.height = size
    const octx = o.getContext('2d'); octx.imageSmoothingQuality = 'high'
    octx.drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size)
    return o.toDataURL('image/png')
  }

  const border = []
  for (let x = 0; x < W; x += 2) border.push([x, 0], [x, H - 1])
  for (let y = 0; y < H; y += 2) border.push([0, y], [W - 1, y])
  const outer = dilate(flood(border), 4)
  // Zone blanche entre le cadre et le visuel central.
  const inside = []
  for (let t = 0.12; t <= 0.3; t += 0.02) inside.push([Math.round(W / 2), Math.round(H * t)], [Math.round(W * t), Math.round(H / 2)], [Math.round(W / 2), Math.round(H * (1 - t))])
  const inner = flood(inside)
  const both = dilate(outer.map((v, i) => v | inner[i]), 4)

  const ui = render(both)
  return { icon512: exportSquare(ui, 512), icon256: exportSquare(ui, 256), logo: exportSquare(ui, 256) }
})()`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL('about:blank')
  const dataUrl = `data:${mime};base64,${readFileSync(source).toString('base64')}`
  const res = await win.webContents.executeJavaScript(pageScript(dataUrl))
  const save = (rel, url) => {
    const out = join(root, rel)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'))
    console.log(`✔ ${rel}`)
  }
  save('build/icon.png', res.icon512)
  save('resources/icon.png', res.icon256)
  save('src/renderer/src/assets/logo.png', res.logo)
  app.quit()
})
