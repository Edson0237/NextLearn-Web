import { Routes } from '@angular/router';

/**
 * Un seul projet, un seul domaine : la vitrine et l'application PWA
 * partagent ce routeur (voir docs/pwa-migration/AUDIT_PHASE1.md, §0 — la
 * décision d'architecture et ce qu'elle implique).
 *
 * `/` reste la page vitrine, défilement d'ancres, inchangée dans son
 * fonctionnement. Tout ce qui relève de l'application vit sous `/app` :
 * authentification, shell à cinq onglets, gardes de routage — voir
 * `app-shell.routes.ts` pour l'arbre complet (Phase 3).
 *
 * `loadChildren`, et non un import statique : quelqu'un qui ne visite
 * jamais l'application (la vitrine seule) ne doit pas payer son code —
 * Phase 3, point 2 du portage (« routes lazy-loadées »), et Phase 5
 * (budget de performance) le demandent tout autant.
 *
 * `app/design-system` reste accessible en Phase 3/4 (comparaison visuelle
 * continue avec Flutter au fil des écrans) ; elle n'est pas destinée à
 * rester publique une fois la Phase 4 terminée.
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
  {
    path: 'app',
    loadChildren: () =>
      import('./features/app-shell/app-shell.routes').then((m) => m.APP_SHELL_ROUTES),
  },
];
