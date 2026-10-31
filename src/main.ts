import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationRef } from '@angular/core';
import { Router, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Durée minimale d'affichage de l'écran de démarrage.
 *
 * Sur un serveur local, l'application démarre si vite que l'écran de marque
 * n'apparaissait qu'un dixième de seconde — un clignotement, pas un écran de
 * lancement. Une seconde laisse le temps de le lire.
 */
const DUREE_MINIMALE_MS = 1000;

/** Au-delà, on retire l'écran quoi qu'il arrive : voir `retirerQuandPret`. */
const DELAI_DE_SECURITE_MS = 8000;

/** L'instant où la page a commencé à se peindre. */
const debut = Date.now();

/**
 * Retire l'écran de démarrage statique d'`index.html`.
 *
 * En fondu plutôt que d'un coup : la bascule brutale entre deux écrans de
 * couleurs différentes se voit comme un clignotement.
 */
function retirerEcranDeDemarrage(): void {
  const splash = document.getElementById('nl-splash');
  if (!splash) return;
  const restant = Math.max(0, DUREE_MINIMALE_MS - (Date.now() - debut));
  setTimeout(() => {
    splash.style.transition = 'opacity 260ms ease-out';
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 280);
  }, restant);
}

/**
 * Attend qu'un vrai écran soit affiché avant de retirer l'écran de démarrage.
 *
 * ## Le défaut corrigé
 *
 * Il était retiré dès que `bootstrapApplication` rendait la main. Or rendre
 * la main ne veut pas dire avoir peint quelque chose : la garde de routage
 * attend la restauration de session, et l'écran qu'elle désigne est chargé à
 * la demande. Entre les deux, **l'écran de marque disparaissait sur du
 * blanc** — deux secondes de page vide mesurées en développement, avant que
 * l'onboarding n'apparaisse.
 *
 * L'écran de démarrage tient donc jusqu'à la première navigation réellement
 * terminée. C'est lui, et non le composant `Splash`, qui fait l'écran de
 * lancement : ce dernier est chargé à la demande et son morceau arrive après
 * la fin de l'initialisation — il n'avait jamais le temps d'être peint.
 *
 * ## Le délai de sécurité
 *
 * Si aucune navigation n'aboutit — garde bloquée, morceau introuvable —,
 * l'écran de marque resterait indéfiniment par-dessus l'erreur qu'il faudrait
 * justement lire. Il tombe alors de lui-même.
 */
function retirerQuandPret(app: ApplicationRef): void {
  setTimeout(retirerEcranDeDemarrage, DELAI_DE_SECURITE_MS);
  try {
    const router = app.injector.get(Router);
    router.events
      .pipe(
        filter(
          (e) =>
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
        take(1),
      )
      .subscribe(() => retirerEcranDeDemarrage());
  } catch {
    // Pas de routeur : rien à attendre.
    retirerEcranDeDemarrage();
  }
}

bootstrapApplication(App, appConfig)
  .then(retirerQuandPret)
  .catch((err) => {
    console.error(err);
    // Un écran de marque posé par-dessus une erreur fatale cache précisément
    // ce qu'il faudrait lire.
    retirerEcranDeDemarrage();
  });
