// Identité du launcher : nom affiché, URL du manifeste par défaut, dépôt des releases.
// Les couleurs sont dans src/renderer/src/theme.css.
export const BRANDING = {
  name: 'Nova Launcher',
  /** Manifeste par défaut en production (modifiable dans les Paramètres). */
  defaultManifestUrl: 'https://raw.githubusercontent.com/7uzmog/nova-games/main/games.json',
  /** Fréquence de vérification des mises à jour des jeux (minutes). */
  updateCheckIntervalMinutes: 30
} as const
