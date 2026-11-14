import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { AppRoutes } from '../../router/routes/app-routes';

const CLE_RECHARGEMENT = 'nl_maj_rechargee_a';
/** En deca, un second rechargement automatique serait une boucle. */
const DELAI_ANTI_BOUCLE_MS = 10_000;
/** Delai minimal entre deux verifications de mise a jour lors de la navigation. */
const DELAI_ENTRE_VERIFICATIONS_MS = 15_000;
/** Garde minimale contre les rafales apres un echec d'installation SW. */
const DELAI_RETRY_ECHEC_MS = 5_000;
/** Absence minimale (ecran eteint, autre application) pour appliquer une mise a jour en attente. */
const ABSENCE_MIN_MS = 5_000;
/** Repli si le navigateur annule ou retarde un rechargement demande depuis le bandeau. */
const DELAI_SECURITE_RECHARGEMENT_MS = 3_000;

/**
 * Ecrans de saisie ou d'authentification ou un rechargement automatique ferait
 * perdre le contexte en cours : le bandeau reste affiche jusqu'a confirmation
 * ou sortie vers un ecran sur.
 */
const ZONES_SENSIBLES = [
  `/app/${AppRoutes.depotScanner}`,
  `/app/${AppRoutes.depotForm}`,
  `/app/${AppRoutes.register}`,
  `/app/${AppRoutes.login}`,
  `/app/${AppRoutes.verificationForm}`,
  `/app/${AppRoutes.changerEmail}`,
  `/app/${AppRoutes.deleteAccount}`,
] as const;

interface OptionsVerification {
  contournerDelai?: boolean;
}

/**
 * Orchestration fiable des mises a jour PWA sur Android (Chrome) et iOS (Safari / PWA installee).
 *
 * Sur iOS, WebKit suspend l'application sans garantir `visibilitychange('hidden')` ni conserver
 * les minuteurs `setInterval`. Les verifications s'appuient donc sur le cycle de vie reel
 * (`pageshow`, `focus`, `visibilitychange`, `pagehide`, `blur`, `online`, `NavigationEnd`).
 *
 * Des qu'Angular emet `VERSION_READY`, le Service Worker connait deja la version cible pour toute
 * nouvelle navigation : un rechargement de page suffit sans chainer systematiquement `activateUpdate()`,
 * qui peut bloquer sur iOS apres reveil du worker.
 */
@Injectable({ providedIn: 'root' })
export class MiseAJourService {
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly router = inject(Router, { optional: true });

  /** Vrai des qu'une version plus recente est prete et attend un moment sur ou une action utilisateur. */
  readonly disponible = signal(false);
  /** Vrai pendant qu'une verification reseau de manifeste (`ngsw.json`) est en cours. */
  readonly verificationEnCours = signal(false);
  /** Vrai entre `VERSION_DETECTED` et la fin (`VERSION_READY` ou `VERSION_INSTALLATION_FAILED`). */
  readonly installationEnCours = signal(false);
  /** Vrai pendant la sequence de rechargement afin d'eviter les doubles clics sur le bandeau. */
  readonly rechargementEnCours = signal(false);

