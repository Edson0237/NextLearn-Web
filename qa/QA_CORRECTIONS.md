# QA_CORRECTIONS.md - ce qui a été corrigé, et comment on le sait

**Date** : 22 octobre 2026 · Suite donnée à [QA_REPORT.md](QA_REPORT.md).
Le rapport d'audit n'a pas été réécrit : il reste le constat daté du 21 octobre.
Ce document dit ce qui a changé depuis, et ce qui ne l'a pas été.

---

## 1. Le backend, vérifié sur sa source

Dépôt cloné depuis `github.com/giovannicharles/nextlearn_api_v1` (HEAD `95ae879`)
et lu : 22 modules, les montages de routes, les modèles Mongo, l'enveloppe de
réponse (`{ data, meta }` / `{ error: { code, message } }`), la liste blanche
CORS, le service d'envoi push.

Deux constats du rapport sont **annulés** - c'étaient des artefacts de mon
extraction d'endpoints, pas des défauts :

| Dit dans le rapport | Réalité |
|---|---|
| « `/api/progression/week` et `/matiere` » | Les deux clients appellent bien `/week-activity` et `/matiere-activity`. L'inventaire les avait tronqués au tiret. |
| « `/api/notifications/unread` et `POST /read` » | Les deux clients appellent `/unread-count` et `PUT /:id/read`. Même troncature. |

Et **six défauts supplémentaires** sont apparus, qu'aucune lecture des deux
clients seuls n'aurait pu montrer : la PWA lisait des clés que le serveur
n'envoie pas.

| # | Défaut | Conséquence visible | Correctif |
|---|---|---|---|
| BK-01 | Le corps d'une notification était lu sous `message` ; le serveur envoie `corps` | Toutes les notifications s'affichaient avec un titre et **un corps vide** | `notification.model.ts` aligné ; la destination vient de `metadata`, pas d'un `cibleRoute` inexistant |
| BK-02 | Badges lus en `nom`/`icone`/`decroche`/`dateDecroche` ; le serveur envoie `type`/`titre`/`description`/`earnedAt` | **Aucun badge** ne s'affichait correctement | `progression.model.ts` aligné sur `BadgeModel` (Flutter) |
| BK-03 | Activité de la semaine lue sous `date` ; la clé est `day` | Graphe de la semaine **vide** | idem |
| BK-04 | Activité par matière lue en `matiereId`/`matiereNom` ; la clé est `matiere` | Section **vide** | idem |
| BK-05 | Stats lues en `docsTelecharges`/`heuresEtude`, absents de `/api/progression/stats` | Deux compteurs à **zéro** ; `sessionCount` et `matiereTop` ignorés | Stats alignées ; les heures se calculent depuis `totalMinutes` |
| BK-06 | Résultat de quiz lu en `total`/`bonnesReponses` ; le serveur envoie `totalQuestions` et `details` | Score affiché **sur 0**, et la correction par question jamais montrée | `quiz.model.ts` aligné ; l'écran affiche la correction, bonne réponse et explication comprises |

Autres points confirmés sur le code du serveur :

- **M-06** : les statuts de vérification sont bien `en_attente | en_revue |
  infos_complementaires_requises | approuve | rejete` (+ `statut: null`). Le
  modèle d'écran de la PWA attendait `verifie`, que l'API n'envoie jamais.
- **M-12** : `CORS_ORIGINS` doit contenir l'origine de la PWA. Le
  rafraîchissement de jeton était le **seul** appel à sortir de l'origine : un
  domaine oublié et c'était la seule requête qui échouait - donc toutes les
  sessions qui expiraient au bout d'un quart d'heure, sans rien casser d'autre.
  Il passe désormais par la même réécriture que le reste.
- **M-16** : `/d/:id` est servi par l'API avec une page de secours « Obtenir
  NextLearn ». Le format de lien est donc bien celui-là, et la PWA l'émet et le
  reconnaît maintenant.
- Les en-têtes `X-Device-Platform` et `X-App-Version` **sont** dans la liste
  blanche CORS : l'argument « préflight » qui justifiait de ne rien envoyer
  depuis le web ne tient plus. Laissé en l'état (le serveur nomme déjà les
  sessions de navigateur par le `User-Agent`), mais le commentaire du code est
  désormais inexact.

---

## 2. Les cinq bloquants

