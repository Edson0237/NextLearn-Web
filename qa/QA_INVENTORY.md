# QA_INVENTORY.md - inventaire indépendant de l'application Flutter

**Auditeur** : recette externe, aucune participation au développement.
**Source de vérité** : le code Flutter de `C:\Users\USER\StudioProjects\nextlearn`
(arbre de travail au 2026-10-21, incluant les modifications non committées).
**Méthode** : lecture du code, pas lecture des rapports. `PARITY_MATRIX.md`,
`PHASE2_STATUS.md` et `PHASE3_STATUS.md` n'ont été ouverts **qu'après** cet
inventaire, et uniquement pour en signaler les écarts (§10).

Statuts utilisés dans tout le dossier QA :
✅ conforme (code lu **et** parcours exécuté) · ⚠️ écart mineur ·
❌ écart majeur / manquant · 🚫 impossible sur le web (avec alternative) ·
❓ non vérifié (avec la raison).

---

## 1. Périmètre mesuré

| Mesure | Flutter | PWA Angular |
|---|---|---|
| Fichiers source | 179 `.dart` (`lib/`) | 171 `.ts` + 69 `.html` + 90 `.scss` (`src/`) |
| Routes déclarées | **36** (`app_routes.dart`, 36 `GoRoute`) | **35** (`app-routes.ts`, 35 entrées) |
| Écrans (pages) | 34 pages + 1 coque | 34 composants + 1 coque |
| Endpoints API distincts | **55** | **51** |
| Clés de traduction | **808 × 2 langues** (fr + en, synchronisées) | **0** (français codé en dur) |
| Boîtes de stockage local | 9 boîtes Hive **chiffrées** | `localStorage` (6 clés), pas d'IndexedDB |

Preuves de comptage : `grep -cE "static const String [a-zA-Z]+ = '"`
sur `lib/app/router/app_routes.dart` → 36 ; `grep -c "GoRoute("` sur
`lib/app/router/app_router.dart` → 36 ; clés ARB comptées en excluant les
métadonnées `@` → 808 identiques dans `app_fr.arb` et `app_en.arb`.

---

## 2. Routes et navigation (référence Flutter)

`lib/app/router/app_routes.dart` + `lib/app/router/app_router.dart`.

### 2.1 Hors coque (poussées par-dessus)

| Route Flutter | Écran | Paramètres | Transition |
|---|---|---|---|
| `/` | `SplashPage` | - | - |
| `/onboarding` | `OnboardingPage` | - | - |
| `/register` | `RegisterPage` | - | - |
| `/register/otp` | `OtpPage` | - | - |
| `/register/pin-setup` | `PinSetupPage` | - | - |
| `/login` | `LoginPinPage` | - | - |
| `/login/otp` | `OtpPage(isLogin2fa: true)` | - | - |
| `/login/reset-pin` | `ResetPinPage` | - | - |
| `/unlock` | `UnlockPage` | - | - |
| `/notifications` | `NotificationsPage` | - | push |
| `/verification` | `VerificationFormPage` | - | push |
| `/verification/attente` | `VerificationPendingPage` | - | push |
| `/support/tickets` | `SupportTicketsPage` | - | push |
| `/profil/supprimer-compte` | `DeleteAccountPage` | - | push |
| `/profil/parametres` | `ParametresPage` | - | push |
| `/profil/appareils` | `SessionsPage` | - | push |
| `/legal/confidentialite` | `LegalDocumentPage` | - | **toujours accessible, sans compte** |
| `/legal/conditions` | `LegalDocumentPage` | - | **toujours accessible, sans compte** |
| `/legal/a-propos` | `AProposPage` | - | push |
| `/depots/nouveau` | `DepotFormPage` | - | **modale (montée par le bas)** |
| `/recours` | `RecoursPage` | - | push, **échappe au blocage de vérification** |
| `/bibliotheque/matiere/:id` | `MatierePage` | `id` | push |
| `/favoris` | `FavorisPage` | - | push |
| `/offline` | `OfflineLibraryPage` | - | push |
| `/recherche` | `RecherchePage` | - | **modale (montée par le bas)** |
| `/bibliotheque/doc/:id` | `DocumentDetailPage` | `id` | push |
| `/bibliotheque/doc/:id/read` | `PdfReaderPage` | `id` | push |
| `/epreuves/:id` | `EpreuveDetailPage` | `id` | push |
| `/quiz/:id` | `QuizSessionPage` | `id` | push |

