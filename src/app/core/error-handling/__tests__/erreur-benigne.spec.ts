import { describe, expect, it } from 'vitest';
import { estErreurBenigne } from '../utils/erreur-benigne';

describe('estErreurBenigne', () => {
  it('Safari : « Load failed » quand la feuille Partager suspend la page', () => {
    expect(estErreurBenigne(new TypeError('Load failed'), true)).toBe(true);
  });

  it('Chrome et Firefox : requête interrompue', () => {
    expect(estErreurBenigne(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(estErreurBenigne(new TypeError('NetworkError when attempting to fetch resource.'), true)).toBe(true);
    expect(estErreurBenigne(new DOMException('The operation was aborted.', 'AbortError'), true)).toBe(true);
  });

  it('réponse HTTP de statut 0 (réseau coupé)', () => {
    const e = Object.assign(new Error('Http failure response'), { name: 'HttpErrorResponse', status: 0 });
    expect(estErreurBenigne(e, true)).toBe(true);
  });

  it('une erreur HTTP réelle n’est pas du bruit', () => {
    const e = Object.assign(new Error('Http failure response: 500'), { name: 'HttpErrorResponse', status: 500 });
    expect(estErreurBenigne(e, true)).toBe(false);
  });

  it('tout ce qui échoue pendant que la page est en arrière-plan est ignoré', () => {
    expect(estErreurBenigne(new Error('quelque chose'), false)).toBe(true);
  });

  it('un vrai bogue reste fatal quand la page est visible', () => {
    expect(estErreurBenigne(new TypeError("Cannot read properties of undefined (reading 'x')"), true)).toBe(false);
    expect(estErreurBenigne('boom', true)).toBe(false);
    expect(estErreurBenigne(undefined, true)).toBe(false);
  });

  it('un module de code introuvable reste fatal : l’écran en dépend', () => {
    expect(estErreurBenigne(new TypeError('Failed to fetch dynamically imported module: /chunk-A.js'), true)).toBe(false);
    expect(estErreurBenigne(new TypeError('Importing a module script failed.'), true)).toBe(false);
  });
});
