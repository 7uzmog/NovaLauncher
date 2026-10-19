/** Visuels de remplacement déterministes (en attendant les vrais assets). */

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function placeholderColors(id: string): { a: string; b: string; c: string; hue: number } {
  const h = hash(id)
  const hue = h % 360
  const hue2 = (hue + 40 + ((h >> 9) % 80)) % 360
  return {
    hue,
    a: `hsl(${hue} 70% 46%)`,
    b: `hsl(${hue2} 75% 22%)`,
    c: `hsl(${(hue + 180) % 360} 80% 60%)`
  }
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

/** Bannière SVG abstraite (data URI) : dégradé, grille en perspective, halo. */
export function placeholderBanner(id: string): string {
  const { a, b, c, hue } = placeholderColors(id)
  const h = hash(id + 'x')
  const cx = 30 + (h % 40)
  const cy = 25 + ((h >> 5) % 30)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="r" cx="${cx}%" cy="${cy}%" r="55%"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
    <pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="white" stroke-opacity=".06" stroke-width="2"/></pattern>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <rect width="1600" height="900" fill="url(#p)" transform="skewX(-${10 + (h % 20)})"/>
  <rect width="1600" height="900" fill="url(#r)"/>
  <circle cx="${1100 + (h % 300)}" cy="${300 + ((h >> 3) % 200)}" r="${180 + (h % 120)}" fill="none" stroke="hsl(${hue} 90% 80%)" stroke-opacity=".18" stroke-width="3"/>
  <circle cx="${1100 + (h % 300)}" cy="${300 + ((h >> 3) % 200)}" r="${260 + (h % 120)}" fill="none" stroke="hsl(${hue} 90% 80%)" stroke-opacity=".08" stroke-width="2"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
