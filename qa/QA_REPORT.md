# QA_REPORT.md - recette de parité PWA Angular ↔ application Flutter

**Date** : 21 octobre 2026 · **Auditeur** : recette indépendante, aucune participation au développement
**Référence (lecture seule)** : `C:\Users\USER\StudioProjects\nextlearn` (Flutter, arbre de travail)
**Audité** : `C:\Users\USER\StudioProjects\nextlearn\NextLearn-Web` (Angular 21, arbre de travail)
**Inventaire indépendant** : [QA_INVENTORY.md](QA_INVENTORY.md)

---

> **Mise à jour du 22 octobre 2026.** Ce rapport reste le constat daté du
> 21 octobre, non réécrit : c'est la trace de ce qui a été trouvé. Les
> corrections qui ont suivi, les six défauts supplémentaires révélés par la
> lecture du backend et les mesures d'après sont dans
> [QA_CORRECTIONS.md](QA_CORRECTIONS.md). Deux constats du §3 y sont annulés
> (endpoints de progression et de notifications : artefacts d'extraction, pas
> des défauts).

## 1. Verdict

# 🚫 NO-GO

La PWA n'est pas en état d'être proposée aux étudiants comme équivalent de
l'application mobile, et trois des motifs suffiraient seuls à bloquer :

1. **La navigation interne est cassée.** Trente appels de navigation
   construisent une URL sans le préfixe `/app`, qui ne correspond à aucune
   route déclarée. Seize cas ont été reproduits à l'exécution : le bouton
   retour de douze écrans et quatre raccourcis de l'accueil ne font rien
   d'autre qu'émettre `NG04002: Cannot match any routes`. Un étudiant qui
   ouvre une fiche de document ne peut plus en sortir autrement qu'avec le
   bouton du navigateur.
2. **Le lecteur de documents n'affiche rien.** Le PDF est bien téléchargé et
   analysé, mais son conteneur mesure 390 × **0** pixel : l'écran se résume à
   sa barre de titre. C'est la fonction centrale du produit.
3. **Les textes légaux ne s'affichent pas dans l'application et sont
   inaccessibles sans compte.** `NG0904` est levée sur leur `iframe`, et la
   garde de routage renvoie vers l'onboarding quiconque n'est pas connecté -
   là où Flutter les rend lisibles dans les deux cas, précisément parce
   qu'Apple et Google l'exigent.

S'y ajoutent l'absence totale d'internationalisation (808 clés × 2 langues
côté Flutter, zéro côté PWA), l'absence de tout fonctionnement hors ligne
au-delà de la coque applicative, et une performance mobile mesurée à **49/100**
sur Lighthouse pour un objectif de 80.

