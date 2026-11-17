import { describe, expect, it } from 'vitest';
import { estErreurBenigne, estErreurChargementModule } from '../utils/erreur-benigne';

describe('estErreurBenigne', () => {
  it('Safari : « Load failed » quand la feuille Partager suspend la page', () => {
    expect(estErreurBenigne(new TypeError('Load failed'), true)).toBe(true);
    expect(estErreurBenigne(new TypeError('The Internet connection appears to be offline.'), true)).toBe(true);
  });

  it('Chrome et Firefox : requête interrompue', () => {
    expect(estErreurBenigne(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(estErreurBenigne(new TypeError('NetworkError when attempting to fetch resource.'), true)).toBe(true);
    expect(estErreurBenigne(new DOMException('The operation was aborted.', 'AbortError'), true)).toBe(true);
  });

  it('réponse HTTP de statut 0 (réseau coupé) et Failure réseau associé', () => {
    const e = Object.assign(new Error('Http failure response'), { name: 'HttpErrorResponse', status: 0 });
    expect(estErreurBenigne(e, true)).toBe(true);
    expect(estErreurBenigne(new Error('Le serveur met du temps à répondre. Réessayez.'), true)).toBe(true);
  });

  it('erreur de script tiers sans détail (« Script error. »)', () => {
    expect(estErreurBenigne(new Error('Script error.'), true)).toBe(true);
    expect(estErreurBenigne(new Error('An ErrorEvent with no error occurred.'), true)).toBe(true);
  });

  it('une erreur HTTP réelle n’est pas du bruit', () => {
    const e = Object.assign(new Error('Http failure response: 500'), { name: 'HttpErrorResponse', status: 500 });
    expect(estErreurBenigne(e, true)).toBe(false);
  });

  it('tout ce qui échoue pendant que la page est en arrière-plan est ignoré', () => {
    expect(estErreurBenigne(new Error('quelque chose'), false)).toBe(true);
    expect(estErreurBenigne(new TypeError('Importing a module script failed.'), false)).toBe(true);
  });

  it('un vrai bogue reste fatal quand la page est visible', () => {
    expect(estErreurBenigne(new TypeError("Cannot read properties of undefined (reading 'x')"), true)).toBe(false);
    expect(estErreurBenigne('boom', true)).toBe(false);
    expect(estErreurBenigne(undefined, true)).toBe(false);
  });

  it('un module de code introuvable reste non bénin quand la page est visible et est reconnu comme perte de module', () => {
    const dyn = new TypeError('Failed to fetch dynamically imported module: /chunk-A.js');
    const webkit = new TypeError('Importing a module script failed.');
    const htmlFallback = new SyntaxError("Unexpected token '<'");

    expect(estErreurBenigne(dyn, true)).toBe(false);
    expect(estErreurBenigne(webkit, true)).toBe(false);
    expect(estErreurBenigne(htmlFallback, true)).toBe(false);

    expect(estErreurChargementModule(dyn)).toBe(true);
    expect(estErreurChargementModule(webkit)).toBe(true);
    expect(estErreurChargementModule(htmlFallback)).toBe(true);
    expect(estErreurChargementModule(new Error('Autre bogue'))).toBe(false);
  });
});
