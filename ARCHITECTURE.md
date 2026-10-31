# Architecture de NextLearn Web (PWA)

Application Angular 21 (standalone, signaux, `OnPush`, sans zone.js), servie en PWA : service worker,
cache des lectures, documents disponibles hors ligne, notifications poussées. Elle parle à l'API
Node.js/Express (`/api/*`) et partage ses contrats avec l'application mobile.

> Ce document décrit l'architecture **telle qu'elle est**, et les règles qui la gardent propre.
> Les règles de dépendance sont vérifiées automatiquement : `npm run verifier:architecture`.

## 1. Principe : Feature-First, dépendances vers le bas

Le code est découpé **par fonctionnalité** (ce que l'étudiant fait), et non par type de fichier.
Chaque fonctionnalité s'appuie sur des couches basses qui ne savent rien d'elle.

```
            ┌────────────────────────────────────────────┐
            │  layout/      l'enveloppe : routes, barre    │  compose les features
            └───────────────┬────────────────────────────┘
                            ▼
            ┌────────────────────────────────────────────┐
            │  features/    une fonctionnalité = un dossier│  écrans + logique d'écran
            └───────────────┬────────────────────────────┘
                            ▼
            ┌────────────────────────────────────────────┐
            │  shared/      UI réutilisable, services     │  composants, directives,
            │               d'application                 │  services qui touchent l'écran
            └───────────────┬────────────────────────────┘
                            ▼
            ┌────────────────────────────────────────────┐
            │  core/        modèles, accès aux données,    │  aucune dépendance vers
            │               état de session, réseau        │  l'interface
            └────────────────────────────────────────────┘
```

| Couche | Rôle | Peut dépendre de |
|---|---|---|
| `core/` | Modèles de domaine, dépôts de données (HTTP), état applicatif, réseau, stockage, i18n, garde de routage | rien d'autre que `core/` |
| `shared/` | Composants d'interface réutilisables, directives, services qui ont un effet à l'écran (thème, toast, favoris) | `core/` |
| `features/<nom>/` | Les écrans d'une fonctionnalité et leur logique de présentation | `core/`, `shared/` - jamais une autre feature |
| `layout/` | L'enveloppe : routes de l'application, barre de navigation, coque | tout ; **rien ne dépend de lui** |

## 2. Arborescence

```
src/app/
├── app.config.ts · app.routes.ts · app.ts        composition racine (providers, routes, service worker)
│
├── core/                                          ─── le noyau, sans interface ───
│   ├── models/          modèles transverses : utilisateur, vérification, échec (Failure), parcours OTP
│   ├── network/         intercepteur d'authentification, erreur-api (enFailure), enveloppe-api (donnees),
│   │                    configuration de l'API, état du réseau, expiration de session
│   ├── storage/         stockage sécurisé local (jetons, PIN haché, préférences)
│   ├── router/          routes nommées (app-routes), garde d'accès, stratégie de réutilisation d'onglets
│   ├── i18n/            traductions (fr/en), tube `t`, fonction `tr()`
│   ├── pwa/             installation et mise à jour de la PWA
│   ├── preferences/     verrouillage de l'application, accessibilité
│   ├── error-handling/  gestion globale des erreurs
│   └── <domaine>/       un dossier par domaine métier - modèle + dépôt (+ service d'état si besoin) :
│       auth · bibliotheque · epreuves · contributions · profil · progression · quiz · recherche ·
│       recours · references · moderation · notifications · partage · scan · verification · contexte
│
├── shared/                                        ─── réutilisable, avec interface ───
│   ├── ui/              composants : bouton, carte de document, feuilles glissantes (CDK), toast,
│   │                    barre de page, champ PIN, icônes (Lucide), type-document (présentation)…
│   ├── directives/      pressable, cascade-enter
│   ├── services/        thème, retour haptique, état des favoris
│   └── styles/          jetons de design (_tokens.scss), typographie
│
├── features/                                      ─── une fonctionnalité par dossier ───
│   ├── auth/ (splash, onboarding, register, otp, login-pin, pin-setup, reset-pin, unlock)
│   ├── home/ · bibliotheque/ · epreuves/ · recherche/ · quiz/ · progression/ · partage/
│   ├── contributions/ · recours/ · verification/ · notifications/
│   ├── profil/ (profil-home, settings-list, sessions, support-tickets, dialogues/…)
│   ├── legal/ · not-found/ · design-system/
│   └── vitrine/ (page d'accueil publique : mène à /app, installe la PWA)
│
└── layout/
    ├── app-shell/       routes de l'application (`/app/*`) et sa racine
    └── main-shell/      coque avec barre de navigation du bas
```

Hors de `src/app/` : `public/` (manifeste, service worker Firebase, `i18n/*.json`), `ngsw-config.json`
(cache), `tools/` (contrôles automatiques), `qa/` (sondes de navigateur et scénarios de bout en bout).

## 3. Responsabilités et conventions

### Accès aux données (`core/<domaine>/*-repository.ts`)
- **Seuls** les dépôts parlent à `HttpClient` (règle R4, vérifiée).
- Un dépôt convertit la réponse JSON en **modèle typé** (`xxxDepuisApi`) et traduit les erreurs avec
  `enFailure` (`core/network/erreur-api.ts`) - un écran ne manipule jamais du JSON brut ni une erreur HTTP.
- Les réponses sont enveloppées `{ data, meta? }` : utiliser `donnees()` (`core/network/enveloppe-api.ts`).

### Modèles (`core/**/*.model.ts`)
- Des types et des fonctions pures. **Aucune dépendance à l'interface** : un modèle ne connaît ni icône,
  ni couleur, ni composant. L'apparence d'un type de document vit dans
  `shared/ui/type-document/` (`presentationType`, tube `typeDoc`).

### Services d'état (`core/**/*.service.ts`, `shared/services/`)
- Un service par état partagé, exposé en **signaux** (`signal`, `computed`), mutable seulement par lui.
- Ce qui a un effet à l'écran (toast, thème) est dans `shared/services/`, pas dans `core/`.

### Écrans (`features/**`)
- Composants **standalone, `OnPush`**, état local en signaux, un dossier par écran
  (`x.ts`, `x.html`, `x.scss`, `x.spec.ts`).
- Un écran orchestre (appelle un service, affiche un état) ; il ne contient ni requête HTTP ni règle métier.
- Une fenêtre ou un bloc qui a **sa propre logique** devient son propre composant
  (ex. `features/profil/dialogues/pin-dialog`, `support-dialog`) et ne communique que par entrées/sorties.
- Pas d'import entre features : ce qui est partagé monte dans `shared/` (UI) ou `core/` (logique).

### Navigation
- Les routes sont déclarées **une fois** dans `core/router/app-routes.ts`. Une route à plusieurs segments se
  navigue par `navigateByUrl('/app/' + AppRoutes.x)`, jamais par `navigate(['/app', 'a/b'])` (le `/` serait
  encodé) - contrôlé par `tools/verifier-design.mjs`.
- Les écrans sont chargés **à la demande** (`loadComponent`).

### Interface
- Couleurs, rayons, espacements : **uniquement** via les jetons CSS (`shared/styles/_tokens.scss`).
- Icônes : composant `nl-icon` (Lucide, extraites par `tools/extraire-icones.mjs`) - jamais un caractère.
- Textes : `public/i18n/{fr,en}.json`, clés lues par le tube `t` ou `tr('clé', 'repli')`. Les deux
  catalogues doivent rester en phase (contrôlé).
- Nommage : domaine et identifiants en **français** (`dossier`, `signalement`, `favoris`), cohérent avec
  l'API et l'application mobile ; techniques en anglais (`Repository`, `Interceptor`).

### PWA, cache et hors ligne (non modifiés par la refonte)
- `ngsw-config.json` : fichiers de l'application mis en cache à l'installation ; groupe de données
  `api-lecture` (stratégie *freshness*, 7 jours) pour les lectures de l'API.
- `core/bibliotheque/stockage-hors-ligne.ts` : documents téléchargés sur l'appareil.
- `core/storage/secure-storage.service.ts` : jetons, PIN haché, état local - clés inchangées.
- `public/firebase-messaging-sw.js` : notifications poussées.

### Page d'accueil publique (`features/vitrine`)
- Un seul but : mener le visiteur dans l'application. NextLearn n'est sur aucun magasin d'applications, donc la page ne
  propose pas de « télécharger » : un bouton ouvre `/app`, un second installe la PWA quand le navigateur le permet
  (invitation native sur Android/Chrome, explication du geste sur iPhone).
- Aucune ressource externe (police auto-hébergée, icônes de l'application) : une page publique n'envoie pas l'adresse IP du
  visiteur à un CDN. Le script de connexion Google n'est lui aussi chargé que sur les écrans qui l'utilisent.
- L'aperçu du téléphone est une vraie capture de l'application : `node qa/outils/capturer-apercu-accueil.mjs`
  la régénère (données d'exemple simulées) vers `public/images/apercu-accueil.jpg`.

### Authentification
- `core/auth/auth.service.ts` (état et orchestration) → `auth-repository.ts` (appels `/api/auth/*`),
  `verrou-pin.ts` (blocage local après échecs de PIN), `google-identite.ts` (script Google).
- `core/network/auth.interceptor.ts` pose le jeton, rafraîchit la session, gère l'expiration.
- `core/router/auth.guard.ts` aiguille selon la session, le verrou et l'état de vérification académique.
- Le PIN est **facultatif** ; sans PIN, la connexion passe par un code envoyé par e-mail.

## 4. Garde-fous automatiques

| Commande | Ce qu'elle contrôle |
|---|---|
| `npm run verifier:architecture` | Règles de dépendance R1–R5 (voir `tools/audit-architecture.mjs`) |
| `npm run verifier:design` | Catalogues i18n en phase, variables CSS orphelines, routes à segments, icônes en caractères |
| `npm test` | Tests unitaires (Vitest via `ng test`) |
| `npm run build` | Compilation de production (détecte aussi les erreurs de types des gabarits) |
| `node qa/outils/verifier-*.mjs` | Sondes de navigateur (Playwright) sur un serveur de développement : filtres, fiche, cartes, fenêtres du profil, vérification, Google… |
| `qa/outils/e2e-*.mjs` | Scénarios de bout en bout contre une vraie API et une base en mémoire |

Règles de dépendance : **R1** `core` ne dépend ni de `shared` ni de `features` · **R2** `shared` ne
dépend pas de `features` · **R3** une feature ne dépend pas d'une autre · **R4** seul `core` parle à
`HttpClient` · **R5** rien ne dépend de `layout`.

## 5. Ce que la refonte a changé

État de départ mesuré avant toute modification (branche `refactor/architecture-feature-first`,
modifications locales sauvegardées hors du dépôt) : 148 tests, build de 381,90 kB, 3 entorses de couches.

| # | Changement | Pourquoi (problème réel) |
|---|---|---|
| 1 | `enFailure` - `core/network/erreur-api.ts` remplace **12 copies** identiques de la traduction d'erreurs HTTP | Duplication ; une correction devait être faite 12 fois. Testé (3 tests). |
| 2 | Présentation d'un type de document déplacée du modèle vers `shared/ui/type-document/` (+ tube `typeDoc`) ; **8 écrans** perdent leurs 4 méthodes d'enrobage recopiées | Le modèle de données importait les noms d'icônes de l'interface (inversion de dépendance). 6 tests. |
| 3 | `FavorisEtat` passe de `core/` à `shared/services/` | Il pilotait un toast : un service d'application, pas du noyau. |
| 4 | `features/shell` + `features/app-shell` → `layout/` ; `Components/` (ancien site, depuis remplacé par la nouvelle page d'accueil) | L'enveloppe n'est pas une fonctionnalité ; un dossier à majuscule hors convention. |
| 5 | `settings-list` (594 → 499 lignes) : fenêtres **PIN** et **support** extraites en composants (`features/profil/dialogues/`) | Un écran portait 5 responsabilités ; les règles de saisie du PIN n'étaient pas testables. 7 tests. |
| 6 | `AuthRepository` (658 → 564 lignes) : blocage après échecs de PIN → `VerrouPin` ; avatar et niveau → `ProfilRepository` ; `donnees()` partagé | Un dépôt d'authentification qui gérait aussi le profil et la politique de blocage. 6 + 4 tests. |
| 7 | Doublon mort retiré : `core/verification/verification.model.ts` (un 2ᵉ `JustificatifType`) | Deux modèles pour la même réponse, dont un erroné. |
| 8 | Contrôle automatique de l'architecture (`tools/audit-architecture.mjs`, `npm run verifier:architecture`) | Les règles ne tiennent que si elles sont vérifiées. |

## 6. Résultats

| Mesure | Avant | Après |
|---|---|---|
| Entorses de dépendance (R1–R5) | 3 | **0** |
| Tests unitaires | 148 | **170** (47 fichiers, tous au vert ; +26 nouveaux, −4 déplacés vers `verrou-pin.spec.ts`) |
| Build de production | 381,90 kB initial (107,88 kB transféré) | 381,90 kB (107,89 kB) - **inchangé** |
| Copies de la gestion d'erreurs HTTP | 12 | **1** |
| Écrans recopiant la présentation des types | 8 | **0** |
| `auth-repository.ts` | 658 lignes | 564 lignes |
| `settings-list.ts` | 594 lignes | 499 lignes |
| Fichiers du service worker, du cache, du stockage, de l'intercepteur, de la garde, de la configuration | - | **inchangés** (comparés octet à octet à la sauvegarde) |

Sondes de navigateur après refonte : cartes, fiche ressource, catalogue et favoris, réglages, feuilles
(clair et sombre), filtres (24/24), « Mes signalements » (6/6), Google non institutionnel (6/6),
vérification académique (11/11), fenêtres PIN et support (11/11).

## 7. Dette connue et suite proposée

- **`auth-repository.ts` reste volumineux** (564 lignes) : inscription, connexion, Google, session
  restaurée et réinitialisation du PIN y cohabitent. Prochain découpage naturel : un dépôt Google à part.
- **41 lectures de réponses** (`?.['data']`) restent écrites à la main dans 14 dépôts ; elles n'ont pas toutes
  la même tolérance (réponse à plat ou enveloppée), les unifier d'un coup pourrait changer un comportement.
  Les migrer un dépôt à la fois, avec son test, vers `donnees()`.
- `core/quiz/quiz-repository.ts` garde sa propre gestion d'erreur : elle teste `instanceof Response` (jamais
  vrai pour une erreur d'`HttpClient`), donc ses erreurs HTTP deviennent toutes le message générique. La
  basculer sur `enFailure` donnerait de vrais messages - un changement visible, à décider à part.
- `settings-list` reste la plus grosse page (499 lignes) : thème, langue, accessibilité, notifications,
  cache pourraient devenir des groupes de réglages indépendants.
- `src/styles.scss` est l'ancienne feuille globale de l'ancien site vitrine (variables Poppins, `.btn`, `.container`,
  réinitialisation, `a`/`ul`/`img` globaux). La nouvelle page d'accueil n'en dépend plus ; l'application, elle, hérite encore
  de ses règles de base. À élaguer règle par règle, en contrôlant les écrans, plutôt que d'un coup.
