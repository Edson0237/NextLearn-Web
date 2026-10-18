import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BottomSheetRef, BOTTOM_SHEET_DATA } from '../bottom-sheet';
import { BottomSheetShell } from '../shell/bottom-sheet-shell';
import { Button } from '../../button/button';
import { Icon } from '../../icon/icon';
import { IconName } from '../../icon/icon-paths';
import { HapticService } from '../../../services/haptic';

export interface ConfirmSheetData {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly icon?: IconName;
}

/**
 * Demande de confirmation en feuille — traduction de
 * `FeuilleAction.confirmer` (`feuille_action.dart`). `destructive` teinte
 * le bouton en rouge et n'est pas qu'une couleur : il dit que ce qui va
 * se passer ne se reprend pas.
 */
@Component({
  selector: 'nl-confirm-sheet',
  standalone: true,
  imports: [BottomSheetShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-sheet.html',
  styleUrl: './confirm-sheet.scss',
})
export class ConfirmSheet {
  private readonly haptic = inject(HapticService);
  protected readonly ref = inject(BottomSheetRef<boolean>);
  protected readonly data = inject(BOTTOM_SHEET_DATA) as ConfirmSheetData;

  protected confirmer(): void {
    this.haptic.moyen();
    this.ref.close(true);
  }

  protected annuler(): void {
    this.ref.close(false);
  }
}
