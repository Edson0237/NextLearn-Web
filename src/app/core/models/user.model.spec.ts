import { Cycle, NiveauEtude, libelleNiveau, niveauDepuisTexte, utilisateurDepuisApi } from './user.model';

/**
 * Ce que ce test protège : la tolérance à l'ancienne notation (L1..M2),
 * sans laquelle un compte créé avant la migration du référentiel niveau
 * ne pourrait plus se reconnaître — et le libellé par cycle, qui désambiguïse
 * un niveau par ailleurs muet (« N4 » seul ne dit rien).
 */
describe('niveauDepuisTexte', () => {
  it('reconnaît la notation actuelle', () => {
    expect(niveauDepuisTexte('n3')).toBe(NiveauEtude.n3);
  });

  it('tolère l’ancienne notation L1..M2', () => {
    expect(niveauDepuisTexte('M1')).toBe(NiveauEtude.n4);
    expect(niveauDepuisTexte('L3')).toBe(NiveauEtude.n3);
  });

  it('retombe sur N1 pour une valeur inconnue', () => {
    expect(niveauDepuisTexte('???')).toBe(NiveauEtude.n1);
  });
});

describe('libelleNiveau', () => {
  it('diffère selon le cycle pour le même rang', () => {
    expect(libelleNiveau(NiveauEtude.n4, Cycle.master)).toBe('Master 1');
    expect(libelleNiveau(NiveauEtude.n4, Cycle.ingenieur)).toBe('Ingénieur 4');
  });

  it('retombe sur « Niveau N » sans cycle connu', () => {
    expect(libelleNiveau(NiveauEtude.n2)).toBe('Niveau 2');
  });
});

describe('utilisateurDepuisApi', () => {
  it('tolère les champs manquants sans lever', () => {
    const u = utilisateurDepuisApi({ id: '1', email: 'a@b.cm' });
    expect(u.nom).toBe('');
    expect(u.niveau).toBe(NiveauEtude.n1);
  });
});
