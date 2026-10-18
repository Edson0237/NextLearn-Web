# Matrice de parité — Flutter → PWA Angular

Référentiel de suivi de la migration. Une ligne par écran ou fonctionnalité.
Statut : `à faire` / `en cours` / `fait` / `adapté` / `impossible`.

Source : `C:\Users\USER\StudioProjects\nextlearn` (Flutter, source de vérité).

Architecture tranchée (voir rapport d'audit, §0) : un seul domaine, un seul
projet Angular. `NextLearn-Web` (site vitrine déjà en ligne) est la base ; la
vitrine devient sa page publique, l'application étudiante s'ajoute en routes
supplémentaires du même projet.

---

## 1. Auth & onboarding

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Écran de démarrage, restauration de session | `splash_page.dart` | Composant racine + guard de résolution avant affichage | à faire | Pas d'écran natif de lancement : prévoir un splash HTML/CSS statique dans `index.html` pour masquer l'écran blanc avant le bundle JS (Phase 5 pt. 5) | idem |
| Présentation initiale (3-4 pages) | `onboarding_page.dart` | Composant avec signal d'étape | à faire | — | — |
| Inscription — formulaire | `register_page.dart` | Reactive Forms, mêmes règles de validation | à faire | `file_picker` → `<input type="file">` (justificatif) | idem |
| Inscription — code OTP par e-mail | `otp_page.dart` | Formulaire à 6 cases + minuteur de renvoi | à faire | — | — |
| Création du PIN à 4 chiffres | `pin_setup_page.dart` | `pin_input_widget` porté en composant | à faire | Clavier numérique virtuel ne doit jamais masquer le champ (Phase 2 pt. 5) | idem |
| Connexion par PIN local | `login_pin_page.dart` | Idem + biométrie optionnelle | à faire | WebAuthn (Face ID via Safari) **si** iOS 16.4+ et PWA installée — à valider en Phase 1 bis, pas garanti | WebAuthn (empreinte) via Credential Management API |
| Déverrouillage (session active, app reprise) | `unlock_page.dart` | Idem, sans ré-appel réseau | à faire | — | — |
| Récupération de PIN oublié (OTP) | `reset_pin_page.dart` | Formulaire + OTP | à faire | — | — |
| Reprise d'un parcours OTP interrompu (`_ecranDuParcours`) | `app_router.dart` | Guard de résolution + état persistant (signal + sessionStorage) | à faire | **Point d'attention** : la logique de reprise (jeton temporaire, `ParcoursOtp`) est une pièce de routage fine — à porter fonction par fonction, pas en esprit | idem |
| Lien profond vers un document reçu hors session | `lien_profond.dart` | Résolution d'URL + file d'attente de destination en mémoire (pas de persistance disque — comportement identique) | à faire | Deep link web = URL ordinaire, plus simple qu'en natif | idem |
| Authentification biométrique | `biometric_service.dart` | WebAuthn, dégradé silencieux si indisponible | adapté (dégradation déjà prévue côté Flutter) | Le service Flutter capture déjà `MissingPluginException` sur web : le même contrat (jamais d'exception, juste `false`) doit être repris côté Angular | idem |

## 2. Navigation principale (shell)

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Barre de navigation basse, 5 onglets | `main_shell.dart`, `bottom_nav_bar.dart` | Composant shell + Angular Router avec routes parallèles (state préservé par onglet) | à faire | `env(safe-area-inset-bottom)` indispensable (encoche / barre d'accueil) | — |
| État préservé par branche (`StatefulNavigationShell`) | idem | `RouteReuseStrategy` custom, ou composants gardés en vie par `[hidden]` | à faire | **Risque** : Angular Router ne garde pas nativement 5 arbres de composants vivants en parallèle comme `go_router`'s `StatefulShellRoute` — demande une stratégie explicite | — |
| Retour : ramène au premier onglet, puis confirme la sortie | `main_shell.dart` (`PopScope`) | Sans objet en PWA : il n'y a pas de "fermer l'application" au sens natif | **impossible / sans objet** | Le bouton retour du navigateur a sa propre sémantique (historique) — ne pas reproduire ce comportement, risquerait de piéger l'utilisateur dans l'historique | idem |
| Recherche plein écran hors du shell | `recherche_page.dart` | Route hors shell, overlay | à faire | — | — |

## 3. Bibliothèque de documents

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Accueil bibliothèque (documents directs, plus de détour par matières) | `bibliotheque_home_page.dart` | Liste + filtres | à faire | — | — |
| Catalogue complet | `catalogue_page.dart` | Liste paginée (`paginated_fetch.dart` → pattern à reprendre) | à faire | — | — |
| Vue par matière (tronc commun inclus) | `matiere_page.dart` | idem | à faire | — | — |
| Détail d'un document | `document_detail_page.dart` | Route `/bibliotheque/doc/:id` | à faire | — | — |
| Lecteur PDF intégré | `pdf_reader_page.dart` (`syncfusion_flutter_pdfviewer`) | `pdf.js` (Mozilla) ou équivalent web | à faire | **Risque notable** — voir rapport §3 : pas d'équivalent direct à Syncfusion, qualité de rendu/performance à valider sur mobile bas de gamme | idem |
| Favoris | `favoris_page.dart` | Liste + API `/api/favorites` | à faire | — | — |
| Bibliothèque hors-ligne (téléchargement, consultation) | `offline_library_page.dart` | IndexedDB (Dexie) + Cache Storage pour les PDF | à faire | **Risque** : stockage persistant non garanti sur iOS Safari hors PWA installée (`navigator.storage.persist()` peu fiable sur iOS) — voir rapport §4 | Stockage persistant plus fiable (`persist()` généralement honoré) |
| Téléchargement de document (`telechargement_service.dart`) | — | Fetch + écriture Cache Storage/IndexedDB, barre de progression | à faire | — | — |
| Notation d'un document | `document_detail_page.dart` | Appel `/api/documents/:id/rate` | à faire | — | — |
| URL signée / visualisation (`signed-url`, `view`) | — | Fetch avec jeton, affichage via blob URL | à faire | — | — |

## 4. Épreuves

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Liste des épreuves (filtres type CC/SN, matière) | `epreuves_list_page.dart` | Liste + filtres | à faire | — | — |
| Détail d'une épreuve | `epreuve_detail_page.dart` | Route `/epreuves/:id` | à faire | — | — |
| Téléchargement / notation épreuve | idem | `/api/epreuves/:id/download`, `/rate` | à faire | — | — |

## 5. Quiz

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Session de quiz (578 lignes de domaine à porter) | `quiz_session_page.dart` | Composant avec état de progression, soumission `/api/quiz/:id/submit` | à faire | **Point d'attention sécurité** : le repo mémoire a confirmé que la bonne réponse (`bonneReponseIndex`) est retirée côté serveur avant envoi — vérifier que l'affichage web ne la redemande/stocke jamais en clair côté client avant correction | idem |

## 6. Progression

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Tableau de bord (stats, activité semaine, par matière) | `progression_dashboard_page.dart` | Composants + `fl_chart` → **Chart.js** ou **ngx-charts** | à faire | — | — |
| Badges (liste + vérification) | — | `/api/progression/badges`, `/badges/check` | à faire | — | — |
| Séries ("streak") | `streak_badge.dart` | Composant porté | à faire | — | — |

## 7. Contributions (dépôt de documents par les étudiants)

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Formulaire de dépôt (PDF ou scan) | `depot_form_page.dart` | Reactive Forms + `<input type="file">` | à faire | Le scan caméra natif n'a pas d'équivalent web fiable (redressement de perspective) — **alternative : import PDF/photo brute uniquement**, déjà le comportement de repli choisi côté Flutter web (`scanner_service_web.dart` → `disponible = false`) | idem |
| Mes dépôts (suivi statut) | `mes_depots_page.dart` | Liste + statuts | à faire | — | — |

## 8. Vérification académique

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Formulaire de vérification (justificatif) | `verification_form_page.dart` | Reactive Forms + upload fichier | à faire | — | — |
| Écran d'attente (statut en direct) | `verification_pending_page.dart` | Polling ou re-fetch à la reprise de focus | à faire | Pas de websocket identifié côté Flutter (le routeur réécoute un provider, pas un flux serveur) — à confirmer avant de choisir polling vs push | idem |

## 9. Modération & recours

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Signalement d'un document (`signaler_sheet.dart`) | — | Feuille modale → composant équivalent | à faire | — | — |
| Voie de recours contre une décision | `recours_page.dart` | Formulaire + `/api/recours`, `/possibilites` | à faire | — | — |

## 10. Notifications

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Liste des notifications, lu/non lu | `notifications_page.dart` | Liste + `/api/notifications`, `read-all` | à faire | — | — |
| Push natif (FCM) | `push_service_natif.dart` | Firebase Cloud Messaging **web** (`@angular/fire` ou SwPush) | à faire | **Risque confirmé** : push iOS uniquement si PWA installée sur écran d'accueil, iOS 16.4+ ; Safari ne supporte pas le push en navigateur ouvert simple | Chrome/Android : support complet, proche du natif |
| Push web : actuellement un stub inerte côté Flutter | `push_service_web.dart` | À construire entièrement (rien à porter, tout est à écrire) | à faire — départ de zéro | Le code Flutter note déjà que `firebase_core_web` ne compilait pas avec le SDK Dart utilisé ; **aucune garantie que ce problème se reproduise côté Angular** (SDK JS natif, pas de pont Dart↔JS) mais à vérifier en Phase 5 avant d'announcer une date | — |
| Préférences de notification | `preference_notifications.dart` | Formulaire de réglages | à faire | — | — |

## 11. Profil & paramètres

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| Accueil profil | `profil_home_page.dart` | Composant | à faire | — | — |
| Paramètres (thème, taille de texte, animations) | `parametres_page.dart` + `preferences_accessibilite.dart` | Signals + `prefers-color-scheme`/`prefers-reduced-motion` comme valeurs par défaut, réglage explicite prioritaire (même contrat que `AppMotion.reduireLeMouvement`) | à faire | — | — |
| Appareils connectés (sessions actives, révocation à distance) | `sessions_page.dart` | `/api/auth/sessions`, `DELETE /sessions/:id` | à faire | — | — |
| Signalements/support (tickets) | `support_tickets_page.dart` | `/api/support/tickets` | à faire | — | — |
| Suppression de compte (écran dédié, pas une modale) | `delete_account_page.dart` | Composant dédié — **exigence Apple 5.1.1(v)**, conserver un écran à part même en PWA | à faire | Page déjà exigée aussi pour la fiche Play Store (voir le site vitrine, déjà livré : `/suppression-compte/`) | — |

## 12. Légal

| Fonctionnalité Flutter | Écran(s) | Équivalent Angular prévu | Statut | Remarques iOS | Remarques Android |
|---|---|---|---|---|---|
| À propos | `a_propos_page.dart` | Composant statique | à faire | — | — |
| Politique de confidentialité / conditions (in-app) | `legal_document_page.dart` | **Déjà fait** : pages statiques `/confidentialite/` et `/conditions/`, déjà dans le même projet puisque c'est désormais la même base — un lien suffit, pas d'iframe | **fait** | — | — |
| Suppression de compte — exigence Play Store (page web hors appli) | — | **Déjà fait** : `/suppression-compte/`, même projet | **fait** | — | — |

## 13. Infrastructure transverse

| Fonctionnalité Flutter | Fichier(s) | Équivalent Angular prévu | Statut | Remarques |
|---|---|---|---|---|
| Client HTTP + intercepteurs (jeton, device headers) | `dio_client.dart`, `device_headers.dart` | `HttpClient` + `HttpInterceptorFn` | à faire | Pattern directement transposable |
| Modèle d'échec unifié (`failure.dart`) | `failure.dart` | Classe/union TypeScript équivalente | à faire | Porter la même taxonomie d'erreurs (pas en inventer une nouvelle) |
| Détection de connectivité | `connectivity_service.dart` | `navigator.onLine` + écouteurs `online`/`offline` (moins fiable que les plugins natifs — faux positifs connus) | adapté | **Risque mineur** : `navigator.onLine` ne garantit pas un accès réseau réel, seulement une interface active |
| Vérification réseau au démarrage | `demarrage_reseau.dart` | Idem + état d'app avant affichage | à faire | — |
| Stockage chiffré (JWT, refresh token, hash PIN) | `secure_storage_service.dart` | **Aucun équivalent sûr** : repli sur `localStorage`, non chiffré | **impossible tel quel** | **Risque majeur, voir rapport §2** |
| 9 boîtes Hive chiffrées (documents, favoris, progression…) | `hive_service.dart`, `hive_encryption.dart` | IndexedDB (Dexie), chiffrement applicatif optionnel via WebCrypto | adapté | **Risque** : la clé de chiffrement Hive vient du coffre système (Keystore/Keychain) ; WebCrypto peut générer/stocker une clé non extractible, mais la garantie n'est pas la même — à traiter comme un abaissement de niveau de sécurité, pas une parité |
| Nettoyage de cache | `cache_cleaner_service.dart` | Équivalent IndexedDB/Cache Storage | à faire | — |
| Partage (liens, documents) | `lien_profond.dart`, `share_plus` | Web Share API + repli "copier le lien" | adapté | Contrat déjà prévu par le prompt |
| Retour haptique | `retour_haptique.dart` | `navigator.vibrate()` (Android/Chrome uniquement — absent sur iOS Safari) | adapté | **Pas de haptique sur iOS Safari**, quel que soit le code — limite de la plateforme, pas du portage |
| Rafraîchissement global (pull-to-refresh) | `rafraichissement_global.dart`, `liste_rafraichissable.dart` | Pattern CSS/JS (pas de primitive native comme en Flutter) | à faire | — |

## 14. Design system (référence Phase 2)

| Élément | Source | Statut |
|---|---|---|
| Palette couleurs (clair + sombre, hex exacts) | `app_colors.dart` | **extrait, prêt à traduire en tokens CSS** |
| Grille d'espacement (base 4) + rayons | `app_spacing.dart` | **extrait** |
| Typographie (Poppins/Inter/JetBrains Mono, tailles, graisses) | `app_text_styles.dart` | **extrait** |
| Durées et courbes d'animation + contrat `prefers-reduced-motion` | `app_motion.dart` | **extrait** |
| 21 composants UI partagés déjà identifiés et nommés | `lib/core/ux/`, `lib/shared/widgets/` | **inventaire fait**, portage à faire composant par composant |
| Thème clair/sombre | `app_theme.dart`, `theme_mode_provider.dart` | à auditer en détail en Phase 2 |

---

**Légende statuts** : `à faire` (rien fait) · `en cours` · `fait` · `adapté` (porté avec une différence délibérée documentée) · `impossible` (aucun équivalent web, alternative à décider).
