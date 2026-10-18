import { inject, Injectable } from '@angular/core';
import { BottomSheetService } from './bottom-sheet';
import { SelectionSheet, SelectionSheetData, ChoixSelection } from './selection-sheet/selection-sheet';

/**
 * Façade reprenant la forme de `FeuilleSelection.ouvrir`
 * (`feuille_selection.dart`).
 */
@Injectable({ providedIn: 'root' })
export class FeuilleSelectionService {
  private readonly sheets = inject(BottomSheetService);

  /** Rend la valeur choisie, ou `undefined` si refermée sans choisir. */
  async ouvrir<T>(data: SelectionSheetData<T>): Promise<T | undefined> {
    const handle = this.sheets.open<SelectionSheet<T>, T>(SelectionSheet, data);
    return handle.result;
  }
}

export type { SelectionSheetData, ChoixSelection };
