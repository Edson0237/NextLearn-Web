# Refonte « Academic Clarity » - ce qui a changé, et pourquoi

Ce document accompagne `QA_CORRECTIONS.md`. Celui-ci portait sur ce qui ne
marchait pas ; celui-là porte sur ce qui marchait mais ne ressemblait à rien.

La demande, mot pour mot : *« Je trouve le design actuel de la PWA trop
basique, ce travail ressemble trop à un travail fait par une intelligence
artificielle »*, et une contrainte ferme : *« Je ne veux surtout pas, à aucune
de mes pages, d'icône en dur »*. La référence est le dossier
`qa/Inspiration/`, dont `academic_clarity/DESIGN.md` est la spécification.

## 1. Le diagnostic

Ce qui faisait « travail de machine » n'était pas une faute de goût isolée,
mais trois habitudes :

1. **Aucune hiérarchie.** Toutes les cartes avaient le même poids visuel, la
   même ombre, le même rayon. L'œil n'avait nulle part où se poser en premier.
2. **La couleur ne disait rien.** Les teintes étaient décoratives au lieu
   d'être porteuses de sens : rien ne distinguait un cours d'une épreuve.
3. **De la redondance partout.** La matière apparaissait trois fois par carte
   - dans le badge, dans le sous-titre, dans la ligne de méta.

## 2. Le périmètre retenu

Deux décisions, prises avec l'utilisateur :

- **Cobalt `#2563EB`, fidèle à l'inspiration.** Ce choix rompt délibérément la
  parité de couleur avec l'application Flutter. C'est assumé : la parité
  fonctionnelle reste la règle, la parité chromatique non.
- **Les quatre écrans de l'inspiration + tout le système.** Les ~30 autres
  écrans héritent des jetons sans être redessinés un par un.

## 3. Les fondations

| Fichier | Rôle |
|---|---|
| `src/app/shared/styles/_tokens.scss` | Palette claire et sombre, rayons, espacements, ombres, mixins `carte` / `ombre-carte` / `cible-etendue` |
| `src/app/shared/styles/_type.scss` | L'échelle typographique complète, de `display-lg` à `caption` |
| `src/app/shared/styles/_fonts.scss` | Plus Jakarta Sans variable, deux sous-ensembles (latin, latin-ext), servie en local |
| `src/app/shared/ui/icon/icon-paths.ts` | 126 icônes, en chemins SVG intégrés |

**La couleur porte le sens.** Chaque type de document a sa teinte et son fond
teinté, en paire clair/sombre : cours cobalt, TD/TP cyan, épreuve ambre,
corrigé émeraude. Ces paires sont lues par `couleurTypeDocument()` /
`fondTypeDocument()` - plus aucun écran ne recopie une couleur.

## 4. La règle des icônes

Aucune icône n'est un caractère. Ni emoji, ni `★`, ni `→`, ni `›`. Le
catalogue `icon-paths.ts` contient des chemins SVG extraits localement de
`@material-symbols/svg-400` : pas de police distante, pas de CDN, donc rien
qui change de dessin d'un appareil à l'autre et rien qu'un lecteur d'écran
puisse épeler.

**Les tracés eux-mêmes étaient faux.** Le registre avait été écrit à la main :
sur 126 entrées, 60 ne correspondaient à aucun tracé réel du jeu, et les 66
autres étaient réparties entre deux variantes - « rounded » et « outlined » -
soit deux dessins différents côte à côte dans la même barre d'icônes. Le signe
le plus visible était le marque-page de la fiche ressource, qui ne ressemblait
à rien. Par-dessus, `bookmark` et `bookmark_outline` recevaient le même tracé :
le favori ne changeait pas d'état.

`tools/extraire-icones.mjs` régénère désormais les 126 tracés depuis la seule
variante « rounded » - celle que nomme l'en-tête du fichier, et celle que
Flutter dessine (`Icons.xxx_rounded`). Le même script en mode `--verifier`
échoue si un tracé dévie de sa source, ce qui empêche la dérive de revenir.

