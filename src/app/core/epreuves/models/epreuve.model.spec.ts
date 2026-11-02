import { TypeEpreuve, typeEpreuveCle, typeEpreuveCourt, typeEpreuveDepuisApi, typeEpreuveVersApi } from './epreuve.model';

describe('TypeEpreuve - rattrapage', () => {
  it('se lit depuis l’API', () => {
    expect(typeEpreuveDepuisApi('RATTRAPAGE')).toBe(TypeEpreuve.rattrapage);
    expect(typeEpreuveDepuisApi(' rattrapage ')).toBe(TypeEpreuve.rattrapage);
  });

  it('les valeurs existantes sont inchangées', () => {
    expect(typeEpreuveDepuisApi('CC')).toBe(TypeEpreuve.cc);
    expect(typeEpreuveDepuisApi('SN')).toBe(TypeEpreuve.sn);
  });

  it('une valeur absente ou inconnue ne devient jamais un type', () => {
    expect(typeEpreuveDepuisApi(undefined)).toBeUndefined();
    expect(typeEpreuveDepuisApi(null)).toBeUndefined();
    expect(typeEpreuveDepuisApi('')).toBeUndefined();
    expect(typeEpreuveDepuisApi('RAT')).toBeUndefined();
    expect(typeEpreuveDepuisApi('AUTRE')).toBeUndefined();
  });

  it('retourne vers l’API la valeur que le serveur attend', () => {
    expect(typeEpreuveVersApi(TypeEpreuve.rattrapage)).toBe('RATTRAPAGE');
    expect(typeEpreuveVersApi(TypeEpreuve.cc)).toBe('CC');
    expect(typeEpreuveVersApi(TypeEpreuve.sn)).toBe('SN');
  });

  it('a un libellé court et une clé de traduction', () => {
    expect(typeEpreuveCourt(TypeEpreuve.rattrapage)).toBe('RAT');
    expect(typeEpreuveCle(TypeEpreuve.rattrapage)).toBe('epreuveTypeRat');
    expect(typeEpreuveCle(TypeEpreuve.cc)).toBe('epreuveTypeCc');
    expect(typeEpreuveCle(TypeEpreuve.sn)).toBe('epreuveTypeSn');
  });
});
