import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Location } from '@angular/common';
import { Icon } from '../../../shared/ui/icon/icon';
import { SettingsList } from '../settings-list/settings-list';

/**
 * Page de réglages dédiée — traduction de `ParametresPage`
 * (`lib/domains/profil/presentation/pages/parametres/parametres_page.dart`).
 *
 * L'onglet Profil affiche déjà la même liste sous l'en-tête ; cet écran
 * existe pour les liens profonds et le retour arrière explicite.
 */
@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [Icon, SettingsList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parametres.html',
  styleUrl: './parametres.scss',
})
export class Parametres {
  constructor(private readonly location: Location) {}

  protected retour(): void {
    this.location.back();
  }
}
