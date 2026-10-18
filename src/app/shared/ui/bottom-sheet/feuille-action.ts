import { inject, Injectable } from '@angular/core';
import { BottomSheetService } from './bottom-sheet';
import { ConfirmSheet, ConfirmSheetData } from './confirm-sheet/confirm-sheet';
import { ActionListSheet, ActionListSheetData, ActionOption } from './action-list-sheet/action-list-sheet';

/**
 * Façade qui reprend la forme de l'API statique de `FeuilleAction`
 * (`feuille_action.dart`) par-dessus `BottomSheetService` : deux méthodes,
 * deux promesses, pour ne pas obliger chaque appelant à connaître
 * `ConfirmSheet`/`ActionListSheet`.
 */
@Injectable({ providedIn: 'root' })
export class FeuilleActionService {
  private readonly sheets = inject(BottomSheetService);

  /** Rend `true` si l'utilisateur a confirmé, `false` sinon — jamais `undefined`. */
  async confirmer(data: ConfirmSheetData): Promise<boolean> {
    const handle = this.sheets.open<ConfirmSheet, boolean>(ConfirmSheet, data);
    return (await handle.result) ?? false;
  }

  /** Rend la valeur choisie, ou `undefined` si la feuille a été refermée sans choisir. */
  async choisir<T>(data: ActionListSheetData): Promise<T | undefined> {
    const handle = this.sheets.open<ActionListSheet, T>(ActionListSheet, data);
    return handle.result;
  }
}

export type { ConfirmSheetData, ActionListSheetData, ActionOption };
