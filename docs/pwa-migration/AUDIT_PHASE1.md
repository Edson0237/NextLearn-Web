# Phase 1 — Audit (Flutter → PWA Angular)

Aucune modification de code n'a été faite dans cette phase.

## 0. Le prompt suppose une base qui n'existe pas

Le prompt parle de « partir de la base Angular déjà existante (le site web de
l'application) » et de réutiliser « le site Angular existant comme base
technique (structure, services, API, authentification, configuration,
déploiement) ».

Il y a deux projets Angular dans ce dépôt, et **aucun des deux n'est ça** :

| Projet | Ce qu'il est | Appelle l'API ? | Authentification ? |
|---|---|---|---|
| `NextLearn-Web` | Site vitrine (Accueil, À propos, Contact, Équipe) | Non — aucun `HttpClient`, aucun `fetch` | Non |
| `admin_nextlearn_web` | Back-office pour le personnel (gestion de contenu, utilisateurs) | Oui, JWT + intercepteur | Oui, mais pour des administrateurs, pas des étudiants |

Il n'existe **aucun site Angular côté étudiant**. La Phase 3/4 du prompt
(« réutilise au maximum ce qui existe déjà dans le site Angular — auth,
services API, interceptors, modèles ») n'a donc presque rien à réutiliser :
seuls les *patterns* d'`admin_nextlearn_web` (forme de l'intercepteur JWT,
guard, structure de services) sont transposables — pas ses écrans, pensés
pour un tableau de gestion, pas pour une coquille mobile.

**Décision d'architecture (tranchée)** : un seul nom de domaine pour les deux,
donc un seul projet Angular. `NextLearn-Web` devient la base : il porte déjà
le domaine, le pipeline de build Vercel, et les trois pages légales publiées
et testées (`/confidentialite/`, `/conditions/`, `/suppression-compte/`). Le
site vitrine actuel (Accueil, À propos, Contact, Équipe) n'est pas remplacé :
il devient la page publique de ce même projet, et les écrans de l'application
(auth, bibliothèque, etc.) s'ajoutent comme des routes supplémentaires du même
Angular, derrière l'authentification. Un seul manifeste, un seul service
worker, un seul domaine — conforme à la contrainte posée.

Ce que ça implique concrètement, et que je traite comme des choix de mise en
œuvre routiniers (à corriger si je me trompe, pas des points bloquants) :
- La page vitrine actuelle est un défilement d'ancres sur une seule page
  (`app.routes.ts` est vide, les sections sont empilées dans `app.html`). Elle
  devient une route à part (`/` ou `/bienvenue`) pendant que les routes
  applicatives (`/app/...` ou équivalent) prennent le reste — sans casser les
  ancres existantes du footer/header vers les sections de la vitrine.
- `admin_nextlearn_web` n'est plus concerné par l'architecture : ses services
  d'auth restent seulement un modèle à relire pour la forme de
  l'intercepteur JWT, rien de plus (inchangé par rapport à l'audit initial).
- Le dossier `legal/` + `tools/build-legal.mjs` déjà en place dans
  `NextLearn-Web` n'a pas besoin d'être refait : les pages légales restent
  statiques sous `public/`, hors du routage Angular, exactement comme
  aujourd'hui.

Le reste de cet audit porte donc presque entièrement sur le projet Flutter,
qui est la seule source de vérité réelle — fonctionnelle et visuelle.

## 1. Inventaire — projet Flutter

**Architecture** : clean architecture par domaines (`domain` / `infrastructure`
/ `presentation`), 16 domaines, cohérente partout. C'est une structure qui se
transpose bien en « feature folders » Angular (Phase 3 pt. 2 du prompt).

**31 écrans**, listés avec leurs routes exactes dans `PARITY_MATRIX.md`.
Routing via `go_router`, avec une logique de garde non triviale :
reprise d'un parcours OTP interrompu, lien profond mis en attente pendant une
authentification, verrouillage par PIN qui bloque tout sauf la récupération.
Cette logique (dans `app_router.dart`, `RouterNotifier.redirect`) est le
morceau le plus délicat à porter fidèlement — elle n'est pas découpée en
fonctions séparées, c'est une cascade de conditions qui se lit comme un tout.

