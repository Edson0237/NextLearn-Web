import { Routes } from '@angular/router';
import { authGuard } from '../../core/router/auth.guard';
import { AppRoutes } from '../../core/router/app-routes';
import { RouteStub } from '../route-stub/route-stub';
import { MainShell } from '../shell/main-shell';
import { AppShellRoot } from './app-shell-root';
import { Onboarding } from '../auth/onboarding/onboarding';
import { Splash } from '../auth/splash/splash';

/**
 * L'arbre de routes de l'application — traduction du `GoRouter` complet
 * (`lib/app/router/app_router.dart`). `canActivateChild: [authGuard]` posé
 * une fois ici couvre toute navigation sous `/app`, exactement comme le
 * `redirect` unique de go_router s'applique à chaque route déclarée.
 *
 * Chaque écran est un `RouteStub` (Phase 4) sauf la coque à cinq onglets,
 * qui existe réellement (Phase 3 : c'est de l'architecture de navigation,
 * pas du contenu). Voir `route-stub.ts` pour pourquoi un composant
 * générique plutôt que 31 fichiers vides.
 */
function stub(ecran: string, source: string) {
  return { component: RouteStub, data: { ecran, source } };
}

export const APP_SHELL_ROUTES: Routes = [
  {
    path: '',
    component: AppShellRoot,
    canActivateChild: [authGuard],
    children: [
      // ── Authentification ───────────────────────────────────────────────
      { path: '', pathMatch: 'full', component: Splash },
      { path: AppRoutes.onboarding, component: Onboarding },
      { path: AppRoutes.register, ...stub('Inscription', 'register_page.dart') },
      { path: AppRoutes.otp, ...stub('Code de vérification', 'otp_page.dart') },
      { path: AppRoutes.pinSetup, ...stub('Créer un code', 'pin_setup_page.dart') },
      { path: AppRoutes.login, ...stub('Connexion', 'login_pin_page.dart') },
      { path: AppRoutes.loginOtp, ...stub('Code de vérification', 'otp_page.dart (2FA)') },
      { path: AppRoutes.unlock, ...stub('Déverrouillage', 'unlock_page.dart') },
      { path: AppRoutes.resetPin, ...stub('Code oublié', 'reset_pin_page.dart') },

      // ── Hors coque (poussés par-dessus) ──────────────────────────────────
      { path: AppRoutes.notifications, ...stub('Notifications', 'notifications_page.dart') },
      { path: AppRoutes.verificationForm, ...stub('Vérification académique', 'verification_form_page.dart') },
      { path: AppRoutes.verificationPending, ...stub('Dossier en attente', 'verification_pending_page.dart') },
      { path: AppRoutes.supportTickets, ...stub('Signalements', 'support_tickets_page.dart') },
      { path: AppRoutes.deleteAccount, ...stub('Supprimer mon compte', 'delete_account_page.dart') },
      { path: AppRoutes.aPropos, ...stub('À propos', 'a_propos_page.dart') },
      { path: AppRoutes.depotForm, ...stub('Proposer un document', 'depot_form_page.dart') },
      { path: AppRoutes.recours, ...stub('Voie de recours', 'recours_page.dart') },
      { path: AppRoutes.parametres, ...stub('Réglages', 'parametres_page.dart') },
      { path: AppRoutes.sessions, ...stub('Appareils connectés', 'sessions_page.dart') },
      { path: AppRoutes.matieres, ...stub('Catalogue par matière', 'catalogue_page.dart') },
      { path: AppRoutes.matiere, ...stub('Matière', 'matiere_page.dart') },
      { path: AppRoutes.favoris, ...stub('Favoris', 'favoris_page.dart') },
      { path: AppRoutes.offlineLibrary, ...stub('Bibliothèque hors-ligne', 'offline_library_page.dart') },
      { path: AppRoutes.recherche, ...stub('Recherche', 'recherche_page.dart') },
      { path: AppRoutes.documentDetail, ...stub('Document', 'document_detail_page.dart') },
      { path: AppRoutes.pdfReader, ...stub('Lecteur', 'pdf_reader_page.dart') },
      { path: AppRoutes.epreuveDetail, ...stub('Épreuve', 'epreuve_detail_page.dart') },
      { path: AppRoutes.quizSession, ...stub('Quiz', 'quiz_session_page.dart') },

      // ── Coque principale : cinq onglets qui gardent leur état ────────────
      {
        path: '',
        component: MainShell,
        children: [
          { path: AppRoutes.home, ...stub('Accueil', 'home_page.dart') },
          { path: AppRoutes.bibliotheque, ...stub('Bibliothèque', 'bibliotheque_home_page.dart') },
          { path: AppRoutes.epreuves, ...stub('Épreuves', 'epreuves_list_page.dart') },
          { path: AppRoutes.progression, ...stub('Progression', 'progression_dashboard_page.dart') },
          { path: AppRoutes.mesDepots, ...stub('Mes dépôts', 'mes_depots_page.dart') },
          { path: AppRoutes.profil, ...stub('Profil', 'profil_home_page.dart') },
        ],
      },
    ],
  },
];
