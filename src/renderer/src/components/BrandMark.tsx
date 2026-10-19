import logo from '../assets/logo.png'

/**
 * Logo du launcher. Pour le changer : `npm run make:icon -- chemin/vers/icone.png`
 * (régénère aussi l'icône de l'exe et de l'installeur).
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return <img src={logo} width={size} height={size} alt="" draggable={false} className="shrink-0" />
}