**~60 endpoints API** recensés (auth compris), contre le même backend que
l'admin back-office (`api-nextlearn.duckdns.org` par défaut, surchargeable).
Compatibilité déjà confirmée dans une session précédente de ce projet : le
contrat API (DTO, codes d'erreur typés, `ACCOUNT_NOT_VALIDATED`, etc.) est
documenté côté backend et stable.

**Design system** déjà séparé et complet dans `lib/app/theme/` :
- Palette exacte, deux jeux (clair/sombre), hex au complet (`app_colors.dart`)
- Grille d'espacement base 4 + 4 rayons par rôle (`app_spacing.dart`)
- Typographie à 3 familles (Poppins/Inter/JetBrains Mono), tailles et graisses
  figées par rôle (`app_text_styles.dart`)
- Durées/courbes d'animation, **avec un contrat d'accessibilité déjà posé** :
  toute animation passe par un point unique qui respecte
  `prefers-reduced-motion` ou l'équivalent système (`app_motion.dart`)

C'est une base inhabituellement propre à traduire en tokens CSS — la Phase 2
du prompt (§1) est largement une transcription, pas une invention.

**21 composants UI partagés**, déjà identifiés et nommés
(`lib/core/ux/`, `lib/shared/widgets/`) : cartes de document, squelettes de
chargement, bannière hors-ligne, feuilles d'action, badge de série, etc.
Correspond directement à la bibliothèque de composants demandée en Phase 2
§3.

**9 boîtes de stockage local chiffrées** (Hive + clé du coffre système) et
**13 clés de stockage sécurisé** (JWT, refresh token, hash du PIN, état de
reprise OTP, compteur de tentatives PIN). Détail en §2 ci-dessous.

**Le web a déjà été anticipé à trois endroits**, chacun avec une implémentation
« inerte » dédiée et un commentaire expliquant pourquoi :
- Notifications push (`push_service_web.dart`) — stub qui ne fait rien
- Scanner de document (`scanner_service_web.dart`) — `disponible = false`,
  repli sur l'import de fichier
- Biométrie (`biometric_service.dart`) — capture déjà `MissingPluginException`

C'est une bonne nouvelle pour la Phase 4 : ces trois points de bascule
existent déjà dans le code source de vérité, il n'y a pas à les découvrir.

**2 langues** (fr/en), **26 fichiers de test** existants côté Flutter — à ne
pas porter tels quels (ce sont des tests Dart), mais chacun documente un
comportement qu'un test Angular équivalent devra couvrir (Phase 6 pt. 1).

## 2. Risque majeur — le stockage sécurisé n'a pas d'équivalent web

`flutter_secure_storage` s'appuie sur le Keychain iOS et le Keystore Android :
une zone protégée par le système, hors d'atteinte d'un autre processus. Il n'y
a **rien d'équivalent sur le web**. Le plugin lui-même retombe sur
`localStorage` en navigateur — en clair, lisible par n'importe quel script
qui s'exécute sur la page.

Ce que ça contient aujourd'hui, côté Flutter : le jeton JWT, le refresh
token, le hash du PIN, et l'état d'un parcours OTP en cours. Les trois
premiers sont exactement ce qu'un vol par injection de script (XSS) chercherait
à voler. Ce n'est pas un détail d'implémentation à lisser en Phase 3 — c'est
un abaissement réel du niveau de sécurité qui doit être **décidé
explicitement**, pas découvert après coup :

- JWT à durée de vie courte + refresh token en cookie `httpOnly` (inatteignable
  en JS, donc en XSS) plutôt qu'en `localStorage`, si le backend peut émettre
  ce genre de cookie — à vérifier côté `nextlearn_api_v1`.
- Une Content Security Policy stricte, qui réduit la surface XSS sans
  supprimer le risque.
- Accepter le risque tel quel et le documenter pour l'utilisateur (dans la
  politique de confidentialité déjà publiée, qui ne le mentionne pas
  aujourd'hui).

Aucune de ces options n'est un choix technique neutre — c'est un choix de
produit. Voir Q2.

## 3. Risque — lecteur PDF

Le lecteur Flutter s'appuie sur `syncfusion_flutter_pdfviewer`, une
bibliothèque commerciale avec rendu natif optimisé. Le web n'a pas
d'équivalent direct de ce niveau : l'option standard est `pdf.js` (Mozilla),
qui fonctionne mais dont la fluidité sur un téléphone d'entrée de gamme (le
public visé, explicitement nommé dans le prompt) n'est pas garantie sans
réglages — pagination à la demande plutôt que rendu intégral, mise en cache
des pages déjà rendues. À tester tôt, pas en fin de projet : c'est l'écran le
plus consulté de l'application (la bibliothèque de documents est le cœur du
produit).

## 4. Risque — persistance hors-ligne sur iOS Safari

La bibliothèque hors-ligne (téléchargement de documents pour consultation
sans réseau) suppose un stockage qui survit à la fermeture de l'onglet et au
nettoyage automatique. Sur Chrome/Android, `navigator.storage.persist()` est
généralement honoré pour une PWA installée. Sur iOS Safari, le comportement
est historiquement moins fiable, même en PWA installée — Safari a réduit à
plusieurs reprises la durée de rétention du stockage pour les sites sans
interaction récente. Le prompt demande une expérience « hors-ligne fiable » :
sur iOS, ça ne peut être promis sans test réel sur un appareil, pas en
émulateur.

