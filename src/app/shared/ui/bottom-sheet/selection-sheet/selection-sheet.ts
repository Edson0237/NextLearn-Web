import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BottomSheetRef, BOTTOM_SHEET_DATA } from '../bottom-sheet';
import { BottomSheetShell } from '../shell/bottom-sheet-shell';
import { Icon } from '../../icon/icon';
import { HapticService } from '../../../services/haptic';

/** Le seuil au-delà duquel le champ de recherche apparaît. */
export const SEUIL_RECHERCHE = 8;

export interface ChoixSelection<T = unknown> {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
}

export interface SelectionSheetData<T = unknown> {
  readonly title: string;
  readonly choices: readonly ChoixSelection<T>[];
  readonly currentValue?: T;
  readonly searchHint?: string;
  readonly emptyMessage?: string;
}

/**
 * Le choix d'une valeur dans une liste, en feuille — traduction de
 * `FeuilleSelection` (`feuille_selection.dart`). Le champ de recherche
 * n'apparaît qu'au-delà de [SEUIL_RECHERCHE] entrées — posé au-dessus de
 * trois écoles, il n'aiderait personne.
 *
 * Un tapotement suffit à valider : pas de bouton « Confirmer » sur une
 * liste à choix unique, la ligne touchée *est* la décision.
 */
@Component({
  selector: 'nl-selection-sheet',
  standalone: true,
  imports: [BottomSheetShell, Icon, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './selection-sheet.html',
  styleUrl: './selection-sheet.scss',
})
export class SelectionSheet<T = unknown> {
  private readonly haptic = inject(HapticService);
  protected readonly ref = inject(BottomSheetRef<T>);
  protected readonly data = inject(BOTTOM_SHEET_DATA) as SelectionSheetData<T>;

  protected readonly filtre = signal('');

  protected readonly avecRecherche = computed(
    () => this.data.choices.length >= SEUIL_RECHERCHE,
  );

  protected readonly visibles = computed(() => {
    const terme = this.filtre().trim().toLowerCase();
    if (!terme) return this.data.choices;
    // En minuscules et sans tenir compte de la position du mot : chercher
    // « info » doit trouver « Génie informatique ».
    return this.data.choices.filter((c) => c.label.toLowerCase().includes(terme));
  });

  protected choisir(choix: ChoixSelection<T>): void {
    this.haptic.selection();
    this.ref.close(choix.value);
  }

  protected effacerRecherche(): void {
    this.filtre.set('');
  }
}
