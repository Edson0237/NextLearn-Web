import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Écran de marque — traduction de `SplashPage`
 * (`lib/domains/auth/presentation/pages/splash/splash_page.dart`). Le
 * routeur applicatif (`authGuard`) gère seul la redirection pendant que
 * `AuthService.init()` restaure la session ; cet écran n'est que
 * l'animation d'entrée.
 *
 * L'entrée (350 ms, logo qui dépasse légèrement l'échelle avant de se
 * poser) est en CSS pur plutôt qu'un `AnimationController` : une
 * `@keyframes` suffit, et `prefers-reduced-motion` la coupe déjà via les
 * variables de `_motion.scss` — aucune détection à écrire côté TypeScript.
 */
@Component({
  selector: 'app-splash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-splash">
      <img class="nl-splash__logo" src="/images/Logo.png" alt="NextLearn" width="220" />
      <p class="nl-splash__accroche">Toute ta bibliothèque académique, à portée de recherche</p>
    </div>
  `,
  styleUrl: './splash.scss',
})
export class Splash {}
