# QA_CHECKLIST.md — recette avant mise en production

Checklist réutilisable, à cocher intégralement avant chaque déploiement de la
PWA NextLearn. Une case ne se coche que sur **preuve** : sortie de commande,
capture, requête observée. « Ça devrait marcher » ne coche rien.

Référence de comportement : l'application Flutter (`lib/`), jamais la matrice
de parité.

---

## 0. Avant de commencer

- [ ] Brancher la version à recetter, `npm ci` depuis une installation propre
- [ ] Noter le SHA du commit recetté : `________`
- [ ] Vérifier que le dépôt Flutter n'a pas été modifié : `git -C .. status --porcelain lib/ test/`

## 1. Build et tests automatisés

- [ ] `npm run build` : 0 erreur, **0 avertissement**
- [ ] Budget : chunk initial ≤ 120 Ko transférés (relevé : ______ Ko)
- [ ] `npx ng test --watch=false` : tous verts (______ tests)
- [ ] `npm run test:site` : tous verts (______ tests)
- [ ] `npx playwright test` sur un serveur **déjà chaud** : tous verts
- [ ] Aucun `console.log`/`console.warn` résiduel : `grep -rn "console\.\(log\|warn\)" src/ | grep -v spec`
- [ ] Aucun toast « bientôt disponible » : `grep -rni "bientôt\|à venir\|TODO" src/`

## 2. Routage et navigation

- [ ] Aucune navigation sans préfixe : `grep -rn "navigate(\['/'," src/app/features` ne renvoie **rien**
- [ ] Une route `**` existe et mène à un écran 404 explicite
- [ ] Sur chacun des 35 écrans : chargement direct par URL, puis rechargement (F5), sans erreur console
- [ ] Bouton retour de chaque écran poussé : mène à l'écran attendu, zéro `NG04002`
- [ ] Bouton retour du navigateur sur chaque onglet de la coque
- [ ] `/app` **sans** barre oblique finale ne renvoie pas 404
- [ ] Lien profond `/d/<id>` : ouvre la fiche du document, ou redirige vers la connexion puis **y revient**
- [ ] Déconnecté : `/app/legal/document/confidentialite` et `/conditions` s'affichent **sans compte** (exigence Apple 5.1.1)
- [ ] Session expirée en cours d'usage : message explicite, pas de boucle de redirection

## 3. Parcours fonctionnels (avec compte de test)

- [ ] Inscription complète : identité → cascade école/cycle/niveau/filière → OTP → PIN
- [ ] Inscription sans adresse institutionnelle : dépôt du justificatif, écran d'attente, déblocage
- [ ] Connexion, déconnexion, déverrouillage par PIN, PIN oublié
- [ ] Verrou PIN : 5 échecs → recul exponentiel, message avec la durée restante
- [ ] Bibliothèque : filtres par type, tri, pagination/défilement infini
- [ ] Recherche : résultats, état vide, **historique des recherches**
- [ ] Fiche document : lire, télécharger (avec progression), favori, hors ligne, **noter**, **signaler**
- [ ] Lecteur PDF : le document **s'affiche** (canevas visible, hauteur > 0), reprise à la page quittée
- [ ] Épreuves : filtres CC/SN, détail, corrigé, notation
- [ ] Quiz : enchaînement des questions, soumission, score **et correction par question**
- [ ] Progression : stats, semaine, matières, badges, série — valeurs cohérentes avec l'usage
- [ ] Dépôt : import PDF, licence, suivi du statut, motif de refus affiché
- [ ] Recours et tickets de support : envoi et historique
- [ ] Profil : avatar, changement de niveau, appareils connectés (révocation), suppression de compte
- [ ] Réglages : thème, **langue**, **taille du texte**, **réduction des animations**, **notifications**, **vidage du cache**

## 4. Cas limites (sur chaque parcours cœur)

- [ ] Réseau coupé en cours d'action
- [ ] Réseau lent (3G bridé) : aucune requête ne reste pendante au-delà de 20 s
- [ ] Réponse API en erreur 400 / 401 / 403 / 404 / 409 / 422 / 429 / 500
- [ ] Liste vide : illustration + message, jamais une page blanche
- [ ] Données très longues (titre de 200 caractères), caractères accentués et spéciaux
- [ ] Double clic rapide sur un bouton d'envoi : une seule requête part
- [ ] Jeton expiré pendant une action : rafraîchissement silencieux, l'action aboutit
- [ ] Permission refusée (fichier, notifications) : message, pas d'écran cassé

