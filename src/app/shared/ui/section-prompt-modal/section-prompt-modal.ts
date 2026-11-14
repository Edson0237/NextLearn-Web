import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth';
import { SectionPreference } from '../../../core/models';
import { Fraicheur } from '../../services/fraicheur';
import { Icon } from '../icon/icon';

interface ChoixSection {
  readonly value: SectionPreference;
  readonly titre: string;
  readonly description: string;
  readonly badge: string;
}

const CHOIX_SECTIONS: readonly ChoixSection[] = [
  {
    value: 'FRANCOPHONE',
    titre: 'Section Francophone',
    description: 'Cours, TD et épreuves de la section francophone',
    badge: 'FR',
  },
  {
    value: 'ANGLOPHONE',
    titre: 'Section Anglophone',
    description: 'Courses, tutorials and exams from the anglophone section',
    badge: 'EN',
  },
  {
    value: 'TOUTES',
    titre: 'Les deux sections',
    description: 'Afficher les ressources francophones et anglophones',
    badge: 'FR+EN',
  },
];

@Component({
  selector: 'nl-section-prompt-modal',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="nl-sec-overlay" role="alertdialog" aria-modal="true" aria-labelledby="nl-sec-titre">
        <div class="nl-sec-carte">
          <div class="nl-sec-icone">
            <nl-icon name="school" [size]="26" />
          </div>
          <h2 id="nl-sec-titre" class="nl-sec-titre">Choisis ta section académique</h2>
          <p class="nl-sec-sous">
            Pour mieux filtrer ta bibliothèque, indique la section dont tu souhaites voir les documents. Tu pourras modifier ce choix à tout moment dans ton profil.
          </p>

          <div class="nl-sec-options" role="radiogroup" aria-label="Section académique">
            @for (opt of options; track opt.value) {
              <button
                type="button"
                role="radio"
                class="nl-sec-option"
                [class.nl-sec-option--actif]="selection() === opt.value"
                [attr.aria-checked]="selection() === opt.value"
                [disabled]="saving()"
                (click)="choisir(opt.value)">
                <span class="nl-sec-badge">{{ opt.badge }}</span>
                <span class="nl-sec-texte">
                  <span class="nl-sec-opt-titre">{{ opt.titre }}</span>
                  <span class="nl-sec-opt-desc">{{ opt.description }}</span>
                </span>
                @if (selection() === opt.value) {
                  <span class="nl-sec-check">
                    <nl-icon name="check" [size]="20" />
                  </span>
                }
              </button>
            }
          </div>

          @if (erreur(); as err) {
            <p class="nl-sec-erreur" role="alert">{{ err }}</p>
          }

          <button
            type="button"
            class="nl-sec-valider"
            [disabled]="!selection() || saving()"
            (click)="confirmer()">
            @if (saving()) {
              Enregistrement...
            } @else {
              Continuer
            }
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .nl-sec-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      pointer-events: auto;
    }
    .nl-sec-carte {
      width: 100%;
      max-width: 420px;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      background: var(--bg-primary, #ffffff);
      color: var(--text-primary, #0f172a);
      border: 1px solid var(--border, #e2e8f0);
      border-radius: 20px;
      padding: 24px 20px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .nl-sec-icone {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: var(--primary-soft, #eef4fb);
      color: var(--primary, #1a4a7e);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    .nl-sec-titre {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary, #0f172a);
      text-align: center;
    }
    .nl-sec-sous {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.45;
      color: var(--text-secondary, #475569);
      text-align: center;
    }
    .nl-sec-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 4px;
    }
    .nl-sec-option {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: left;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1.5px solid var(--border, #e2e8f0);
      background: var(--bg-secondary, #f1f5f9);
      color: var(--text-primary, #0f172a);
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .nl-sec-option:hover:not(:disabled) {
      border-color: var(--primary, #1a4a7e);
    }
    .nl-sec-option--actif {
      border-color: var(--primary, #1a4a7e);
      background: var(--primary-soft, #eef4fb);
    }
    .nl-sec-badge {
      flex-shrink: 0;
      min-width: 48px;
      height: 32px;
      padding: 0 8px;
      border-radius: 8px;
      background: var(--primary, #1a4a7e);
      color: var(--text-on-primary, #ffffff);
      font-size: 0.75rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .nl-sec-texte {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .nl-sec-opt-titre {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary, #0f172a);
    }
    .nl-sec-opt-desc {
      font-size: 0.78rem;
      line-height: 1.35;
      color: var(--text-secondary, #475569);
    }
    .nl-sec-check {
      color: var(--primary, #1a4a7e);
      display: inline-flex;
      flex-shrink: 0;
    }
    .nl-sec-erreur {
      margin: 0;
      color: var(--danger, #dc2626);
      font-size: 0.85rem;
      text-align: center;
    }
    .nl-sec-valider {
      margin-top: 4px;
      width: 100%;
      padding: 13px 16px;
      border-radius: 12px;
      border: none;
      background: var(--primary, #1a4a7e);
      color: var(--text-on-primary, #ffffff);
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
    }
    .nl-sec-valider:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `],
})
export class SectionPromptModal {
  private readonly auth = inject(AuthService);
  private readonly fraicheur = inject(Fraicheur);

  protected readonly options = CHOIX_SECTIONS;
  protected readonly selection = signal<SectionPreference | null>(null);
  protected readonly saving = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected readonly visible = computed(() => {
    const user = this.auth.state().user;
    return Boolean(user && !user.sectionPreference);
  });

  protected choisir(val: SectionPreference): void {
    this.erreur.set(null);
    this.selection.set(val);
  }

  protected async confirmer(): Promise<void> {
    const choix = this.selection();
    if (!choix || this.saving()) return;
    this.saving.set(true);
    this.erreur.set(null);
    const err = await this.auth.changerSection(choix);
    this.saving.set(false);
    if (err) {
      this.erreur.set(err);
    } else {
      this.fraicheur.tick();
    }
  }
}
