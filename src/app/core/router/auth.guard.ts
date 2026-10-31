import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateChildFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthState } from '../auth/auth.model';
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
  const aller = (dest: string): UrlTree => router.parseUrl(`/app/${dest}`);

  const resultat = (s: AuthState): boolean | UrlTree => {
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

    // ── Session verrouillée ────────────────────────────────────────────────
    if (authentifie && s.isLocked) {
      if (chemin === AppRoutes.unlock || chemin === AppRoutes.resetPin) return true;
      return aller(AppRoutes.unlock);
    }

    // ── Verrou levé / pas de session : déverrouillage inutile ────────────────
    if (chemin === AppRoutes.unlock) {
      return authentifie ? aller(AppRoutes.home) : aller(AppRoutes.login);
    }

    // ── Textes légaux : accessibles dans tous les cas ────────────────────────
    //
    // Traduction de `routesToujoursAccessibles` (`app_router.dart`), et placée
    // au même endroit : après le verrou, avant les routes publiques. Ces deux
    // textes n'appartiennent à aucune des deux catégories, et c'est
    // précisément ce qui les rendait inatteignables — déconnecté, on était
    // renvoyé vers l'onboarding, alors que ce sont les textes qu'il faut
    // pouvoir lire *avant* de consentir. Apple exige par ailleurs que la
    // politique de confidentialité soit consultable sans compte.
    if (chemin.startsWith('legal/document/')) return true;

    const routesPubliques = [
      AppRoutes.onboarding, AppRoutes.register, AppRoutes.otp,
      AppRoutes.pinSetup, AppRoutes.login, AppRoutes.loginOtp,
    ];
    const estRoutePublique = routesPubliques.some((r) => chemin === r || chemin.startsWith(r));

    if (!authentifie) {
      const ecranParcours = ecranDuParcours(s.parcoursOtp);
      if (ecranParcours) {
        return chemin === ecranParcours ? true : aller(ecranParcours);
      }

      if (estRoutePublique) return true;

      if (chemin.startsWith('bibliotheque/doc/')) pending.set(chemin);

      return aller(s.isFirstLaunch ? AppRoutes.onboarding : AppRoutes.login);
    }

    if (estRoutePublique) {
      const destination = pending.consommer();
      return aller(destination ?? AppRoutes.home);
    }

    // ── Vérification académique ────────────────────────────────────────────
    const etatVerif = verification.state();
    const estRouteVerification = chemin.startsWith(AppRoutes.verificationForm);

    if (bloqueAcces(etatVerif)) {
      if (chemin.startsWith(AppRoutes.recours)) return true;

      if (demandeAction(etatVerif.statut)) {
        return chemin === AppRoutes.verificationForm ? true : aller(AppRoutes.verificationForm);
      }
      return chemin === AppRoutes.verificationPending ? true : aller(AppRoutes.verificationPending);
    }

    if (estRouteVerification) return aller(AppRoutes.home);

    return true;
  };

  const stateInitial = auth.state();
  if (stateInitial.isInitializing) {
    return toObservable(auth.state).pipe(
      filter((s) => !s.isInitializing),
      take(1),
      map((s) => resultat(s)),
    );
  }

  return resultat(stateInitial);
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
