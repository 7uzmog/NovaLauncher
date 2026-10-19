import { createReadStream, createWriteStream } from 'node:fs'
import { stat, truncate } from 'node:fs/promises'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'

export interface DownloadOptions {
  url: string
  /** Fichier .part ; s'il existe déjà, le téléchargement reprend (HTTP Range). */
  dest: string
  signal: AbortSignal
  expectedSize?: number
  onProgress: (received: number, total: number) => void
}

async function existingSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

function counter(start: number, total: number, onProgress: DownloadOptions['onProgress']): Transform {
  let received = start
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length
      onProgress(received, total)
      cb(null, chunk)
    }
  })
}

/** Téléchargement en streaming vers le disque, avec reprise et annulation. */
export async function download(opts: DownloadOptions): Promise<void> {
  const { url, dest, signal, expectedSize, onProgress } = opts
  let offset = await existingSize(dest)
  if (expectedSize && offset > expectedSize) {
    await truncate(dest, 0)
    offset = 0
  }
  if (expectedSize && offset === expectedSize) {
    onProgress(offset, expectedSize)
    return
  }

  if (url.startsWith('file:')) {
    const src = fileURLToPath(url)
    const total = (await stat(src)).size
    if (offset >= total) offset = 0
    await pipeline(
      createReadStream(src, { start: offset, highWaterMark: 1 << 20 }),
      counter(offset, total, onProgress),
      createWriteStream(dest, { flags: offset > 0 ? 'a' : 'w' }),
      { signal }
    )
    return
  }

  const headers: Record<string, string> = { 'User-Agent': 'nova-launcher' }
  if (offset > 0) headers.Range = `bytes=${offset}-`
  const res = await fetch(url, { signal, headers, redirect: 'follow' })

  if (res.status === 416) {
    // Plage invalide : le fichier local est probablement complet ou corrompu, on repart de zéro.
    await truncate(dest, 0)
    return download({ ...opts })
  }
  if (!res.ok || !res.body) throw new Error(`Téléchargement impossible (HTTP ${res.status})`)

  const resumed = res.status === 206
  if (!resumed) offset = 0
  const length = Number(res.headers.get('content-length') ?? 0)
  const total = length ? offset + length : expectedSize ?? 0

  await pipeline(
    Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>),
    counter(offset, total, onProgress),
    createWriteStream(dest, { flags: resumed ? 'a' : 'w' }),
    { signal }
  )
}
