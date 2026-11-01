import { Routes } from '@angular/router';
import { authGuard } from '../../core/router';
import { AppRoutes } from '../../core/router';
import { MainShell } from '../main-shell/main-shell';
import { AppShellRoot } from './app-shell-root';

/**
 * L'arbre de routes de l'application - traduction du `GoRouter` complet
 * (`lib/app/router/app_router.dart`). `canActivateChild: [authGuard]` posé
 * une fois ici couvre toute navigation sous `/app`, exactement comme le
 * `redirect` unique de go_router s'applique à chaque route déclarée.
 *
 * ## Pourquoi `loadComponent` et non `component`
 *
 * Les trente-cinq écrans étaient importés en haut de ce fichier, donc
 * rassemblés dans un seul morceau de code de 856 Ko - téléchargé en entier
 * pour afficher l'écran de connexion, lecteur PDF compris. Lighthouse le
 * chiffrait à 820 Kio de JavaScript jamais exécuté, et la performance mobile
 * tombait à 49/100 pour un objectif de 80.
 *
 * Chaque écran se charge désormais quand on y va. Les deux seules exceptions
 * sont les coques (`AppShellRoot`, `MainShell`) : elles sont de toute façon
 * traversées dès la première navigation, et les charger paresseusement
 * ajouterait un aller-retour avant le premier pixel.
 */
