import { inject } from '@angular/core';
import { CanActivateChildFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { VerificationService } from '../verification/verification.service';
import { PendingDestinationService } from './pending-destination.service';
import { estAuthentifie } from '../auth/auth.model';
import { ParcoursOtp } from '../../core/models/parcours-otp.model';
import { bloqueAcces, demandeAction } from '../models/verification.model';
import { AppRoutes } from './app-routes';

/**
 * Garde de routage applicatif — traduction de `RouterNotifier.redirect`
 * (`lib/app/router/app_router.dart`), posé une fois sur la route `/app`
 * via `canActivateChild` : Angular l'évalue alors à chaque navigation
 * sous `/app`, exactement comme go_router réévalue son unique callback
 * `redirect` à chaque changement d'état auth (`refreshListenable`).
 *
 * **Non porté ici, délibérément** : la résolution des liens profonds
 * (`LienProfond.documentDepuisChemin`) — elle suppose le module
 * bibliothèque et son schéma d'URL de partage, Phase 4. Le reste de la
 * précédence (authentification, verrouillage, parcours OTP en cours,
 * blocage par vérification académique) est traduit à l'identique.
 *
 * Les routes toujours accessibles sans compte côté Flutter
 * (confidentialite/conditions) n'ont pas d'équivalent à chercher ici :
 * elles vivent hors du routage Angular, en pages statiques
 * (`public/confidentialite/`, `public/conditions/`).
 */
export const authGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const verification = inject(VerificationService);
  const pending = inject(PendingDestinationService);
  const router = inject(Router);

  const chemin = cheminRelatif(state);
  const s = auth.state();
  // `createUrlTree(['/app', dest])` traiterait un `dest` à plusieurs
  // segments (« login/otp », « bibliotheque/doc/42 »…) comme un seul
  // segment littéral, slash échappé en %2F inclus — `parseUrl` découpe
  // correctement la chaîne, comme le ferait une navigation par URL.
  const aller = (dest: string): UrlTree => router.parseUrl(`/app/${dest}`);

  // ── Démarrage : restaure la session, le routeur reste sur le splash ──────
  if (s.isInitializing) {
    return chemin === AppRoutes.splash ? true : aller(AppRoutes.splash);
  }

  const authentifie = estAuthentifie(s);

  // ── Splash quitté : décide où partir ──────────────────────────────────────
  if (chemin === AppRoutes.splash) {
    if (authentifie) {
      if (s.isLocked) return aller(AppRoutes.unlock);
      const destination = pending.consommer();
      return aller(destination ?? AppRoutes.home);
    }
    return aller(ecranDuParcours(s.parcoursOtp) ?? (s.isFirstLaunch ? AppRoutes.onboarding : AppRoutes.login));
  }

  // ── Session verrouillée : rien d'autre que le PIN local ───────────────────
  // Placé avant les routes publiques pour qu'un lien ne puisse pas
  // contourner le verrou. Seule exception : la récupération du PIN —
  // précisément l'écran dont a besoin quelqu'un qui a oublié le code que
  // le verrou lui réclame.
  if (authentifie && s.isLocked) {
    if (chemin === AppRoutes.unlock || chemin === AppRoutes.resetPin) return true;
    return aller(AppRoutes.unlock);
  }

  // ── Verrou levé (ou pas de session) : l'écran de déverrouillage n'a plus lieu d'être ──
  if (chemin === AppRoutes.unlock) {
    return authentifie ? aller(AppRoutes.home) : aller(AppRoutes.login);
  }

  const routesPubliques = [
    AppRoutes.onboarding, AppRoutes.register, AppRoutes.otp,
    AppRoutes.pinSetup, AppRoutes.login, AppRoutes.loginOtp,
  ];
  const estRoutePublique = routesPubliques.some((r) => chemin === r || chemin.startsWith(r));

  if (!authentifie) {
    // Une démarche est ouverte : on y reste. Elle tient à un jeton
    // temporaire et à un code déjà envoyé — s'en éloigner par accident
    // obligerait à tout reprendre et à consommer un second code. Chaque
    // écran propose de renoncer explicitement (voir `abandonnerParcoursOtp`),
    // ce qui efface le jeton et rend la navigation libre.
    const ecranParcours = ecranDuParcours(s.parcoursOtp);
    if (ecranParcours) {
      return chemin === ecranParcours ? true : aller(ecranParcours);
    }

    if (estRoutePublique) return true;

    // On retient où l'on voulait aller — le cas du lien partagé vers une
    // fiche document, à retrouver une fois connecté.
    if (chemin.startsWith('bibliotheque/doc/')) pending.set(chemin);

    return aller(s.isFirstLaunch ? AppRoutes.onboarding : AppRoutes.login);
  }

  if (estRoutePublique) {
    const destination = pending.consommer();
    return aller(destination ?? AppRoutes.home);
  }

  // ── Vérification académique ────────────────────────────────────────────
  // Un compte standard n'a pas de dossier : `bloqueAcces` est faux et rien
  // ne change pour lui.
  const etatVerif = verification.state();
  const estRouteVerification = chemin.startsWith(AppRoutes.verificationForm);

  if (bloqueAcces(etatVerif)) {
    // La voie de recours échappe au blocage : les seules personnes qui ont
    // un rejet à contester sont précisément celles dont l'accès est coupé.
    if (chemin.startsWith(AppRoutes.recours)) return true;

    if (demandeAction(etatVerif.statut)) {
      return chemin === AppRoutes.verificationForm ? true : aller(AppRoutes.verificationForm);
    }
    return chemin === AppRoutes.verificationPending ? true : aller(AppRoutes.verificationPending);
  }

  // Dossier tranché favorablement : on quitte les écrans de vérification.
  if (estRouteVerification) return aller(AppRoutes.home);

  return true;
};

/** L'écran à reprendre pour l'étape d'authentification en cours, s'il y en a une. */
function ecranDuParcours(parcours: ParcoursOtp | undefined): string | null {
  switch (parcours) {
    case ParcoursOtp.inscription: return AppRoutes.otp;
    case ParcoursOtp.definitionPin: return AppRoutes.pinSetup;
    case ParcoursOtp.connexion: return AppRoutes.loginOtp;
    case ParcoursOtp.reinitialisation: return AppRoutes.resetPin;
    default: return null;
  }
}

/** Le chemin de la navigation, relatif à `/app` et sans slash de tête. */
function cheminRelatif(state: RouterStateSnapshot): string {
  const sansQuery = state.url.split('?')[0];
  return sansQuery.replace(/^\/?app\/?/, '').replace(/\/$/, '');
}
