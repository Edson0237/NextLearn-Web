import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { tr } from '../../../core/i18n/traduction.service';
import { TraductionPipe } from '../../../core/i18n/t.pipe';
import { Router } from '@angular/router';
import { AppRoutes } from '../../../core/router/app-routes';

interface Badge {
  readonly label: string;
}

interface Diapositive {
  readonly icone: IconName;
  readonly titre: string;
  readonly corps: string;
  /** La teinte de la diapositive, prise au jeu de jetons. */
  readonly accent: string;
  readonly accentFonce: string;
  /** La couleur du texte et de l'icône posés sur l'accent. */
  readonly encre: string;
  readonly badges: readonly Badge[];
}

/**
 * Présentation initiale — traduction d'`OnboardingPage`
 * (`lib/domains/auth/presentation/pages/onboarding/onboarding_page.dart`).
 *
 * **Trois teintes qui racontent** : l'ambre du problème, le bleu NextLearn
 * de la solution, l'émeraude de l'arrivée. Elles étaient gelées en dur,
 * recopiées du Flutter — dont un `#1a6fbf` qui n'était le bleu de personne,
 * ni celui du logo ni celui de l'application. Elles viennent désormais du
 * jeu de jetons (`--warning`, `--primary`, `--tertiary`), donc suivent le
 * thème et le bleu de la marque.
 *
 * **Non repris, délibérément** : le sélecteur de langue (`_ChoixLangue`) —
 * il pilote le `l10n` Flutter, qui n'a pas d'équivalent dans ce projet
 * Angular (vitrine et application sont toutes deux en français, sans
 * couche i18n). Les pastilles de badge perdent leur icône (`chat_bubble`,
 * `usb`, `cloud_done`…) : décoratives sur un écran à palette gelée qui ne
 * survivra pas à une extension du jeu d'icônes du design system, le texte
 * seul porte déjà l'information.
 *
 * Le défilement tactile vient de `scroll-snap`, pas d'un gestionnaire de
 * geste : le navigateur le fait nativement.
 */
@Component({
  imports: [TraductionPipe, Icon],
  selector: 'app-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private readonly router = inject(Router);

  private readonly piste = viewChild<ElementRef<HTMLElement>>('piste');

  protected readonly diapositives: readonly Diapositive[] = [
    {
      icone: 'folder_open',
      titre: tr('onboardingTitre1', 'Tes cours éparpillés partout'),
      corps: tr(
        'onboardingCorps1',
        "WhatsApp, clés USB, groupes Telegram… retrouver un poly prend plus de temps que de l'étudier. Ce n'est plus acceptable.",
      ),
      accent: 'var(--soleil)',
      accentFonce: 'var(--soleil-deep)',
      encre: 'var(--soleil-encre)',
      badges: [{ label: 'WhatsApp' }, { label: 'USB' }],
    },
    {
      icone: 'library_books',
      titre: tr('onboardingTitre2', 'Une bibliothèque pour tout trouver'),
      corps: tr(
        'onboardingCorps2',
        'Cours, TD, synthèses, annales — tout est là, classé, trouvable en 2 secondes. Même sans connexion internet.',
      ),
      accent: 'var(--primary)',
      accentFonce: 'var(--primary-deep)',
      encre: 'var(--text-on-primary)',
      badges: [{ label: tr('biblioHorsLigne', 'Hors ligne') }, { label: tr('onboardingBadgeDeuxSec', '2 sec') }],
    },
    {
      icone: 'groups',
      titre: tr('onboardingTitre3', "Rejoins des milliers d'étudiants"),
      corps: tr(
        'onboardingCorps3',
        'NextLearn est gratuit, hors ligne, et pensé pour toi. Commence à apprendre mieux, dès maintenant.',
      ),
      accent: 'var(--tertiary)',
      accentFonce: 'var(--tertiary-deep)',
      encre: 'var(--text-on-primary)',
      badges: [{ label: tr('onboardingBadgeGratuit', 'Gratuit') }, { label: tr('onboardingBadgePourToi', 'Pour toi') }],
    },
  ];

  protected readonly index = signal(0);

  protected surDefilement(e: Event): void {
    const el = e.target as HTMLElement;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== this.index()) this.index.set(i);
  }

  protected allerA(i: number): void {
    const el = this.piste()?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  protected suivant(): void {
    const dernier = this.index() === this.diapositives.length - 1;
    if (dernier) {
      void this.router.navigate(['/app', AppRoutes.register]);
    } else {
      this.allerA(this.index() + 1);
    }
  }

  protected passer(): void {
    void this.router.navigate(['/app', AppRoutes.register]);
  }
}
