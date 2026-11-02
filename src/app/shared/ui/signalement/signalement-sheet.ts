import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TraductionPipe } from '../../../core/i18n';
import { BottomSheetRef, BOTTOM_SHEET_DATA } from '../bottom-sheet/bottom-sheet';
import { BottomSheetShell } from '../bottom-sheet/shell/bottom-sheet-shell';
import { Icon } from '../icon/icon';

/** Le code du motif « Autre », celui qui exige une explication écrite. */
export const MOTIF_AUTRE = 'AUTRE';
export const LONGUEUR_MIN_EXPLICATION = 5;
export const LONGUEUR_MAX_EXPLICATION = 1000;

export interface MotifChoix {
  readonly code: string;
  readonly label: string;
  readonly description?: string;
}

export interface SignalementSheetData {
  readonly titre: string;
  readonly motifs: readonly MotifChoix[];
  /** Rappel du délai de traitement, affiché sous la liste. */
  readonly information: string;
  /** Codes des motifs qui retirent le contenu avant la décision d'un modérateur. */
  readonly motifsMasquants: readonly string[];
  /** Valeurs à restaurer après un échec d'envoi récupérable. */
  readonly motifInitial?: string;
  readonly explicationInitiale?: string;
}

export interface SignalementSaisi {
  readonly motif: string;
  readonly commentaire?: string;
}

/**
 * Le formulaire de signalement, en feuille.
 *
 * Pas de recherche : il y a huit motifs, tous visibles, et la ressource
 * signalée vient de l'écran d'où l'on arrive. Choisir « Autre » ouvre un champ
 * obligatoire ; ce que l'étudiant y a écrit est gardé s'il change de motif puis
 * revient.
 */
@Component({
  selector: 'nl-signalement-sheet',
  standalone: true,
  imports: [BottomSheetShell, Icon, FormsModule, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signalement-sheet.html',
  styleUrl: './signalement-sheet.scss',
})
export class SignalementSheet {
  protected readonly ref = inject(BottomSheetRef<SignalementSaisi>);
  protected readonly data = inject(BOTTOM_SHEET_DATA) as SignalementSheetData;

  protected readonly longueurMax = LONGUEUR_MAX_EXPLICATION;
  protected readonly motif = signal<string | null>(null);
  protected readonly explication = signal('');
  /** Vrai après un essai d'envoi incomplet : c'est alors seulement qu'on gronde. */
  protected readonly tentative = signal(false);

  protected readonly masquant = computed(() => {
    const m = this.motif();
    return !!m && this.data.motifsMasquants.includes(m);
  });
  protected readonly autre = computed(() => this.motif() === MOTIF_AUTRE);
  protected readonly explicationValide = computed(
    () => this.explication().trim().length >= LONGUEUR_MIN_EXPLICATION,
  );
  protected readonly erreur = computed(() => {
    if (!this.tentative()) return null;
    if (!this.motif()) return 'signalementChoisirMotif';
    if (this.autre() && !this.explicationValide()) return 'signalementExpliquerObligatoire';
    return null;
  });

  constructor() {
    this.motif.set(this.data.motifInitial ?? null);
    this.explication.set(this.data.explicationInitiale ?? '');
  }

  protected choisir(code: string): void {
    this.motif.set(code);
  }

  protected envoyer(): void {
    const motif = this.motif();
    if (!motif || (this.autre() && !this.explicationValide())) {
      this.tentative.set(true);
      return;
    }
    const commentaire = this.autre() ? this.explication().trim() : undefined;
    this.ref.close({ motif, commentaire } satisfies SignalementSaisi);
  }
}
