import { validerPin } from './pin-policy';

/**
 * Seul le format est contrôlé : l'utilisateur choisit librement son code,
 * y compris « 1234 », « 0000 » ou une suite.
 */
describe('validerPin', () => {
  it('accepte tout PIN de 4 chiffres, même courant', () => {
    for (const pin of ['2947', '1234', '0000', '7777', '3456', '4321']) {
      expect(validerPin(pin)).toBeUndefined();
    }
  });

  it('refuse une longueur différente de 4', () => {
    expect(validerPin('123')).toBeDefined();
    expect(validerPin('12345')).toBeDefined();
  });

  it('refuse ce qui n’est pas un chiffre', () => {
    expect(validerPin('12a4')).toBeDefined();
  });
});
