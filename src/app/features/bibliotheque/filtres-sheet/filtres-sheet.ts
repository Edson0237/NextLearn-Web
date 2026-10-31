import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BottomSheetRef, BOTTOM_SHEET_DATA } from '../../../shared/ui/bottom-sheet/bottom-sheet';
import { BottomSheetShell } from '../../../shared/ui/bottom-sheet/shell/bottom-sheet-shell';
import { Icon } from '../../../shared/ui/icon/icon';
import { TraductionPipe } from '../../../core/i18n/t.pipe';
import { HapticService } from '../../../shared/services/haptic';
import { DocumentType } from '../../../core/bibliotheque/document.model';

export interface FiltresSheetData {
  readonly formats: readonly { type: DocumentType | null; label: string }[];
  readonly matieres: readonly { id: string; nom: string }[];
  readonly type: DocumentType | null;
  readonly matiere: string | null;
  /** Combien de documents donnerait cette combinaison — pour le bouton et les puces. */
  readonly compter: (type: DocumentType | null, matiere: string | null) => number;
}

/** Ce que la feuille rend : une sélection, ou l'envoi vers le catalogue. */
export type FiltresSheetResultat =
  | { readonly type: DocumentType | null; readonly matiere: string | null }
  | 'catalogue';

/**
 * Le panneau « Filtres » de la bibliothèque. Les choix sont un brouillon :
 * rien ne change dans la liste tant qu'on n'a pas touché « Voir les résultats ».
 */
@Component({
  selector: 'nl-filtres-sheet',
  standalone: true,
  imports: [BottomSheetShell, Icon, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filtres-sheet.html',
  styleUrl: './filtres-sheet.scss',
})
export class FiltresSheet {
  private readonly haptic = inject(HapticService);
  protected readonly ref = inject(BottomSheetRef<FiltresSheetResultat>);
  protected readonly data = inject(BOTTOM_SHEET_DATA) as FiltresSheetData;

  protected readonly type = signal<DocumentType | null>(this.data.type);
  protected readonly matiere = signal<string | null>(this.data.matiere);

  protected readonly total = computed(() => this.data.compter(this.type(), this.matiere()));
  protected readonly modifie = computed(() => this.type() !== null || this.matiere() !== null);

  /** Le compte d'une puce de format, la matière du brouillon étant appliquée. */
  protected compteFormat(type: DocumentType | null): number {
    return this.data.compter(type, this.matiere());
  }

  protected compteMatiere(id: string | null): number {
    return this.data.compter(this.type(), id);
  }

  protected choisirType(t: DocumentType | null): void {
    this.haptic.selection();
    this.type.set(t);
  }

  protected choisirMatiere(id: string | null): void {
    this.haptic.selection();
    this.matiere.set(id);
  }

  protected reinitialiser(): void {
    this.type.set(null);
    this.matiere.set(null);
  }

  protected appliquer(): void {
    this.ref.close({ type: this.type(), matiere: this.matiere() });
  }

  protected versCatalogue(): void {
    this.ref.close('catalogue');
  }
}
