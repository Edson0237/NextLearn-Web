import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../icon/icon';
import { ToastService } from './toast';

/**
 * L'affichage du message courant — un seul exemplaire, posé une fois à la
 * racine applicative (comme le `ScaffoldMessenger` de Flutter couvre
 * toute l'app, pas chaque écran séparément).
 */
@Component({
  selector: 'nl-toast-host',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.scss',
  host: { 'aria-live': 'polite' },
})
export class ToastHost {
  protected readonly service = inject(ToastService);

  protected agir(): void {
    const toast = this.service.actif();
    toast?.onAction?.();
    this.service.ferme();
  }
}
