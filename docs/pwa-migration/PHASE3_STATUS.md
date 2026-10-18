# Phase 3 — Architecture et portage de la logique (statut : terminée)

Pas d'écran : c'est la Phase 4. Ici, tout ce qui fait tourner l'application
sans contenu visuel — modèles, stockage, HTTP, authentification,
vérification, routage, gestion d'erreur. Vérifié : `tsc --noEmit` propre,
build sans erreur ni avertissement, **24 fichiers de test Angular, 80 tests**
+ 25 tests Node (`npm run test:site`), tous verts. Commit `dcb0e8a`.

## Modèles (`src/app/core/models/`)

Traduits sans arrondi depuis `lib/core/models/` et
`lib/domains/auth/domain/models/` : `user.model.ts`, `demande-otp.model.ts`,
`parcours-otp.model.ts`, `verification.model.ts`, `failure.model.ts`. Ce
dernier est le point sensible : `Failure.messagePour()` ne laisse jamais
fuiter un message brut du backend, sauf les deux exceptions déjà documentées
côté Flutter (pré-authentification, compte non validé).

## Stockage et réseau (`src/app/core/storage/`, `core/network/`)

- `SecureStorageService` — `localStorage`, API identique au
  `SecureStorageService` Flutter. **Risque accepté, pas oublié** : pas de
  cookie `httpOnly`, donc exposé à une XSS — décision Q2 de l'audit Phase 1,
  documentée dans le code même, pas seulement dans ce rapport.
- `authInterceptor` — jeton, rafraîchissement dédupliqué (une seule requête
  de refresh même si plusieurs 401 arrivent en même temps), déconnexion sur
  refresh raté. N'envoie **pas** d'en-têtes de description d'appareil : même
  décision que `device_headers.dart` côté Flutter, pour la même raison
  (CORS), pas une impasse technique de ce portage.

## Authentification et vérification (`core/auth/`, `core/verification/`)

`AuthRepository` (HTTP, hash PIN par Web Crypto — même sel que le backend) et
`AuthService` (état par signal, machine à états portée d'`AuthNotifier`)
couvrent l'inscription, l'OTP (inscription et connexion), le PIN (création,
connexion, verrou à recul exponentiel plafonné à 15 min, réinitialisation,
changement) et la session. `VerificationService` est volontairement minimal
— juste ce qu'il faut pour que la garde de routage sache si un dossier
bloque l'accès ; le formulaire et l'historique sont Phase 4.

## Routage (`core/router/`, `features/app-shell/`, `features/shell/`)

- `AppRoutes` (31 chemins), `app-shell.routes.ts` (l'arbre complet,
  lazy-loadé — voir plus bas), chaque écran en `RouteStub` sauf la coque.
- `MainShell` — 5 onglets réels (icônes, navigation, haptique). Le geste
  « retour = quitter l'app » n'a pas d'équivalent web et n'a pas été porté :
  le bouton retour du navigateur, c'est la page précédente, pas la sortie.
- `TabReuseStrategy` — préserve l'état des 5 onglets entre navigations,
  là où Angular détruirait et recréerait par défaut (risque signalé en
  Phase 1 : go_router + `IndexedStack` n'a pas d'équivalent direct).
- `authGuard` — traduction fonction par fonction de `RouterNotifier.redirect`
  (le point le plus à risque de l'audit Phase 1). Non porté, délibérément :
  la résolution de lien profond vers un document, qui suppose le module
  bibliothèque (Phase 4).

**Un bug réel trouvé en testant la garde en conditions réelles** (navigation
dans un routeur monté, pas juste l'appel direct de la fonction) : `aller()`
construisait l'URL avec `createUrlTree(['/app', dest])`, qui traite un `dest`
à plusieurs segments (`login/otp`, `verification/attente`, un lien de
document capturé) comme un seul segment littéral — le `/` interne finissait
encodé en `%2F`, vers une URL qu'aucune route ne pouvait résoudre. Corrigé en
passant par `parseUrl`, qui découpe la chaîne comme une vraie navigation le
ferait. Sans ce test de bout en bout, le bug serait resté invisible : un
test unitaire de la garde isolée n'inspecte pas la forme de l'URL produite.

## Erreurs et câblage racine (`core/error-handling/`, `app.*`)

`AppErrorHandler` (global, remplace toute la page — différence
architecturale avec `ErrorWidget.builder`, documentée dans le code comme
limite connue, pas comme bug) et `GlobalErrorService` affichent `FatalError`
à la racine, à côté de `ToastHost`. Les deux vivent dans `App`, qui sert
aussi la vitrine : leurs jetons de style sont inclus via un mixin Sass sur
leur propre `:host`, pas via la classe `.nl-app`, pour ne jamais fuiter vers
la vitrine qui partage le même composant racine.

`app.routes.ts` charge l'arbre applicatif en `loadChildren` (pas un import
statique) : un nouveau chunk `app-shell-routes` (~27 kB) apparaît au build,
distinct de `vitrine` et `design-catalog` — quelqu'un qui ne visite que la
vitrine ne télécharge pas le code de l'application.

## Reporté à la Phase 4

Le contenu des 31 écrans, le formulaire et l'historique de vérification
académique, la résolution de lien profond vers un document, l'UI de profil
(avatar, niveau). Rien de ce qui précède n'a besoin d'être repris : c'est
de l'architecture qui attend son contenu, pas une ébauche à refaire.
