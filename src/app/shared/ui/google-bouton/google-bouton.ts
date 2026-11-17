import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { AuthService, GoogleIdentite } from '../../../core/auth';
import { TraductionPipe } from '../../../core/i18n';
import { ResultatPin } from '../resultat-pin/resultat-pin';

/**
 * Le bouton « Continuer avec Google ».
 *
 * Dessiné par Google lui-même (`renderButton`), tout en affichant dès le
 * premier rendu un bouton d'attente aux dimensions exactes pour éviter tout
 * clignotement ou zone vide pendant le chargement de GIS.
 */
@Component({
  selector: 'nl-google-bouton',
  standalone: true,
  imports: [TraductionPipe, ResultatPin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!google.desactive()) {
      <div class="nl-gbtn" [attr.aria-busy]="!google.disponible() && !indisponible()">
        @if (!google.disponible()) {
          @if (indisponible()) {
            <p class="nl-gbtn__erreur nl-gbtn__erreur--neutre" role="status">{{ 'googleIndisponible' | t }}</p>
          } @else {
            <div class="nl-gbtn__apercu" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#EA4335" d="M12 5c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.4 1.8 14.9 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z" />
                <path fill="#FBBC05" d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.1 0 10 0 12s.6 3.9 1.6 5.6l3.7-2.8z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.4 7.4 23 12 23z" />
              </svg>
              <span>{{ libelleCle() | t }}</span>
            </div>
          }
        } @else {
          <div #hote class="nl-gbtn__hote" [class.nl-gbtn__hote--attente]="auth.state().isLoading"></div>
          @if (erreur(); as message) {
            <p class="nl-gbtn__erreur" role="alert">{{ message }}</p>
          }
          @if (auth.state().isLoading) {
            <p class="nl-gbtn__attente" role="status">{{ 'googleVerification' | t }}</p>
          }
        }
      </div>
    }
    @if (refusCompte(); as refus) {
      <nl-resultat-pin etat="echec" [titre]="'Connexion impossible'" [message]="refus" (reessayer)="refusCompte.set(null)" />
    }
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .nl-gbtn { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
    .nl-gbtn__hote { min-height: 44px; width: 100%; display: flex; justify-content: center; transition: opacity 150ms; }
    .nl-gbtn__hote--attente { opacity: 0.5; pointer-events: none; }
    .nl-gbtn__erreur { margin: 0; text-align: center; font-size: 0.85rem; line-height: 1.4; color: var(--danger); }
    .nl-gbtn__erreur--neutre { color: var(--text-muted); }
    .nl-gbtn__apercu {
      width: min(100%, 340px);
      height: 44px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: var(--text-primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font: 500 0.875rem/1 var(--font-family-body);
      opacity: 0.82;
      animation: nl-gbtn-pouls 1.2s ease-in-out infinite;
    }
    @keyframes nl-gbtn-pouls { 50% { opacity: 0.55; } }
    @media (prefers-reduced-motion: reduce) { .nl-gbtn__apercu { animation: none; opacity: 0.85; } }
    .nl-gbtn__attente { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
  `],
})
export class GoogleBouton implements OnInit {
  protected readonly google = inject(GoogleIdentite);
  protected readonly auth = inject(AuthService);

  /** Le libellé que Google écrit dans le bouton. */
  readonly texte = input<'signin_with' | 'signup_with' | 'continue_with'>('continue_with');
  readonly largeur = input(320);
  /** Émis quand le serveur refuse : l'écran peut aussi vouloir le dire à sa façon. */
  readonly refus = output<string>();

  protected readonly libelleCle = computed(() =>
    this.texte() === 'signup_with' ? 'authSInscrireAvecGoogle' : 'authContinuerAvecGoogle',
  );
  protected readonly erreur = signal<string | null>(null);
  /** Toutes les tentatives ont échoué : on le dit, sans bloquer le reste de la page. */
  protected readonly indisponible = signal(false);
  /** Un compte banni ou suspendu : refus plein écran. */
  protected readonly refusCompte = signal<string | null>(null);
  private readonly hote = viewChild<ElementRef<HTMLElement>>('hote');

  constructor() {
    effect(() => {
      if (this.google.disponible() && this.hote()) this.dessiner();
    });
  }

  /** Pauses entre les tentatives : le serveur redémarre, ou la connexion est lente. */
  private static readonly PAUSES_MS = [3_000, 8_000, 15_000, 30_000];
  private detruit = false;
  private readonly destruction = inject(DestroyRef).onDestroy(() => (this.detruit = true));

  async ngOnInit(): Promise<void> {
    for (let essai = 0; ; essai++) {
      if (await this.google.preparer()) return;
      if (this.google.desactive() || this.detruit) return;
      if (essai >= GoogleBouton.PAUSES_MS.length) {
        this.indisponible.set(true);
        return;
      }
      this.indisponible.set(true);
      await new Promise((ok) => setTimeout(ok, GoogleBouton.PAUSES_MS[essai]));
      if (this.detruit) return;
    }
  }

  private dessiner(): void {
    const el = this.hote()?.nativeElement;
    if (!el || el.childElementCount > 0) return;
    this.google.afficherBouton(el, (jeton) => void this.surJeton(jeton), {
      texte: this.texte(),
      largeur: this.largeur(),
    });
  }

  private async surJeton(jeton: string): Promise<void> {
    this.erreur.set(null);
    const refus = await this.auth.connexionGoogle(jeton);
    if (!refus) return;
    this.refus.emit(refus.message);
    if (refus.code === 'account_banned') this.refusCompte.set(refus.message);
    else this.erreur.set(refus.message);
  }
}