Ce qui a été retiré au passage : `Bonjour 👋` sur l'accueil, les `→` et `›` de
l'onboarding, le `☆` du catalogue de composants, le `★` de la fiche épreuve,
et les cinq libellés `★★★★★` qui servaient de notation dans la fiche
ressource - celle-ci est redevenue une rangée de cinq boutons, chacun avec sa
cible tactile de 44 px et son icône dessinée.

Un passage de vérification est scripté : la recherche de tout caractère des
plages emoji, flèches et symboles dans les gabarits, les catalogues de
traduction et les libellés TypeScript ne renvoie plus rien.

## 5. Les composants partagés

- **`nl-badge`** - pastille de 22 px, neuf tons, fond et couleur
  surchargeables, variante capitales.
- **`nl-document-card`** - quatre étages : vignette de type 40×40 teintée,
  rangée de badges, titre + sous-titre, ligne de méta avec note et bouton
  d'action rond. Jauge de progression en pied quand la lecture est entamée.
  La matière n'y apparaît plus qu'une fois.
- **`nl-app-header`** - monogramme, titre + section en capitales, cloche avec
  compteur plafonné à 99+, avatar, puce de contexte.
- **`nl-search-bar`** - 44 px, anneau de focus cobalt à 12 %, mode lecture
  seule (un bouton qui ouvre la recherche) et compteur de filtres actifs.
- **`nl-section-header`** - titre, sous-titre, pastille teintée, action.
- **Barre d'onglets flottante** - surface givrée (`backdrop-filter`), point
  actif sous l'onglet courant, pastille de compteur hors-ligne.

## 6. Les quatre écrans

| Écran | Référence | Ce qui a changé |
|---|---|---|
| Accueil | `accueil_d_couverte` | En-tête, recherche en lecture seule, bandeau cobalt avec trois chiffres réels, tuiles « Parcourir par format », rail « Reprendre » avec progression, trois listes thématiques |
| Bibliothèque | `explorateur_acad_mique` | Recherche + filtres, segments de type défilants avec compte réel par type, puces de matière, compteur de résultats |
| Fiche ressource | `fiche_ressource_lecteur` | Le bandeau dégradé pleine largeur a disparu - il mangeait un tiers de l'écran. Fil d'ariane, badges, trois chiffres, action principale pleine largeur, trois actions secondaires, notation en rangée |
| Ma bibliothèque | `ma_biblioth_que_t_l_chargements` | Jauge de stockage réelle (`navigator.storage.estimate()`), trois onglets comptés, recherche locale, badges « Prêt hors-ligne » |

Une précision sur la jauge de stockage : si le navigateur ne sait pas estimer
le quota - Safari le fait rarement - le bloc ne s'affiche pas du tout, plutôt
que d'annoncer un chiffre inventé.

## 7. La passe de cohérence

Les ~30 écrans restants héritent des jetons. Trois régressions réelles sont
ressorties de la réécriture de la palette, toutes corrigées :

| Jeton disparu | Remplacé par | Écrans touchés |
|---|---|---|
| `--text-tertiary` | `--text-muted` | progression, notifications |
| `--radius-pill` | `--radius-pilule` | recherche, quiz |
| `--success` | `--tertiary` | recours, tickets de support |

Une quatrième, plus sérieuse, concernait le thème sombre. Trente-quatre
déclarations `color: #fff` et `rgba(255,255,255,…)` étaient posées sur des
surfaces saturées - le dégradé de l'accueil, les segments actifs, l'en-tête
d'épreuve, la pastille de notification, l'avatar sur fond coloré. Or en sombre
ces surfaces deviennent des pastels clairs : `--primary` passe de `#2563EB` à
`#60A5FA`. Le blanc fixe y tombait sous 2,5:1. Toutes suivent désormais
`--text-on-primary`, qui bascule avec le thème.

Vérification automatisée : plus aucune variable CSS n'est utilisée sans être
définie, hors les onze qui sont posées en ligne par liaison Angular
(`[style.--teinte]` et consorts).

Deux écrans gardent volontairement des couleurs fixes : l'onboarding et le
splash, qui portent le bleu NextLearn historique (`#1A4A7E`) et non le cobalt.
C'est l'identité de marque, elle ne suit pas le thème.

## 8. Ce que les captures ont montré

