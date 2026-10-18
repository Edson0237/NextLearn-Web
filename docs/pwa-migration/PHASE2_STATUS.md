# Phase 2 — Design system (statut : terminée)

Les 21 composants recensés en Phase 1 sont portés, ainsi que la persistance
du thème. Vérifié : build sans erreur ni avertissement (hors un seul budget
de style sur la page de démonstration elle-même, expliqué plus bas), 48 tests
Angular (21 fichiers) + 25 tests Node (`npm run test:site`), tous verts,
depuis une installation `npm ci` propre.

## Jetons (`src/app/shared/styles/`)

Traduits sans arrondi depuis `lib/app/theme/` (Flutter, source de vérité) :

- `_tokens.scss` — palette complète (clair + sombre, hex exacts), espacement
  base 4, rayons par rôle, cible tactile 48px, familles de police, durées et
  courbes de mouvement. Tout sous `.nl-app`, jamais sur `:root` — la vitrine
  garde sa propre palette dans `src/styles.scss` ; les deux coexistent dans le
  même projet sans se mélanger (voir AUDIT_PHASE1.md, §0).
- `_type.scss` — l'échelle typographique complète d'`app_text_styles.dart`,
  en **mixins Sass**, pas en classes CSS partagées : une règle de classe
  (`.nl-h3 {...}`) ne traverse pas l'encapsulation de vues d'Angular, chaque
  composant compile son propre CSS scopé par un attribut qui lui est propre.
  Un mixin copie les propriétés au point d'inclusion. Les variables CSS
  (`var(--primary)`), elles, n'ont pas ce problème : elles se propagent par
  héritage du DOM.
- `_fonts.scss` — Poppins/Inter/JetBrains Mono auto-hébergées. Les `.ttf` de
  `assets/fonts/` (projet Flutter) convertis en WOFF2 via `fontTools`
  (10 fichiers, servis depuis `public/fonts/`) — pas de CDN, conformément à
  la Phase 5 du portage.
- `_native.scss` — règles « application native » : `100dvh`, safe-area,
  `touch-action: manipulation`, pas de surbrillance tactile générique, pas de
  rebond du document, cibles ≥ 48px, retour `:active`.
- `_motion.scss` — contrat `prefers-reduced-motion`, calqué sur
  `AppMotion.reduireLeMouvement` : coupe les durées à zéro, pas les
  transitions à mi-course. Porte aussi l'entrée en cascade (`CascadeEnter`).

## Icônes et illustrations — une décision prise en cours de route

Le prompt de portage demande de reprendre les icônes Flutter. L'audit Phase 1
avait sous-estimé le sujet : Flutter en utilise 302 occurrences
(`Icons.xxx`), et la police web correspondante (Material Symbols) pèse
5,4 Mo. Son découpage automatique (`pyftsubset`) a été essayé puis
abandonné : sur une police à ligatures, la fermeture des règles de
substitution se recoupe tellement que le sous-ensemble ne perdait presque
rien (6647 → 5869 glyphes pour 28 icônes demandées) — un problème documenté
de cet outil sur ce type de police, pas une erreur de configuration.

Choix retenu : 29 icônes extraites individuellement depuis
`@material-symbols/svg-400` (un tracé SVG par icône) et inlinées dans
`icon-paths.ts` — quelques kilo-octets au total, aucune requête, aucun
risque de glyphe manquant. La variante (pleine ou contour) suit le nom
Flutter d'origine : `_outline`/`_outlined` → contour, sinon pleine. Trois
noms n'existent plus sous leur appellation classique dans Material
Symbols et ont été remplacés par leur équivalent visuel le plus proche :
`insert_drive_file` → `draft`, `report_problem` → `warning`,
`clear` → `close` (Material Symbols a fusionné les deux).

