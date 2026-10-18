/**
 * Illustrations d'écran vide — copiées de `assets/illustrations/*.svg`
 * (projet Flutter), dessinées en `currentColor` pour se teinter à
 * l'affichage : la même image sert en thème clair et en thème sombre, et
 * un état d'erreur peut emprunter le rouge sans fichier séparé — même
 * principe que côté Flutter (voir `empty_state.dart`).
 *
 * Inlinées en TypeScript plutôt que chargées en `<img>` : un `<img>` ne
 * laisse pas `currentColor` s'appliquer au contenu de l'image. Cinq
 * fichiers de moins de 1 Ko chacun ne justifient pas une requête HTTP et
 * une étape de désinfection HTML pour les obtenir.
 */
export const ILLUSTRATION_PATHS: Readonly<Record<string, { viewBox: string; markup: string }>> = {
  erreur_reseau: { viewBox: '0 0 160 120', markup: '<path d="M44 62a50 50 0 0 1 72 0" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".25"/> <path d="M56 74a33 33 0 0 1 48 0" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".5"/> <path d="M68 86a16 16 0 0 1 24 0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/> <circle cx="80" cy="98" r="4" fill="currentColor"/> <path d="M112 34L136 58M136 34L112 58" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' },
  vide_documents: { viewBox: '0 0 160 120', markup: '<rect x="28" y="26" width="74" height="66" rx="8" stroke="currentColor" stroke-width="3" opacity=".25"/> <rect x="42" y="18" width="74" height="66" rx="8" stroke="currentColor" stroke-width="3" opacity=".5"/> <rect x="56" y="34" width="74" height="66" rx="8" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-width="3"/> <path d="M70 54h46M70 66h32M70 78h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".45"/>' },
  vide_favoris: { viewBox: '0 0 160 120', markup: '<path d="M56 22h48a6 6 0 0 1 6 6v70l-30-20-30 20V28a6 6 0 0 1 6-6z" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/> <path d="M70 50h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7" opacity=".5"/> <path d="M34 40h10M116 40h10" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".25"/>' },
  vide_hors_ligne: { viewBox: '0 0 160 120', markup: '<path d="M50 74a16 16 0 0 1 2-32 22 22 0 0 1 42-4 15 15 0 0 1 4 36H50z" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/> <path d="M80 62v30M70 84l10 10 10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>' },
  vide_recherche: { viewBox: '0 0 160 120', markup: '<circle cx="70" cy="52" r="28" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-width="3"/> <path d="M91 73l22 22" stroke="currentColor" stroke-width="4" stroke-linecap="round"/> <path d="M61 43l18 18M79 43l-18 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".45"/>' },
};

export type IllustrationName = keyof typeof ILLUSTRATION_PATHS;