## 5. Design

- [ ] Les jetons CSS correspondent encore à `lib/app/theme/` (palette, espacement, rayons, durées)
- [ ] Les couleurs par type de document suivent **le thème actif** (clair ≠ sombre)
- [ ] Corps de texte en Inter, titres et boutons en Poppins
- [ ] Captures côte à côte Flutter ↔ PWA sur chaque écran modifié, en clair **et** en sombre
- [ ] Viewports 360×800, 375×667, 390×844, 430×932, 768×1024, 1280×800 : aucun débordement horizontal
- [ ] Toutes les cibles tactiles ≥ 48 px (audit `target-size` de Lighthouse vert)
- [ ] États vérifiés sur chaque écran : chargement (squelette), vide, erreur, rempli
- [ ] Thème sombre : aucun fond clair résiduel derrière la coque
- [ ] `prefers-reduced-motion` : les animations tombent à zéro

## 6. PWA

- [ ] Manifeste : `id`, `name`, `short_name`, `description`, `lang`, `start_url`, `scope`, `display: standalone`, `theme_color`, `background_color`, `orientation`, `screenshots`
- [ ] Icônes 192 et 512 en `any` **et** en `maskable`
- [ ] `index.html` : `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon` 180×180, `viewport-fit=cover`
- [ ] Aucune ressource tierce bloquante dans le `<head>` (polices et icônes auto-hébergées)
- [ ] Service worker actif sur le build de production, portée `/`
- [ ] `ngsw-config.json` : `dataGroups` défini pour les listes consultées hors ligne
- [ ] Hors ligne : rechargement de la coque, **données déjà vues consultables**, documents téléchargés ouvrables, bandeau hors-ligne visible
- [ ] Actions d'écriture faites hors ligne : mises en file et rejouées au retour du réseau
- [ ] Nouvelle version déployée : bannière « Nouvelle version disponible », activation sans perte de session, aucune erreur de chunk obsolète
- [ ] En-têtes : `index.html` et `ngsw-worker.js` en `no-cache`, assets hachés en `immutable`
- [ ] En-têtes de sécurité : CSP, HSTS, `X-Content-Type-Options`

## 7. Performance

- [ ] Lighthouse **mobile** : Performance ≥ 80, Accessibilité ≥ 90, Bonnes pratiques ≥ 90, SEO ≥ 90
- [ ] LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 200 ms (profil mobile bridé)
- [ ] JavaScript inutilisé au premier écran ≤ 150 Kio
- [ ] Chaque écran est en `loadComponent` (aucun écran dans le chunk d'entrée)

## 8. Sécurité et données

- [ ] Aucun secret dans le bundle : `grep -riE "api[_-]?key|secret|password" dist/`
- [ ] Aucune donnée sensible dans les URL ni dans les journaux console
- [ ] Les jetons ne quittent pas l'origine attendue (vérifier l'onglet Réseau)
- [ ] Console vierge sur un parcours complet : 0 erreur, 0 requête en échec, 0 ressource 404, 0 erreur CORS

## 9. Compatibilité (appareils réels)

- [ ] Chrome Android · [ ] Safari iOS · [ ] Samsung Internet · [ ] Firefox mobile
- [ ] Chrome/Edge bureau · [ ] Safari bureau
- [ ] Installation sur l'écran d'accueil, iOS **et** Android, puis lancement en mode autonome
- [ ] Encoche, indicateur d'accueil, clavier virtuel
- [ ] Geste de retour iOS, bouton retour matériel Android

## 10. Non-régression du site vitrine

- [ ] `/` charge, titre correct, ancres de navigation fonctionnelles
- [ ] Les pages statiques `/confidentialite/`, `/conditions/`, `/suppression-compte/` répondent 200
- [ ] La palette de la vitrine n'a pas fui dans l'application (et inversement)
- [ ] `/app/design-system` **n'est pas** accessible en production

---

**Règle de clôture** : s'il reste une case non cochée, le livrable est
« GO AVEC RÉSERVES » au mieux — et la réserve doit être écrite, avec son
porteur et sa date.