Les quatre écrans ont été capturés en production, dans les deux thèmes et à
deux largeurs (`qa/outils/captures-design.mjs`, résultats dans
`qa/screenshots/refonte/`). La session est semée dans `localStorage` et l'API
jouée localement, avec un jeu de données fixe : deux captures identiques
signifient alors que le rendu n'a pas bougé, et rien d'autre.

Quatre défauts n'apparaissaient qu'à l'image :

1. **Les vignettes de type étaient grises.** `.home__format nl-icon:last-child`
   devait griser le chevron de fin ; mais le combinateur de descendance
   atteignait aussi l'icône de la vignette, seule enfant de son `span` et donc
   « last-child » elle aussi. Toute la couleur de format tombait. Même faute
   dans la carte « corrigé » de la fiche ressource. Corrigé par `>`.
2. **Le marque-page ne ressemblait à rien** - voir §4.
3. **« Voir toute la bibliothèque »** en action d'en-tête poussait le titre de
   section sur deux lignes à 390 px, la pastille flottant en face de rien.
   L'action est passée à « Voir tout » (`actionVoirTout`, déjà au catalogue),
   et l'en-tête s'aligne désormais sur le premier interligne.
4. **Retirer portait le cobalt de télécharger.** Le bouton rond de la carte
   prenait la couleur primaire quelle que soit l'action : sur « Ma
   bibliothèque », le geste qui supprime était en tout point celui qui
   télécharge sur l'écran d'à côté. La carte accepte maintenant
   `[actionDestructive]`, qui le passe en rouge teinté.

## 9. Deuxième passe : la marque, les écrans restants, l'alignement

### 9.1 Le bleu est redevenu celui du logo

Le cobalt `#2563EB` de l'inspiration a cédé la place à `#1A4A7E` - non pas un
bleu choisi dans une charte, mais celui échantillonné sur `images/Logo.png`,
et celui que le splash portait déjà. Une application ne devrait pas changer de
bleu entre son écran d'ouverture et le reste.

Le thème sombre prend `#6CA8DD` : le même bleu éclairci, parce que `#1A4A7E`
sur de l'ardoise ne porte pas de texte. Les cours, dont la teinte suit l'action
par convention, suivent le changement.

### 9.2 Le logo remplace « NL »

Un monogramme de deux lettres tenait lieu de marque à trois endroits : le
splash statique de `index.html`, l'en-tête de l'application, et l'onboarding -
qui, lui, affichait une toque générique (`school`), l'icône de n'importe quelle
école sur le premier écran que voit un nouveau venu.

`images/logo-marque.png` (192×192) est découpé de `Logo.png` : la marque seule,
sans le mot, centrée sur son bleu. Il est préchargé par le service worker, donc
présent hors ligne dès l'installation.

### 9.3 La photo de profil passe devant les initiales

`unlock` et `login-pin` dessinaient chacun leur rond et y écrivaient des
initiales - ou « NL » quand le compte n'était pas connu. Ni l'un ni l'autre ne
regardait `avatarUrl` : la photo n'apparaissait nulle part sur ces écrans,
même lorsqu'elle existait.

`nl-identite` porte les trois états dans l'ordre : **photo**, puis
**initiales**, puis **la marque** quand on ne sait pas encore qui se présente.
Le repli des initiales en cas d'image cassée était déjà dans `nl-avatar`.

### 9.4 Une seule barre pour les écrans secondaires

Cinq écrans gardaient le bandeau dégradé pleine largeur. Deux d'entre eux -
profil et progression - sont des **onglets**, pas des écrans empilés :
progression portait même un bouton retour qui ramenait à l'onglet d'à côté.
Ils prennent l'en-tête d'onglet (`nl-app-header`), comme l'accueil.

Les autres passent à `nl-page-bar`, nouveau composant partagé. Avant lui, cinq
barres différentes coexistaient : bandeau dégradé ici, barre plate de 40 px là,
libellé en capitales sur la fiche ressource et titre normal sur la bibliothèque
hors-ligne, bouton retour de 40 px d'un côté et de 48 de l'autre. La fiche
ressource et la bibliothèque hors-ligne l'adoptent aussi.