export const APP_SHELL_ROUTES: Routes = [
  {
    path: '',
    component: AppShellRoot,
    canActivateChild: [authGuard],
    children: [
      // ── Authentification ───────────────────────────────────────────────
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../../features/auth/splash/splash').then((m) => m.Splash),
      },
      {
        path: AppRoutes.onboarding,
        loadComponent: () => import('../../features/auth/onboarding/onboarding').then((m) => m.Onboarding),
      },
      {
        path: AppRoutes.register,
        loadComponent: () => import('../../features/auth/register/register').then((m) => m.Register),
      },
      {
        path: AppRoutes.otp,
        loadComponent: () => import('../../features/auth/otp/otp').then((m) => m.Otp),
        data: { isLogin2fa: false },
      },
      {
        path: AppRoutes.pinSetup,
        loadComponent: () => import('../../features/auth/pin-setup/pin-setup').then((m) => m.PinSetup),
      },
      {
        path: AppRoutes.login,
        loadComponent: () => import('../../features/auth/login-pin/login-pin').then((m) => m.LoginPin),
      },
      {
        path: AppRoutes.loginOtp,
        loadComponent: () => import('../../features/auth/otp/otp').then((m) => m.Otp),
        data: { isLogin2fa: true },
      },
      {
        path: AppRoutes.unlock,
        loadComponent: () => import('../../features/auth/unlock/unlock').then((m) => m.Unlock),
      },
      {
        path: AppRoutes.resetPin,
        loadComponent: () => import('../../features/auth/reset-pin/reset-pin').then((m) => m.ResetPin),
      },

      // ── Hors coque (poussés par-dessus) ──────────────────────────────────
      {
        path: AppRoutes.notifications,
        loadComponent: () =>
          import('../../features/notifications/notifications-page/notifications-page').then(
            (m) => m.NotificationsPage,
          ),
      },
      {
        path: AppRoutes.verificationForm,
        loadComponent: () =>
          import('../../features/verification/verification-form/verification-form').then((m) => m.VerificationForm),
      },
      {
        path: AppRoutes.verificationPending,
        loadComponent: () =>
          import('../../features/verification/verification-pending/verification-pending').then(
            (m) => m.VerificationPending,
          ),
      },
      {
        path: AppRoutes.supportTickets,
        loadComponent: () =>
          import('../../features/profil/support-tickets/support-tickets').then((m) => m.SupportTickets),
      },
      {
        path: AppRoutes.deleteAccount,
        loadComponent: () =>
          import('../../features/profil/delete-account/delete-account').then((m) => m.DeleteAccount),
      },
      {
        path: AppRoutes.aPropos,
        loadComponent: () => import('../../features/legal/a-propos/a-propos').then((m) => m.APropos),
      },
      {
        path: AppRoutes.installer,
        loadComponent: () =>
          import('../../features/installation/installation-page/installation-page').then((m) => m.InstallationPage),
      },
      {
        path: AppRoutes.legalDocument,
        loadComponent: () =>
          import('../../features/legal/legal-document/legal-document').then((m) => m.LegalDocument),
      },
      {
        path: AppRoutes.depotForm,
        loadComponent: () =>
          import('../../features/contributions/depot-form/depot-form').then((m) => m.DepotForm),
      },
      {
        path: AppRoutes.depotScanner,
        loadComponent: () => import('../../features/contributions/scanner/scanner').then((m) => m.Scanner),
      },
      {
        path: AppRoutes.recours,
        loadComponent: () => import('../../features/recours/recours-page/recours-page').then((m) => m.RecoursPage),
      },
      {
        path: AppRoutes.parametres,
        loadComponent: () => import('../../features/profil/parametres/parametres').then((m) => m.Parametres),
      },
      {
        path: AppRoutes.sessions,
        loadComponent: () => import('../../features/profil/sessions/sessions').then((m) => m.Sessions),
      },
      {
        path: AppRoutes.matieres,
        loadComponent: () => import('../../features/bibliotheque/catalogue/catalogue').then((m) => m.Catalogue),
      },
      {
        path: AppRoutes.matiere,
        loadComponent: () => import('../../features/bibliotheque/matiere/matiere').then((m) => m.Matiere),
      },
      {
        path: AppRoutes.favoris,
        loadComponent: () => import('../../features/bibliotheque/favoris/favoris').then((m) => m.Favoris),
      },
      {
        path: AppRoutes.offlineLibrary,
        loadComponent: () =>
          import('../../features/bibliotheque/offline-library/offline-library').then((m) => m.OfflineLibrary),
      },
      {
        path: AppRoutes.recherche,
        loadComponent: () => import('../../features/recherche/recherche').then((m) => m.Recherche),
      },
      {
        path: AppRoutes.documentDetail,
        loadComponent: () =>
          import('../../features/bibliotheque/document-detail/document-detail').then((m) => m.DocumentDetail),
      },
      {
        // Le lecteur embarque pdf.js : c'est le plus gros morceau de
        // l'application, et le seul écran qui en a besoin.
        path: AppRoutes.pdfReader,
        loadComponent: () => import('../../features/bibliotheque/pdf-reader/pdf-reader').then((m) => m.PdfReader),
      },
      {
        path: AppRoutes.epreuveDetail,
        loadComponent: () =>
          import('../../features/epreuves/epreuve-detail/epreuve-detail').then((m) => m.EpreuveDetail),
      },
      {
        path: AppRoutes.quizSession,
        loadComponent: () => import('../../features/quiz/quiz-session/quiz-session').then((m) => m.QuizSession),
      },

      // ── Coque principale : cinq onglets qui gardent leur état ────────────
      {
        path: '',
        component: MainShell,
        children: [
          {
            path: AppRoutes.home,
            loadComponent: () => import('../../features/home/home').then((m) => m.Home),
          },
          {
            path: AppRoutes.bibliotheque,
            loadComponent: () =>
              import('../../features/bibliotheque/bibliotheque-home/bibliotheque-home').then(
                (m) => m.BibliothequeHome,
              ),
          },
          {
            path: AppRoutes.epreuves,
            loadComponent: () =>
              import('../../features/epreuves/epreuves-list/epreuves-list').then((m) => m.EpreuvesList),
          },
          {
            path: AppRoutes.progression,
            loadComponent: () =>
              import('../../features/progression/progression-dashboard/progression-dashboard').then(
                (m) => m.ProgressionDashboard,
              ),
          },
          {
            path: AppRoutes.mesDepots,
            loadComponent: () =>
              import('../../features/contributions/mes-depots/mes-depots').then((m) => m.MesDepots),
          },
          {
            path: AppRoutes.profil,
            loadComponent: () => import('../../features/profil/profil-home/profil-home').then((m) => m.ProfilHome),
          },
        ],
      },
    ],
  },
];
