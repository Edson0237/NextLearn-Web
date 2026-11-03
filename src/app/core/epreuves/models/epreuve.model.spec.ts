import { TypeEpreuve, typeEpreuveCle, typeEpreuveCourt, typeEpreuveDepuisApi, typeEpreuveVersApi, epreuveDepuisJson, dureeValide, anneeAcademiqueValide } from './epreuve.model';

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

describe('durée facultative — jamais « 0 min »', () => {
  const base = { _id: 'e1', annee: 2023, niveau: 'N3', universiteId: { nom: 'SJI' }, matiereId: { _id: 'm', nom: 'Algo' } };

  it.each([[undefined], [null], [''], [0], ['0'], [-3], ['abc'], [NaN]])('durée %p → inconnue (undefined), pas 0', (v) => {
    const e = epreuveDepuisJson({ ...base, dureeMinutes: v });
    expect(e.dureeMinutes).toBeUndefined();
  });

  it('une durée renseignée est conservée (nombre ou chaîne)', () => {
    expect(epreuveDepuisJson({ ...base, dureeMinutes: 120 }).dureeMinutes).toBe(120);
    expect(epreuveDepuisJson({ ...base, dureeMinutes: '90' }).dureeMinutes).toBe(90);
    expect(dureeValide(119)).toBe(119);
  });

  it('une épreuve sans durée se lit sans erreur, avec le reste intact', () => {
    const e = epreuveDepuisJson({ ...base, dureeMinutes: null, typeEpreuve: 'RATTRAPAGE' });
    expect(e).toMatchObject({ id: 'e1', annee: 2023, niveau: 'N3', typeEpreuve: TypeEpreuve.rattrapage });
  });
});

describe('anneeAcademique', () => {
  const base = { _id: 'e1', annee: 2023, niveau: 'N3' };
  it('lue quand elle est valide et cohérente', () => {
    expect(epreuveDepuisJson({ ...base, anneeAcademique: '2023-2024' }).anneeAcademique).toBe('2023-2024');
  });
  it.each([[undefined], [null], [''], ['2023'], ['2023-2025'], ['abc']])('%p → absente', (v) => {
    expect(epreuveDepuisJson({ ...base, anneeAcademique: v }).anneeAcademique).toBeUndefined();
    expect(anneeAcademiqueValide(v)).toBeUndefined();
  });
  it('l’année numérique reste lue telle quelle (anciennes épreuves incluses)', () => {
    expect(epreuveDepuisJson({ ...base, annee: 2022 }).annee).toBe(2022);
  });
});
