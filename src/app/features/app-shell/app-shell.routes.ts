import { Routes } from '@angular/router';
import { authGuard } from '../../core/router/auth.guard';
import { AppRoutes } from '../../core/router/app-routes';
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
import { MesDepots } from '../contributions/mes-depots/mes-depots';
import { DepotForm } from '../contributions/depot-form/depot-form';
import { ProfilHome } from '../profil/profil-home/profil-home';
import { Parametres } from '../profil/parametres/parametres';
import { Sessions } from '../profil/sessions/sessions';
import { SupportTickets } from '../profil/support-tickets/support-tickets';
import { DeleteAccount } from '../profil/delete-account/delete-account';
import { Home } from '../home/home';
import { BibliothequeHome } from '../bibliotheque/bibliotheque-home/bibliotheque-home';
import { Catalogue } from '../bibliotheque/catalogue/catalogue';
import { Matiere } from '../bibliotheque/matiere/matiere';
import { DocumentDetail } from '../bibliotheque/document-detail/document-detail';
import { Favoris } from '../bibliotheque/favoris/favoris';
import { OfflineLibrary } from '../bibliotheque/offline-library/offline-library';
import { Recherche } from '../recherche/recherche';
import { PdfReader } from '../bibliotheque/pdf-reader/pdf-reader';
import { ProgressionDashboard } from '../progression/progression-dashboard/progression-dashboard';
import { QuizSession } from '../quiz/quiz-session/quiz-session';
import { NotificationsPage } from '../notifications/notifications-page/notifications-page';
import { VerificationForm } from '../verification/verification-form/verification-form';
import { VerificationPending } from '../verification/verification-pending/verification-pending';
import { RecoursPage } from '../recours/recours-page/recours-page';
import { APropos } from '../legal/a-propos/a-propos';
import { LegalDocument } from '../legal/legal-document/legal-document';

/**
 * L'arbre de routes de l'application — traduction du `GoRouter` complet
 * (`lib/app/router/app_router.dart`). `canActivateChild: [authGuard]` posé
 * une fois ici couvre toute navigation sous `/app`, exactement comme le
 * `redirect` unique de go_router s'applique à chaque route déclarée.
 *
 * Tous les écrans authentifiés sont maintenant de vrais composants.
 */
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
      { path: AppRoutes.notifications, component: NotificationsPage },
      { path: AppRoutes.verificationForm, component: VerificationForm },
      { path: AppRoutes.verificationPending, component: VerificationPending },
      { path: AppRoutes.supportTickets, component: SupportTickets },
      { path: AppRoutes.deleteAccount, component: DeleteAccount },
      { path: AppRoutes.aPropos, component: APropos },
      { path: AppRoutes.legalDocument, component: LegalDocument },
      { path: AppRoutes.depotForm, component: DepotForm },
      { path: AppRoutes.recours, component: RecoursPage },
      { path: AppRoutes.parametres, component: Parametres },
      { path: AppRoutes.sessions, component: Sessions },
      { path: AppRoutes.matieres, component: Catalogue },
      { path: AppRoutes.matiere, component: Matiere },
      { path: AppRoutes.favoris, component: Favoris },
      { path: AppRoutes.offlineLibrary, component: OfflineLibrary },
      { path: AppRoutes.recherche, component: Recherche },
      { path: AppRoutes.documentDetail, component: DocumentDetail },
      { path: AppRoutes.pdfReader, component: PdfReader },
      { path: AppRoutes.epreuveDetail, component: EpreuveDetail },
      { path: AppRoutes.quizSession, component: QuizSession },

      // ── Coque principale : cinq onglets qui gardent leur état ────────────
      {
        path: '',
        component: MainShell,
        children: [
          { path: AppRoutes.home, component: Home },
          { path: AppRoutes.bibliotheque, component: BibliothequeHome },
          { path: AppRoutes.epreuves, component: EpreuvesList },
          { path: AppRoutes.progression, component: ProgressionDashboard },
          { path: AppRoutes.mesDepots, component: MesDepots },
          { path: AppRoutes.profil, component: ProfilHome },
        ],
      },
    ],
  },
];
