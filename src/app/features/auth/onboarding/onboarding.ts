import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AppRoutes } from '../../../core/router/app-routes';

interface Badge {
  readonly label: string;
}

interface Diapositive {
  readonly emoji: string;
  readonly titre: string;
  readonly corps: string;
  readonly accent: string;
  readonly accentFonce: string;
  readonly badges: readonly Badge[];
}

/**
 * Présentation initiale — traduction d'`OnboardingPage`
 * (`lib/domains/auth/presentation/pages/onboarding/onboarding_page.dart`).
 *
 * **Palette gelée, comme côté Flutter** : ces trois diapositives gardent
 * leurs teintes d'origine (bleu vif, ambre, émeraude), pas celles de
 * `_tokens.scss` — le commentaire source est explicite : « ne pas
 * remplacer par AppColors sans revalider le rendu ». D'où un bouton en
 * HTML brut ici plutôt que `nlButton`, dont la couleur suit `--primary`.
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
      emoji: '😤',
      titre: 'Tes cours éparpillés partout',
      corps: "WhatsApp, clés USB, groupes Telegram… retrouver un poly prend plus de temps que de l'étudier. Ce n'est plus acceptable.",
      accent: '#f59e0b',
      accentFonce: '#b45309',
      badges: [{ label: 'WhatsApp' }, { label: 'USB' }],
    },
    {
      emoji: '📚',
      titre: 'Une bibliothèque pour tout trouver',
      corps: 'Cours, TD, synthèses, annales — tout est là, classé, trouvable en 2 secondes. Même sans connexion internet.',
      accent: '#1a6fbf',
      accentFonce: '#0b3b73',
      badges: [{ label: 'Hors ligne' }, { label: '2 sec' }],
    },
    {
      emoji: '🎯',
      titre: "Rejoins des milliers d'étudiants",
      corps: 'NextLearn est gratuit, hors ligne, et pensé pour toi. Commence à apprendre mieux, dès maintenant.',
      accent: '#16b981',
      accentFonce: '#0d7a56',
      badges: [{ label: 'Gratuit' }, { label: 'Pour toi' }],
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
