// Chargé avant chaque fichier de test (voir angular.json, `test.options.setupFiles`).
//
// jsdom, l'environnement DOM des tests, n'implémente ni `IntersectionObserver`
// ni `window.matchMedia`. Les deux manquent pour la même raison — jsdom
// simule le DOM, pas le moteur de rendu qui calculerait un vrai résultat de
// défilement ou de media query — et les deux cassaient la simple
// instanciation de composants qui n'ont rien à voir avec le portage PWA :
// cinq composants de la vitrine (about, accueil, contact, equipe,
// fonctionnalite) observent le défilement pour leur animation de révélation,
// et `Vitrine.initializeCursorGlow` interroge `(pointer: fine)` pour savoir
// si l'appareil a une souris.
//
// Aucun des deux substituts n'observe ou ne mesure quoi que ce soit
// réellement : un test de composant n'a pas de vrai défilement ni de vrai
// pointeur à détecter, il lui suffit que l'API existe pour ne pas lever.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserverStub }).IntersectionObserver =
    IntersectionObserverStub;
}

if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof globalThis.matchMedia;
}
