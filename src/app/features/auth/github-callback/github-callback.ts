import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, GithubIdentite } from '../../../core/auth';
import { TraductionPipe } from '../../../core/i18n';
import { Failure } from '../../../core/models';
import { AppRoutes } from '../../../core/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { ResultatPin } from '../../../shared/ui/resultat-pin/resultat-pin';

/**
 * Page de retour OAuth GitHub (`/auth/github/callback`) - Chantiers P4 & P10.
 *
 * 1. Nettoie immédiatement l'URL (`history.replaceState`) pour que `code` et
 *    `state` ne restent jamais dans l'historique du navigateur.
 * 2. Vérifie le paramètre `state` par rapport à `sessionStorage` et consomme
 *    le `code_verifier` PKCE.
 * 3. Appelle `POST /api/auth/github` via `AuthService.connexionGithub`.
 * 4. Affiche les erreurs serveur telles quelles (401, 403 `account_banned`,
 *    409, 429 avec temporisation, 502 `GITHUB_INDISPONIBLE`, 503 `GITHUB_NON_CONFIGURE`).
 */
@Component({
  selector: 'app-github-callback',
  standalone: true,
  imports: [TraductionPipe, Icon, ResultatPin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-ghcb">
      @if (chargement()) {
        <div class="nl-ghcb__carte" role="status" aria-busy="true">
          <div class="nl-ghcb__spinner" aria-hidden="true"></div>
          <h1 class="nl-ghcb__titre">{{ 'githubVerificationEnCours' | t }}</h1>
          <p class="nl-ghcb__texte">{{ 'githubPatiente' | t }}</p>
        </div>
      } @else if (erreur(); as msg) {
        <div class="nl-ghcb__carte" role="alert">
          <div class="nl-ghcb__icone-erreur">
            <nl-icon name="warning" [size]="28" />
          </div>
          <h1 class="nl-ghcb__titre">{{ 'githubConnexionImpossible' | t }}</h1>
          <p class="nl-ghcb__erreur">{{ msg }}</p>

          <div class="nl-ghcb__actions">
            @if (!nonConfigure()) {
              <button
                type="button"
                class="nl-ghcb__btn nl-ghcb__btn--primaire"
                [disabled]="cooldownSecondes() > 0"
                (click)="recommencerGithub()"
              >
                @if (cooldownSecondes() > 0) {
                  <span>{{ 'actionReessayer' | t }} ({{ cooldownSecondes() }} s)</span>
                } @else {
                  <span>{{ 'actionReessayer' | t }}</span>
                }
              </button>
            }
            <button
              type="button"
              class="nl-ghcb__btn nl-ghcb__btn--secondaire"
              (click)="allerConnexion()"
            >
              {{ 'authSeConnecter' | t }}
            </button>
          </div>
        </div>
      }
    </div>

    @if (refusCompte(); as refus) {
      <nl-resultat-pin
        etat="echec"
        [titre]="'Connexion impossible'"
        [message]="refus"
        (reessayer)="allerConnexion()"
      />
    }
  `,
  styles: [`
    :host {
      display: flex;
      min-height: var(--ecran-haut, 100dvh);
      align-items: center;
      justify-content: center;
      padding: 24px var(--space-page, 16px);
      background: var(--bg-canvas);
    }
    .nl-ghcb {
      width: min(100%, 400px);
    }
    .nl-ghcb__carte {
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px 22px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(var(--shadow-color), var(--shadow-card-alpha));
    }
    .nl-ghcb__spinner {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 3px solid var(--bg-secondary);
      border-top-color: var(--primary);
      animation: nl-ghcb-spin 0.8s linear infinite;
    }
    @keyframes nl-ghcb-spin {
      to { transform: rotate(360deg); }
    }
    .nl-ghcb__icone-erreur {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--bg-secondary);
      color: var(--danger);
      display: grid;
      place-items: center;
    }
    .nl-ghcb__titre {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .nl-ghcb__texte {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .nl-ghcb__erreur {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.45;
      color: var(--danger);
    }
    .nl-ghcb__actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 8px;
    }
    .nl-ghcb__btn {
      width: 100%;
      min-height: 44px;
      padding: 10px 18px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .nl-ghcb__btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .nl-ghcb__btn--primaire {
      border: none;
      background: var(--primary);
      color: var(--text-on-primary);
    }
    .nl-ghcb__btn--secondaire {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-primary);
    }
  `],
})
export class GithubCallback implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly github = inject(GithubIdentite);
  private readonly auth = inject(AuthService);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly refusCompte = signal<string | null>(null);
  protected readonly nonConfigure = signal(false);
  protected readonly cooldownSecondes = signal(0);

  private timerCooldown: ReturnType<typeof setInterval> | null = null;
  private detruit = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.detruit = true;
      if (this.timerCooldown) clearInterval(this.timerCooldown);
    });
  }

  async ngOnInit(): Promise<void> {
    const queryMap = this.route.snapshot.queryParamMap;
    const code = queryMap.get('code');
    const state = queryMap.get('state');
    const error = queryMap.get('error');

    try {
      const retour = this.github.verifierRetour({ code, state, error });
      const refus = await this.auth.connexionGithub(
        retour.code,
        retour.redirectUri,
        retour.codeVerifier,
      );
      if (!refus) return; // Redirection déjà assurée par `AuthService.handleGithubAuthResponse`

      if (refus.code === 'account_banned') {
        this.refusCompte.set(refus.message);
      } else if (refus.code === 'GITHUB_NON_CONFIGURE' || refus.statusCode === 503) {
        this.github.masquerSiNonConfigure();
        this.nonConfigure.set(true);
        this.erreur.set(refus.message);
      } else {
        if (refus.code === 'RATE_LIMIT_EXCEEDED' || refus.statusCode === 429) {
          this.demarrerCooldown(refus.retryAfterSeconds ?? 15);
        }
        this.erreur.set(refus.message);
      }
    } catch (e) {
      if (e instanceof Failure) {
        this.erreur.set(e.message);
      } else {
        this.erreur.set('Code GitHub invalide ou expiré. Recommence la connexion.');
      }
    } finally {
      this.chargement.set(false);
    }
  }

  protected async recommencerGithub(): Promise<void> {
    if (this.cooldownSecondes() > 0) return;
    this.chargement.set(true);
    this.erreur.set(null);
    try {
      await this.github.redirigerVersGithub();
    } catch (e) {
      this.chargement.set(false);
      this.erreur.set(e instanceof Failure ? e.message : 'Connexion GitHub indisponible.');
    }
  }

  protected allerConnexion(): void {
    void this.router.navigate(['/app', AppRoutes.login]);
  }

  private demarrerCooldown(secondes: number): void {
    const duree = Math.max(5, Math.min(120, Math.round(secondes)));
    this.cooldownSecondes.set(duree);
    if (this.timerCooldown) clearInterval(this.timerCooldown);
    this.timerCooldown = setInterval(() => {
      if (this.detruit) return;
      const restant = this.cooldownSecondes() - 1;
      if (restant <= 0) {
        this.cooldownSecondes.set(0);
        if (this.timerCooldown) clearInterval(this.timerCooldown);
        this.timerCooldown = null;
      } else {
        this.cooldownSecondes.set(restant);
      }
    }, 1000);
  }
}