Les 5 illustrations d'écran vide (`assets/illustrations/*.svg`, dessinées en
`currentColor`) sont copiées dans `public/illustrations/` et inlinées de la
même façon (`illustration-paths.ts`) — un `<img>` empêcherait la teinte
`currentColor` de s'appliquer.

## Composants (`src/app/shared/ui/`, `src/app/shared/directives/`, `src/app/shared/services/`)

Les 21 recensés en Phase 1, plus la persistance du thème :

| Composant | Traduit de (Flutter) | Tests |
|---|---|---|
| `Button` | thèmes de bouton (`app_theme.dart`) | 4 |
| `Chip` | `DocumentTypeChip` | 3 |
| `Card` | surface générique | — (trivial) |
| `Skeleton` | `ShimmerCard` | — (trivial) |
| `EmptyState` | `EmptyState` | 3 |
| `Icon` | tracés Material Symbols | — (trivial) |
| `Illustration` | SVG d'écran vide | — (trivial) |
| `IconButton` | `IconePressable` | — (couvert par Pressable) |
| `Pressable` (directive) | `ZonePressable` | 4 |
| `Avatar` | `AvatarUtilisateur` | — |
| `DocumentCard` | `DocumentCard` | — (composition de composants déjà testés) |
| `DocumentSkeleton` | `SqueletteDocumentCard` | — (composition de `Skeleton`) |
| `ReadingProgressBar` | `ReadingProgressBar` | — |
| `StreakBadge` | `StreakBadge` | — |
| `OfflineBanner` | `OfflineBanner` | — |
| `AnimatedNumber` | `NombreAnime` | 3 |
| `PinInput` | `PinInputWidget` | 5 |
| `Refreshable` | `ListeRafraichissable` | 4 |
| `ToastService` + `ToastHost` | `MessageFlottant` | 4 |
| `FatalError` | `EcranErreurFatale` | — (présentation seule) |
| `OfflineScreen` | `EcranSansConnexion` | — (présentation seule) |
| `CascadeEnter` (directive) | `ApparitionCascade` | — (CSS pur) |
| `HapticService` | `RetourHaptique` | — (adapté, voir plus bas) |
| `BottomSheetService` + `ConfirmSheet`/`ActionListSheet` | `FeuilleAction` | — (CDK Overlay) |
| `SelectionSheet` | `FeuilleSelection` | — (CDK Overlay) |
| `ThemeService` | `ThemeModeNotifier` | 3 |

Composants domaine-agnostiques (`DocumentCard`, `Avatar`) : aucun modèle
Flutter importé, comme `Card`/`Chip` dès le premier lot — l'appelant (Phase 4,
quand le vrai modèle existera) fournit les valeurs déjà préparées.

### Adaptations délibérées, documentées dans le code

- **`HapticService`** diverge de `RetourHaptique` *sur le web Flutter
  lui-même* : celui-ci est un no-op complet sur `kIsWeb`. La Phase 2 du
  prompt demande explicitement « la meilleure alternative web » quand le
  natif est impossible — c'est `navigator.vibrate()`, qui fonctionne sur
  Chrome/Android (jamais sur Safari/iOS, qui n'a jamais implémenté cette
  API). Résultat : l'inverse de la répartition Flutter natif (iOS favorisé),
  documenté en tête du fichier pour que ça ne surprenne personne.
- **`Refreshable`** n'a pas d'équivalent au problème que résout `estVide`
  côté Flutter (`RefreshIndicator` exige un contenu défilable pour
  reconnaître le geste). Le geste est reconnu ici par Pointer Events sur
  l'hôte, pas par la physique native du défilement : un contenu vide se tire
  exactement comme un contenu plein, sans artifice.
- **`OfflineScreen`/`FatalError`** : `onReessayer` (Flutter) est un
  `Future<bool> Function()` que le widget attend lui-même ; un `output()`
  Angular ne s'attend pas. C'est donc l'appelant qui pilote l'état
  (`[retrying]`/`[showDetails]` en entrée), pas le composant qui prétendrait
  gérer une promesse qu'il ne reçoit jamais.
