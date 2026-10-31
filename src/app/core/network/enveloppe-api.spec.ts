import { donnees, donneesUtilisateur } from './enveloppe-api';

describe('enveloppe de l’API', () => {
  it('ouvre l’enveloppe { data }', () => {
    expect(donnees({ data: { a: 1 } })).toEqual({ a: 1 });
  });

  it('rend une réponse déjà à plat telle quelle', () => {
    expect(donnees({ a: 1 })).toEqual({ a: 1 });
  });

  it('rend un objet vide pour une réponse vide ou illisible', () => {
    expect(donnees(null)).toEqual({});
    expect(donnees('texte')).toEqual({});
    expect(donnees(undefined)).toEqual({});
  });

  it('trouve le profil sous data.user, ou directement sous data', () => {
    expect(donneesUtilisateur({ data: { user: { id: 'u1' } } })).toEqual({ id: 'u1' });
    expect(donneesUtilisateur({ data: { id: 'u2' } })).toEqual({ id: 'u2' });
  });
});