### 2.2 Coque à onglets - `StatefulShellRoute.indexedStack`, 5 branches

| # | Onglet | Route | Sous-routes |
|---|---|---|---|
| 1 | Accueil | `/home` | - |
| 2 | Bibliothèque | `/bibliotheque` | `/bibliotheque/matieres` (catalogue), `/epreuves` **dans la même branche** |
| 3 | Progression | `/progression` | - |
| 4 | Contribuer | `/depots` | - |
| 5 | Profil | `/profil` | - |

Point de vigilance pour l'audit : **`/epreuves` appartient à la branche
« Bibliothèque »** côté Flutter (commentaire explicite dans `app_router.dart`,
lignes ~430) ; ce n'est pas un onglet. L'état de chaque branche (défilement,
filtre de type sélectionné) est conservé par `IndexedStack`.

### 2.3 Règles de redirection (`RouterNotifier.redirect`) - ordre exact

1. Lien profond `/d/:id` → mémorise `destinationEnAttente`, renvoie au splash si
   l'app démarre (`lien_profond.dart`).
2. `isInitializing` → tout vers `/`.
3. Depuis `/` : authentifié + verrouillé → `/unlock` ; authentifié → destination
   en attente **ou** `/home` ; sinon écran du parcours OTP en cours, sinon
   `/onboarding` (premier lancement) ou `/login`.