| Écran | Avant | Après |
|---|---|---|
| Profil | bandeau dégradé, titre répété | en-tête d'onglet + carte d'identité |
| Progression | bandeau + bouton retour sur un onglet | en-tête d'onglet |
| Appareils connectés | barre plate maison | `nl-page-bar` |
| Mes signalements | barre plate maison | `nl-page-bar` |
| Fiche épreuve | bandeau ambre pleine largeur | `nl-page-bar` + badges + titre |

### 9.5 Les alignements

L'utilisateur signalait des éléments mal alignés. Trois sondes écrites pour
les trouver, parce que l'œil les voit mais que le code ne les dit pas :

| Outil | Ce qu'il cherche |
|---|---|
| `qa/outils/verifier-debordements.mjs` | ce qui sort de l'écran |
| `qa/outils/verifier-alignements.mjs` | deux bords à 1–6 px l'un de l'autre |
| `qa/outils/verifier-marges.mjs` | plusieurs marges extérieures sur un écran |

Ce qu'elles ont trouvé :

1. **« Nom » sortait de l'écran à l'inscription.** Les deux colonnes du
   couple Prénom/Nom sont des éléments flex, et un élément flex vaut
   `min-width: auto` : il refuse de descendre sous la largeur intrinsèque de
   son contenu, et un `<input>` nu mesure une vingtaine de caractères. Deux
   côte à côte ne tenaient pas dans 390 px.
2. **Les statistiques du profil recouvraient la carte d'identité.** Leur
   marge négative de −28 px servait à chevaucher le bandeau dégradé, qui
   n'existe plus.
3. **Chaque titre de section des réglages était décalé de 4 px** par rapport
   à la carte qu'il annonce - assez pour se voir, trop peu pour passer pour
   un choix.
4. **L'onboarding avait trois marges extérieures** : 20 px pour le logo,
   24 px pour le bouton, 28 px pour le texte.
5. **La page « introuvable » s'affichait dans la police de la vitrine.**
   Redéfinir `--font-family` sous `.nl-app` ne suffit pas : une police
   s'hérite par sa valeur calculée, et `body` l'avait déjà résolue en
   Poppins. Les écrans qui passent par les mixins typographiques s'en
   sortaient ; ceux qui s'en remettaient à l'héritage, non.

### 9.6 Les textes qui restaient en français dans le code

La fiche épreuve affichait « Contrôle continu », « Session normale »,
« Disponible », « {n} vue(s) » et « {n} min » écrits dans le gabarit, et
l'onboarding « Suivant » et « Commencer gratuitement ». Les clés existaient
toutes au catalogue - elles n'étaient simplement pas employées. En anglais,
ces écrans parlaient donc à moitié français.

## 10. Troisième passe : formats, contribution, progression, lecteur

### 10.1 L'accueil ne montre plus que trois formats

Huit tuiles couvraient deux écrans et mettaient « Exposé » au même rang
qu'« Épreuve ». Restent **Épreuve, Annales, TD** - ce pour quoi on ouvre
l'application la veille d'un examen - et une quatrième tuile « Plus de
formats » qui ouvre les cinq autres en feuille.

Les tuiles ont changé de forme au passage : l'icône en rond au-dessus du
libellé, comme une icône d'application, plutôt qu'une rangée couchée avec
chevron. La feuille de sélection accepte désormais une icône et une teinte
par ligne (`ChoixSelection.icone`), pour qu'un format s'y reconnaisse aussi
vite que sur une tuile.

### 10.2 Les rails de la bibliothèque étaient collés au bord

Les deux rangées de filtres commençaient à 0 px pendant que les cartes en
dessous commençaient à 16. La cause : une marge négative copiée du rail de
l'accueil, qui vit dans un conteneur portant la marge de page - alors que
`.nl-biblio` n'en a aucune. La marge négative n'annulait donc rien, elle
décalait.

### 10.3 La contribution

L'écran était une liste à plat. Un dépôt met des jours à être relu : il
manquait la vue d'ensemble. Il porte maintenant une **barre de répartition**
par statut - publié, en relecture, en attente, refusé - la part de publiés en
pastille, et un **histogramme des six derniers mois**, les mois vides
compris, sans quoi le rythme serait faux. L'écran reprend par ailleurs
l'en-tête d'onglet et les cartes du système.