  private interagi = false;
  private masqueDepuis: number | null = null;
  private derniereActivite = Date.now();
  private derniereVerification = 0;
  private installationEchouee = false;
  private verificationDiffereeHorsLigne = false;
  private verificationPromesse: Promise<boolean> | null = null;
  private minuteurSecuriteRechargement: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.updates?.isEnabled) return;
    const updates = this.updates;

    const verifier = (options: OptionsVerification = {}): Promise<boolean> => {
      if (this.verificationPromesse) return this.verificationPromesse;

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.verificationDiffereeHorsLigne = true;
        return Promise.resolve(false);
      }

      const ecoule = Date.now() - this.derniereVerification;
      const delaiRequis = this.installationEchouee
        ? DELAI_RETRY_ECHEC_MS
        : DELAI_ENTRE_VERIFICATIONS_MS;

      if (!options.contournerDelai && this.derniereVerification > 0 && ecoule < delaiRequis) {
        return Promise.resolve(false);
      }

      this.derniereVerification = Date.now();
      this.verificationDiffereeHorsLigne = false;
      this.verificationEnCours.set(true);

      // Sur Safari / iOS, signale au navigateur de controler aussi ngsw-worker.js sans bloquer checkForUpdate().
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        void navigator.serviceWorker
          .getRegistration()
          .then((reg) => reg?.update())
          .catch(() => undefined);
      }

      const promesse = updates
        .checkForUpdate()
        .catch(() => false)
        .finally(() => {
          this.verificationPromesse = null;
          this.verificationEnCours.set(false);
        });

      this.verificationPromesse = promesse;
      return promesse;
    };

    const abonnements = [
      updates.versionUpdates.subscribe((evenement) => {
        switch (evenement.type) {
          case 'VERSION_DETECTED':
            this.installationEnCours.set(true);
            this.installationEchouee = false;
            break;
          case 'NO_NEW_VERSION_DETECTED':
            this.installationEnCours.set(false);
            this.installationEchouee = false;
            break;
          case 'VERSION_READY':
            this.installationEnCours.set(false);
            this.installationEchouee = false;
            this.verificationDiffereeHorsLigne = false;
            if (this.peutRechargerSansRisque()) {
              void this.appliquer(true);
            } else {
              this.disponible.set(true);
            }
            break;
          case 'VERSION_INSTALLATION_FAILED':
            // L'ancienne version reste operationnelle : on retentera au prochain retour reseau / premier plan.
            this.installationEnCours.set(false);
            this.installationEchouee = true;
            this.disponible.set(false);
            break;
        }
      }),
      updates.unrecoverable.subscribe(() => {
        this.installationEnCours.set(false);
        if (this.rechargeRecemment()) {
          // Evite une boucle infinie de rechargements si le cache reste corrompu apres un redemarrage.
          this.disponible.set(true);
          return;
        }
        this.memoriserRechargement();
        this.recharger();
      }),
    ];

    const memoriserAbsence = (): void => {
      const maintenant = Date.now();
      if (this.masqueDepuis === null) {
        this.masqueDepuis = maintenant;
      }
      this.derniereActivite = maintenant;
    };

    const gererRetourPremierPlan = (depuisBfCache = false): void => {
      const maintenant = Date.now();
      const referenceAbsence = this.masqueDepuis ?? this.derniereActivite;
      const absence = depuisBfCache ? ABSENCE_MIN_MS : Math.max(0, maintenant - referenceAbsence);
      this.masqueDepuis = null;
      this.derniereActivite = maintenant;

      if (absence >= ABSENCE_MIN_MS && !this.zoneSensible(location.pathname)) {
        this.interagi = false;
      }

      void verifier({
        contournerDelai: depuisBfCache || this.installationEchouee || absence >= ABSENCE_MIN_MS,
      });

      // Revenir apres une vraie absence est un moment sur : personne n'est au milieu d'un geste.
      if (absence >= ABSENCE_MIN_MS) {
        this.appliquerSiMomentSur(location.pathname);
      }
    };

    const surChangementVisibilite = (): void => {
      if (document.visibilityState === 'hidden') {
        memoriserAbsence();
        return;
      }
      gererRetourPremierPlan();
    };

    const surPageShow = (evenement: PageTransitionEvent): void => {
      // Sur iOS Safari, `persisted` indique une restauration directe depuis le BFCache.
      if (evenement.persisted || document.visibilityState === 'visible') {
        gererRetourPremierPlan(Boolean(evenement.persisted));
      }
    };

    const surFocus = (): void => {
      if (document.visibilityState !== 'hidden') {
        gererRetourPremierPlan();
      }
    };

    const surRetourReseau = (): void => {
      const doitForcer = this.installationEchouee || this.verificationDiffereeHorsLigne;
      void verifier({ contournerDelai: doitForcer });
    };

    const surCoupureReseau = (): void => {
      this.verificationDiffereeHorsLigne = true;
      this.installationEnCours.set(false);
    };

    const marquerInteraction = (): void => {
      this.interagi = true;
      this.derniereActivite = Date.now();
    };

    document.addEventListener('visibilitychange', surChangementVisibilite);
    window.addEventListener('pageshow', surPageShow);
    window.addEventListener('pagehide', memoriserAbsence);
    window.addEventListener('blur', memoriserAbsence);
    window.addEventListener('focus', surFocus);
    window.addEventListener('online', surRetourReseau);
    window.addEventListener('offline', surCoupureReseau);
    window.addEventListener('pointerdown', marquerInteraction, { passive: true });
    window.addEventListener('keydown', marquerInteraction, { passive: true });

    // Verification initiale au demarrage.
    void verifier({ contournerDelai: true });

    const navigation = this.router?.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.derniereActivite = Date.now();
        this.appliquerSiMomentSur(e.urlAfterRedirects);
        if (!this.zoneSensible(e.urlAfterRedirects)) {
          this.interagi = false;
        }
        void verifier();
      });

    inject(DestroyRef).onDestroy(() => {
      abonnements.forEach((a) => a.unsubscribe());
      navigation?.unsubscribe();
      document.removeEventListener('visibilitychange', surChangementVisibilite);
      window.removeEventListener('pageshow', surPageShow);
      window.removeEventListener('pagehide', memoriserAbsence);
      window.removeEventListener('blur', memoriserAbsence);
      window.removeEventListener('focus', surFocus);
      window.removeEventListener('online', surRetourReseau);
      window.removeEventListener('offline', surCoupureReseau);
      window.removeEventListener('pointerdown', marquerInteraction);
      window.removeEventListener('keydown', marquerInteraction);
      if (this.minuteurSecuriteRechargement !== null) {
        clearTimeout(this.minuteurSecuriteRechargement);
        this.minuteurSecuriteRechargement = null;
      }
    });
  }

  /**
   * Recharge l'application pour basculer vers la nouvelle version deja mise en cache par ngsw.
   * Pour `automatique`, applique la protection anti-boucle et temporise sur geste actif ou zone sensible.
   */
  async appliquer(automatique = false): Promise<void> {
    if (this.rechargementEnCours()) return;
    if (automatique && this.rechargeRecemment()) return;

    this.rechargementEnCours.set(true);
    if (automatique) this.memoriserRechargement();
    this.disponible.set(false);

    if (this.minuteurSecuriteRechargement !== null) {
      clearTimeout(this.minuteurSecuriteRechargement);
    }
    this.minuteurSecuriteRechargement = setTimeout(() => {
      this.rechargementEnCours.set(false);
      this.minuteurSecuriteRechargement = null;
    }, DELAI_SECURITE_RECHARGEMENT_MS);

    this.recharger();
  }

  /**
   * Une version est prete et n'a pas ete appliquee : si l'ecran n'est pas un ecran de saisie,
   * recharge maintenant. Appelee au changement d'ecran et au retour apres absence.
   */
  appliquerSiMomentSur(url: string): void {
    if (!this.disponible() || this.rechargeRecemment() || this.zoneSensible(url)) return;
    void this.appliquer(true);
  }

  private zoneSensible(url: string): boolean {
    const chemin = url.split(/[?#]/)[0];
    return ZONES_SENSIBLES.some((z) => chemin === z || chemin.startsWith(z + '/'));
  }

  protected recharger(): void {
    document.location.reload();
  }

  private peutRechargerSansRisque(): boolean {
    if (this.rechargeRecemment()) return false;
    const chemin = location.pathname;
    if (this.zoneSensible(chemin)) return false;
    // Sur les pages d'application, ne pas interrompre un geste actif ; le bandeau propose ou attend la transition.
    if (chemin.startsWith('/app') && this.interagi) return false;
    return true;
  }

  private rechargeRecemment(): boolean {
    try {
      const t = Number(sessionStorage.getItem(CLE_RECHARGEMENT));
      return t > 0 && Date.now() - t < DELAI_ANTI_BOUCLE_MS;
    } catch {
      return false;
    }
  }

  private memoriserRechargement(): void {
    try {
      sessionStorage.setItem(CLE_RECHARGEMENT, String(Date.now()));
    } catch {
      // Stockage bloque : le delai anti-boucle ne protege pas, la mise a jour reste utile.
    }
  }
}
