import { validerPin } from './pin-policy';

/**
 * Ce que ce test protège : les trois familles de PIN faibles qu'on
 * écarte (liste noire, chiffre répété, suite), sans sur-bloquer un code
 * par ailleurs ordinaire — un faux refus serait aussi gênant qu'un vrai
 * code faible accepté.
 */
describe('validerPin', () => {
  it('accepte un PIN ordinaire', () => {
    expect(validerPin('2947')).toBeUndefined();
  });

  it('refuse un code de la liste noire', () => {
    expect(validerPin('1234')).toBeDefined();
  });

  it('refuse un chiffre répété', () => {
    expect(validerPin('7777')).toBeDefined();
  });

  it('refuse une suite croissante', () => {
    expect(validerPin('3456')).toBeDefined();
  });

  it('refuse une suite décroissante, y compris le passage 0→9', () => {
    expect(validerPin('1098')).toBeDefined();
  });

  it('refuse une longueur différente de 4', () => {
    expect(validerPin('123')).toBeDefined();
  });
});