### 10.4 La progression

C'est l'écran que l'utilisateur avait en tête en parlant de barres et de
graphiques. Trois défauts s'y voyaient dès qu'on lui donnait de vraies
données :

1. **Les jours de la semaine s'affichaient en anglais** - « TUE WED THU ».
   Aucun `LOCALE_ID` n'était fourni et le canal `fr` n'était pas enregistré :
   les tubes `date` et `number` retombaient sur `en-US` dans une application
   entièrement française. `registerLocaleData(localeFr)` et un `LOCALE_ID`
   lu sur `TraductionService` corrigent les deux.
2. **Les barres se mesuraient à un plafond fixe de 120 minutes.** Une semaine
   calme donnait six traits écrasés en bas du cadre ; une journée de trois
   heures était coupée au ras du plafond. Elles se mesurent désormais à la
   journée la plus chargée, et portent leur valeur.
3. **Les matières n'avaient aucune barre** - un nom et une durée, à comparer
   de tête. Chacune porte maintenant sa jauge, relative à la plus travaillée.

### 10.5 Le lecteur PDF

Vérifié de bout en bout sur un document de douze pages
(`qa/outils/verifier-lecteur-pdf.mjs`) : le rendu, le nombre de pages, le
suivi de page au défilement - celui qui alimente « Reprendre » - et
l'absence de débordement. La sonde sort en erreur si l'un des quatre lâche.

Elle a trouvé un défaut réel : **la page dépassait la fenêtre de 27 px**, et
la barre du lecteur - calée sur `100dvh` - s'échappait vers le haut au
premier geste. Deux causes cumulées, toutes deux hors de l'application :

- `app-root` n'a pas de `display` par défaut, donc en ligne, et la
  `line-height: 1.7` du corps lui ajoutait une boîte de ligne ;
- pdf.js ajoute un `<canvas>` de mesure directement dans `<body>` - invisible,
  mais en ligne lui aussi, et donc porteur d'une seconde boîte de ligne.

### 10.6 Le préchauffage des tests ne chauffait rien

Quatre tests de déverrouillage échouaient sur un démarrage à froid, et
passaient à chaud. `prechauffage.ts` demandait les routes en HTTP - mais sur
une application à page unique, `GET /app/unlock` rend `index.html` et rien
d'autre : aucun morceau chargé à la demande n'est réclamé, donc aucun n'est
compilé. Il chauffait cinq fois la même page d'accueil. Il ouvre désormais un
vrai navigateur, seul capable de suivre les imports dynamiques du routeur.

Vérifié sur un départ réellement froid, cache Vite vidé : 13 tests verts en
41 s.

## 11. Ce qui reste

Plus aucun bandeau dégradé pleine largeur : les cinq écrans qui le portaient
encore sont repris au §9.4.

Ce qui n'a pas été fait, et qui se verrait :

- **Les tests e2e ne couvrent que treize parcours.** Les écrans repris ici
  sont vérifiés par capture, pas par assertion.
- **Les écrans de dépôt et de vérification académique** gardent leurs cartes
  et leurs rayons propres (18 px au lieu de 12), sans que ce soit visible
  côte à côte avec le reste.
- **La vitrine** (`src/app/Components/`) n'est pas concernée par cette
  refonte : elle garde sa police et sa palette.

## 12. Vérifications

| Contrôle | Résultat |
|---|---|
| `ng build` | 0 erreur, 0 avertissement, aucun budget dépassé |
| `ng test` | 131 tests, 38 fichiers, tous verts |
| `npm run test:site` | 25 tests, tous verts |
| Clés i18n | 440 clés utilisées, toutes présentes dans `fr.json` et `en.json` (1047 chacun), zéro désynchronisation |
| Icônes en dur | aucune, gabarits + traductions + libellés TS |
| Tracés d'icônes | `node tools/extraire-icones.mjs --verifier` : les 127 correspondent à la source |
| Jetons CSS | aucune variable utilisée sans définition |
| Les trois ci-dessus, en un geste | `node tools/verifier-design.mjs` |
| Débordements horizontaux | aucun, sur 16 écrans (`qa/outils/verifier-debordements.mjs`) |
| Bords presque alignés | aucun (`qa/outils/verifier-alignements.mjs`) |
| Marges extérieures | une seule par écran (`qa/outils/verifier-marges.mjs`) |
| `playwright test` | 13 tests, tous verts - y compris sur un départ à froid, cache Vite vidé |
| Lecteur PDF | `node qa/outils/verifier-lecteur-pdf.mjs` : rendu, 12 pages, suivi de page, zéro débordement |
| Captures | 39 PNG dans `qa/screenshots/refonte/` |

