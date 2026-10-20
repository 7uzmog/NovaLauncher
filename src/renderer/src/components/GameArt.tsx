import { useEffect, useState } from 'react'
import type { Game } from '@shared/types'
import { initials, placeholderBanner, placeholderColors } from '../lib/placeholder'

export function GameBanner({ game, className = '' }: { game: Pick<Game, 'id' | 'banner' | 'name'>; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [game.banner])
  const src = game.banner && !failed ? game.banner : placeholderBanner(game.id)
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

export function GameIcon({ game, size = 36, className = '' }: { game: Game; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [game.icon])
  const { a, b } = placeholderColors(game.id)
  if (game.icon && !failed) {
    return (
      <img
        src={game.icon}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-[10px] object-cover ${className}`}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: size * 0.36 }}
      className={`grid shrink-0 place-items-center rounded-[10px] font-bold tracking-tight text-white/90 ${className}`}
    >
      {initials(game.name)}
    </div>
  )
}

/** Logo du jeu, ou son nom en grande typo si aucun logo n'est fourni (rien si la bannière porte déjà le titre). */
export function GameLogo({ game, className = '', textClassName = '' }: { game: Game; className?: string; textClassName?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [game.logo])
  if (game.hideTitle) return <h1 className="sr-only">{game.name}</h1>
  if (game.logo && !failed) {
    return (
      <img
        src={game.logo}
        alt={game.name}
        draggable={false}
        onError={() => setFailed(true)}
        className={`object-contain object-left drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] ${className}`}
      />
    )
  }
  return (
    <h1 className={`font-black uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.6)] ${textClassName}`}>
      {game.name}
    </h1>
  )
}
