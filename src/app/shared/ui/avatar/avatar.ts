import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Icon } from '../icon/icon';

/**
 * Photo de profil, ou initiales à défaut — traduction d'`AvatarUtilisateur`
 * (`lib/shared/widgets/avatar_utilisateur.dart`).
 *
 * Les initiales restent le repli même quand une photo existe : une image
 * qui échoue à charger (réseau coupé, fichier retiré) doit laisser un rond
 * lisible plutôt qu'une icône de lien cassé — `(error)` bascule dessus.
 *
 * Domaine-agnostique : prend `initials` et `photoUrl` en entrée plutôt
 * qu'un modèle utilisateur, comme `Card`/`Chip` avant lui. Calculer les
 * initiales (première lettre du prénom + du nom) reste à l'appelant, qui
 * connaît le modèle réel — cette logique de deux caractères n'a pas sa
 * place dans un composant de présentation.
 */
@Component({
  selector: 'nl-avatar',
  standalone: true,
  imports: [Icon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
  host: {
    '[style.--avatar-size.px]': 'size()',
    '[class.nl-avatar--sombre]': 'onDarkBackground()',
  },
})
export class Avatar {
  readonly initials = input.required<string>();
  readonly photoUrl = input<string>();
  readonly size = input(48);
  readonly onDarkBackground = input(true);
  /** Affiche la pastille appareil photo et rend le rond tapable. */
  readonly editable = input(false);
  readonly edit = output<void>();

  // L'URL qui a échoué, pas un simple booléen : si `photoUrl` change pour
  // une nouvelle adresse après un échec, la nouvelle doit être retentée —
  // un booléen resterait bloqué sur « échec » indéfiniment.
  private readonly urlEnEchec = signal<string | undefined>(undefined);

  protected readonly afficherPhoto = computed(
    () => !!this.photoUrl() && this.photoUrl() !== this.urlEnEchec(),
  );

  protected surErreur(): void {
    this.urlEnEchec.set(this.photoUrl());
  }
}