## 5. Risque — notifications push sur iOS

Confirmé par la documentation Apple et déjà anticipé dans le prompt lui-même :
le push web sur iOS **n'existe que si la PWA est installée sur l'écran
d'accueil**, et seulement depuis iOS 16.4. Pas de notification pour quiconque
utilise le site dans Safari sans l'avoir installé. C'est une limite de la
plateforme, pas du portage — mais elle doit être dite clairement à
l'utilisateur plutôt que découverte en silence (bannière d'installation qui
explique pourquoi installer, pas seulement qu'on peut installer).

## 6. Point qui n'est pas un risque mais change une habitude Flutter

Le geste « retour » qui ramène au premier onglet puis demande confirmation
avant de fermer l'application (`PopScope` dans `main_shell.dart`) **n'a pas de
sens en PWA** : le bouton retour du navigateur gère l'historique, pas la
fermeture de l'application. Reproduire ce comportement piégerait
l'utilisateur dans une boucle de confirmation sur un geste qui, sur le web,
veut juste dire « page précédente ». À ne pas porter — à documenter dans la
matrice comme « sans objet », ce qui est déjà fait.

## 7. Ce qui est bon signal pour la suite

- La séparation déjà en place pour web (push, scan, biométrie) suit un même
  patron (import conditionnel ou classe inerte avec le même contrat) — ce
  patron peut guider la Phase 3/4 plutôt que d'en inventer un nouveau.
- Le design system est presque entièrement isolé du reste du code. Deux
  exceptions trouvées par grep, et toutes deux assumées par un commentaire
  dans le code plutôt que par une dérive silencieuse : `onboarding_page.dart`
  et `bottom_nav_bar.dart` gardent une palette propre à l'onboarding (bleu
  #1A6FBF, ambre, émeraude — différente de la charte officielle), avec la
  note explicite « palette historique de l'onboarding, volontairement figée
  ici […] ne pas remplacer par AppColors sans revalider le rendu ». À porter
  donc comme un choix délibéré (un jeu de couleurs propre à ces écrans), pas
  à unifier par erreur avec la charte générale en Phase 2.
- Le contrat d'accessibilité (réduction de mouvement, échelle de texte
  composable avec le réglage système) existe déjà et est documenté dans le
  code — à reprendre à l'identique, pas à redécider.
- Le contrat API est déjà stable et documenté côté backend (session
  précédente de ce projet : audit complet Backend ↔ Back-office, tests à
  jour) — aucune incertitude côté serveur qui retarderait le portage.

## Questions à trancher avant la Phase 2

**Q1 — Où vit le nouveau projet ? Tranché.**
Un seul domaine, un seul projet : `NextLearn-Web` est la base, la vitrine
devient sa page publique, l'application s'ajoute en routes supplémentaires du
même Angular. Voir §0 pour le détail et les choix de mise en œuvre qui en
découlent.

**Q2 — Stockage des jetons (§2) : quel compromis de sécurité ?**
Cookie `httpOnly` côté backend (demande une modification de
`nextlearn_api_v1`), CSP stricte, ou acceptation documentée du risque
`localStorage` ? Cette décision conditionne l'intercepteur HTTP de la
Phase 3 — mieux vaut la prendre avant que ce code existe.

**Q3 — Bibliothèque UI de base ?**
Le prompt laisse `[À REMPLIR]`. Vu la fidélité visuelle exigée (reproduire un
design system déjà figé, pas un thème Material standard), je recommande
**SCSS custom + Angular CDK** (primitives d'accessibilité et d'overlay sans
imposer un look Material ou un autre système de design par-dessus celui qui
existe déjà) plutôt qu'Angular Material ou PrimeNG, qui imposeraient leur
propre vocabulaire visuel à défaire ensuite partout.

**Q4 — Lecteur PDF (§3) : valider `pdf.js` sur un appareil bas de gamme réel
avant d'engager la Phase 4 sur cet écran**, plutôt qu'après.

**Q5 — Priorité du scope** : le prompt liste 31 écrans et ~60 endpoints.
Builder tout avant de livrer quoi que ce soit est un risque en soi. Je
recommande de livrer la Phase 5 (PWA installable, manifeste, service worker)
sur un périmètre volontairement réduit — auth + bibliothèque + lecteur PDF,
les trois quarts de l'usage réel — et d'enchaîner les domaines restants
derrière, plutôt que d'attendre la parité complète pour le premier
déploiement testable.

---

Pas de modification de code dans cette phase, conformément au prompt. En
attente de validation sur Q1/Q2/Q3 avant d'ouvrir la Phase 2.