**Ce qui est solide et ne doit pas être refait** : la traduction des jetons de
design (toutes les valeurs hexadécimales, l'espacement, les rayons, les
durées et les courbes correspondent au code Flutter), la garde de routage
(portée règle par règle, y compris la reprise d'un parcours OTP), la politique
de PIN (identique au caractère près), le modèle d'échec unifié, l'intercepteur
de jeton avec rafraîchissement dédupliqué, et le découpage des composants
partagés. L'ossature est juste ; c'est le remplissage des écrans et le
câblage qui ne le sont pas.

---

## 2. Méthode et force des preuves

| Ce qui a été fait | Comment | Ce que ça prouve |
|---|---|---|
| Inventaire indépendant | Lecture de 179 fichiers Dart | La référence, sans passer par la matrice |
| Comparaison de code | Fichier à fichier, Flutter ↔ Angular | Écarts de logique, de validation, de modèle |
| Sondage de 35 écrans | Playwright, session simulée, faux backend | URL finale, texte rendu, erreurs console, requêtes en échec |
| Parcours de navigation | Clic réel sur les boutons retour et raccourcis | Les `NG04002` observés, pas déduits |
| Mesures de mise en page | `getBoundingClientRect` dans la page | Hauteur nulle du lecteur PDF, cibles tactiles, débordements |
| Captures comparées | Flutter web (CanvasKit, fr-FR) ↔ PWA, 390×844, clair + sombre | Écarts visuels sur les écrans publics |
| Conformité PWA | Build de production servi localement, service worker actif | Manifeste, métadonnées, hors-ligne réel |
| Performance | Lighthouse 12, profils mobile et bureau | Scores et métriques Web Vitals |
| Non-régression | `ng build`, 113 tests Angular, 25 tests Node, 13 tests Playwright | Tous verts (voir §8) |

**Limite assumée et explicite** : les appels réseau ont été simulés
(décision validée avec le demandeur). Les charges utiles ont été construites
à partir des parsers **Flutter**, pas de ceux d'Angular, pour que la PWA soit
confrontée exactement à ce que l'application mobile reçoit. Ce qui n'est donc
**pas** prouvé : les contrats réels du backend, les codes d'erreur réellement
renvoyés, les quotas et limitations de débit.

Artefacts : `qa/rapport-fonctionnel.json`, `qa/rapport-retours.json`,
`qa/rapport-navigations.json`, `qa/rapport-pdf-boite.json`, `qa/rapport-pwa.json`,
`qa/rapport-design.json`, `qa/rapport-responsive.json`, `qa/rapport-perf.json`,
`qa/rapport-vitrine.json`, `qa/screenshots/`.

---

## 3. Scores

### 3.1 Parité fonctionnelle : **26 / 70 = 37 %**

Méthode : les 70 fonctionnalités de `QA_INVENTORY.md` (hors éléments purement
internes), chacune classée au vu d'une preuve. ✅ exige **code lu ET parcours
exécuté**. Le détail est au §4.

| Verdict | Nombre | Part |
|---|---|---|
| ✅ Conforme | 26 | 37 % |
| ⚠️ Écart mineur | 8 | 11 % |
| ❌ Écart majeur ou absent | 26 | 37 % |
| 🚫 Impossible sur le web | 3 | 4 % |
| ❓ Non vérifié | 7 | 10 % |

Si l'on retire les 3 limites de plateforme et les 7 non vérifiées, la parité
sur ce qui était vérifiable est de **26 / 60 = 43 %**.

### 3.2 Fidélité du design : **0 / 7 écran comparable strictement conforme**

Seuls 7 écrans sont capturables côté Flutter (les écrans publics : la session
de `flutter_secure_storage` sur le web est chiffrée et ne peut pas être semée
de l'extérieur, contrairement au `localStorage` de la PWA).

| Écran | Verdict | Écart principal |
|---|---|---|
| splash | ❓ | Non comparé (écran transitoire) |
| onboarding | ⚠️ | Sélecteur de langue absent, icônes des puces absentes, illustration différente |
| register | ❌ | Le champ « Nom » déborde hors de l'écran à 390 px |
| login-pin | ⚠️ | Logo non centré, champ à libellé externe au lieu d'un libellé interne |
| reset-pin | ❓ | Capturé, non analysé en détail |
| legal-confidentialite | ❌ | Page vide (`NG0904`) |
| legal-conditions | ❌ | Page vide (`NG0904`) |

Les 27 écrans authentifiés n'ont **pas** de référence Flutter : leur fidélité
visuelle est **non vérifiée** et figure dans la liste de tests manuels (§9).
Ce qui a pu être vérifié sur eux sans référence - jetons, typographie, cibles
tactiles, débordements, thème sombre - l'a été et figure au §5.

---

## 4. Tableau de recette

Légende : ✅ conforme · ⚠️ mineur · ❌ majeur/absent · 🚫 plateforme · ❓ non vérifié
« Design clair/sombre » : ✅ signifie « rendu sans défaut constaté sur la capture »,
pas « identique à Flutter » - faute de référence pour les écrans authentifiés.

| # | Écran / Fonctionnalité | Fonctionnel | Design clair | Design sombre | Hors-ligne | Preuve |
|---|---|---|---|---|---|---|
| 1 | Splash + restauration de session | ✅ | ❓ | ❓ | ❌ | `rapport-fonctionnel.json` → `/app` → `/app/onboarding` |
| 2 | Onboarding | ✅ | ⚠️ | ❓ | ✅ | captures `onboarding/` |
| 3 | Inscription - identité | ❓ | ❌ | ❓ | ❌ | capture `register/` : champ « Nom » coupé |
| 4 | Inscription - parcours (cascade) | ❓ | ❓ | ❓ | ❌ | non exécuté (backend) |
| 5 | OTP inscription | ❓ | ❓ | ❓ | ❌ | non exécuté (backend) |
| 6 | Création du PIN | ❓ | ❓ | ❓ | ❌ | non exécuté (backend) |
| 7 | Connexion par PIN | ❓ | ⚠️ | ❓ | ❌ | captures `login-pin/` |
| 8 | Déverrouillage local | ✅ | ❓ | ❓ | ✅ | 4 tests e2e du dépôt, verts |
| 9 | Réinitialisation du PIN | ❓ | ❓ | ❓ | ❌ | non exécuté (backend) |
| 10 | Reprise d'un parcours OTP | ✅ | - | - | - | `auth.guard.ts` ligne à ligne vs `app_router.dart` |
| 11 | Biométrie | 🚫 | - | - | - | `biometric.service.ts` : stub assumé |
| 12 | Rafraîchissement de jeton | ⚠️ | - | - | - | `auth.interceptor.ts:97` part en cross-origin |
| 13 | Coque à 5 onglets | ✅ | ✅ | ✅ | ✅ | captures `home/` |
| 14 | État préservé par onglet | ❓ | - | - | - | `TabReuseStrategy` non mesurée |
| 15 | Gardes de routage | ✅ | - | - | - | 35 sondages d'URL |
| 16 | Navigations internes | ❌ | - | - | - | `rapport-navigations.json` : 4 `NG04002` |
| 17 | Boutons retour | ❌ | - | - | - | `rapport-retours.json` : 12 `NG04002` |
| 18 | Liens profonds `/d/:id` | ❌ | - | - | - | non porté (`auth.guard.ts`, commentaire) |
| 19 | Accueil (hors sections) | ⚠️ | ⚠️ | ⚠️ | ❌ | captures `home/` : 4ᵉ outil tronqué, stats figées à 0 |
| 20 | Catalogue par matière | ✅ | ✅ | ✅ | ❌ | captures `catalogue-matieres/` |
| 21 | Page matière | ✅ | ✅ | ✅ | ❌ | captures `matiere/` |
| 22 | Fiche document | ❌ | ⚠️ | ⚠️ | ❌ | §5 D-07, D-08 |
| 23 | Lecteur PDF | ❌ | ❌ | ❌ | ❌ | `rapport-pdf-boite.json` : viewport 390×0 |
| 24 | Favoris | ✅ | ✅ | ✅ | ❌ | captures `favoris/` |
| 25 | Bibliothèque hors-ligne | ❌ | ✅ | ✅ | ❌ | `offline-repository.ts` : aucun stockage local |
| 26 | Téléchargement de document | ❌ | - | - | - | `recordDownload()` jamais appelé |
| 27 | Notation d'un document | ❌ | - | - | - | `rate()` jamais appelé depuis un écran |
| 28 | Signalement d'un document | ❌ | - | - | - | domaine modération non porté |
| 29 | Recherche | ⚠️ | ✅ | ✅ | ❌ | pas d'historique local |
| 30 | Progression de lecture | ❌ | - | - | - | `/api/progress/lecture` jamais appelé |
| 31 | Liste des épreuves (CC/SN) | ✅ | ✅ | ✅ | ❌ | captures `epreuves-list/` |
| 32 | Détail + notation d'épreuve | ✅ | ✅ | ✅ | ❌ | `epreuve-detail.ts:94` |
| 33 | Téléchargement d'épreuve | ⚠️ | - | - | - | appel présent, pas de progression |
| 34 | Session de quiz | ⚠️ | ✅ | ✅ | ❌ | pas de correction par question |
| 35 | Soumission + score | ✅ | ✅ | ✅ | ❌ | captures `quiz-session/` |
| 36 | Tableau de bord progression | ⚠️ | ✅ | ✅ | ❌ | sections « semaine/matières/sessions » vides avec données présentes |
| 37 | Badges | ✅ | ✅ | ✅ | ❌ | - |
| 38 | Série (streak) | ✅ | ✅ | ✅ | ❌ | - |
| 39 | Sessions d'étude + file d'attente | ❌ | - | - | ❌ | `/api/progress/sessions` jamais alimenté |
| 40 | Formulaire de dépôt | ✅ | ✅ | ✅ | ❌ | licences + import PDF présents |
| 41 | Mes dépôts | ✅ | ✅ | ✅ | ❌ | captures `mes-depots/` |
| 42 | Scan caméra | 🚫 | - | - | - | identique à Flutter web |
| 43 | Formulaire de vérification | ⚠️ | ✅ | ✅ | ❌ | modèle divergent (§5 M-12) |
| 44 | Écran d'attente de vérification | ❌ | ✅ | ✅ | ❌ | statuts incompatibles (§5 M-12) |
| 45 | Blocage d'accès par vérification | ✅ | - | - | - | garde vérifiée |
| 46 | Signalement (feuille) | ❌ | - | - | - | absent |
| 47 | Recours | ✅ | ✅ | ✅ | ❌ | captures `recours/` |
| 48 | Tickets de support | ✅ | ✅ | ✅ | ❌ | captures `support-tickets/` |
| 49 | Motifs de signalement serveur | ❌ | - | - | - | `/api/reports/motifs` jamais appelé |
| 50 | Notifications - liste, lu/non lu | ✅ | ✅ | ✅ | ❌ | captures `notifications/` |
| 51 | Pastille de non-lus | ❌ | ❌ | ❌ | - | `home.html` : cloche sans compteur |
| 52 | Push | ❌ | - | - | - | aucun `SwPush` dans `src/` |
| 53 | Préférence de notifications | ❌ | - | - | - | toast « bientôt disponibles » |
| 54 | Accueil profil | ✅ | ✅ | ✅ | ❌ | captures `profil-home/` |
| 55 | Réglages | ⚠️ | ✅ | ✅ | ❌ | 4 lignes sur 13 sont des toasts |
| 56 | Thème clair/sombre/système | ✅ | ✅ | ✅ | ✅ | `theme.ts` + captures des deux thèmes |
| 57 | Langue | ❌ | - | - | - | `settings-list.ts:119` |
| 58 | Taille du texte | ❌ | - | - | - | `settings-list.ts:155` |
| 59 | Réduction des animations | ❌ | - | - | - | `settings-list.ts:151` |
| 60 | Appareils connectés | ✅ | ✅ | ✅ | ❌ | captures `sessions/` |
| 61 | Suppression de compte | ✅ | ✅ | ✅ | ❌ | écran dédié, 2 étapes |
| 62 | Vidage du cache | ❌ | - | - | - | absent des réglages |
| 63 | À propos | ✅ | ✅ | ✅ | ✅ | captures `a-propos/` |
| 64 | Textes légaux dans l'app | ❌ | ❌ | ❌ | ❌ | `NG0904`, page vide |
| 65 | Internationalisation fr/en | ❌ | ❌ | ❌ | - | aucun module i18n |
| 66 | Détection de connectivité | ❌ | - | - | ❌ | `navigator.onLine` jamais utilisé |
| 67 | Bandeau / écran hors-ligne | ❌ | - | - | ❌ | utilisés uniquement dans la page de démo |
| 68 | Délais d'expiration HTTP | ❌ | - | - | - | aucun `timeout` sur `HttpClient` |
| 69 | Modèle d'échec unifié | ✅ | - | - | - | `failure.model.ts` fidèle |
| 70 | Stockage sécurisé | 🚫 | - | - | - | `localStorage`, risque documenté |

---

## 5. Écarts classés par gravité

### 🔴 Bloquants

---

**B-01 - Trente navigations internes pointent vers des routes inexistantes**

*Reproduction* : ouvrir `/app/bibliotheque/doc/d1`, cliquer sur la flèche retour.
*Flutter* : `context.pop()` ramène à l'écran précédent.
*PWA* : rien ne se passe ; la console affiche `RuntimeError: NG04002: Cannot match any routes`.
*Preuve* : `qa/rapport-retours.json` - 12 écrans concernés (matiere, document-detail,
favoris, offline-library, recherche, quiz-session, progression, notifications, recours,
a-propos, legal-confidentialite, legal-conditions) ; `qa/rapport-navigations.json` -
4 raccourcis de l'accueil (Rechercher, Favoris, Déposer, Voir tout).
*Cause* : `router.navigate(['/', AppRoutes.x])` produit `/home`, `/favoris`, `/recherche`…
alors que toute l'application vit sous `/app` et qu'`app.routes.ts` ne déclare
aucune route `**`. 30 occurrences recensées statiquement
([home.ts:74-94](../src/app/features/home/home.ts#L74-L94),
[document-detail.ts:60](../src/app/features/bibliotheque/document-detail/document-detail.ts#L60), etc.).
*Correctif* : remplacer `['/', X]` par `['/app', X]` - ou, mieux, un service de
navigation unique qui porte le préfixe, pour que l'erreur ne puisse pas revenir.
Ajouter une route `**` vers un écran 404 pour que l'échec soit visible plutôt que muet.
*Estimation* : 2 h + 1 h de tests.

---

**B-02 - Le lecteur PDF affiche une zone de hauteur nulle**

*Reproduction* : ouvrir `/app/bibliotheque/doc/d1/read` avec une URL signée valide.
*Flutter* : le document s'affiche, la barre d'outils se masque au tapotement,
la page de reprise est restaurée.
*PWA* : seule la barre « Lecture » est visible. Après 14 s, toujours aucun canevas.
*Preuve* : `qa/rapport-pdf-boite.json` - `.pdf-reader` = 390×**65**,
`.pdf-reader__viewport` = 390×**0**, `pdf-viewer` = 390×**0**, `nbCanvas: 0`,
alors que le balisage interne de pdf.js est bien présent
(`<div class="page" data-page-number="1">`). Le PDF est donc chargé et analysé,
mais jamais peint. Capture : `qa/screenshots/pdf-reader/pwa_390x844_light_t14000.png`.
*Cause* : `.pdf-reader { height: 100% }` sans hauteur définie sur la chaîne
d'ancêtres (`:host` du composant, `router-outlet`), donc 100 % de rien.
*Correctif* : donner une hauteur définie au `:host` du composant (`display:flex;
height:100dvh` ou `flex:1; min-height:0` sur toute la chaîne).
*Estimation* : 1 h + une capture de non-régression.

---

**B-03 - Les textes légaux ne s'affichent pas, et sont inaccessibles sans compte**

*Reproduction* : (a) ouvrir `/app/legal/document/confidentialite` connecté ;
(b) la même URL déconnecté.
*Flutter* : le document s'affiche dans l'application ; les deux routes légales
sont **toujours** accessibles, connecté ou non (règle 6 du `redirect`), parce
que les liens du formulaire d'inscription y mènent avant tout consentement.
*PWA* : (a) seul le titre s'affiche, le corps est vide et la console lève
`RuntimeError: NG0904: unsafe value used in a resource URL context` ;
(b) redirection vers `/app/onboarding`.
*Preuve* : `qa/rapport-fonctionnel.json` (entrées `legal-confidentialite`,
`legal-conditions`, et leurs variantes « sans compte »).
*Cause* : [legal-document.html:11](../src/app/features/legal/legal-document/legal-document.html#L11)
lie `[src]` à une chaîne brute ; Angular exige un `SafeResourceUrl`. Et la route
`legal/document/:doc` est placée sous `canActivateChild: [authGuard]` sans
équivalent de la liste `routesToujoursAccessibles` de Flutter.
*Conséquence* : exigence Apple 5.1.1 et Google Play non satisfaite **dans
l'application**. Les pages statiques `/confidentialite/` existent, mais c'est
un autre parcours (sortie de l'app, nouvel onglet).
*Correctif* : `DomSanitizer.bypassSecurityTrustResourceUrl` sur une URL
construite à partir d'une liste blanche de deux valeurs ; sortir les deux
routes légales de la garde.
*Estimation* : 2 h.

---

**B-04 - Aucune internationalisation**

*Reproduction* : régler le navigateur en anglais, ouvrir la PWA ; puis
Réglages → Langue.
*Flutter* : 808 clés traduites, français et anglais synchronisés ; la langue
suit le téléphone et se force dans les réglages. Visible dès l'onboarding
(sélecteur « 🌐 AUTO » en haut à droite, capture `onboarding/flutter_*`).
*PWA* : tout est en français codé en dur ; le sélecteur n'existe pas sur
l'onboarding et, dans les réglages, affiche un toast « Langue : bientôt
disponible ».
*Preuve* : aucun module i18n dans `src/` ; [settings-list.ts:119](../src/app/features/profil/settings-list/settings-list.ts#L119).
*Estimation* : 5 à 8 jours (extraction, mise en place `@angular/localize` ou
équivalent, reprise des 808 clés, bascule à chaud).

---

**B-05 - Rien ne fonctionne hors ligne au-delà de la coque**

*Reproduction* : charger `/app/home` en ligne, passer hors ligne, recharger.
*Flutter* : 9 boîtes Hive chiffrées ; les documents déjà vus, les favoris, la
progression et les notifications restent consultables ; les documents
téléchargés s'ouvrent ; les écritures sont mises en file d'attente.
*PWA* : la coque se recharge (le service worker fait son travail), puis chaque
écran affiche « Impossible de charger l'accueil / les documents », sans aucun
bandeau ni écran hors-ligne.
*Preuve* : `qa/rapport-pwa.json` → `horsLigneRechargement`, `horsLigneNavigation` ;
captures `qa/screenshots/hors-ligne/`. `ngsw.json` généré : `"dataGroups": []`.
[offline-repository.ts](../src/app/core/bibliotheque/offline-repository.ts) ne
fait que marquer des identifiants côté serveur - aucun fichier n'est stocké.
Aucun `indexedDB` ni `caches.open` dans `src/`.
*Correctif* : `dataGroups` (performance/freshness) dans `ngsw-config.json` pour
les listes, IndexedDB pour les documents hors ligne, câblage du `OfflineBanner`
et de l'`OfflineScreen` déjà écrits.
*Estimation* : 4 à 6 jours.

---

### 🟠 Majeurs

**M-01 - Les couleurs de type de document sont figées sur le jeu sombre.**
[document.model.ts:48-62](../src/app/core/bibliotheque/document.model.ts#L48-L62)
renvoie `#7fa9ee` (cours), `#5fd08a` (TD), `#f3796b` (épreuve)… qui sont, au
caractère près, les valeurs **sombres** de `_tokens.scss`. En thème clair,
Flutter utilise `#3b74d6`, `#16a34a`, `#dc2626`. Résultat visible sur
`qa/screenshots/home/pwa_390x844_light.png` : des étiquettes pâles sur fond
blanc, sous le seuil de contraste. Les variables CSS correctes existent
pourtant (`--type-cours` par thème) : la fonction les contourne.
*Correctif* : renvoyer `var(--type-cours)` etc. **Estimation : 30 min.**

**M-02 - La fiche document perd la notation, le signalement et le téléchargement.**
Flutter : barre d'actions à trois niveaux (ouvrir / télécharger avec
progression / favori), notation 5 étoiles vers `POST /rate`, menu « Signaler »
alimenté par `/api/reports/motifs`, retrait du hors-ligne avec confirmation.
PWA : Lire / Favori / Hors ligne. `rate()` et `recordDownload()` existent dans
le dépôt mais **ne sont appelés par aucun écran**. **Estimation : 2 j.**

**M-03 - La fiche document affiche « Document introuvable » pendant son chargement.**
[document-detail.html:76](../src/app/features/bibliotheque/document-detail/document-detail.html#L76) :
le `@else` de `@if (document())` rend l'état vide dès le premier rendu, avant
toute réponse. Le signal `error()` est renseigné mais n'est affiché nulle part.
**Estimation : 1 h.**

**M-04 - L'accueil perd trois sections et affiche des chiffres faux.**
Absents : « Mes matières » (avec le tronc commun séparé), « Reprendre »
(progression de lecture), la grille « Accès rapide » par type. Les compteurs
« Hors ligne » et « Lus » sont écrits en dur à `0`
([home.html:25-33](../src/app/features/home/home.html#L25-L33)) alors que
Flutter affiche les vrais. La cloche n'a pas de pastille de non-lus.
**Estimation : 3 j.**

**M-05 - Progression de lecture et sessions d'étude absentes.**
`/api/progress/lecture` et `/api/progress/sessions` ne sont jamais appelés. Le
lecteur ne mémorise ni la page courante ni le temps passé ; le tableau de bord
ne peut donc rien afficher de réel, et la file d'attente hors-ligne de Flutter
n'a pas d'équivalent. **Estimation : 3 j.**

**M-06 - Deux modèles de vérification académique incompatibles coexistent.**
La garde et le service utilisent `core/models/verification.model.ts`
(`requis | en_attente | en_revue | infos_complementaires_requises | approuve | rejete`,
conforme à Flutter). Les **écrans** utilisent `core/verification/verification.model.ts`
(`non_soumis | en_attente | verifie | rejete`), avec un `as` qui accepte
n'importe quelle chaîne. Le serveur envoyant `approuve`, l'écran d'attente ne
reconnaîtra jamais l'état validé, et n'affiche ni le motif de rejet, ni le
nombre de resoumissions restantes - les deux informations que Flutter montre.
**Estimation : 1 j.**

**M-07 - Aucune détection de mise à jour (`SwUpdate`).**
Aucune bannière « Nouvelle version disponible », aucune activation contrôlée.
Avec des chunks hachés et un `index.html` resté en cache, une mise en ligne
peut produire des erreurs de chargement de chunk chez les visiteurs déjà
ouverts. **Estimation : 0,5 j.**

**M-08 - Aucun bouton d'installation Android (`beforeinstallprompt`), aucune aide iOS.**
La matrice prévoyait les deux. **Estimation : 1 j.**

**M-09 - Push totalement absent.** Ni `SwPush`, ni demande de permission, ni
appel à `/api/notifications/device`, ni gestion du clic. **Estimation : 2 à 3 j**
(et uniquement Android + iOS ≥ 16.4 installé).

**M-10 - Manifeste incomplet et métadonnées iOS absentes.**
Mesuré sur le build de production (`qa/rapport-pwa.json`) : manquent `id`,
`theme_color`, `background_color`, `description`, `lang`, `orientation`,
`screenshots`, `categories` ; **0 icône `maskable`**. Dans `index.html` :
aucune balise `theme-color`, `apple-mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, ni image de
démarrage. Le `viewport` n'a pas `viewport-fit=cover`, ce qui **annule**
l'usage des `env(safe-area-inset-*)` de `_native.scss` : sur iPhone, la barre
d'onglets passera sous l'indicateur d'accueil. **Estimation : 0,5 j.**

**M-11 - Performance mobile à 49/100.**
Lighthouse 12, profil mobile, sur `/app/login` servi en production :
LCP **10,8 s**, FCP 6,3 s, TTI 10,8 s, TBT 420 ms, Speed Index 6,6 s,
CLS 0,007. Poids total 1 772 Kio, dont **820 Kio de JavaScript inutilisé**.
Cause principale : `app-shell.routes.ts` déclare les 35 écrans en `component:`
et non en `loadComponent:`, donc le chunk `app-shell-routes` (856 Kio bruts)
embarque tout - y compris le lecteur PDF - pour afficher un écran de connexion.
Bureau : 84/100. **Objectif du cahier des charges : ≥ 80.**
*Correctif* : `loadComponent` par écran, et sortir `ng2-pdf-viewer` du chemin
critique. **Estimation : 1 j.**

**M-12 - Aucun délai d'expiration HTTP.**
Flutter coupe à 20 s (`dio_client.dart`) et sait dire « le serveur met du temps
à répondre ». La PWA n'a aucun `timeout` : sur un réseau lent - le cas d'usage
visé - une requête reste pendante indéfiniment et l'écran reste en chargement.
Ironie : le message existe déjà dans `failure.model.ts:44` mais n'est atteint
que sur `status === 0`. **Estimation : 2 h.**

**M-13 - Cibles tactiles sous le seuil.**
Mesuré dans la page (`qa/rapport-design.json`) : **38** éléments interactifs
sous 44 px sur la bibliothèque (boutons d'icône à 40×40), 16 sur l'accueil,
7 sur les épreuves (segments à 116×32, puces à 69×32). Flutter impose 48 dp
(`AppTouch.minimum`) et le jeton `--touch-min: 48px` existe - il n'est pas
appliqué. Lighthouse confirme : audit `target-size` **en échec**.
**Estimation : 0,5 j.**

**M-14 - Les rôles typographiques sont inversés.**
Mesuré : `body` rend en **Poppins** sur les 7 écrans sondés, alors que le
contrat Flutter réserve Poppins aux titres et aux boutons et donne **Inter** au
corps ; sur `profil-home` et `parametres`, c'est l'inverse (titres en Inter).
JetBrains Mono n'est jamais chargée. **Estimation : 0,5 j.**

**M-15 - Débordement horizontal sur petits écrans.**
`document-detail` : largeur de document 391 px pour une fenêtre de 360 et de
375 px (`qa/rapport-responsive.json`) → défilement horizontal parasite.
`register` : le champ « Nom » est coupé par le bord droit dès 390 px
(capture `register/pwa_390x844_light.png`). **Estimation : 0,5 j.**

**M-16 - Les liens de partage des deux plateformes sont incompatibles.**
Flutter émet `https://api-nextlearn.duckdns.org/d/{id}` et ne reconnaît que
`/d/:id`. La PWA partage `window.location.href`
([document-detail.ts:73](../src/app/features/bibliotheque/document-detail/document-detail.ts#L73)),
et ne sait pas résoudre `/d/:id` (résolution de lien profond non portée,
assumé dans `auth.guard.ts`). Un lien partagé depuis l'application mobile
n'ouvre pas la PWA, et réciproquement. **Estimation : 1 j.**

**M-17 - Le bandeau et l'écran hors-ligne ne sont jamais câblés.**
`OfflineBanner` et `OfflineScreen` ne sont utilisés que dans
`design-catalog` (page de démonstration). Aucun écran réel ne signale la perte
de réseau. **Estimation : 0,5 j** une fois la connectivité détectée.

**M-18 - Quatre réglages sur treize ne sont que des toasts.**
Langue, notifications, réduction des animations, taille du texte affichent
« bientôt ». Le vidage du cache a disparu, et « Documents hors ligne » annonce
toujours « 0 fichier » en dur. Flutter a 7 groupes et 16 lignes réellement
actives. **Estimation : incluse dans B-04/B-05.**

**M-19 - `/app` sans barre oblique finale renvoie 404.**
`vercel.json` ne réécrit que `/app/(.*)`. Vérifié en rejouant exactement cette
règle (`qa/rapport-pwa.json` → `urlNueApp: 404`). Quelqu'un qui tape l'adresse
sans slash tombe sur une page d'erreur de l'hébergeur.
*Correctif* : ajouter `{ "source": "/app", "destination": "/index.html" }`.
**Estimation : 5 min.**

**M-20 - Une feuille de style externe reste chargée en production.**
`https://cdnjs.cloudflare.com/.../font-awesome/6.5.1/css/all.min.css` est encore
dans le `<head>` du build de production (`qa/rapport-pwa.json` → `meta.cdnExternes`),
uniquement pour la vitrine. Pour l'application : une requête bloquante vers un
tiers, un point de panne hors-ligne, et une fuite d'adresse IP vers un CDN que
la politique de confidentialité ne mentionne pas. **Estimation : 2 h.**

---

### 🟡 Mineurs

- **m-01** - `recherche` n'a pas d'historique local (Flutter : `historique_recherches.dart`).
- **m-02** - Le quiz n'affiche que le score ; Flutter dispose de `bonneReponseIndex` pour montrer la correction par question.
- **m-03** - Replis de libellés divergents : « Enseignant »/« Université » au lieu de « Non renseigné(e) » traduits.
- **m-04** - `Failure.depuisErreurHttp(e, true)` est appelé avec `estProd: true` en dur dans les dépôts : la journalisation de diagnostic n'est jamais active, même en développement.
- **m-05** - `console.warn('[PdfReader] délai dépassé…')` subsiste dans le code livré.
- **m-06** - L'entrée en cascade (`nlCascadeEnter`) n'est utilisée que dans la page de démonstration ; Flutter l'applique sur 4 écrans réels.
- **m-07** - La route `/app/design-system` est publiquement accessible en production ; la Phase 2 elle-même la disait temporaire.
- **m-08** - Le test `e2e/pdf-reader.spec.ts` vérifie `toBeAttached()` sur `<pdf-viewer>` : il **passe** alors que la fonctionnalité est invisible (B-02). Un test qui ne mesure pas ce que son nom annonce.
- **m-09** - La suite Playwright du dépôt échoue (7 sur 13) sur un serveur de développement froid, faute d'attente de la première compilation ; elle passe intégralement à chaud. À stabiliser avant toute mise en CI.

### ⚪ Cosmétiques

- **c-01** - `login-pin` : le logo est aligné à gauche au lieu d'être centré.
- **c-02** - `login-pin`/`register` : libellés externes + placeholders d'exemple, là où Flutter met le libellé dans le champ.
- **c-03** - `register` : sous-titre différent (« Quelques informations pour commencer. » vs « Tes informations personnelles »).
- **c-04** - `register` : flèche retour `←` au lieu du chevron `‹`.
- **c-05** - `onboarding` : les puces « WhatsApp » et « USB » ont perdu leurs icônes ; l'illustration (emoji) n'est pas la même.
- **c-06** - Accueil : la barre d'outils déborde, le 4ᵉ bouton « Déposer » est coupé par le bord droit (visible en clair et en sombre).

---

## 6. Fonctionnalités non portées et limites de plateforme

| Fonctionnalité | Statut | Alternative |
|---|---|---|
| Scan de document avec redressement | 🚫 | Import PDF - **identique à Flutter web**, pas un écart |
| Stockage chiffré par le système | 🚫 | `localStorage`, risque documenté dans le code ; à compenser par une CSP et une durée de jeton courte |
| Retour haptique sur iOS Safari | 🚫 | Aucune ; `navigator.vibrate` couvre Android |
| Push sur iOS | 🚫 sauf PWA installée, iOS ≥ 16.4 | À annoncer comme tel dans l'interface |
| « Retour = quitter l'application » | 🚫 | Sans objet sur le web - la matrice a raison sur ce point |

---

## 7. Observation hors périmètre (backend)

`GET https://api-nextlearn.duckdns.org/api/documents?limit=1` répond **200 sans
jeton** et renvoie le catalogue complet avec `uploadedBy`, `fichierHash` et les
identifiants internes. `GET /api/users/me` répond bien 401. Le commentaire de
`lien_profond.dart` affirme pourtant que « le catalogue est réservé aux
étudiants inscrits ». Ce n'est ni un défaut de la PWA ni de l'application
mobile, mais cela mérite une décision explicite côté API.

---

## 8. Résultats des tests et du build

| Vérification | Résultat |
|---|---|
| `ng build` (production) | ✅ 0 erreur, 0 avertissement - 391,6 Ko initial / 106,7 Ko transférés ; chunk `app-shell-routes` 855,9 Ko |
| Tests unitaires Angular (vitest) | ✅ **113 tests / 36 fichiers**, tous verts |
| Tests Node du site (`npm run test:site`) | ✅ **25 tests**, tous verts |
| Playwright du dépôt (serveur chaud) | ✅ **13 / 13** |
| Playwright du dépôt (serveur froid) | ⚠️ **6 / 13** - flakiness, voir m-09 |
| Lighthouse mobile | Performance **49**, Accessibilité 95, Bonnes pratiques 100, SEO 100 |
| Lighthouse bureau | Performance 84, Accessibilité 95, Bonnes pratiques 100, SEO 100 |
| Vitrine (non-régression) | ✅ titre, contenu et `load` corrects en 4,8 s (`qa/rapport-vitrine.json`) |
| Dépôt Flutter non modifié | ✅ `git status` identique avant/après ; seul `build/` (ignoré) a été écrit par `flutter build web` |

---

## 9. À tester à la main, sur appareil réel

Ces points ne sont pas vérifiables depuis cet environnement. À cocher avant
toute remise en recette.

**iPhone (Safari, puis PWA installée)**
- [ ] « Partager → Sur l'écran d'accueil » : l'icône posée est bien celle de NextLearn (aujourd'hui aucune `apple-touch-icon` n'est déclarée - attendu : échec).
- [ ] Lancement en mode autonome : barre de statut lisible, pas de barre Safari résiduelle.
- [ ] Encoche et indicateur d'accueil : la barre d'onglets ne passe pas dessous (aujourd'hui `viewport-fit=cover` manque - attendu : échec).
- [ ] Clavier virtuel : le champ e-mail et le champ PIN restent visibles pendant la saisie.
- [ ] Geste de retour iOS (balayage depuis le bord) sur chaque écran poussé.
- [ ] Pas de zoom au double-tap, pas de rebond de page, pas de sélection de texte intempestive.
- [ ] Lecture d'un PDF réel de plus de 50 pages : fluidité et mémoire.

**Android (Chrome, puis PWA installée)**
- [ ] Bannière ou bouton d'installation (aujourd'hui `beforeinstallprompt` n'est pas géré - attendu : seul le menu du navigateur fonctionne).
- [ ] Icône adaptative : vérifier le rognage (aucune icône `maskable` - attendu : icône rognée dans un cercle blanc).
- [ ] Couleur de la barre de statut (aucun `theme_color` - attendu : blanc par défaut).
- [ ] Bouton retour matériel sur chaque écran, y compris depuis un lien profond.
- [ ] Retour haptique sur les boutons (`navigator.vibrate`).
- [ ] Réseau 3G réel : temps avant premier affichage, et comportement quand une requête n'aboutit pas (aujourd'hui sans délai d'expiration - attendu : chargement infini).

**Les deux**
- [ ] Ouvrir un lien partagé depuis l'application mobile (`.../d/<id>`) : vérifier où il aboutit.
- [ ] Session expirée pendant l'usage (laisser l'app ouverte plus que la durée du jeton).
- [ ] Bascule clair/sombre depuis les réglages du système, application ouverte.
- [ ] Comparer, écran par écran, l'app mobile et la PWA côte à côte sur les 27 écrans authentifiés - aucune référence automatisée n'existe pour eux (§3.2).

---

## 10. Ce qui n'a pas été vérifié, et pourquoi

| Non vérifié | Raison |
|---|---|
| Contrats réels du backend (payloads, codes d'erreur, 429) | Réseau simulé (choix validé) ; aucun compte de test fourni |
| Parcours d'inscription, OTP, création et réinitialisation du PIN de bout en bout | Nécessitent un e-mail réel et un backend de test |
| Fidélité visuelle des 27 écrans authentifiés | Impossible de semer une session dans le build Flutter web (`flutter_secure_storage` chiffre son stockage) |
| Rendu natif iOS/Android de l'app Flutter | Aucun appareil ni émulateur disponible ; la référence utilisée est Flutter **web** (CanvasKit), dont le rendu de texte diffère légèrement du natif |
| Push, biométrie, App Links / Universal Links | Appareil réel requis |
| En-têtes HTTP de production (CSP, HSTS, cache) | Audit mené en local ; `vercel.json` ne déclare aucun bloc `headers`, à confirmer sur le déploiement |
| Conservation de l'état par onglet (`TabReuseStrategy`) | Non mesurée |

---

## 11. Ordre de reprise conseillé

1. B-01, B-02, B-03, M-19, M-01, M-03 - une journée, et l'application redevient utilisable.
2. M-12, M-13, M-14, M-15, M-20, M-10 - deuxième journée : réseau, accessibilité, conformité PWA.
3. M-11 (`loadComponent`) - la performance passe la barre des 80.
4. B-05 puis M-05, M-04, M-02, M-06 - le fond fonctionnel.
5. B-04 (i18n), M-07 à M-09 (mises à jour, installation, push) - le chantier long.

**Je n'ai modifié aucun code applicatif.** Les correctifs ci-dessus sont
proposés, pas appliqués : j'attends votre feu vert, et je les traiterai par
ordre de gravité.