- **`FatalError`** est volontairement sans la pièce qui l'installe comme
  filet de sécurité global (`installerFiletErreurs`/`ErrorWidget.builder`
  côté Flutter). L'équivalent web est `ErrorHandler` (`@angular/core`), une
  décision d'architecture globale — Phase 3, pas un composant de
  présentation.
- **`BottomSheetService`** retraduit en esprit la mise en garde du code
  Flutter sur le piège du `Navigator` (une feuille ouverte sur le mauvais
  navigateur ne se referme pas) : c'est toujours `BottomSheetRef`, reçu par
  le contenu ouvert, qui ferme la feuille — jamais une référence prise
  ailleurs.
- **`DocumentCard`** ne porte pas le `Hero` (survol animé vers la fiche).
  La View Transitions API en est l'équivalent web le plus proche, mais elle
  se pose au niveau du routeur — Phase 3/4.

## Architecture

`App` est réduit à une coque de routage (`<router-outlet />`). Le contenu qui
y vivait directement — la vitrine — est passé dans `features/vitrine/`, qui
devient la route `''`. Une route `app/design-system` héberge la page de
démonstration (Phase 2, point 6) — comparaison visuelle avec l'application
Flutter, bascule clair/sombre/système en direct, persistée (`ThemeService`).
2 tests vérifient que les deux routes résolvent.

**`vercel.json`** : un rewrite `/app/(.*)` → `/index.html`. Vérifié contre la
documentation Vercel elle-même : le filesystem a toujours priorité sur les
rewrites, donc `/confidentialite/`, `/conditions/` et
`/suppression-compte/` continuent de servir leur propre fichier statique.
**Un test local avec `serve -s` donne un faux négatif sur ce point précis**
(il sert la coquille Angular à la place du fichier réel) — défaut de ce
serveur de test, pas du comportement réel de Vercel.

**`@angular/cdk`** introduit pour les feuilles glissantes (`BottomSheetService`,
bâti sur `@angular/cdk/overlay`) — seul usage réel de la recommandation Q3 de
l'audit Phase 1 (SCSS custom + CDK plutôt qu'Angular Material/PrimeNG).

## Corrigé au passage

Cinq spécifications préexistantes de la vitrine (`about`, `accueil`,
`contact`, `equipe`, `fonctionnalite`) échouaient sur `IntersectionObserver
is not defined` — jsdom ne l'implémente pas. Sans lien avec le portage, mais
c'est la même suite qu'il faut garder verte. `src/test-setup.ts` fournit un
substitut inerte pour `IntersectionObserver` et `window.matchMedia` (le
second nécessaire pour tester `Vitrine` elle-même, qui interroge
`(pointer: fine)`).

## Ce qui reste

Rien côté composants de présentation — les 21 sont portés. Restent pour les
phases suivantes :

- **Phase 3** : l'architecture globale (routage applicatif réel, guards
  d'authentification, `ErrorHandler` branché sur `FatalError`,
  intercepteur HTTP) et les écrans eux-mêmes, qui composeront ces
  21 composants plutôt que de les afficher côte à côte dans une page de
  démonstration.
- Le budget de style de `design-catalog.scss` dépasse le seuil de 9 ko de
  155 octets — attendu, puisque cette page expose tous les composants à la
  fois, contrairement à n'importe quel écran réel. Le seuil global n'a pas
  été relevé pour autant : il continue de refléter la plus grande feuille
  *légitime* restante, pas ce cas exceptionnel. La page disparaît de toute
  façon à la Phase 4.

## Comment vérifier

```
npm ci
npm run build       # ng build — un seul avertissement de budget, expliqué ci-dessus
npm test            # @angular/build:unit-test (vitest) — 48 tests
npm run test:site   # node --test — 25 tests (pages légales + <head>)
```

La page de démonstration, une fois servie : `/app/design-system`.
