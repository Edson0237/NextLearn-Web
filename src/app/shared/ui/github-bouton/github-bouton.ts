import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { AuthService, GithubIdentite } from '../../../core/auth';
import { TraductionPipe } from '../../../core/i18n';
import { Failure } from '../../../core/models';

/**
 * Bouton « Continuer avec GitHub » - Chantiers P4 & P10.
 *
 * Ne s'affiche que si `GET /api/auth/github/config` a répondu `enabled: true`.
 * Au clic, lance la redirection pleine page vers GitHub avec `state` et PKCE `S256`.
 * En cas de limitation de débit (429), affiche le message et désactive le bouton
 * quelques secondes sans relancer automatiquement.
 */
@Component({
  selector: 'nl-github-bouton',
  standalone: true,
  imports: [TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (github.disponible()) {
      <div class="nl-ghbtn">
        <button
          type="button"
          class="nl-ghbtn__btn"
          [style.width.px]="largeur()"
          [disabled]="auth.state().isLoading || lancement() || cooldownSecondes() > 0"
          (click)="continuerAvecGithub()"
        >
          <svg class="nl-ghbtn__logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.38-3.88-1.38-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          <span>{{ 'githubContinuer' | t }}</span>
        </button>
        @if (erreur(); as message) {
          <p class="nl-ghbtn__erreur" role="alert">{{ message }}</p>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .nl-ghbtn { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 8px; }
    .nl-ghbtn__btn {
      max-width: 100%;
      min-height: 44px;
      padding: 0 18px;
      border-radius: var(--radius-pilule, 22px);
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      transition: opacity 150ms, background-color 150ms;
    }
    .nl-ghbtn__btn:hover:not(:disabled) {
      background: var(--bg-secondary);
    }
    .nl-ghbtn__btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .nl-ghbtn__logo { flex-shrink: 0; }
    .nl-ghbtn__erreur {
      margin: 0;
      text-align: center;
      font-size: 0.85rem;
      line-height: 1.4;
      color: var(--danger);
    }
  `],
})
export class GithubBouton implements OnInit {
  protected readonly github = inject(GithubIdentite);
  protected readonly auth = inject(AuthService);

  readonly largeur = input(320);
  readonly refus = output<string>();

  protected readonly erreur = signal<string | null>(null);
  protected readonly lancement = signal(false);
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
    await this.github.preparer();
  }

  protected async continuerAvecGithub(): Promise<void> {
    if (this.lancement() || this.cooldownSecondes() > 0) return;
    this.erreur.set(null);
    this.lancement.set(true);
    try {
      await this.github.redirigerVersGithub();
    } catch (e) {
      this.lancement.set(false);
      if (e instanceof Failure) {
        if (e.code === 'GITHUB_NON_CONFIGURE' || e.statusCode === 503) {
          this.github.masquerSiNonConfigure();
          return;
        }
        if (e.code === 'RATE_LIMIT_EXCEEDED' || e.statusCode === 429) {
          this.demarrerCooldown(e.retryAfterSeconds ?? 15);
        }
        this.erreur.set(e.message);
        this.refus.emit(e.message);
      } else {
        const msg = 'Connexion GitHub indisponible. Réessaie dans un instant.';
        this.erreur.set(msg);
        this.refus.emit(msg);
      }
    }
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