Pour reproduire les captures :

```sh
npx ng build
node qa/outils/serveur-statique.mjs &     # sert dist/ sur :4400
node qa/outils/captures-design.mjs     # les 4 écrans de l'inspiration
node qa/outils/captures-auth.mjs       # authentification et écrans secondaires
node qa/outils/captures-contrib.mjs    # contribution, progression, accueil, bibliothèque
```

Et les sondes, qui ont besoin du même serveur :

```sh
node qa/outils/verifier-debordements.mjs
node qa/outils/verifier-alignements.mjs
node qa/outils/verifier-marges.mjs
node qa/outils/verifier-lecteur-pdf.mjs
```

## 13. Authentification : le code à usage unique ne revient plus à chaque fois

### 13.1 Ce qui change

L'OTP atteste d'une chose : que la personne tient l'adresse e-mail déclarée.
Il était pourtant redemandé à **chaque** connexion, et un PIN local était
réclamé à **chaque** ouverture. Sur un téléphone personnel - déjà protégé par
le code de l'appareil - cela faisait deux serrures derrière une porte fermée,
plusieurs fois par jour, et supposait un réseau au moment précis où l'on vient
ouvrir un cours téléchargé pour s'en passer.

| | Avant | Après |
|---|---|---|
| Ouvrir l'application | PIN à chaque fois | rien, la session dure |
| Se connecter, appareil connu | e-mail + PIN + OTP | e-mail + PIN |
| Se connecter, nouvel appareil | e-mail + PIN + OTP | e-mail + PIN + OTP |
| Créer un compte | OTP | OTP |

### 13.2 Côté serveur

Une collection `TrustedDevice` : un appareil devient connu après un premier
code validé, et les connexions suivantes depuis celui-ci s'arrêtent au PIN.

- l'identifiant est **tiré au sort par le client** et **rangé haché** - il
  vaut preuve de possession, au même titre qu'un code OTP ;
- il expire au bout d'un an sans usage : une confiance accordée une fois ne
  vaut pas indéfiniment ;
- `login` rend `otpRequis: true|false`. Les clients s'aiguillent sur ce
  drapeau, pas sur la présence d'un champ ;
- **un client qui n'envoie pas d'identifiant garde l'ancien parcours.** C'est
  ce qui permet de déployer le serveur avant les clients sans rien casser, et
  c'est testé.

Un défaut corrigé au passage : `verify2faLogin` révoquait **tous** les jetons
du compte. Se connecter sur l'ordinateur de la salle info déconnectait donc le
téléphone, ce qui annule l'intérêt d'une session qui dure. La révocation ne
porte plus que sur les jetons du même appareil ; les autres se révoquent
explicitement depuis « Appareils connectés ».

Sept tests couvrent le tout (`auth.service.appareil.test.ts`), dont : un PIN
faux n'ouvre rien même depuis un appareil connu, et l'identifiant n'est jamais
rangé en clair.

### 13.3 Le verrou local devient un réglage

Désactivé par défaut - personne ne se retrouve verrouillé par une mise à jour
- et réactivable dans les réglages pour un téléphone partagé. PWA et mobile.

### 13.4 L'application d'administration

Elle portait déjà une branche « appareil reconnu », écrite contre un contrat
que l'API n'a jamais implémenté : en-tête `X-Trusted-Device`, jeton
`appareilDeConfiance` émis par le serveur, session imbriquée sous `session`.
L'en-tête était ignoré, le champ n'arrivait jamais, la branche n'était jamais
prise. Elle suit désormais le contrat qui existe.

## 14. Lecture et bibliothèque hors ligne

