import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const CLE_STOCKAGE = 'nl_theme_mode';

/**
 * Préférence d'apparence, conservée entre deux visites — traduction de
 * `ThemeModeNotifier` (`lib/app/theme/theme_mode_provider.dart`).
 *
 * `localStorage` et non un cookie : ce n'est pas une donnée sensible comme
 * un jeton (voir `AUDIT_PHASE1.md`, §2, où ce choix est refusé) — un
 * réglage d'apparence ne vaut rien à voler.
 *
 * Lue de façon synchrone à la construction, comme côté Flutter (« lire la
 * boîte Hive est synchrone, donc l'app n'affiche jamais le thème clair une
 * fraction de seconde avant de basculer ») : `localStorage.getItem` est
 * lui aussi synchrone, la même garantie tient sans effort supplémentaire.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.lire());

  private lire(): ThemeMode {
    try {
      const stocke = localStorage.getItem(CLE_STOCKAGE);
      return stocke === 'light' || stocke === 'dark' ? stocke : 'system';
    } catch {
      // Un réglage d'apparence n'est pas critique : boîte illisible
      // (navigation privée, stockage bloqué), on repart sur « Système ».
      return 'system';
    }
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(CLE_STOCKAGE, mode);
    } catch {
      // Le choix reste appliqué pour la session en cours ; il ne sera
      // simplement pas retenu à la prochaine visite.
    }
  }

  /** `null` pour "système" — l'absence de l'attribut `data-theme` laisse
   * `prefers-color-scheme` décider, exactement le contrat de `_tokens.scss`. */
  attribute(): 'light' | 'dark' | null {
    const m = this.mode();
    return m === 'system' ? null : m;
  }
}
