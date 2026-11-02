import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { AuthService } from '../../../core/auth';
import { GoogleIdentite } from '../../../core/auth';
import { TraductionPipe } from '../../../core/i18n';
import { ResultatPin } from '../resultat-pin/resultat-pin';

/**
 * Le bouton « Continuer avec Google ».
 *
 * Dessiné par Google lui-même (c'est ce que ses règles de marque exigent),
 * posé dans un conteneur que ce composant possède. Il ne s'affiche que si la
 * connexion Google est utilisable ; sinon il ne laisse aucune trace.
 *
 * Il ne **route** rien : il remet le jeton à `AuthService.connexionGoogle`, qui
 * applique la réponse du serveur (inscription, PIN, accueil, page d'attente) de
 * la même façon d'où qu'il soit touché. Il n'a que les **refus** à montrer :
 *  - `account_banned` : l'écran de refus plein écran, le même que pour un PIN
 *    refusé ;
 *  - le reste (`domain_not_allowed`, jeton expiré…) : le message du serveur,
 *    sous le bouton, jamais une « erreur » générique.
 */
@Component({
  selector: 'nl-google-bouton',
  standalone: true,
  imports: [TraductionPipe, ResultatPin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!google.disponible() && !google.desactive()) {
      <!-- Google se charge, ou n'a pas répondu : la place est réservée pour que
           le formulaire ne saute pas, et le parcours par e-mail reste utilisable. -->
      <div class="nl-gbtn" [attr.aria-busy]="!indisponible()">
        @if (indisponible()) {
          <p class="nl-gbtn__erreur nl-gbtn__erreur--neutre" role="status">{{ 'googleIndisponible' | t }}</p>
        } @else {
          <div class="nl-gbtn__squelette" aria-hidden="true"></div>
        }
      </div>
    }
    @if (google.disponible()) {
      <div class="nl-gbtn">
        <div #hote class="nl-gbtn__hote" [class.nl-gbtn__hote--attente]="auth.state().isLoading"></div>
        @if (erreur(); as message) {
          <p class="nl-gbtn__erreur" role="alert">{{ message }}</p>
        }
        @if (auth.state().isLoading) {
          <p class="nl-gbtn__attente" role="status">{{ 'googleVerification' | t }}</p>
        }
      </div>
    }
    @if (refusCompte(); as refus) {
      <nl-resultat-pin etat="echec" [titre]="'Connexion impossible'" [message]="refus" (reessayer)="refusCompte.set(null)" />
    }
  `,
  styles: [`
    :host { display: block; }
    .nl-gbtn { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .nl-gbtn__hote { min-height: 44px; display: flex; justify-content: center; transition: opacity 150ms; }
    .nl-gbtn__hote--attente { opacity: 0.5; pointer-events: none; }
    .nl-gbtn__erreur { margin: 0; text-align: center; font-size: 0.85rem; line-height: 1.4; color: var(--danger); }
    .nl-gbtn__erreur--neutre { color: var(--text-muted); }
    .nl-gbtn__squelette { width: min(100%, 320px); height: 44px; border-radius: var(--radius-pilule, 22px); background: var(--bg-secondary); animation: nl-gbtn-pouls 1.4s ease-in-out infinite; }
    @keyframes nl-gbtn-pouls { 50% { opacity: 0.5; } }
    @media (prefers-reduced-motion: reduce) { .nl-gbtn__squelette { animation: none; } }
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

  protected readonly erreur = signal<string | null>(null);
  /** Toutes les tentatives ont échoué : on le dit, sans bloquer le reste de la page. */
  protected readonly indisponible = signal(false);
  /** Un compte banni ou suspendu : refus plein écran. */
  protected readonly refusCompte = signal<string | null>(null);
  private readonly hote = viewChild<ElementRef<HTMLElement>>('hote');

  constructor() {
    // Le conteneur n'existe qu'une fois Google disponible ET la vue rafraîchie :
    // on dessine dès que les deux sont vrais, quel que soit celui qui arrive en
    // dernier (un bouton monté après que Google est prêt ne doit pas attendre).
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
      // Dit « indisponible » dès le premier échec, et continue d'essayer en arrière-plan.
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
    if (!refus) return; // réponse appliquée par `AuthService`
    this.refus.emit(refus.message);
    if (refus.code === 'account_banned') this.refusCompte.set(refus.message);
    else this.erreur.set(refus.message);
  }
}
