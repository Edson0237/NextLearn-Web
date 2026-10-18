import { Routes } from '@angular/router';
import { authGuard } from '../../core/router/auth.guard';
import { AppRoutes } from '../../core/router/app-routes';
import { RouteStub } from '../route-stub/route-stub';
import { MainShell } from '../shell/main-shell';
import { AppShellRoot } from './app-shell-root';
import { Onboarding } from '../auth/onboarding/onboarding';
import { Splash } from '../auth/splash/splash';
import { Register } from '../auth/register/register';
import { Otp } from '../auth/otp/otp';
import { PinSetup } from '../auth/pin-setup/pin-setup';
import { LoginPin } from '../auth/login-pin/login-pin';
import { Unlock } from '../auth/unlock/unlock';
import { ResetPin } from '../auth/reset-pin/reset-pin';
import { EpreuvesList } from '../epreuves/epreuves-list/epreuves-list';
import { EpreuveDetail } from '../epreuves/epreuve-detail/epreuve-detail';

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
      { path: AppRoutes.register, component: Register },
      { path: AppRoutes.otp, component: Otp, data: { isLogin2fa: false } },
      { path: AppRoutes.pinSetup, component: PinSetup },
      { path: AppRoutes.login, component: LoginPin },
      { path: AppRoutes.loginOtp, component: Otp, data: { isLogin2fa: true } },
      { path: AppRoutes.unlock, component: Unlock },
      { path: AppRoutes.resetPin, component: ResetPin },

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
      { path: AppRoutes.epreuveDetail, component: EpreuveDetail },
      { path: AppRoutes.quizSession, ...stub('Quiz', 'quiz_session_page.dart') },

      // ── Coque principale : cinq onglets qui gardent leur état ────────────
      {
        path: '',
        component: MainShell,
        children: [
          { path: AppRoutes.home, ...stub('Accueil', 'home_page.dart') },
          { path: AppRoutes.bibliotheque, ...stub('Bibliothèque', 'bibliotheque_home_page.dart') },
          { path: AppRoutes.epreuves, component: EpreuvesList },
          { path: AppRoutes.progression, ...stub('Progression', 'progression_dashboard_page.dart') },
          { path: AppRoutes.mesDepots, ...stub('Mes dépôts', 'mes_depots_page.dart') },
          { path: AppRoutes.profil, ...stub('Profil', 'profil_home_page.dart') },
        ],
      },
    ],
  },
];
