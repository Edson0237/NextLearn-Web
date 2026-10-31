import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { LienProfond } from './core/partage/lien-profond';

/**
 * Un seul projet, un seul domaine : la vitrine et l'application PWA
 * partagent ce routeur (voir docs/pwa-migration/AUDIT_PHASE1.md, §0 - la
 * décision d'architecture et ce qu'elle implique).
 *
 * `/` est la page d'accueil publique : un seul but, mener le visiteur dans
 * l'application. Tout ce qui relève de l'application vit sous `/app` :
 * authentification, shell à cinq onglets, gardes de routage - voir
 * `app-shell.routes.ts` pour l'arbre complet (Phase 3).
 *
 * `loadChildren`, et non un import statique : quelqu'un qui ne visite
 * jamais l'application (la vitrine seule) ne doit pas payer son code -
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
  // Catalogue de composants : outil de travail, pas une page du produit. Il
  // restait accessible à quiconque devinait l'adresse en production, alors que
  // la Phase 2 le présentait déjà comme temporaire. `isDevMode()` le réserve
  // désormais au développement, sans rien retirer à l'équipe.
  ...(isDevMode()
    ? [
        {
          path: 'app/design-system',
          loadComponent: () =>
            import('./features/design-system/design-catalog/design-catalog').then(
              (m) => m.DesignCatalog,
            ),
        },
      ]
    : []),
  { path: 'app/', pathMatch: 'full', redirectTo: 'app' },
  // Lien partagé : `/d/<id>`, la forme exacte qu'émet l'application mobile
  // (`LienProfond.document`). La PWA ne la reconnaissait pas - un lien reçu
  // d'un camarade ne menait nulle part - et partageait de son côté une URL que
  // le téléphone, lui, ne savait pas ouvrir. Les deux plateformes émettent et
  // comprennent désormais le même lien.
  {
    path: `${LienProfond.segmentDocument}/:id`,
    loadComponent: () =>
      import('./features/partage/redirection-document').then((m) => m.RedirectionDocument),
  },
  {
    path: 'app',
    loadChildren: () =>
      import('./layout/app-shell/app-shell.routes').then((m) => m.APP_SHELL_ROUTES),
  },
  // Dernière de la liste, et c'est tout l'intérêt : sans elle, une navigation
  // vers un chemin non déclaré lève `NG04002` dans la console et n'affiche
  // rien - l'utilisateur reste sur l'écran précédent sans comprendre pourquoi
  // son clic n'a rien fait. Une erreur qu'on voit est une erreur qu'on corrige.
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
