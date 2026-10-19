import { net, protocol } from 'electron'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Protocole nova-asset:// : sert au renderer les images locales référencées par
 * un manifeste file://, limité aux dossiers autorisés.
 */
export const ASSET_SCHEME = 'nova-asset'

const allowedRoots = new Set<string>()
const norm = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p)

export function allowAssetRoot(dir: string): void {
  allowedRoots.add(norm(resolve(dir)) + sep)
}

export function toAssetUrl(filePath: string): string {
  return `${ASSET_SCHEME}://local/${encodeURIComponent(filePath)}`
}

export function registerAssetSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

export function handleAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, (request) => {
    const url = new URL(request.url)
    const filePath = resolve(decodeURIComponent(url.pathname.slice(1)))
    const lower = norm(filePath)
    const allowed = [...allowedRoots].some((root) => lower.startsWith(root))
    if (!allowed) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
