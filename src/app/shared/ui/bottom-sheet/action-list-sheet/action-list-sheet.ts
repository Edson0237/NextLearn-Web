import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BottomSheetRef, BOTTOM_SHEET_DATA } from '../bottom-sheet';
import { BottomSheetShell } from '../shell/bottom-sheet-shell';
import { Icon } from '../../icon/icon';
import { IconName } from '../../icon/icon-paths';
import { HapticService } from '../../../services/haptic';

export interface ActionOption<T = unknown> {
  readonly label: string;
  readonly value: T;
  readonly description?: string;
  readonly icon?: IconName;
  readonly destructive?: boolean;
}

export interface ActionListSheetData {
  readonly title?: string;
  readonly options: readonly ActionOption[];
}

/**
 * Liste d'actions en feuille — traduction de `FeuilleAction.choisir`
 * (`feuille_action.dart`). Chaque ligne ferme la feuille avec sa valeur ;
 * un retour haptique léger confirme le choix.
 */
@Component({
  selector: 'nl-action-list-sheet',
  standalone: true,
  imports: [BottomSheetShell, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-list-sheet.html',
  styleUrl: './action-list-sheet.scss',
})
export class ActionListSheet {
  private readonly haptic = inject(HapticService);
  protected readonly ref = inject(BottomSheetRef);
  protected readonly data = inject(BOTTOM_SHEET_DATA) as ActionListSheetData;

  protected choisir(option: ActionOption): void {
    this.haptic.leger();
    this.ref.close(option.value);
  }
}