| Défaut | Cause |
|---|---|
| Rouvrir un document le rouvrait page 1 **hors ligne** | la progression ne vivait que sur le serveur |
| Passer hors ligne **déconnectait** | une coupure réseau et « pas de dossier de vérification » rendaient le même `null` ; l'échéance en cache, périmée, concluait à l'expiration |

La progression est désormais écrite **localement d'abord**, puis poussée au
serveur ; le local fait foi quand il est plus récent. Et ne pas pouvoir poser
une question n'est plus une réponse : une coupure réseau ne termine plus la
session.

Trois sondes gardent ces comportements :

```sh
node qa/outils/verifier-lecteur-pdf.mjs        # rendu, pages, suivi, débordement
node qa/outils/verifier-reprise-lecture.mjs    # reprise, serveur présent ou non
node qa/outils/verifier-biblio-hors-ligne.mjs  # survie au changement de session
```

## 15. La barre d'onglets

Pilule sombre flottante, icônes seules, carré arrondi sous l'onglet courant.
Ses teintes viennent de la charte (`--nav-*`) et non de la maquette d'origine,
qui apportait un violet et un bleu vif appartenant à aucune palette du
produit. Elle garde la même teinte dans les deux thèmes : c'est un objet posé
sur la page, pas une de ses surfaces. Les libellés quittent l'écran mais pas
l'arbre d'accessibilité - `aria-label` les porte.

## 16. Fonctionnalités affichées mais non branchées

Constat : plusieurs écrans de la PWA appelaient des routes que le backend
n'avait **jamais** eues. Recensement par comparaison de tous les `http.*` du
client avec les routes montées (404 = route absente).

| Fonctionnalité | Route manquante | Statut |
|---|---|---|
| Contribution « Chargement impossible » | `/api/documents/submissions` (+ admin) | créée (`modules/submissions`) |
| Signalement d'une ressource | `/api/reports`, `/api/reports/motifs` (+ `/api/admin/signalements`) | créée (`modules/reports`) |
| Lien de partage | `GET /d/:id`, `/.well-known/assetlinks.json` | créée (`modules/partage`) |
| Changer de niveau | `GET /api/me/levels` | créée (`modules/compte`) |
| Photo de profil | `POST/DELETE /api/profile/avatar` | créée |
| Appareils connectés | `/api/auth/sessions` | créée |
| Notifications push | `/api/notifications/device-token` | créée côté API |
| Domaine e-mail à l'inscription | `/api/auth/institution-domain/check` | créée |
| Recours | `/api/recours*` (+ `/api/admin/recours`) | créée (`modules/recours`) |
| Cycle de revérification OTP | `/api/auth/verification-status`, `/otp/status` | **non créée** : caduque depuis le passage à « OTP sur appareil inconnu » |
| Push web | `firebase-config.json` absent | **bloqué** : demande les identifiants Firebase du projet |

Défauts côté client corrigés au passage :

* `PUT /api/profile` répond `{ user }` : le client lisait l'enveloppe comme un
  compte et enregistrait un profil vide (sondé : `verifier-reglages-profil.mjs`).
* Recours : le client parlait `rejet_document` / `suspension_compte` /
  `refus_inscription`, l'API, le mobile et l'administration `verification` /
  `suspension` / `depot`.
* Retour depuis une fiche : le lecteur empilait une seconde fiche au lieu de
  reculer ; « fiche → lecture → retour → retour » tournait en rond
  (`HistoriqueNavigation`, sondé : `verifier-fiche-ressource.mjs`).
* La rotation du refresh token perdait l'appareil de la session.
* Écran de lancement : le nom « NextLearn » manquait sous le logo.

## 17. Bout en bout réel : vraie API, vrai navigateur

Les sondes précédentes mockaient l'API : elles ne pouvaient pas voir qu'une
route n'existait pas ou qu'une réponse n'avait pas la forme attendue. Ces
sondes-ci n'ont **aucun mock** : l'API réelle tourne sur une base MongoDB en
mémoire (`mongodb-memory-server`, port 27555), l'étudiant se connecte par
l'écran de connexion (appareil de confiance : sans OTP), et chaque geste est
vérifié **côté serveur**.

