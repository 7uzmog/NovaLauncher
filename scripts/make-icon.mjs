// Rasterise le logo placeholder (SVG) en PNG 512x512 via Electron.
//   npx electron scripts/make-icon.mjs
// Remplacez build/icon.png et resources/icon.png par votre propre logo (PNG 512x512 minimum).
import { app, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a80ff"/><stop offset="1" stop-color="#5b3df5"/></linearGradient></defs>
  <rect x="16" y="16" width="480" height="480" rx="120" fill="url(#g)"/>
  <path d="M168 360V152l176 208V152" fill="none" stroke="#fff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  await win.loadURL(`data:text/html,<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="512" height="512"></body>`)
  await new Promise((r) => setTimeout(r, 500))
  const png = (await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })).resize({ width: 512, height: 512 }).toPNG()
  for (const dir of ['build', 'resources']) {
    mkdirSync(join(root, dir), { recursive: true })
    writeFileSync(join(root, dir, 'icon.png'), png)
  }
  console.log('icon.png écrit dans build/ et resources/')
  app.quit()
})