4. Authentifié + verrouillé → seuls `/unlock` et `/login/reset-pin` passent.
5. `/unlock` hors verrou → `/home` ou `/login`.
6. `/legal/confidentialite` et `/legal/conditions` → **toujours autorisées**
   (exigence Apple + liens du formulaire d'inscription).
7. Non authentifié avec un parcours OTP ouvert → on y reste (sortie seulement
   par le renoncement explicite offert sur l'écran).
8. Non authentifié, route non publique → mémorise `/documents/...`, puis
   `/onboarding` ou `/login`.
9. Authentifié sur une route publique → destination en attente ou `/home`.
10. Vérification académique bloquante : `/recours` passe ; `statut.demandeAction`
    → `/verification` ; sinon `/verification/attente`.
11. Dossier validé sur une route de vérification → `/home`.

### 2.4 Liens de partage (`lien_profond.dart`)

- Forme émise : `https://api-nextlearn.duckdns.org/d/{id}` (segment court `d`,
  hôte identique à l'API pour servir `/.well-known/assetlinks.json`).
- Forme reconnue à l'entrée : `/d/{id}` uniquement ; tout autre chemin suit son
  cours normal.
- Le lien ne porte **que** l'identifiant (ni titre, ni matière, ni école).

---

## 3. Endpoints API (55 relevés dans `lib/`)

Base : `ApiConfig.baseUrl` = `https://api-nextlearn.duckdns.org`, surchargée par
`--dart-define=NEXTLEARN_API_URL`. `authPath` = `/api/auth`.

**Auth** : `POST /api/auth/register`, `/login`, `/verify-otp`, `/verify-2fa`,
`/setup-pin`, `/resend-otp`, `/reset-pin`, `/confirm-reset-pin`, `/refresh`,
`/change-pin`, `/logout`, `GET /api/auth/institution`, `GET /api/auth/sessions`,
`DELETE /api/auth/sessions/:id`.

**Documents** : `GET /api/documents` (+ pagination/filtres), `/search`,
`/recommended`, `/popular`, `/recent`, `GET /api/documents/:id`,
`POST /api/documents/:id/view`, `/rate`, `/download`,
`GET /api/documents/:id/signed-url`, `GET /api/documents/submissions/me`,
`POST /api/documents/submissions`.

**Épreuves** : `GET /api/epreuves`, `GET /api/epreuves/:id`,
`POST /api/epreuves/:id/rate`, `/download`.

**Favoris / hors-ligne** : `GET /api/favorites`, `POST|DELETE /api/favorites/:id`,
`GET /api/offline/documents`, `POST|DELETE /api/offline/:id`.

**Progression** : `GET /api/progression/stats`, `/week`, `/matiere`, `/badges`,
`POST /api/progression/badges/check`, `POST /api/progress/sessions`,
`GET|POST /api/progress/lecture`, `GET /api/progress/lecture/:id`.

**Quiz** : `GET /api/quiz`, `GET /api/quiz/:id`, `POST /api/quiz/:id/submit`.

**Références** : `GET /api/references/universites`, `/filieres`, `/matieres`,
`/cycles`, `/niveaux`, `/semestres`, `/document`, `/justificatif`.

**Compte** : `GET /api/users/me`, `GET|PUT /api/profile`,
`POST /api/profile/avatar`, `GET /api/me/context`, `GET /api/me/levels`.

**Notifications** : `GET /api/notifications`, `/unread`, `POST /api/notifications/read`,
`POST /api/notifications/device`, `POST /api/notifications/campaigns/:id/...`.

**Modération / support / recours** : `POST /api/reports`, `GET /api/reports/motifs`,
`GET|POST /api/support/tickets`, `GET|POST /api/recours`, `/recours/me`,
`/recours/possibilites`.

**Vérification** : `GET|POST /api/verification/requests`,
`GET /api/verification/requests/me`.

### 3.1 Contrat de transport

- Timeouts : `connectTimeout` **20 s**, `receiveTimeout` **20 s** (`dio_client.dart`).
- En-têtes : `Authorization: Bearer` sauf sur les 9 chemins pré-auth
  (`_cheminsSansJeton`) ; `X-Device-Platform` + `X-App-Version` sur mobile,
  **rien sur le web** (préflight CORS - décision documentée).
- 401 : refresh dédupliqué (une seule requête concurrente), rejeu une fois
  (`extra['retried']`), `onSessionExpired` **seulement s'il existe un refresh
  token** ; les chemins de `_chemins401Identifiant` (dont `/auth/change-pin`)
  ne déclenchent jamais de refresh.
- Erreurs : `Failure` ne laisse fuiter le message serveur que dans deux cas -
  `ACCOUNT_NOT_VALIDATED` (≤ 240 car.) et 401/422 sur chemin pré-auth (≤ 200 car.).
  Messages par défaut : 400/401/403/404/409/422/429/500-502-503 + générique,
  tous traduits.

---

## 4. Modèles de domaine

`UserModel` (+ `niveau`, `filiere`, `universite`, `langue`), `SessionModel`,
`DemandeOtp`, `ParcoursOtp` (4 valeurs : inscription, definitionPin, connexion,
reinitialisation), `DomaineInstitutionnel`, `NiveauDisponible`,
`DocumentModel`, `EpreuveModel`, `QuizModel` + `QuizQuestion`
(`bonneReponseIndex` nullable, retiré par le serveur avant soumission) +
`QuizResult`, `BadgeModel`, `StudySessionModel`, `NotificationModel`,
`DepotModel`, `RecoursModel`, `VerificationModel` (+ `statut.demandeAction`,
`bloqueAcces`), `SupportTicketModel`, `ContexteEtudiant`, `FiliereModel`,
`MatiereModel`, `UniversiteModel`.

---

## 5. Règles métier et validations

- **PIN** (`pin_policy.dart`) : 4 chiffres, chiffres uniquement, liste noire de
  20 codes, pas de chiffre répété, pas de suite croissante/décroissante (avec
  passage 9→0). 5 messages d'erreur distincts.
- **Verrou PIN** : tentatives comptées, recul exponentiel plafonné à 15 min
  (clés `nl_pin_failed_attempts`, `nl_pin_locked_until`).
- **Inscription** : prénom + nom requis, e-mail institutionnel reconnu par
  `GET /api/auth/institution` (3 états : vérification, reconnu + institution,
  refusé + message serveur), case « sans adresse institutionnelle » qui bascule
  vers le dépôt d'un justificatif, consentement obligatoire avec liens légaux,
  parcours en 2 étapes (identité → école/cycle/filière/niveau en cascade).
- **Cascade de références** : école → cycle → niveau → filière, chaque niveau
  désactivé tant que le précédent n'est pas choisi, avec message d'aide propre.
- **Quiz** : la bonne réponse n'est jamais envoyée au client avant correction.
- **Session d'étude** : durée minimale (`StudySessionController.minimumDurationSeconds`)
  et pages lues > 0, sinon rien n'est envoyé ; file d'attente locale
  (`study_session_queue.dart`) rejouée au retour du réseau.

---

## 6. Design system (jetons extraits du code)

| Famille | Valeurs Flutter |
|---|---|
| Primaires clair | `#1A4A7E`, `#0F2E4D`, `#0F2E4D`, `#3D6FA3` |
| Primaires sombre | `#74AAE0`, `#12314F`, `#0F2E4D`, `#9AC4EC` |
| Corail | clair `#FF7A59`/`#FFB39E` - sombre `#FF9478`/`#FFBBA6` |
| Vert | clair `#2E9E5B`/`#7FC89D` - sombre `#5CBE86`/`#8FD6AE` |
| Sémantiques clair | danger `#D14343`, warning `#ED8B22`, neutral `#8AA1B6` |
| Sémantiques sombre | danger `#F2796A`, warning `#E3A648`, neutral `#728799` |
| Fonds clair | `#FFFFFF`, `#EEF4F9`, `#F5F9FC`, `#E1EBF5` |
| Fonds sombre | `#11212F`, `#0A1620`, `#17293A`, `#1F3648` |
| Texte clair | `#10202E`, `#4D6072`, `#8AA1B6`, `#FFFFFF` |
| Texte sombre | `#E7EFF6`, `#A6B8C7`, `#728799`, `#08131C` |
| Bordures | clair `#D6E1EA`/`#F5F9FC` - sombre `#22394E`/`#1A2C3D` |
| Ombres | couleur `#0F2E4D` α .06/.08 (clair), `#000000` α .32/.42 (sombre) ; `blur 16 offset 0,6` et `blur 24 offset 0,10` |
| Couleurs par type (9 slugs) | cours, td, epreuve, synthese, annales, corrige, rapport, expose, tp - **paire clair/sombre pour chacun** |
| Palette matières | **10 teintes**, choisies par hash du nom, identiques dans les deux thèmes |
| Espacement | 4, 8, 12, 16, 20, 24, 32 ; page 20 ; entre-éléments 12 ; entre-sections 20 |
| Rayons | 8, 12, 14, 16, feuille 20, pilule 999 |
| Cible tactile | **48 dp minimum** |
| Mouvement | micro 150 ms, standard 280 ms, lente 400 ms, fondu 200 ms |
| Courbes | easeOutCubic (entrée), easeInCubic (sortie), easeInOutCubic, easeOutBack |
| Cascade de liste | pas de 40 ms, plafonné à 8 éléments |
| Réduction de mouvement | préférence in-app **prioritaire** sur le réglage système ; durée ramenée à zéro |
| Typographie | Poppins (titres/boutons), Inter (corps), JetBrains Mono (identifiants) |

Composants partagés Flutter (22) : `DocumentCard`, `SqueletteDocumentCard`,
`ShimmerCard`, `CategoryChip`, `EmptyState`, `EtatErreur`, `AvatarUtilisateur`,
`ZonePressable` (**11 fichiers**), `ApparitionCascade` (**4 fichiers**),
`FeuilleAction` + `FeuilleSelection` (**8 fichiers**), `MessageFlottant`,
`NombreAnime`, `OfflineBanner`, `EcranSansConnexion`, `EcranErreurFatale`,
`PinInputWidget`, `ReadingProgressBar`, `StreakBadge`, `ListeRafraichissable`,
`BanniereReverification`, `FileAttenteOtp`, `BoutonCloche` (pastille de non-lus,
plafond 99+).

---

## 7. Services transverses

| Service | Rôle | Contrainte |
|---|---|---|
| `SecureStorageService` | 12 clés (jeton, expiration, refresh, user, hash PIN, 1er lancement, dernier OTP, tentatives PIN, verrou, jeton temporaire, parcours OTP + échéance) | Keystore/Keychain |
| `HiveService` | **9 boîtes chiffrées** : documents, offline_docs, lecture_progress, favoris, study_sessions, notifications, prefs, references, epreuves - avec horodatage d'écriture et migration depuis les boîtes non chiffrées | clé issue du coffre système |
| `ConnectivityService` + `demarrage_reseau.dart` | état réseau, vérification au démarrage | plugin natif |
| `TelechargementService` | téléchargement avec progression (fraction) | - |
| `CacheCleanerService` | vidage réel du cache | - |
| `PushService` (natif/web) | FCM : permission, jeton → `POST /api/notifications/device`, `onMessage`, `onMessageOpenedApp` ; **la version web est un stub inerte** | iOS ≥ 16.4 + PWA installée |
| `BiometricService` | déverrouillage biométrique, dégradation silencieuse | - |
| `ScannerService` (natif/web) | scan de document ; **`disponible = false` sur le web**, le bouton n'est alors pas affiché | 🚫 web |
| `RetourHaptique` | retours tactiles | 🚫 iOS Safari |
| `PreferencesAccessibilite` | échelle de texte + réduction d'animations | - |
| `HistoriqueRecherches` | historique local des recherches | - |
| `StudySessionQueue` | file d'attente des sessions d'étude hors-ligne | - |
| `SessionExpiredNotifier` | notification globale de session expirée | - |
| `LienProfond` | émission/reconnaissance des liens `/d/:id` | App Links / Universal Links |

---

## 8. États d'écran à vérifier (contrat Flutter)

Chaque liste distingue **4** états, pas 3 : squelette (`AsyncValue.loading`),
vide (`EmptyState` + illustration), erreur (`EtatErreur` avec réessai), rempli.
Les rangées de l'accueil **disparaissent** si elles sont vides mais montrent un
squelette si elles chargent (commentaire explicite `home_page.dart` §« Le défaut
qu'elle corrige »), et **n'affichent jamais d'erreur** - une suggestion qui
échoue s'efface.

---

## 9. Ce qui est impossible ou dégradé sur le web (constat de la source)

Le code Flutter prend déjà ces décisions, elles ne sont donc pas des écarts du
portage mais le contrat à reprendre :

| Sujet | Décision déjà prise côté Flutter |
|---|---|
| En-têtes d'appareil | non envoyés depuis un navigateur (préflight CORS) |
| Scanner de document | indisponible sur le web, bouton masqué |
| Push web | stub inerte |
| Haptique | absent sur iOS Safari |
| Stockage chiffré | pas d'équivalent navigateur au Keystore/Keychain |

---

## 10. Écarts entre cet inventaire et `PARITY_MATRIX.md`

### 10.1 La matrice est périmée et ne peut pas servir de preuve

`PARITY_MATRIX.md` porte **« à faire » sur la quasi-totalité de ses lignes**
(auth, shell, bibliothèque, épreuves, quiz, progression, contributions,
vérification, modération, notifications, profil, infrastructure), alors que
`PHASE2_STATUS.md` et `PHASE3_STATUS.md` déclarent ces phases « terminées » et
que le code correspondant existe bel et bien dans `src/`. Trois documents de
suivi se contredisent ; aucun ne décrit l'état réel du dépôt. La matrice n'a
donc **pas** été utilisée comme source dans cet audit.

### 10.2 Fonctionnalités absentes de la matrice

La matrice ne mentionne nulle part :

| Absent de la matrice | Référence Flutter |
|---|---|
| **Internationalisation (808 clés × fr/en)** et le sélecteur de langue | `lib/l10n/`, `locale_provider.dart`, `parametres_page.dart` |
| Échelle de taille de texte (accessibilité) | `preferences_accessibilite.dart` |
| Progression de lecture et reprise à la page | `/api/progress/lecture`, `pdf_reader_page.dart` |
| Sessions d'étude + file d'attente hors-ligne | `study_session_queue.dart`, `/api/progress/sessions` |
| Historique de recherche local | `historique_recherches.dart` |
| Pastille de notifications non lues (plafond 99+) | `bouton_cloche.dart` |
| Grille « Accès rapide » par type de document | `home_page.dart` (`_GrilleTypes`) |
| Section « Mes matières » avec tronc commun séparé | `home_page.dart` (`_SectionMatieres`) |
| Bannière de re-vérification | `banniere_reverification.dart` |
| File d'attente OTP | `file_attente_otp.dart` |
| Vidage réel du cache | `cache_cleaner_service.dart` |
| Écran d'erreur fatale + écran sans connexion | `ecran_erreur_fatale.dart`, `ecran_sans_connexion.dart` |
| Timeouts HTTP (20 s) | `dio_client.dart` |
| Palette de 10 couleurs par matière, 9 paires de couleurs par type | `app_colors.dart` |
| Notation d'une épreuve **et** d'un document (5 étoiles) | `/rate` |
| Signalement d'un document avec motifs serveur | `/api/reports/motifs` |

### 10.3 Lignes « impossible » ou « adapté » insuffisamment justifiées

| Ligne de la matrice | Problème |
|---|---|
| « Retour : ramène au premier onglet, puis confirme la sortie » → **impossible / sans objet** | Le geste natif n'a effectivement pas d'équivalent, mais la matrice en conclut qu'il n'y a rien à faire. Il reste à définir ce que fait le bouton retour du navigateur sur chaque écran de la coque, et à le vérifier : « sans objet » n'est pas une spécification. |
| « Stockage chiffré » → **impossible tel quel**, repli `localStorage` | L'abaissement de sécurité est reconnu, mais la matrice ne dit pas ce qui le compense (durée de vie du jeton, portée, révocation). Un « risque majeur » sans mesure d'atténuation n'est pas une décision, c'est un report. |
| « 9 boîtes Hive chiffrées » → **adapté** (IndexedDB + WebCrypto) | Présenté comme adapté alors que **rien n'est implémenté** : aucun IndexedDB dans `src/` (vérifié par `grep`). Le statut devrait être « à faire ». |
| « Détection de connectivité » → **adapté** | Correct sur le fond (`navigator.onLine`), mais la matrice ne couvre pas `demarrage_reseau.dart`, qui bloque le démarrage de l'app tant que le réseau n'est pas vérifié. |
| « Politique de confidentialité / conditions » → **fait** | Les pages statiques existent, mais la matrice ne relève pas que Flutter les expose **à l'intérieur** de l'application et **sans compte** (règle 6 du redirect) : un lien sortant vers une page statique n'est pas le même parcours. |
| « Partage » → **adapté** (Web Share + copier le lien) | Ne dit pas que la forme du lien doit rester `/d/:id` sur l'hôte de l'API pour rester ouvrable par l'application mobile. Sans cela, les deux plateformes produisent des liens que l'autre ne sait pas ouvrir. |
| « Authentification biométrique » → **adapté** | Le contrat « jamais d'exception, juste false » est bien repris, mais la matrice présente WebAuthn comme la cible alors que l'implémentation actuelle est un stub assumé. |

---

## 11. Ce que cet inventaire **ne** couvre pas

| Non vérifié | Raison |
|---|---|
| Comportement réel de l'app Flutter sur appareil | Aucun appareil Android connecté (`adb` absent du PATH), aucun simulateur iOS sur Windows. Flutter 3.41.9 est installé : la comparaison visuelle est possible via `flutter run -d chrome`, à valider avec le demandeur (le rendu web de Flutter n'est pas strictement identique au rendu natif). |
| Parcours de bout en bout avec données réelles | Aucun compte de test ni jeton fourni. |
| Push, biométrie, App Links | Testables uniquement sur appareil réel. |
| Conformité du backend | Hors périmètre : l'audit compare deux clients. |
