# Phase 2 — Design system (statut)

Ce que ce document décrit a été vérifié : build sans erreur ni avertissement,
21 tests Angular (12 fichiers) + 25 tests Node (`npm run test:site`), tous
verts, depuis une installation `npm ci` propre.

## Ce qui est fait

**Jetons** (`src/app/shared/styles/`), traduits sans arrondi depuis
`lib/app/theme/` (Flutter, source de vérité) :

- `_tokens.scss` — palette complète (clair + sombre, hex exacts), espacement
  base 4, rayons par rôle, cible tactile 48px, familles de police, durées et
  courbes de mouvement. Tout sous `.nl-app`, jamais sur `:root` — la vitrine
  garde sa propre palette dans `src/styles.scss`, les deux coexistent dans le
  même projet sans se mélanger (voir AUDIT_PHASE1.md, §0).
- `_type.scss` — l'échelle typographique complète d'`app_text_styles.dart`,
  en **mixins Sass**, pas en classes CSS partagées. Raison : une règle de
  classe (`.nl-h3 {...}`) ne traverse pas l'encapsulation de vues d'Angular —
  chaque composant compile son propre CSS scopé par un attribut qui lui est
  propre. Un mixin copie les propriétés au point d'inclusion, donc ne
  dépend d'aucun sélecteur partagé. Les variables CSS (`var(--primary)`),
  elles, n'ont pas ce problème : elles se propagent par héritage du DOM.
- `_fonts.scss` — Poppins/Inter/JetBrains Mono auto-hébergées. Les `.ttf` de
  `assets/fonts/` (projet Flutter) convertis en WOFF2 via `fontTools`
  (10 fichiers, voir `public/fonts/`) et chargées sans CDN, conformément à la
  Phase 5 du portage.
- `_native.scss` — règles « application native » : `100dvh`, safe-area,
  `touch-action: manipulation`, pas de surbrillance tactile générique, pas de
  rebond du document, cibles ≥ 48px, retour `:active`.
- `_motion.scss` — contrat `prefers-reduced-motion`, calqué sur
  `AppMotion.reduireLeMouvement` : coupe les durées à zéro, pas les
  transitions à mi-course.

**Composants** (`src/app/shared/ui/`), cinq sur les 21 recensés en Phase 1 —
voir « Ce qui reste » :

| Composant | Traduit de (Flutter) | Tests |
|---|---|---|
| `Button` | `ElevatedButtonTheme`/`OutlinedButtonTheme`/`TextButtonTheme` | 4 |
| `Chip` | `DocumentTypeChip` (`category_chip.dart`) | 3 |
| `Card` | surface générique (`AppRadius.md` + `shadowCard`) | — (trivial) |
| `Skeleton` | `ShimmerCard` | — (trivial) |
| `EmptyState` | `EmptyState` (`empty_state.dart`) | 3 |

**Architecture** : `App` est réduit à une coque de routage
(`<router-outlet />`). Le contenu qui y vivait directement — la vitrine —
est passé dans `features/vitrine/`, qui devient la route `''`. Une nouvelle
route `app/design-system` héberge la page de démonstration (Phase 2, point 6)
— comparaison visuelle avec l'application Flutter, bascule clair/sombre/
système en direct. 2 tests vérifient que les deux routes résolvent (sans
cette preuve, une régression de ce découpage serait silencieuse : Angular
résout les routes à l'exécution, pas à la compilation).

**`vercel.json`** : un rewrite `/app/(.*)` → `/index.html`, nécessaire
puisque `/app/design-system` est désormais une route cliente (pas un
fichier). Vérifié contre la documentation Vercel elle-même : le filesystem a
toujours priorité sur les rewrites, donc `/confidentialite/`,
`/conditions/` et `/suppression-compte/` continuent de servir leur propre
fichier statique, inchangés. **Un test local avec `serve -s` donne un faux
négatif sur ce point** (il sert la coquille Angular pour `/confidentialite/`
au lieu du fichier réel) — c'est un défaut de ce serveur de test précis, pas
du comportement réel de Vercel ; ne pas s'y fier pour vérifier ce point.

**Corrigé au passage** : cinq spécifications préexistantes de la vitrine
(`about`, `accueil`, `contact`, `equipe`, `fonctionnalite`) échouaient sur
`IntersectionObserver is not defined` — jsdom ne l'implémente pas. Sans
lien avec le portage, mais c'est la même suite qu'il faut garder verte.
`src/test-setup.ts` fournit un substitut inerte pour `IntersectionObserver`
et `window.matchMedia` (le second nécessaire pour tester `Vitrine` elle-même,
qui interroge `(pointer: fine)`).

## Ce qui reste (Phase 2)

16 des 21 composants recensés en Phase 1 ne sont pas encore portés :
`apparition_cascade`, `avatar_utilisateur`, `document_card`,
`ecran_erreur_fatale`, `ecran_sans_connexion`, `feuille_action`,
`feuille_selection`, `liste_rafraichissable`, `message_flottant`,
`nombre_anime`, `offline_banner`, `pin_input_widget`,
`reading_progress_bar`, `retour_haptique`, `squelette_document`,
`streak_badge`, `zone_pressable`. Aucun n'est bloquant pour démarrer la
Phase 3 (architecture/routage) — ils se portent au fil des écrans qui en ont
besoin, plutôt que tous d'un coup avant que rien ne les utilise.

Non traité : thème sombre de l'application (`AppTheme`/`ThemeModeNotifier`)
au-delà des jetons eux-mêmes — la bascule clair/sombre/système existe dans la
page de démonstration, mais aucune persistance du choix (équivalent de
`ThemeModeNotifier`, qui écrit dans Hive) n'est encore câblée côté web.

**Angular CDK n'a encore été introduit nulle part** — la recommandation de
l'audit Phase 1 (Q3 : SCSS custom + CDK plutôt qu'Angular Material/PrimeNG)
tient toujours, mais aucun des cinq composants livrés n'avait besoin de ses
primitives d'overlay/accessibilité. Il deviendra nécessaire pour
`feuille_action`/`feuille_selection` (bottom sheets) parmi les 16 restants.

## Comment vérifier

```
npm ci
npm run build       # ng build — doit finir sans avertissement
npm test            # @angular/build:unit-test (vitest) — 21 tests
npm run test:site   # node --test — 25 tests (pages légales + <head>)
```

La page de démonstration, une fois servie : `/app/design-system`.
