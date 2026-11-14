import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TraductionService } from '../../../core/i18n';

/**
 * Sélecteur de langue compact (FR / EN) pour les écrans hors session
 * (onboarding, connexion, inscription, récupération).
 */
@Component({
  selector: 'nl-langue-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-langue-switcher" role="group" aria-label="Langue / Language">
      <button
        type="button"
        class="nl-langue-switcher__btn nl-cible-fine"
        [class.nl-langue-switcher__btn--actif]="langue() === 'fr'"
        [attr.aria-pressed]="langue() === 'fr'"
        (click)="choisir('fr')"
      >FR</button>
      <button
        type="button"
        class="nl-langue-switcher__btn nl-cible-fine"
        [class.nl-langue-switcher__btn--actif]="langue() === 'en'"
        [attr.aria-pressed]="langue() === 'en'"
        (click)="choisir('en')"
      >EN</button>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .nl-langue-switcher {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px;
      border-radius: 999px;
      background: var(--bg-secondary, #f1f5f9);
      border: 1px solid var(--border, #e2e8f0);
    }

    .nl-langue-switcher__btn {
      position: relative;
      min-width: 0;
      min-height: 0;
      border: 0;
      background: transparent;
      color: var(--text-secondary, #64748b);
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.04em;
      padding: 5px 9px;
      border-radius: 999px;
      cursor: pointer;
      transition: background-color 140ms ease, color 140ms ease;
    }

    .nl-langue-switcher__btn::after {
      content: '';
      position: absolute;
      inset: -10px 0;
    }

    .nl-langue-switcher__btn--actif {
      background: var(--primary, #2563eb);
      color: var(--text-on-primary, #ffffff);
    }
  `],
})
export class LangueSwitcher {
  private readonly traductions = inject(TraductionService);
  protected readonly langue = this.traductions.langue;

  protected choisir(l: 'fr' | 'en'): void {
    void this.traductions.definir(l);
  }
}