| # | État | Preuve |
|---|---|---|
| **B-01** navigation sans préfixe `/app` | ✅ corrigé | 30 appels réécrits ; route `**` ajoutée vers un écran 404 ; `grep "navigate(['/'," src/app/features` ne renvoie plus rien |
| **B-02** lecteur PDF invisible | ✅ corrigé | Deux causes : conteneur de hauteur nulle (`:host` en `100dvh`) **et** worker pdf.js chargé depuis un CDN par défaut, absent en production. Worker auto-hébergé. Mesure : viewport 390×771, canvas 390×551, couche de texte présente (avant : 390×0, aucun canvas) |
| **B-03** textes légaux vides et inaccessibles | ✅ corrigé | `DomSanitizer` sur l'`iframe` (fin de `NG0904`) ; les deux routes légales sortent de la garde, comme la règle 6 de `app_router.dart`. Sonde : `/app/legal/document/conditions` déconnecté → reste sur place, le cadre affiche « Conditions générales d'utilisation… » |
| **B-04** aucune internationalisation | ✅ corrigé | **1011 clés en français et en anglais**, sans écart. Les 808 clés de l'ARB Flutter exportées telles quelles + 203 clés propres aux écrans web. ~435 textes convertis dans 44 gabarits et 25 fichiers TypeScript. Sélecteur de langue réel (système / français / anglais), effet immédiat, `<html lang>` suivi |
| **B-05** rien ne fonctionne hors ligne | ✅ corrigé | `dataGroups` ajouté à `ngsw-config.json` (19 familles d'URL, stratégie « fraîcheur », 7 j) ; stockage réel des documents en Cache Storage, fiche comprise ; le lecteur ouvre la copie locale en priorité ; la bibliothèque hors ligne se dresse sans réseau |

---

## 3. Les écarts majeurs

| # | Objet | État |
|---|---|---|
| M-01 | Couleurs de type figées sur le jeu sombre | ✅ `var(--type-*)` : la teinte suit le thème |
| M-02 | Fiche document : notation, signalement, téléchargement | ✅ les trois ajoutés ; module de modération créé (motifs servis par l'API, jamais recopiés) |
| M-03 | « Document introuvable » pendant le chargement | ✅ squelettes, état d'erreur avec reprise, état vide distinct |
| M-04 | Accueil amputé | ✅ « Reprendre », « Mes matières » (tronc commun séparé), « Accès rapide », statistiques réelles, pastille de non-lus (plafond 99+) |
| M-05 | Progression de lecture et sessions d'étude | ✅ page mémorisée et restaurée, session envoyée au-delà de 5 s et d'une page (même seuil que Flutter) |
| M-06 | Deux modèles de vérification incompatibles | ✅ un seul modèle ; l'écran d'attente nomme les cinq statuts, affiche le motif de rejet et les resoumissions restantes |
| M-07 | Aucune détection de mise à jour | ✅ `SwUpdate` + bandeau « Mettre à jour » ; jamais de rechargement imposé |
| M-08 | Pas de bouton d'installation | ✅ `beforeinstallprompt` capté, refus mémorisé, guide iOS affiché à qui n'a pas installé |
| M-09 | Push absent | ⚠️ **tout est câblé, il manque deux valeurs** : `PushService` (permission, jeton FCM, enregistrement, message au premier plan), service worker dédié, clic qui ouvre la bonne fiche, interrupteur réel. `public/firebase-config.json` attend `appId` et `vapidKey` - ils s'obtiennent en déclarant une application **Web** dans la console Firebase du projet `nextlearn-91195`, qui n'a aujourd'hui qu'un client Android. Sans eux, le service se déclare « pas encore disponible » et ne tente rien - le même parti que le service d'envoi côté API sans sa clé |
| M-10 | Manifeste et balises iOS | ✅ `id`, `theme_color`, `background_color`, `description`, `lang`, `orientation`, `categories`, **2 icônes maskable générées** ; balises `apple-*`, `theme-color` clair/sombre, `viewport-fit=cover` |
| M-11 | 820 Kio de JavaScript inutile | ✅ `loadComponent` par écran : le morceau d'entrée de l'application passe de **856 Ko à 20 Ko**, le lecteur PDF est isolé dans son propre morceau |
| M-12 | Aucun délai d'expiration HTTP | ✅ 20 s, comme Dio ; présenté comme un statut 0, que `Failure` sait déjà nommer |
| M-13 | Cibles tactiles sous le seuil | ✅ **cause trouvée** : `_native.scss` était inclus depuis une feuille de composant, donc réécrit avec l'attribut d'encapsulation - la règle des 48 px ne touchait aucun écran. Déplacé en feuille globale. Audit `target-size` de Lighthouse : **échec → succès** |
| M-14 | Typographie | ✅ `--font-family-heading`, appelé par 10 règles, n'était défini nulle part. (Le rapport parlait aussi d'un corps en Poppins : c'était le `body` de la vitrine, mesuré hors de `.nl-app` - constat retiré) |
| M-15 | Débordements horizontaux | ✅ la barre d'actions visait `nl-button`, un élément qui n'existe pas (`nlButton` est une directive) : aucune largeur n'était partagée. Corrigé et mis sur deux rangées |
| M-16 | Liens de partage incompatibles | ✅ `LienProfond` porté ; la PWA émet `…/d/<id>` et résout `/d/:id` |
| M-17 | Bandeau hors-ligne jamais câblé | ✅ `ReseauService` + bandeau dans la coque |
| M-18 | Quatre réglages sur treize étaient des toasts | ✅ langue, notifications, réduction d'animations, taille du texte : tous réels ; vidage du cache effectif (sans toucher aux documents hors ligne) ; compteur de fichiers réel |
| M-19 | `/app` nu en 404 | ✅ règle ajoutée à `vercel.json` ; vérifié : 200 |
| M-20 | Feuilles externes en production | ✅ Google Fonts et Font Awesome déplacés dans le composant vitrine, qui seul s'en sert |

---

## 4. Les mineurs et cosmétiques

✅ m-01 historique de recherche (local, jamais envoyé) · ✅ m-02 correction par
question · ✅ m-03 replis « Non renseigné » · ✅ m-04 journalisation de
diagnostic rétablie hors production (13 dépôts) · ✅ m-05 trace retirée ·
✅ m-06 entrée en cascade appliquée à six listes réelles · ✅ m-07 catalogue de
composants réservé au développement · ✅ m-08 le test du lecteur PDF vérifie
désormais qu'il **affiche** quelque chose · ✅ m-09 préchauffage avant la suite
e2e (plus d'échec à froid) · ✅ c-01 logo centré · ✅ c-06 barre d'outils de
l'accueil sur deux rangées.

Non traités, et assumés : **c-02 à c-05** (libellés externes plutôt
qu'internes aux champs, sous-titre d'inscription, flèche de retour, icônes des
puces d'onboarding) - des choix de formulation et d'iconographie qui relèvent
d'un arbitrage de design, pas d'un défaut.

---

## 5. Ce que mesurent les chiffres

| Mesure | Avant | Après |
|---|---|---|
| Lighthouse mobile - Performance | **49** | **80** |
| Lighthouse mobile - Accessibilité | 95 | **100** |
| Lighthouse mobile - Bonnes pratiques | 100 | 100 |
| Lighthouse mobile - SEO | 100 | 100 |
| Premier affichage (FCP) | 6,3 s | **0,7 s** |
| Plus grand élément affiché (LCP) | 10,8 s | **4,5 s** |
| Blocage du fil principal (TBT) | 420 ms | **160 ms** |
| Poids total | 1 772 Kio | **576 Kio** |
| JavaScript inutile | 820 Kio | **122 Kio** |
| Audit `target-size` | échec | **succès** |
| Morceau d'entrée de l'application | 856 Ko | **20 Ko** |
| Tests unitaires | 113 | **131** |
| Tests Node | 25 | 25 |
| Tests e2e Playwright | 13 (dont 7 instables à froid) | **13, stables** |

Trois leviers expliquent l'essentiel du gain de performance : le chargement
paresseux par écran, un écran de démarrage en HTML et CSS seuls dans
`index.html` (le premier affichage ne dépend plus du JavaScript), et le fait
de ne plus attendre le catalogue de traductions quand la langue est le
français - les gabarits portent déjà ce texte en secours.

**Mesure honnête** : les scores sont relevés sur le build de production servi
localement **avec compression gzip**, comme le fait Vercel. Sans elle, le même
build tombe à 62 : ce n'est pas l'application qui change, c'est le serveur de
mesure.

---

## 6. Ce qui reste à faire, et par qui

| Reste | Qui | Pourquoi ce n'est pas fait |
|---|---|---|
| Déclarer une application **Web** dans la console Firebase (`nextlearn-91195`), coller `appId` et `vapidKey` dans `public/firebase-config.json` | vous | Le projet n'a qu'un client Android ; ces deux valeurs ne s'obtiennent que dans la console. Tout le reste du push est écrit et attend |
| Ajouter l'origine de la PWA à `CORS_ORIGINS` côté API | vous | Variable d'environnement du serveur |
| Décider si `GET /api/documents` doit rester **public** | vous | Le catalogue complet, `uploadedBy` et `fichierHash` compris, répond sans jeton. Hors périmètre d'un client, mais à trancher |
| Comparer écran par écran sur appareil réel | vous | Aucune référence Flutter automatisable pour les 27 écrans authentifiés (le stockage de session de Flutter web est chiffré) ; la checklist du §9 du rapport reste valable |
| Rangées de documents horizontales sur l'accueil | à arbitrer | Flutter les fait défiler horizontalement ; la PWA les empile. L'empilement évite du contenu caché sur petit écran - divergence délibérée, à confirmer ou à annuler |

---

## 7. Garanties

- **Projet Flutter inchangé** : `git status` identique avant et après, même
  `HEAD` (`b3eea6a`). Seul `build/`, ignoré par git, a été écrit par
  `flutter build web` pour produire les captures de référence.
- **Aucun code applicatif du backend touché** : le dépôt n'a servi qu'à lire
  les contrats, dans une copie jetable hors du projet.
- **Build de production** : 0 erreur, 0 avertissement.
- **Tous les tests passent** : 131 unitaires, 25 Node, 13 e2e.
