/**
 * Chemins de l'application — traduction d'`AppRoutes`
 * (`lib/app/router/app_routes.dart`). Relatifs à `/app`, où toute
 * l'application vit dans ce projet (voir `AUDIT_PHASE1.md`, §0 — la
 * vitrine occupe `/`).
 */
export abstract class AppRoutes {
  // ── Auth ─────────────────────────────────────────────────────────────────
  static readonly splash = '';
  static readonly onboarding = 'onboarding';
  static readonly register = 'register';
  static readonly otp = 'register/otp';
  static readonly pinSetup = 'register/pin-setup';
  static readonly login = 'login';
  static readonly loginOtp = 'login/otp';
  /** Session valide mais verrouillée : PIN local uniquement. */
  static readonly unlock = 'unlock';
  /** Récupération d'un compte dont le PIN a été oublié. */
  static readonly resetPin = 'login/reset-pin';

  // ── Onglets du shell ─────────────────────────────────────────────────────
  static readonly home = 'home';
  static readonly bibliotheque = 'bibliotheque';
  static readonly epreuves = 'epreuves';
  static readonly progression = 'progression';
  static readonly mesDepots = 'depots';
  static readonly profil = 'profil';

  // ── Bibliothèque ─────────────────────────────────────────────────────────
  static readonly documentDetail = 'bibliotheque/doc/:id';
  static readonly pdfReader = 'bibliotheque/doc/:id/read';
  static readonly matieres = 'bibliotheque/matieres';
  static readonly matiere = 'bibliotheque/matiere/:id';
  static readonly favoris = 'favoris';
  static readonly offlineLibrary = 'offline';
  static readonly recherche = 'recherche';

  // ── Épreuves ─────────────────────────────────────────────────────────────
  static readonly epreuveDetail = 'epreuves/:id';

  // ── Quiz ─────────────────────────────────────────────────────────────────
  static readonly quizSession = 'quiz/:id';

  // ── Notifications ────────────────────────────────────────────────────────
  static readonly notifications = 'notifications';

  // ── Signalements ─────────────────────────────────────────────────────────
  static readonly supportTickets = 'support/tickets';
  /** Écran dédié, pas une modale — exigence Apple 5.1.1(v). */
  static readonly deleteAccount = 'profil/supprimer-compte';
  static readonly parametres = 'profil/parametres';

  // ── Textes légaux (dans l'application — les pages publiques statiques
  // vivent hors du routage, voir public/confidentialite, public/conditions) ─
  static readonly aPropos = 'legal/a-propos';

  // ── Vérification académique ──────────────────────────────────────────────
  static readonly verificationForm = 'verification';
  static readonly verificationPending = 'verification/attente';

  // ── Contributions étudiantes ──────────────────────────────────────────────
  static readonly depotForm = 'depots/nouveau';

  // ── Voie de recours ───────────────────────────────────────────────────────
  static readonly recours = 'recours';

  // ── Appareils connectés ───────────────────────────────────────────────────
  static readonly sessions = 'profil/appareils';

  // ── Aides de navigation ───────────────────────────────────────────────────
  static docDetailPath(id: string): string { return `bibliotheque/doc/${id}`; }
  static matierePath(id: string): string { return `bibliotheque/matiere/${id}`; }
  static docReaderPath(id: string): string { return `bibliotheque/doc/${id}/read`; }
  static epreuveDetailPath(id: string): string { return `epreuves/${id}`; }
  static quizSessionPath(id: string): string { return `quiz/${id}`; }
}
