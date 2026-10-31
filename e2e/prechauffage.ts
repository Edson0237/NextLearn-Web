import { chromium } from '@playwright/test';

/**
 * Chauffe le serveur de développement avant la suite.
 *
 * Le serveur répond dès qu'il écoute, mais Vite ne compile chaque morceau
 * chargé à la demande qu'au moment où un navigateur le réclame. Le premier
 * test à ouvrir une route payait donc sa compilation, et dépassait son
 * délai : la suite échouait à sept tests sur treize, puis à quatre, sur un
 * démarrage à froid seulement. L'échec intermittent dans ce qu'il a de pire,
 * puisqu'il accuse le code testé.
 *
 * **Une requête HTTP ne suffit pas** : sur une application à page unique,
 * `GET /app/unlock` rend `index.html` et rien d'autre - aucun morceau n'est
 * demandé, donc aucun n'est compilé. C'est ce que faisait la version
 * précédente de ce fichier, qui chauffait donc cinq fois la même page
 * d'accueil en croyant chauffer cinq routes.
 *
 * Il faut un vrai navigateur : lui seul exécute le code d'amorçage, suit les
 * imports dynamiques du routeur et force la compilation des écrans.
 */
export default async function prechauffer(): Promise<void> {
  /** Les routes que la suite visite, la plus lourde en dernier. */
  const routes = [
    '/',
    '/app/login',
    '/app/register',
    '/app/unlock',
    // Le lecteur embarque pdf.js : de loin le plus long à compiler.
    '/app/bibliotheque/doc/test-doc/read',
  ];

  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({ serviceWorkers: 'block' });
  const page = await contexte.newPage();

  for (const chemin of routes) {
    try {
      // `networkidle` plutôt que `load` : c'est l'arrivée des morceaux qu'on
      // attend, et ils sont demandés après le premier rendu.
      await page.goto(`http://localhost:4200${chemin}`, {
        waitUntil: 'networkidle',
        timeout: 120_000,
      });
    } catch {
      // Une route qui ne chauffe pas n'est pas une raison d'arrêter la
      // suite : les tests le diront mieux, et avec leur propre message.
    }
  }

  await navigateur.close();
}