Lancement : base mémoire et serveur PDF (`:4402`) démarrés, puis
`qa/outils/e2e-demarrer.sh` (API `:5001`, PWA `:4201`), puis
`node qa/outils/e2e-reset.cjs && node qa/outils/e2e-N-*.mjs` (`BASE=http://127.0.0.1:4400`
pour le build de production servi par `serveur-statique.mjs … 5001`).

| Sonde | Couvre | Résultat |
|---|---|---|
| `e2e-2-documents` | fiche, vue, favori (ajout/retrait/page), notation, hors ligne (serveur + cache), téléchargement, lecteur, signalement | 14/14 |
| `e2e-3-annales-quiz` | recherche, épreuves (liste, ouverture, téléchargement, note), quiz complet, progression | 12/12 |
| `e2e-4-compte` | notifications (badge, ouverture, tout lire), reprise de lecture, niveau, appareils, changement de PIN, thème | 16/16 |
| `e2e-5-moderation` | dépôts (liste, file admin, refus, notification), recours de bout en bout, signalement → masquage → modération | 25/25 |
| `e2e-6-session` | support, matières, langue, déconnexion/reconnexion | 6/6 |
| `e2e-7-hors-ligne` (build de production + service worker) | lecture du PDF enregistré réseau coupé | 3/3 |

Défauts de fond trouvés par ces sondes :

* **Lecture et téléchargement** : l'API signait toute adresse en `authenticated`
  alors que les fichiers sont publics → adresse inexistante (404). Le hors
  ligne ne pouvait donc rien enregistrer. Corrigé (documents et épreuves).
* **Changement de PIN** : `POST /api/auth/change-pin` n'existait pas, et le
  service lisait l'utilisateur sans `+pinHash` (champ exclu du schéma) :
  « Utilisateur introuvable » à chaque tentative, y compris sur l'ancienne
  route `/api/users/change-pin`. Corrigé.
* `/api/auth/verification-status` répondait 404 à chaque navigation.
* Cycle : l'énumération est en majuscules (`LICENCE`), les comparaisons ne
  l'étaient pas - le contrôle « niveau étranger au cycle » ne s'appliquait pas.

Non éprouvé de bout en bout (dépend d'un service externe) : envoi d'un PDF
(dépôt, avatar, justificatif : Cloudinary), e-mails OTP (SMTP), notifications
push (Firebase absent), publication d'un dépôt approuvé (relit le fichier
chez Cloudinary).

## 18. Avant la connexion, de bout en bout (`e2e-8-avant-connexion`, 31/31)

Parcours réel, e-mail coupé (le code est retrouvé en base, il n'y est que haché) :
lancement → présentation → inscription (validations, domaine, cascade
école/cycle/filière/niveau servie par l'API) → code par e-mail → PIN →
connexion (e-mail inconnu, PIN faux) → appareil nouveau (code exigé) → appareil
connu (rien) → PIN oublié (faux code, bon code, nouveau PIN).

Défauts trouvés et corrigés :

* **Inscription impossible à terminer** : le pavé du PIN se bloque à quatre
  chiffres affichés ; au passage en confirmation, l'affichage n'était pas remis
  à zéro, donc la confirmation ne pouvait pas être saisie (inscription **et**
  récupération du PIN).
* **Page introuvable après le code reçu** : `navigate(['/app', cond ? a : pinSetup])`
  encodait le « / » (`register%2Fpin-setup`). La garde de `verifier-design.mjs`
  ne voyait pas les ternaires ni les `…Path(id)` ; elle les voit maintenant
  (et a trouvé la même faute sur l'ouverture d'une épreuve depuis la liste).
* **Filière effacée** : en choisissant le niveau, la filière juste choisie
  repassait à « Choisir… » (catalogue de secours).
* **Niveaux « Niveau 0 »** : les filières stockées en « Niveau 1 » / « L1 »
  donnaient un libellé faux et une valeur refusée à l'inscription ; le serveur
  les ramène au code N1…N5.
* **« Code incorrect » avec un code frais** : deux codes valides coexistaient
  et le serveur lisait le plus ancien. Un nouveau code invalide les précédents,
  et la lecture prend le plus récent.
