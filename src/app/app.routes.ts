import { Routes } from '@angular/router';

/**
 * Un seul projet, un seul domaine : la vitrine et l'application PWA
 * partagent ce routeur (voir docs/pwa-migration/AUDIT_PHASE1.md, §0 — la
 * décision d'architecture et ce qu'elle implique).
 *
 * `/` reste la page vitrine, défilement d'ancres, inchangée dans son
 * fonctionnement. Tout ce qui relève de l'application vit sous `/app` — la
 * Phase 3 y ajoutera l'authentification, le shell à cinq onglets et les
 * écrans. Pour l'instant, une seule route y existe : la page de
 * démonstration du design system (Phase 2, point 6), qui n'est pas destinée
 * à rester accessible publiquement une fois la Phase 4 commencée.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/vitrine/vitrine').then((m) => m.Vitrine),
  },
  {
    path: 'app/design-system',
    loadComponent: () =>
      import('./features/design-system/design-catalog/design-catalog').then(
        (m) => m.DesignCatalog,
      ),
  },
];
