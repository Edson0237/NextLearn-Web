import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, GoogleIdentite } from '../../../core/auth';
import { TraductionPipe } from '../../../core/i18n';
import { Failure } from '../../../core/models';
import { ChangementEmailRepository, DemandeEmail, MethodePreuve, StatutEmail } from '../../../core/profil';
import { AppRoutes } from '../../../core/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { ToastService } from '../../../shared/ui/toast/toast';

type Ecran = 'chargement' | 'erreur' | 'accueil' | 'formulaire' | 'preuve' | 'nouvelle' | 'attente' | 'succes';

/**
 * Changer l'adresse e-mail du compte.
 *
 * L'écran n'invente aucun état : il affiche ce que le serveur dit de la demande
 * en cours (`prochaineEtape`), ce qui permet de la reprendre après avoir fermé
 * l'application. Rien de ce qui est tapé ici (adresse, codes) n'est gardé sur
 * l'appareil, et le PIN n'y sert à rien : la preuve que le compte est bien le
 * sien vient de l'ancienne adresse ou de Google, pas d'un code local.
 */
@Component({
  selector: 'nl-changer-email',
  standalone: true,
  imports: [TraductionPipe, Icon, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './changer-email.html',
  styleUrl: './changer-email.scss',
})
export class ChangerEmail implements OnInit {
  private readonly repo = inject(ChangementEmailRepository);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly google = inject(GoogleIdentite);

  protected readonly ecran = signal<Ecran>('chargement');
  protected readonly statut = signal<StatutEmail | null>(null);
  protected readonly demande = signal<DemandeEmail | null>(null);
  protected readonly occupe = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected readonly nouvelEmail = signal('');
  protected readonly methode = signal<MethodePreuve>('ancienne_adresse');
  protected readonly code = signal('');
  /** L'adresse enfin en place, pour l'écran de réussite. */
  protected readonly adresseFinale = signal('');

  protected readonly etapeActive = computed(() => {
    switch (this.ecran()) {
      case 'preuve': return 1;
      case 'nouvelle': return 2;
      case 'attente': return 3;
      case 'succes': return 3;
      default: return 0;
    }
  });
  protected readonly avecPreuve = computed(() => this.demande()?.methode !== 'ancienne_inaccessible');
  protected readonly codeComplet = computed(() => /^\d{6}$/.test(this.code()));
  protected readonly emailValide = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.nouvelEmail().trim()));

  private readonly hoteGoogle = viewChild<ElementRef<HTMLElement>>('hoteGoogle');
  private detruit = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.detruit = true));
    // Le bouton Google n'est dessiné que pour une preuve par Google.
    effect(() => {
      const hote = this.hoteGoogle();
      if (!hote || this.ecran() !== 'preuve' || this.demande()?.methode !== 'google') return;
      void this.google.preparer().then((pret) => {
        if (pret && !this.detruit) {
          this.google.afficherBouton(hote.nativeElement, (jeton) => void this.preuveGoogle(jeton), { texte: 'continue_with', largeur: 300 });
        }
      });
    });
  }

  ngOnInit(): void {
    void this.charger();
  }

  protected retour(): void {
    void this.router.navigate(['/app', AppRoutes.profil]);
  }

  private async charger(): Promise<void> {
    this.ecran.set('chargement');
    try {
      const s = await this.repo.statut();
      this.statut.set(s);
      this.appliquer(s.demande);
      if (!s.demande) this.ecran.set('accueil');
    } catch (e) {
      this.erreur.set(this.message(e));
      this.ecran.set('erreur');
    }
  }

  /** Place l'écran sur l'étape que le serveur attend. */
  private appliquer(d: DemandeEmail | null): void {
    this.demande.set(d);
    this.code.set('');
    if (!d) return;
    switch (d.prochaineEtape) {
      case 'preuve': this.ecran.set('preuve'); break;
      case 'nouvelle': this.ecran.set('nouvelle'); break;
      case 'attente_admin':
      case 'justificatifs': this.ecran.set('attente'); break;
      default: this.ecran.set('accueil');
    }
  }

  protected commencer(): void {
    this.erreur.set(null);
    this.ecran.set('formulaire');
  }

  protected async demarrer(): Promise<void> {
    if (!this.emailValide() || this.occupe()) return;
    await this.agir(async () => this.appliquer(await this.repo.demarrer(this.nouvelEmail().trim(), this.methode())));
  }

  protected async verifierPreuve(): Promise<void> {
    const d = this.demande();
    if (!d || !this.codeComplet() || this.occupe()) return;
    await this.agir(async () => this.appliquer(await this.repo.verifierPreuve(d.id, this.code())));
  }

  private async preuveGoogle(jeton: string): Promise<void> {
    const d = this.demande();
    if (!d || this.occupe()) return;
    await this.agir(async () => this.appliquer(await this.repo.verifierPreuveGoogle(d.id, jeton)));
  }

  protected async confirmer(): Promise<void> {
    const d = this.demande();
    if (!d || !this.codeComplet() || this.occupe()) return;
    await this.agir(async () => {
      const fin = await this.repo.confirmer(d.id, this.code());
      if (fin.termine) {
        const s = await this.repo.statut();
        this.adresseFinale.set(s.email);
        this.auth.majEmail(s.email);
        this.statut.set(s);
        this.demande.set(null);
        this.ecran.set('succes');
      } else {
        this.appliquer(fin);
      }
    });
  }

  protected async renvoyer(): Promise<void> {
    const d = this.demande();
    if (!d || this.occupe()) return;
    await this.agir(async () => {
      this.appliquer(await this.repo.renvoyer(d.id));
      this.toast.succes('Code renvoyé.');
    });
  }

  protected async annuler(): Promise<void> {
    const d = this.demande();
    if (d) await this.agir(async () => this.repo.annuler(d.id)).catch(() => undefined);
    this.demande.set(null);
    this.nouvelEmail.set('');
    this.erreur.set(null);
    await this.charger();
  }

  protected surCode(e: Event): void {
    this.code.set((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6));
    this.erreur.set(null);
  }

  protected surEmail(e: Event): void {
    this.nouvelEmail.set((e.target as HTMLInputElement).value);
    this.erreur.set(null);
  }

  private async agir(f: () => Promise<unknown>): Promise<void> {
    this.occupe.set(true);
    this.erreur.set(null);
    try {
      await f();
    } catch (e) {
      this.erreur.set(this.message(e));
      // Une demande disparue (expirée, annulée ailleurs) : on repart de l'état réel du serveur.
      if (e instanceof Failure && (e.statusCode === 410 || e.statusCode === 404)) await this.charger();
    } finally {
      this.occupe.set(false);
    }
  }

  private message(e: unknown): string {
    return e instanceof Failure ? e.message : 'Une erreur est survenue. Réessaie.';
  }
}
